// YouTube search via the public youtubei/v1/search endpoint. Same
// transport as player_api.rs, just a different payload + response
// shape. Always compiled — works on desktop and Android.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::clients::find_client;

const KEYED_ENDPOINT: &str = "https://youtubei.googleapis.com/youtubei/v1/search";
const UNKEYED_ENDPOINT: &str = "https://www.youtube.com/youtubei/v1/search";

// EgIQAQ%3D%3D = base64-encoded protobuf filter "videos only" (no
// channels / playlists / mixes in the results). Same constant
// yt-dlp uses for `ytsearch:`.
const FILTER_VIDEOS_ONLY: &str = "EgIQAQ%3D%3D";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub video_id: String,
    pub title: String,
    pub channel: String,
    pub duration_seconds: Option<u32>,
    pub thumbnail_url: String,
    pub view_count: Option<u64>,
    pub published: Option<String>,
}

pub async fn search(query: &str, limit: usize) -> Result<Vec<SearchResult>, String> {
    let q = query.trim();
    if q.is_empty() {
        return Ok(Vec::new());
    }

    // WEB client returns the richest renderer (channel + views +
    // publishedTimeText). Search doesn't go through signature
    // cipher so the WEB-specific drawbacks don't apply.
    let client = find_client("WEB").ok_or_else(|| "WEB client missing".to_string())?;

    let http = reqwest::Client::builder()
        .user_agent(client.user_agent)
        .build()
        .map_err(|e| format!("could not build http client: {e}"))?;

    let body = json!({
        "context": {
            "client": {
                "clientName": client.name,
                "clientVersion": client.version,
                "hl": "en",
                "gl": "US",
                "userAgent": client.user_agent,
            }
        },
        "query": q,
        "params": FILTER_VIDEOS_ONLY,
    });

    let endpoint = if client.api_key.is_empty() {
        UNKEYED_ENDPOINT.to_string()
    } else {
        format!("{KEYED_ENDPOINT}?key={}", client.api_key)
    };

    let resp = http
        .post(&endpoint)
        .header("X-YouTube-Client-Name", client.client_id)
        .header("X-YouTube-Client-Version", client.version)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("network error contacting youtube: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("youtube returned status {}", resp.status()));
    }

    let json: Value = resp
        .json()
        .await
        .map_err(|e| format!("could not parse youtube search response: {e}"))?;

    Ok(parse_results(&json, limit))
}

fn parse_results(json: &Value, limit: usize) -> Vec<SearchResult> {
    let Some(sections) = json
        .pointer("/contents/twoColumnSearchResultsRenderer/primaryContents/sectionListRenderer/contents")
        .and_then(Value::as_array)
    else {
        return Vec::new();
    };

    let mut out = Vec::with_capacity(limit);
    for section in sections {
        let Some(items) = section
            .pointer("/itemSectionRenderer/contents")
            .and_then(Value::as_array)
        else {
            continue;
        };
        for item in items {
            if let Some(v) = item.get("videoRenderer") {
                if let Some(r) = parse_video_renderer(v) {
                    out.push(r);
                    if out.len() >= limit {
                        return out;
                    }
                }
            }
        }
    }
    out
}

fn parse_video_renderer(v: &Value) -> Option<SearchResult> {
    let video_id = v.get("videoId")?.as_str()?.to_string();

    let title = extract_runs(v.pointer("/title/runs"))
        .or_else(|| v.pointer("/title/simpleText").and_then(|s| s.as_str()).map(String::from))?;

    let channel = extract_runs(v.pointer("/ownerText/runs"))
        .or_else(|| extract_runs(v.pointer("/longBylineText/runs")))
        .unwrap_or_default();

    let duration_seconds = v
        .pointer("/lengthText/simpleText")
        .and_then(Value::as_str)
        .and_then(parse_duration);

    let thumbnail_url = v
        .pointer("/thumbnail/thumbnails")
        .and_then(Value::as_array)
        .and_then(|arr| arr.last())
        .and_then(|t| t.get("url"))
        .and_then(Value::as_str)
        .map(String::from)
        .unwrap_or_else(|| format!("https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"));

    let view_count = v
        .pointer("/viewCountText/simpleText")
        .and_then(Value::as_str)
        .and_then(parse_view_count);

    let published = v
        .pointer("/publishedTimeText/simpleText")
        .and_then(Value::as_str)
        .map(String::from);

    Some(SearchResult {
        video_id,
        title,
        channel,
        duration_seconds,
        thumbnail_url,
        view_count,
        published,
    })
}

fn extract_runs(runs: Option<&Value>) -> Option<String> {
    let arr = runs?.as_array()?;
    let mut s = String::new();
    for r in arr {
        if let Some(t) = r.get("text").and_then(Value::as_str) {
            s.push_str(t);
        }
    }
    if s.is_empty() {
        None
    } else {
        Some(s)
    }
}

// "3:45" or "1:23:45" → seconds. None on parse failure / empty.
fn parse_duration(s: &str) -> Option<u32> {
    if s.is_empty() {
        return None;
    }
    let mut total: u32 = 0;
    for part in s.split(':') {
        let n: u32 = part.parse().ok()?;
        total = total.checked_mul(60)?.checked_add(n)?;
    }
    Some(total)
}

// "1,234,567 views" → 1234567. Returns None for non-numeric strings
// like "No views" or shortened forms like "12K views" (acceptable —
// we just won't render the count for those).
fn parse_view_count(s: &str) -> Option<u64> {
    let digits: String = s.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.is_empty() {
        None
    } else {
        digits.parse().ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_duration_handles_hms() {
        assert_eq!(parse_duration("45"), Some(45));
        assert_eq!(parse_duration("3:45"), Some(225));
        assert_eq!(parse_duration("1:23:45"), Some(5025));
    }

    #[test]
    fn parse_duration_rejects_garbage() {
        assert_eq!(parse_duration(""), None);
        assert_eq!(parse_duration("foo"), None);
        assert_eq!(parse_duration("3:foo"), None);
    }

    #[test]
    fn parse_view_count_strips_commas_and_suffix() {
        assert_eq!(parse_view_count("1,234,567 views"), Some(1234567));
        assert_eq!(parse_view_count("42 views"), Some(42));
        assert_eq!(parse_view_count("No views"), None);
    }

    #[test]
    fn parse_results_returns_empty_on_unexpected_shape() {
        let v: Value = serde_json::from_str(r#"{"foo":"bar"}"#).unwrap();
        assert!(parse_results(&v, 10).is_empty());
    }

    #[test]
    fn parse_video_renderer_extracts_core_fields() {
        let v: Value = serde_json::from_str(
            r#"{
                "videoId": "abc123",
                "title": { "runs": [{ "text": "Hello " }, { "text": "World" }] },
                "ownerText": { "runs": [{ "text": "Some Channel" }] },
                "lengthText": { "simpleText": "3:14" },
                "viewCountText": { "simpleText": "1,000 views" },
                "publishedTimeText": { "simpleText": "2 days ago" },
                "thumbnail": { "thumbnails": [
                    { "url": "https://i.ytimg.com/vi/abc123/default.jpg" },
                    { "url": "https://i.ytimg.com/vi/abc123/hqdefault.jpg" }
                ] }
            }"#,
        )
        .unwrap();
        let r = parse_video_renderer(&v).expect("should parse");
        assert_eq!(r.video_id, "abc123");
        assert_eq!(r.title, "Hello World");
        assert_eq!(r.channel, "Some Channel");
        assert_eq!(r.duration_seconds, Some(194));
        assert_eq!(r.view_count, Some(1000));
        assert_eq!(r.published.as_deref(), Some("2 days ago"));
        assert!(r.thumbnail_url.ends_with("hqdefault.jpg"));
    }

    #[test]
    fn parse_video_renderer_falls_back_to_constructed_thumbnail() {
        let v: Value = serde_json::from_str(
            r#"{
                "videoId": "xyz",
                "title": { "simpleText": "T" }
            }"#,
        )
        .unwrap();
        let r = parse_video_renderer(&v).expect("should parse");
        assert_eq!(r.thumbnail_url, "https://i.ytimg.com/vi/xyz/hqdefault.jpg");
    }
}
