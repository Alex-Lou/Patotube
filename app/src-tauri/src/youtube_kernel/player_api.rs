// has_metadata / has_combined_video / has_audio_only are used by
// the Android-gated downloader path; on desktop only call_player_api
// is reached (via stream_url.rs).
#![allow(dead_code)]

use serde_json::{json, Value};

use super::clients::ClientProfile;
use super::types::PlayerResponse;

const KEYED_PLAYER_ENDPOINT: &str =
    "https://youtubei.googleapis.com/youtubei/v1/player";

// ANDROID_VR uses the un-keyed endpoint; auth via X-YouTube-Client-* headers.
const UNKEYED_PLAYER_ENDPOINT: &str =
    "https://www.youtube.com/youtubei/v1/player";

pub fn http_client(user_agent: &str) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(user_agent)
        .build()
        .map_err(|e| format!("could not build http client: {e}"))
}

pub async fn call_player_api(
    client: &ClientProfile,
    video_id: &str,
) -> Result<PlayerResponse, String> {
    let http = http_client(client.user_agent)?;
    let mut client_ctx = json!({
        "clientName": client.name,
        "clientVersion": client.version,
        "hl": "en",
        "gl": "US",
        "userAgent": client.user_agent,
        "osName": client.os_name,
        "osVersion": client.os_version,
    });
    if let Some(extra) = client.extra_context {
        if let Ok(extra_value) = serde_json::from_str::<Value>(extra) {
            if let (Some(obj), Some(extra_obj)) =
                (client_ctx.as_object_mut(), extra_value.as_object())
            {
                for (k, v) in extra_obj {
                    obj.insert(k.clone(), v.clone());
                }
            }
        }
    }
    let body = json!({
        "context": { "client": client_ctx },
        "videoId": video_id,
        "playbackContext": {
            "contentPlaybackContext": { "html5Preference": "HTML5_PREF_WANTS" }
        },
        "contentCheckOk": true,
        "racyCheckOk": true,
    });

    let endpoint = if client.api_key.is_empty() {
        UNKEYED_PLAYER_ENDPOINT.to_string()
    } else {
        format!("{KEYED_PLAYER_ENDPOINT}?key={}", client.api_key)
    };

    let response = http
        .post(&endpoint)
        .header("X-YouTube-Client-Name", client.client_id)
        .header("X-YouTube-Client-Version", client.version)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("network error contacting youtube: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!("youtube returned status {status}"));
    }

    response
        .json::<PlayerResponse>()
        .await
        .map_err(|e| format!("could not parse youtube response: {e}"))
}

pub async fn resolve_player_with(
    clients: &[&'static ClientProfile],
    video_id: &str,
    accept: impl Fn(&PlayerResponse) -> bool,
) -> Result<(PlayerResponse, &'static ClientProfile), String> {
    let mut last_error: Option<String> = None;
    for client in clients.iter().copied() {
        match call_player_api(client, video_id).await {
            Ok(resp) => {
                let playable = resp
                    .playability_status
                    .as_ref()
                    .and_then(|s| s.status.as_deref())
                    .map(|s| s == "OK")
                    .unwrap_or(true);

                if playable && accept(&resp) {
                    return Ok((resp, client));
                }
                let reason = resp
                    .playability_status
                    .as_ref()
                    .and_then(|s| s.reason.clone())
                    .or_else(|| {
                        resp.playability_status
                            .as_ref()
                            .and_then(|s| s.status.clone())
                    })
                    .unwrap_or_else(|| "no usable streams".into());
                last_error = Some(format!("{}: {reason}", client.name));
            }
            Err(e) => {
                last_error = Some(format!("{}: {e}", client.name));
            }
        }
    }
    Err(last_error.unwrap_or_else(|| "All YouTube clients refused.".into()))
}

// --- acceptance predicates --------------------------------------

pub fn has_metadata(resp: &PlayerResponse) -> bool {
    resp.video_details.is_some()
}

pub fn has_combined_video(resp: &PlayerResponse) -> bool {
    resp.streaming_data
        .as_ref()
        .map(|s| s.formats.iter().any(|f| f.url.is_some()))
        .unwrap_or(false)
}

pub fn has_audio_only(resp: &PlayerResponse) -> bool {
    resp.streaming_data
        .as_ref()
        .map(|s| {
            s.adaptive_formats.iter().any(|f| {
                f.url.is_some()
                    && f.mime_type
                        .as_deref()
                        .is_some_and(|m| m.starts_with("audio/"))
            })
        })
        .unwrap_or(false)
}
