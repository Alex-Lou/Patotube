// Patotube Internet Archive extraction kernel.
//
// IA's `/metadata/<identifier>` JSON endpoint returns the full
// file listing for any item, with no auth required. We pick the
// best file per mediatype (mp3 for audio items, mp4 for video
// items) and stream it from `/download/<identifier>/<file>`.
//
// IA serves both audio and video items naturally — videos are
// supported here (unlike SoundCloud which is audio-only).

mod file_pick;
mod types;
mod url;

#[cfg(target_os = "android")]
use std::path::PathBuf;

#[cfg(target_os = "android")]
use tauri::AppHandle;

#[cfg(target_os = "android")]
use crate::commands::StartDownloadInput;
#[cfg(target_os = "android")]
use crate::downloader::MediaInfo;
#[cfg(target_os = "android")]
use crate::events::emit_status;
#[cfg(target_os = "android")]
use crate::jobs::JobRegistry;
#[cfg(target_os = "android")]
use crate::output_path::resolve_output_path;
#[cfg(target_os = "android")]
use crate::streamer::stream_to_disk;
#[cfg(target_os = "android")]
use crate::youtube_url::sanitize_filename;

#[cfg(target_os = "android")]
use self::types::{ItemMetadata, StringOrList};

pub use self::url::is_archive_url;

#[cfg(target_os = "android")]
const METADATA_BASE: &str = "https://archive.org/metadata/";
#[cfg(target_os = "android")]
const DOWNLOAD_BASE: &str = "https://archive.org/download/";
#[cfg(target_os = "android")]
const DESKTOP_UA: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
     (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

#[cfg(target_os = "android")]
async fn fetch_metadata(identifier: &str) -> Result<ItemMetadata, String> {
    let http = reqwest::Client::builder()
        .user_agent(DESKTOP_UA)
        .build()
        .map_err(|e| format!("could not build http client: {e}"))?;

    let response = http
        .get(format!("{METADATA_BASE}{identifier}"))
        .send()
        .await
        .map_err(|e| format!("network error fetching IA metadata: {e}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "Internet Archive returned status {}",
            response.status()
        ));
    }
    response
        .json::<ItemMetadata>()
        .await
        .map_err(|e| format!("could not parse IA metadata JSON: {e}"))
}

#[cfg(target_os = "android")]
pub async fn fetch_info(item_url: &str) -> Result<MediaInfo, String> {
    let identifier = url::extract_identifier(item_url)
        .ok_or_else(|| "Not a recognised Internet Archive URL.".to_string())?;
    let item = fetch_metadata(&identifier).await?;

    let title = item
        .metadata
        .title
        .and_then(StringOrList::into_string)
        .unwrap_or_else(|| identifier.clone());
    let uploader = item
        .metadata
        .creator
        .and_then(StringOrList::into_string);
    let duration_sec = item
        .files
        .iter()
        .find_map(|f| f.length.as_deref().and_then(|s| s.parse::<f64>().ok()))
        .filter(|d| *d > 0.0);

    Ok(MediaInfo {
        url: item_url.to_string(),
        title,
        uploader,
        duration_sec,
        thumbnail: Some(format!("https://archive.org/services/img/{identifier}")),
        platform: "archive".into(),
    })
}

#[cfg(target_os = "android")]
pub async fn start(
    app: &AppHandle,
    registry: &JobRegistry,
    input: StartDownloadInput,
) -> Result<(), String> {
    let job_id = input.job_id.clone();
    emit_status(app, &job_id, "downloading", None, None);

    let identifier = match url::extract_identifier(&input.url) {
        Some(i) => i,
        None => {
            let e = "Not a recognised Internet Archive URL.".to_string();
            emit_status(app, &job_id, "failed", Some(e.clone()), None);
            return Err(e);
        }
    };

    let item = match fetch_metadata(&identifier).await {
        Ok(i) => i,
        Err(e) => {
            emit_status(app, &job_id, "failed", Some(e.clone()), None);
            return Err(e);
        }
    };

    let title_raw = item
        .metadata
        .title
        .clone()
        .and_then(StringOrList::into_string)
        .unwrap_or_else(|| identifier.clone());
    let title = sanitize_filename(&title_raw);

    let _ = &input.output_dir; // kept for desktop parity

    let app_handle = app.clone();
    let registry_clone = registry.clone();
    let identifier_clone = identifier.clone();

    tokio::spawn(async move {
        let result = run_download(&app_handle, &job_id, &identifier_clone, item, &title).await;
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

#[cfg(target_os = "android")]
async fn run_download(
    app: &AppHandle,
    job_id: &str,
    identifier: &str,
    item: ItemMetadata,
    title: &str,
) -> Result<PathBuf, String> {
    let picked = file_pick::pick_best(&item)?;
    let stream_url = format!("{DOWNLOAD_BASE}{identifier}/{}", picked.name);
    let out = resolve_output_path(&format!("{title}.{}", picked.extension)).await?;
    stream_to_disk(app, job_id, &stream_url, &out).await?;
    Ok(out)
}
