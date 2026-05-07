// Patotube YouTube extraction kernel for Android.
//
// Public surface:
//   - `fetch_info(url)` — resolves a URL to MediaInfo (title, duration,
//     thumbnail, ...) without committing to a download.
//   - `start(app, registry, input)` — spawns a background task that
//     downloads to disk, emitting progress + status events along the
//     way.
//
// Both call into the same youtubei/v1/player REST machinery (see
// `player_api.rs`) parameterised by `clients.rs` profiles. The
// downloader (`download.rs`) is multi-UA-retry to dodge per-CDN-node
// 403s. Filesystem candidates live in `output_path.rs`.
//
// See `docs/youtube-kernel.md` for the full architecture, including
// why we don't use yt-dlp / NewPipe / ffmpeg-kit on Android.

mod clients;
mod download;
mod output_path;
mod player_api;
mod progress;
mod stream_pick;
mod types;

use std::path::PathBuf;

use tauri::AppHandle;

use crate::commands::{FormatChoice, StartDownloadInput};
use crate::downloader::MediaInfo;
use crate::jobs::JobRegistry;
use crate::youtube_url::{extract_youtube_id, sanitize_filename};

use self::clients::{audio_clients, default_clients, ClientProfile};
use self::download::download_stream;
use self::output_path::resolve_output_path;
use self::player_api::{
    has_audio_only, has_combined_video, has_metadata, resolve_player_with,
};
use self::progress::emit_status;
use self::stream_pick::{pick_audio, pick_video};
use self::types::PlayerResponse;

/// Resolves a YouTube URL to user-facing metadata. Does not download.
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

    let _ = &input.output_dir; // kept for desktop parity

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

/// Picks the right resolution + download strategy for this job.
///
/// Audio jobs try real audio-only first (much smaller download); on
/// failure they fall back to the combined MP4 saved as `.m4a`. The
/// frontend's post-processing step (MediaExtractor remux on Android)
/// then strips the video track to produce a true audio-only file.
///
/// See `docs/youtube-kernel.md` ("Phase 1") for the full pipeline.
async fn run_download(
    app: &AppHandle,
    job_id: &str,
    video_id: &str,
    title: &str,
    format: FormatChoice,
    want_audio: bool,
) -> Result<PathBuf, String> {
    if want_audio {
        match try_audio_only(app, job_id, video_id, title).await {
            Ok(p) => return Ok(p),
            Err(e) => {
                eprintln!("[patotube] audio-only failed: {e} — falling back to combined mp4");
            }
        }
        return try_combined(app, job_id, video_id, title, "best", "m4a").await;
    }
    let quality = match format {
        FormatChoice::Video { quality } => quality,
        FormatChoice::Audio { .. } => "best".into(),
    };
    try_combined(app, job_id, video_id, title, &quality, "mp4").await
}

async fn try_audio_only(
    app: &AppHandle,
    job_id: &str,
    video_id: &str,
    title: &str,
) -> Result<PathBuf, String> {
    let clients = audio_clients();
    let (resp, client) =
        resolve_player_with(&clients, video_id, has_audio_only).await?;
    let streaming = resp
        .streaming_data
        .ok_or_else(|| "No streaming data".to_string())?;
    let (url, total, ext) = pick_audio(&streaming)?;
    let out = resolve_output_path(&format!("{title}.{ext}")).await?;
    download_stream(app, job_id, &url, &out, total, client.user_agent).await?;
    Ok(out)
}

async fn try_combined(
    app: &AppHandle,
    job_id: &str,
    video_id: &str,
    title: &str,
    quality: &str,
    save_ext: &str,
) -> Result<PathBuf, String> {
    let clients = default_clients();
    let (resp, client) =
        resolve_player_with(&clients, video_id, has_combined_video).await?;
    let streaming = resp
        .streaming_data
        .ok_or_else(|| "No streaming data".to_string())?;
    let (url, total, _real_ext) = pick_video(&streaming, quality)?;
    let out = resolve_output_path(&format!("{title}.{save_ext}")).await?;
    download_stream(app, job_id, &url, &out, total, client.user_agent).await?;
    Ok(out)
}

/// Convenience: resolve_player_with seeded with `default_clients()`.
async fn resolve_player(
    video_id: &str,
    accept: impl Fn(&PlayerResponse) -> bool,
) -> Result<(PlayerResponse, &'static ClientProfile), String> {
    let clients = default_clients();
    resolve_player_with(&clients, video_id, accept).await
}
