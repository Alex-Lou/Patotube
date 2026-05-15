// Resolves a YouTube video_id to a directly playable HTTPS URL.
// Used by the in-app preview player — NOT for downloading (the
// downloader path picks higher-quality adaptive streams). We
// deliberately target the legacy `formats[]` (combined audio+video
// in a single MP4 H.264/AAC stream) because every WebView on every
// platform plays it without DASH/HLS plumbing.
//
// Client preference is ANDROID_VR → IOS → ANDROID: these return
// `url` directly (no signatureCipher), so no sigcipher round-trip
// and the URL works against the CDN with whatever User-Agent the
// WebView ships.

use super::clients::default_clients;
use super::player_api::call_player_api;
use super::types::Format;

#[derive(Debug, Clone)]
pub struct ResolvedStream {
    pub url: String,
    /// User-Agent of the client that produced this URL. The CDN
    /// validates UA on signed URLs, so the proxy MUST replay this
    /// when fetching upstream — not the WebView's UA.
    pub user_agent: String,
}

pub async fn fetch_combined_stream(video_id: &str) -> Result<String, String> {
    Ok(resolve(video_id).await?.url)
}

pub async fn resolve(video_id: &str) -> Result<ResolvedStream, String> {
    if video_id.is_empty() {
        return Err("empty video id".into());
    }
    let mut last_err: Option<String> = None;
    for client in default_clients() {
        match call_player_api(client, video_id).await {
            Ok(resp) => {
                let playable = resp
                    .playability_status
                    .as_ref()
                    .and_then(|s| s.status.as_deref())
                    .map(|s| s == "OK")
                    .unwrap_or(true);
                if !playable {
                    let reason = resp
                        .playability_status
                        .as_ref()
                        .and_then(|s| s.reason.clone())
                        .unwrap_or_else(|| "unplayable".into());
                    last_err = Some(format!("{}: {reason}", client.name));
                    continue;
                }
                let Some(streaming) = resp.streaming_data else {
                    last_err = Some(format!("{}: no streaming data", client.name));
                    continue;
                };
                if let Some(url) = pick_best_combined(&streaming.formats) {
                    return Ok(ResolvedStream {
                        url,
                        user_agent: client.user_agent.to_string(),
                    });
                }
                last_err = Some(format!("{}: no combined format", client.name));
            }
            Err(e) => {
                last_err = Some(format!("{}: {e}", client.name));
            }
        }
    }
    Err(last_err.unwrap_or_else(|| "all clients failed".into()))
}

fn pick_best_combined(formats: &[Format]) -> Option<String> {
    formats
        .iter()
        .filter(|f| f.url.is_some())
        .filter(|f| {
            f.mime_type
                .as_deref()
                .is_some_and(|m| m.starts_with("video/mp4"))
        })
        .max_by_key(|f| f.height)
        .and_then(|f| f.url.clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fmt(url: Option<&str>, mime: Option<&str>, h: u32) -> Format {
        Format {
            url: url.map(String::from),
            signature_cipher: None,
            mime_type: mime.map(String::from),
            height: h,
            content_length: None,
            average_bitrate: None,
            audio_quality: None,
        }
    }

    #[test]
    fn picks_highest_mp4_with_direct_url() {
        let v = vec![
            fmt(Some("https://a"), Some("video/mp4; codecs=\"avc1\""), 360),
            fmt(Some("https://b"), Some("video/mp4; codecs=\"avc1\""), 720),
            fmt(Some("https://c"), Some("video/webm; codecs=\"vp9\""), 1080),
        ];
        assert_eq!(pick_best_combined(&v).as_deref(), Some("https://b"));
    }

    #[test]
    fn skips_signature_cipher_only_formats() {
        let v = vec![fmt(None, Some("video/mp4"), 720)];
        assert!(pick_best_combined(&v).is_none());
    }

    #[test]
    fn empty_formats_returns_none() {
        assert!(pick_best_combined(&[]).is_none());
    }
}
