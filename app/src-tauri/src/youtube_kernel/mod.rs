// YouTube extraction kernel. See docs/youtube-kernel.md for the full Phase 1/2 pipeline.

mod clients;
mod player_api;
pub mod search;
mod sigcipher;
pub mod stream_url;
mod stream_pick;
mod types;

#[cfg(target_os = "android")]
mod download;
#[cfg(target_os = "android")]
mod unlock_pipeline;

#[cfg(target_os = "android")]
use std::path::PathBuf;

#[cfg(target_os = "android")]
use tauri::AppHandle;

#[cfg(target_os = "android")]
use crate::commands::{FormatChoice, StartDownloadInput};
#[cfg(target_os = "android")]
use crate::media_info::MediaInfo;
#[cfg(target_os = "android")]
use crate::jobs::JobRegistry;
#[cfg(target_os = "android")]
use crate::youtube_url::{extract_youtube_id, sanitize_filename};

#[cfg(target_os = "android")]
use self::clients::{audio_clients, default_clients, ClientProfile};
#[cfg(target_os = "android")]
use self::download::download_stream;
#[cfg(target_os = "android")]
use crate::output_path::destination_candidates;
#[cfg(target_os = "android")]
use self::player_api::{
    has_audio_only, has_combined_video, has_metadata, resolve_player_with,
};
#[cfg(target_os = "android")]
use crate::events::emit_status;
#[cfg(target_os = "android")]
use self::stream_pick::{pick_audio, pick_video};
#[cfg(target_os = "android")]
use self::types::PlayerResponse;

/// Resolves a YouTube URL to user-facing metadata. Does not download.
#[cfg(target_os = "android")]
pub async fn fetch_info(url: &str) -> Result<MediaInfo, String> {
    let video_id = extract_youtube_id(url)
        .ok_or_else(|| "Not a recognised YouTube URL.".to_string())?;

    let (resp, _client) = resolve_player(&video_id, has_metadata).await?;

    let details = resp
        .video_details
        .ok_or_else(|| "Video metadata missing.".to_string())?;

    let duration_sec = details
        .length_seconds
        .parse::<f64>()
        .ok()
        .filter(|&d| d > 0.0);

    let thumbnail = details.thumbnail.map(|c| c.thumbnails).and_then(|t| {
        t.into_iter()
            .max_by_key(|x| x.width as u64 * x.height as u64)
            .map(|x| x.url)
    });

    Ok(MediaInfo {
        url: format!("https://www.youtube.com/watch?v={}", details.video_id),
        title: details.title,
        uploader: details.author,
        duration_sec,
        thumbnail,
        platform: "youtube".into(),
    })
}

/// Spawns a background download task. Returns immediately after
/// emitting an initial `downloading` status; progress + completion
/// arrive asynchronously via the `download://progress` and
/// `download://status` events.
#[cfg(target_os = "android")]
pub async fn start(
    app: &AppHandle,
    registry: &JobRegistry,
    input: StartDownloadInput,
) -> Result<(), String> {
    let job_id = input.job_id.clone();
    emit_status(app, &job_id, "downloading", None, None);

    let video_id = extract_youtube_id(&input.url)
        .ok_or_else(|| "Not a recognised YouTube URL.".to_string())?;

    let want_audio = matches!(input.format, FormatChoice::Audio { .. });

    let title_raw = match resolve_player(&video_id, has_metadata).await {
        Ok((r, _)) => r
            .video_details
            .map(|d| d.title)
            .unwrap_or_else(|| video_id.clone()),
        Err(e) => {
            emit_status(app, &job_id, "failed", Some(e.clone()), None);
            return Err(e);
        }
    };
    let title = sanitize_filename(&title_raw);
    let output_dir = input.output_dir.clone();

    let app_handle = app.clone();
    let registry_clone = registry.clone();
    let video_id_owned = video_id.clone();
    let format_choice = input.format.clone();

    tokio::spawn(async move {
        let result = run_download(
            &app_handle,
            &job_id,
            &video_id_owned,
            &title,
            format_choice,
            want_audio,
            &output_dir,
        )
        .await;

        match result {
            Ok(path) => emit_status(
                &app_handle,
                &job_id,
                "done",
                None,
                Some(path.to_string_lossy().into_owned()),
            ),
            Err(err) => emit_status(&app_handle, &job_id, "failed", Some(err), None),
        }
        registry_clone.remove(&job_id);
    });

    Ok(())
}

/// Audio strategy: 1) audio-only via mobile/TV clients, 2) audio-only via WEB + sig/n unlock,
/// 3) combined MP4 saved as .m4a (frontend strips video). See docs/youtube-kernel.md.
#[cfg(target_os = "android")]
async fn run_download(
    app: &AppHandle,
    job_id: &str,
    video_id: &str,
    title: &str,
    format: FormatChoice,
    want_audio: bool,
    output_dir: &str,
) -> Result<PathBuf, String> {
    if want_audio {
        match try_audio_only(app, job_id, video_id, title, output_dir).await {
            Ok(p) => return Ok(p),
            Err(e) => eprintln!("[patotube] audio-only fast path failed: {e}"),
        }
        match unlock_pipeline::try_audio_via_unlock(app, job_id, video_id, title, output_dir).await {
            Ok(p) => return Ok(p),
            Err(e) => eprintln!(
                "[patotube] audio-only unlock path failed: {e} — falling back to combined mp4"
            ),
        }
        return try_combined(app, job_id, video_id, title, "best", "m4a", output_dir).await;
    }
    let quality = match format {
        FormatChoice::Video { quality } => quality,
        FormatChoice::Audio { .. } => "best".into(),
    };
    try_combined(app, job_id, video_id, title, &quality, "mp4", output_dir).await
}

#[cfg(target_os = "android")]
async fn try_audio_only(
    app: &AppHandle,
    job_id: &str,
    video_id: &str,
    title: &str,
    output_dir: &str,
) -> Result<PathBuf, String> {
    let clients = audio_clients();
    let (resp, client) =
        resolve_player_with(&clients, video_id, has_audio_only).await?;
    let streaming = resp
        .streaming_data
        .ok_or_else(|| "No streaming data".to_string())?;
    let picked = pick_audio(&streaming)?;
    let url = picked
        .direct_url
        .ok_or_else(|| "format requires signature unlock — fall through".to_string())?;
    let candidates =
        destination_candidates(output_dir, &format!("{title}.{}", picked.extension)).await?;
    download_stream(app, job_id, &url, &candidates, picked.content_length, client.user_agent)
        .await
}

#[cfg(target_os = "android")]
async fn try_combined(
    app: &AppHandle,
    job_id: &str,
    video_id: &str,
    title: &str,
    quality: &str,
    save_ext: &str,
    output_dir: &str,
) -> Result<PathBuf, String> {
    let clients = default_clients();
    let (resp, client) =
        resolve_player_with(&clients, video_id, has_combined_video).await?;
    let streaming = resp
        .streaming_data
        .ok_or_else(|| "No streaming data".to_string())?;
    let picked = pick_video(&streaming, quality)?;
    let url = picked
        .direct_url
        .ok_or_else(|| "combined-MP4 format requires signature unlock".to_string())?;
    let candidates =
        destination_candidates(output_dir, &format!("{title}.{save_ext}")).await?;
    download_stream(app, job_id, &url, &candidates, picked.content_length, client.user_agent)
        .await
}

/// Convenience: resolve_player_with seeded with `default_clients()`.
#[cfg(target_os = "android")]
async fn resolve_player(
    video_id: &str,
    accept: impl Fn(&PlayerResponse) -> bool,
) -> Result<(PlayerResponse, &'static ClientProfile), String> {
    let clients = default_clients();
    resolve_player_with(&clients, video_id, accept).await
}
