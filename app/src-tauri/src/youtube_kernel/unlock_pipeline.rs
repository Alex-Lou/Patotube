// Phase 2 unlock fallback: WEB client + sigcipher::Unlocker when the
// multi-client REST chain fails. boa's Context isn't Send →
// spawn_blocking keeps it off the await path.

use std::path::PathBuf;

use tauri::AppHandle;

use super::clients::web_client_only;
use super::download::download_stream;
use crate::output_path::destination_candidates;
use super::player_api::{has_audio_only, resolve_player_with};
use super::sigcipher::{fetch_player_js_for_video, Unlocker};
use super::stream_pick::{pick_audio, PickedFormat};

/// Audio fallback that uses the WEB client + Unlocker. Called by
/// `run_download` after the existing audio-clients chain fails.
pub async fn try_audio_via_unlock(
    app: &AppHandle,
    job_id: &str,
    video_id: &str,
    title: &str,
    output_dir: &str,
) -> Result<PathBuf, String> {
    let clients = web_client_only();
    let (resp, client) =
        resolve_player_with(&clients, video_id, has_audio_only).await?;

    let streaming = resp
        .streaming_data
        .ok_or_else(|| "WEB: no streaming data".to_string())?;
    let picked = pick_audio(&streaming)?;

    // Fetch the per-video player.js (the watch page → jsUrl → JS).
    let (_js_url, player_js_source) = fetch_player_js_for_video(video_id).await?;

    // Compile decoders + unlock on a blocking thread; boa's Context
    // is !Send, so it must not cross an await.
    let url = unlock_picked_url_blocking(&picked, &player_js_source).await?;

    let candidates =
        destination_candidates(output_dir, &format!("{title}.{}", picked.extension)).await?;
    download_stream(app, job_id, &url, &candidates, picked.content_length, client.user_agent).await
}

/// Build an Unlocker on a worker thread, run the cipher unlock, and
/// return the streamable URL. The Unlocker is dropped at the end of
/// the closure so its boa Context never escapes.
async fn unlock_picked_url_blocking(
    picked: &PickedFormat,
    player_js_source: &str,
) -> Result<String, String> {
    let direct = picked.direct_url.clone();
    let cipher = picked.signature_cipher.clone();
    let js = player_js_source.to_string();

    tokio::task::spawn_blocking(move || -> Result<String, String> {
        let mut unlocker = Unlocker::from_player_js(&js)?;
        unlocker.unlock_url(direct.as_deref(), cipher.as_deref())
    })
    .await
    .map_err(|e| format!("unlock task panicked: {e}"))?
}
