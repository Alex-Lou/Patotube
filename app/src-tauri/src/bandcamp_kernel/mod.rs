// Patotube Bandcamp extraction kernel.
//
// Public surface (Android only):
//   - `fetch_info(url)` — resolves a track page to MediaInfo.
//   - `start(app, registry, input)` — downloads the streamable
//     mp3-128 file the page exposes.
//
// Bandcamp embeds all the metadata we need in a `data-tralbum`
// attribute on the track page, so the protocol is just:
//
//   GET https://<artist>.bandcamp.com/track/<slug>
//   regex out data-tralbum="…" → JSON parse
//   stream the trackinfo[0].file["mp3-128"] URL straight to disk
//
// No API key, no auth, no signature dance. Free preview only —
// FLAC and MP3-V0 require a buyer-authenticated download page
// flow we don't ship.

mod extract;
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

pub use self::url::is_bandcamp_url;

#[cfg(target_os = "android")]
const DESKTOP_UA: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
     (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

#[cfg(target_os = "android")]
async fn fetch_page(track_url: &str) -> Result<String, String> {
    let http = reqwest::Client::builder()
        .user_agent(DESKTOP_UA)
        .build()
        .map_err(|e| format!("could not build http client: {e}"))?;
    let response = http
        .get(track_url)
        .header("Accept-Language", "en-US,en;q=0.9")
        .send()
        .await
        .map_err(|e| format!("network error fetching Bandcamp page: {e}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "Bandcamp returned status {}",
            response.status()
        ));
    }
    response
        .text()
        .await
        .map_err(|e| format!("could not read Bandcamp page body: {e}"))
}

#[cfg(target_os = "android")]
pub async fn fetch_info(track_url: &str) -> Result<MediaInfo, String> {
    let page = fetch_page(track_url).await?;
    let tralbum = extract::extract_tralbum(&page)?;
    let title = extract::pick_title(&tralbum);
    let duration_sec = tralbum.trackinfo.first().and_then(|t| t.duration);
    // Bandcamp embeds the album-art ID; build the canonical
    // thumbnail URL from it. Format `_10` is the 1200×1200
    // jpeg, biggest the CDN serves.
    let thumbnail = tralbum
        .art_id
        .map(|id| format!("https://f4.bcbits.com/img/a{id}_10.jpg"));

    Ok(MediaInfo {
        url: track_url.to_string(),
        title,
        uploader: tralbum.artist,
        duration_sec,
        thumbnail,
        platform: "bandcamp".into(),
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

    let page = match fetch_page(&input.url).await {
        Ok(p) => p,
        Err(e) => {
            emit_status(app, &job_id, "failed", Some(e.clone()), None);
            return Err(e);
        }
    };
    let tralbum = match extract::extract_tralbum(&page) {
        Ok(t) => t,
        Err(e) => {
            emit_status(app, &job_id, "failed", Some(e.clone()), None);
            return Err(e);
        }
    };

    let title_raw = format!(
        "{} - {}",
        tralbum.artist.clone().unwrap_or_else(|| "Bandcamp".into()),
        extract::pick_title(&tralbum),
    );
    let title = sanitize_filename(&title_raw);

    let _ = &input.output_dir; // kept for desktop parity

    let app_handle = app.clone();
    let registry_clone = registry.clone();

    tokio::spawn(async move {
        let result = run_download(&app_handle, &job_id, tralbum, &title).await;
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
    tralbum: extract::TrAlbum,
    title: &str,
) -> Result<PathBuf, String> {
    let (url, ext) = extract::pick_first_stream(&tralbum)?;
    let out = resolve_output_path(&format!("{title}.{ext}")).await?;
    stream_to_disk(app, job_id, &url, &out).await?;
    Ok(out)
}
