// Phase 2 unlock fallback path. When the existing multi-client REST
// chain (ANDROID_MUSIC → ANDROID → IOS → TVHTML5) all fail to
// produce a playable audio-only URL — typically because YouTube
// requires PoToken/n-param unscrambling on those clients today —
// we fall through to this module: ask the WEB client (which serves
// `signatureCipher` formats), grab the per-video player.js URL from
// the watch page, build a `sigcipher::Unlocker` from it on a
// blocking thread (boa's Context isn't Send), and use the unlocked
// URL with the existing `download_stream`.
//
// All boa work happens inside `spawn_blocking` so the !Send context
// never crosses an `await` point.

use std::path::PathBuf;

use tauri::AppHandle;

use super::clients::web_client_only;
use super::download::download_stream;
use crate::output_path::resolve_output_path;
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

    let out = resolve_output_path(&format!("{title}.{}", picked.extension)).await?;
    download_stream(app, job_id, &url, &out, picked.content_length, client.user_agent).await?;
    Ok(out)
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
