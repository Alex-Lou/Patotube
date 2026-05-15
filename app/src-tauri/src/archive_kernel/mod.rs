// Internet Archive kernel. /metadata/<id> JSON → pick best file (mp3/mp4)
// → stream from /download/<id>/<file>. Audio + video both supported.

mod file_pick;
mod types;
mod url;

use std::path::PathBuf;

use tauri::AppHandle;

use crate::commands::StartDownloadInput;
use crate::media_info::MediaInfo;
use crate::events::emit_status;
use crate::jobs::JobRegistry;
use crate::output_path::destination_candidates;
use crate::streamer::stream_to_disk;
use crate::youtube_url::sanitize_filename;

use self::types::{ItemMetadata, StringOrList};

pub use self::url::is_archive_url;

const METADATA_BASE: &str = "https://archive.org/metadata/";
const DOWNLOAD_BASE: &str = "https://archive.org/download/";
const DESKTOP_UA: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
     (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

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
    let output_dir = input.output_dir.clone();

    let app_handle = app.clone();
    let registry_clone = registry.clone();
    let identifier_clone = identifier.clone();

    tokio::spawn(async move {
        let result = run_download(
            &app_handle,
            &job_id,
            &identifier_clone,
            item,
            &title,
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

async fn run_download(
    app: &AppHandle,
    job_id: &str,
    identifier: &str,
    item: ItemMetadata,
    title: &str,
    output_dir: &str,
) -> Result<PathBuf, String> {
    let picked = file_pick::pick_best(&item)?;
    let stream_url = format!("{DOWNLOAD_BASE}{identifier}/{}", picked.name);
    let candidates =
        destination_candidates(output_dir, &format!("{title}.{}", picked.extension)).await?;
    stream_to_disk(app, job_id, &stream_url, &candidates).await
}
