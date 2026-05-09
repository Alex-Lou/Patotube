// Patotube SoundCloud extraction kernel.
//
// Public surface (cross-platform):
//   - `fetch_info(url)` — resolves a track URL to MediaInfo
//     (title, uploader, duration, artwork) without downloading.
//   - `start(app, registry, input)` — spawns a background task
//     that downloads the track to disk, emitting progress + status
//     events via `crate::events`.
//
// Pipeline:
//   resolve track url
//      → api::resolve_track  (api-v2.soundcloud.com/resolve)
//   pick a progressive transcoding (mp3 preferred)
//      → transcoding::pick_progressive
//   fetch the streamable CDN URL
//      → api::fetch_stream_url  (per-format hop SC requires)
//   stream to disk
//      → streamer::stream_to_disk
//
// On desktop this kernel runs INSTEAD of the yt-dlp sidecar for
// SoundCloud URLs — yt-dlp's resolve step takes 3-5 s of process
// startup + page parsing for SC tracks, vs. ~500 ms here. On
// Android there's no yt-dlp anyway.

mod api;
mod client_id;
mod transcoding;
mod types;
mod url;

use std::path::PathBuf;

use tauri::AppHandle;

use crate::commands::StartDownloadInput;
use crate::downloader::MediaInfo;
use crate::events::emit_status;
use crate::jobs::JobRegistry;
use crate::output_path::resolve_destination;
use crate::streamer::stream_to_disk;
use crate::youtube_url::sanitize_filename;

pub use self::url::is_soundcloud_url;

/// Resolves a SoundCloud track URL to user-facing metadata.
pub async fn fetch_info(track_url: &str) -> Result<MediaInfo, String> {
    let canon = url::canonicalise(track_url)
        .ok_or_else(|| "Not a recognised SoundCloud URL.".to_string())?;
    let track = api::resolve_track(&canon).await?;

    let duration_sec = if track.duration > 0 {
        Some((track.duration as f64) / 1000.0)
    } else {
        None
    };

    Ok(MediaInfo {
        url: canon,
        title: track.title,
        uploader: Some(track.user.username),
        duration_sec,
        thumbnail: track.artwork_url,
        platform: "soundcloud".into(),
    })
}

/// Spawns a background task that resolves + downloads the track.
pub async fn start(
    app: &AppHandle,
    registry: &JobRegistry,
    input: StartDownloadInput,
) -> Result<(), String> {
    let job_id = input.job_id.clone();
    emit_status(app, &job_id, "downloading", None, None);

    let canon = match url::canonicalise(&input.url) {
        Some(c) => c,
        None => {
            let e = "Not a recognised SoundCloud URL.".to_string();
            emit_status(app, &job_id, "failed", Some(e.clone()), None);
            return Err(e);
        }
    };

    let track = match api::resolve_track(&canon).await {
        Ok(t) => t,
        Err(e) => {
            emit_status(app, &job_id, "failed", Some(e.clone()), None);
            return Err(e);
        }
    };
    let title = sanitize_filename(&format!("{} - {}", track.user.username, track.title));
    let output_dir = input.output_dir.clone();

    let app_handle = app.clone();
    let registry_clone = registry.clone();

    tokio::spawn(async move {
        let result = run_download(&app_handle, &job_id, &track, &title, &output_dir).await;
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

async fn run_download(
    app: &AppHandle,
    job_id: &str,
    track: &types::Track,
    title: &str,
    output_dir: &str,
) -> Result<PathBuf, String> {
    let picked = transcoding::pick_progressive(track)?;
    let stream_url = api::fetch_stream_url(&picked.url).await?;
    let out = resolve_destination(output_dir, &format!("{title}.{}", picked.extension)).await?;
    stream_to_disk(app, job_id, &stream_url, &out).await?;
    Ok(out)
}
