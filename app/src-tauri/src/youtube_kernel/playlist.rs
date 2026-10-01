// YouTube playlist listing via the public youtubei/v1/browse endpoint
// (same transport as search.rs). Always compiled: the desktop app lists
// playlists the same way, then downloads each video as a normal job.

use serde::Serialize;
use serde_json::{json, Value};
use url::Url;

use super::clients::find_client;
use super::search::{extract_runs, parse_duration, SearchResult};

const KEYED_ENDPOINT: &str = "https://youtubei.googleapis.com/youtubei/v1/browse";
const UNKEYED_ENDPOINT: &str = "https://www.youtube.com/youtubei/v1/browse";

/// Most videos a playlist can queue at once. Enough for a season of
/// episodes, small enough not to get the client throttled.
pub const MAX_PLAYLIST_ITEMS: usize = 25;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistInfo {
    pub id: String,
    pub title: String,
    pub entries: Vec<SearchResult>,
    /// The playlist has more than MAX_PLAYLIST_ITEMS videos.
    pub truncated: bool,
}

/// Playlist id from a YouTube URL (`/playlist?list=…` or `/watch?…&list=…`).
/// Mixes (`RD…`) are generated per viewer and endless, and liked / watch
/// later lists are private: none of them can be listed, so they are
/// rejected with a readable error.
pub fn playlist_id(raw: &str) -> Result<String, String> {
    let url = Url::parse(raw.trim()).map_err(|_| "not a URL".to_string())?;
    let host = url.host_str().unwrap_or_default().to_ascii_lowercase();
    let is_youtube = host == "youtube.com" || host.ends_with(".youtube.com");
    if !is_youtube {
        return Err("not a YouTube URL".into());
    }
    let id = url
        .query_pairs()
        .find(|(k, _)| k == "list")
        .map(|(_, v)| v.into_owned())
        .filter(|v| !v.is_empty())
        .ok_or_else(|| "this URL has no playlist".to_string())?;
    if id.starts_with("RD") {
        return Err("YouTube mixes can't be downloaded as a playlist".into());
    }
    if id == "LL" || id == "WL" {
        return Err("this playlist is private".into());
    }
    if !id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-') {
        return Err("invalid playlist id".into());
    }
    Ok(id)
}

pub async fn fetch(url: &str) -> Result<PlaylistInfo, String> {
    let id = playlist_id(url)?;
    let client = find_client("WEB").ok_or_else(|| "WEB client missing".to_string())?;
    let http = reqwest::Client::builder()
        .user_agent(client.user_agent)
        .connect_timeout(std::time::Duration::from_secs(15))
        .timeout(std::time::Duration::from_secs(30))
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
        "browseId": format!("VL{id}"),
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
        .map_err(|e| format!("could not parse youtube playlist response: {e}"))?;

    let info = parse_playlist(&id, &json);
    if info.entries.is_empty() {
        return Err("this playlist is empty, private or unavailable".into());
    }
    Ok(info)
}

fn parse_playlist(id: &str, json: &Value) -> PlaylistInfo {
    let title = json
        .pointer("/metadata/playlistMetadataRenderer/title")
        .and_then(Value::as_str)
        .map(String::from)
        .or_else(|| {
            json.pointer("/header/playlistHeaderRenderer/title/simpleText")
                .and_then(Value::as_str)
                .map(String::from)
        })
        .unwrap_or_else(|| "Playlist".to_string());

    // The renderers sit several wrappers deep and YouTube reshuffles the
    // wrappers often: walk the whole tree for the item renderer instead.
    let mut renderers = Vec::new();
    collect_renderers(json, "playlistVideoRenderer", &mut renderers);

    let mut entries: Vec<SearchResult> =
        renderers.into_iter().filter_map(parse_entry).collect();
    let truncated = entries.len() > MAX_PLAYLIST_ITEMS || has_continuation(json);
    entries.truncate(MAX_PLAYLIST_ITEMS);

    PlaylistInfo { id: id.to_string(), title, entries, truncated }
}

fn collect_renderers<'a>(v: &'a Value, key: &str, out: &mut Vec<&'a Value>) {
    match v {
        Value::Object(map) => {
            for (k, child) in map {
                if k == key {
                    out.push(child);
                } else {
                    collect_renderers(child, key, out);
                }
            }
        }
        Value::Array(items) => items.iter().for_each(|i| collect_renderers(i, key, out)),
        _ => {}
    }
}

fn has_continuation(v: &Value) -> bool {
    let mut found = Vec::new();
    collect_renderers(v, "continuationItemRenderer", &mut found);
    !found.is_empty()
}

fn parse_entry(v: &Value) -> Option<SearchResult> {
    // Deleted / private videos stay in the list but cannot be played.
    if v.get("isPlayable").and_then(Value::as_bool) == Some(false) {
        return None;
    }
    let video_id = v.get("videoId")?.as_str()?.to_string();
    let title = extract_runs(v.pointer("/title/runs"))
        .or_else(|| v.pointer("/title/simpleText").and_then(Value::as_str).map(String::from))?;
    let channel = extract_runs(v.pointer("/shortBylineText/runs")).unwrap_or_default();
    let duration_seconds = v
        .get("lengthSeconds")
        .and_then(Value::as_str)
        .and_then(|s| s.parse().ok())
        .or_else(|| v.pointer("/lengthText/simpleText").and_then(Value::as_str).and_then(parse_duration));
    let thumbnail_url = v
        .pointer("/thumbnail/thumbnails")
        .and_then(Value::as_array)
        .and_then(|arr| arr.last())
        .and_then(|t| t.get("url"))
        .and_then(Value::as_str)
        .map(String::from)
        .unwrap_or_else(|| format!("https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"));
    Some(SearchResult {
        video_id,
        title,
        channel,
        duration_seconds,
        thumbnail_url,
        view_count: None,
        published: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn playlist_id_from_playlist_and_watch_urls() {
        assert_eq!(
            playlist_id("https://www.youtube.com/playlist?list=PLabc_123-x").unwrap(),
            "PLabc_123-x"
        );
        assert_eq!(
            playlist_id("https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=PLxyz&index=3").unwrap(),
            "PLxyz"
        );
    }

    #[test]
    fn playlist_id_rejects_mixes_private_lists_and_other_sites() {
        assert!(playlist_id("https://www.youtube.com/watch?v=x&list=RDdQw4w9WgXcQ")
            .unwrap_err()
            .contains("mixes"));
        assert!(playlist_id("https://www.youtube.com/playlist?list=WL").is_err());
        assert!(playlist_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ").is_err());
        assert!(playlist_id("https://example.com/playlist?list=PLabc").is_err());
        assert!(playlist_id("https://www.youtube.com/playlist?list=PL%2F..%2F").is_err());
    }

    fn item(id: &str, title: &str, secs: &str) -> Value {
        json!({ "playlistVideoRenderer": {
            "videoId": id,
            "title": { "runs": [{ "text": title }] },
            "shortBylineText": { "runs": [{ "text": "Channel" }] },
            "lengthSeconds": secs,
            "thumbnail": { "thumbnails": [{ "url": "small" }, { "url": "big" }] }
        }})
    }

    fn page(items: Vec<Value>) -> Value {
        json!({
            "metadata": { "playlistMetadataRenderer": { "title": "My season" } },
            "contents": { "twoColumnBrowseResultsRenderer": { "tabs": [{ "tabRenderer": {
                "content": { "sectionListRenderer": { "contents": [{ "itemSectionRenderer": {
                    "contents": [{ "playlistVideoListRenderer": { "contents": items } }]
                }}]}}
            }}]}}
        })
    }

    #[test]
    fn parses_entries_in_order() {
        let p = parse_playlist("PL1", &page(vec![item("aaaaaaaaaaa", "Ep 1", "1500"), item("bbbbbbbbbbb", "Ep 2", "1620")]));
        assert_eq!(p.title, "My season");
        assert_eq!(p.entries.len(), 2);
        assert_eq!(p.entries[0].video_id, "aaaaaaaaaaa");
        assert_eq!(p.entries[0].title, "Ep 1");
        assert_eq!(p.entries[0].channel, "Channel");
        assert_eq!(p.entries[0].duration_seconds, Some(1500));
        assert_eq!(p.entries[0].thumbnail_url, "big");
        assert!(!p.truncated);
    }

    #[test]
    fn skips_unplayable_videos() {
        let mut gone = item("ccccccccccc", "[Private video]", "0");
        gone["playlistVideoRenderer"]["isPlayable"] = json!(false);
        let p = parse_playlist("PL1", &page(vec![gone, item("aaaaaaaaaaa", "Ep 1", "60")]));
        assert_eq!(p.entries.len(), 1);
        assert_eq!(p.entries[0].video_id, "aaaaaaaaaaa");
    }

    #[test]
    fn caps_long_playlists() {
        let items = (0..30).map(|i| item(&format!("id{i:09}"), &format!("Ep {i}"), "60")).collect();
        let p = parse_playlist("PL1", &page(items));
        assert_eq!(p.entries.len(), MAX_PLAYLIST_ITEMS);
        assert!(p.truncated);
    }

    #[test]
    fn continuation_marks_the_list_as_truncated() {
        let mut j = page(vec![item("aaaaaaaaaaa", "Ep 1", "60")]);
        j["contents"]["x"] = json!({ "continuationItemRenderer": {} });
        assert!(parse_playlist("PL1", &j).truncated);
    }
}
