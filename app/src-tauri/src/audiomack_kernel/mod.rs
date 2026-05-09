// Patotube Audiomack extraction kernel.
//
// Audiomack ships a clean public API for individual song
// metadata: GET `audiomack.com/api/music/url/song/<artist>/<slug>`
// returns JSON with `{ artist, title, url }` — `url` is the
// streamable mp3.
//
// One quirk: some "songs" on Audiomack are actually re-shares of
// SoundCloud tracks. The yt-dlp extractor delegates those to the
// SC handler. We don't yet do that — if we hit one we surface a
// clear error and the user can try the underlying SC URL.

mod url;

#[cfg(target_os = "android")]
use std::path::PathBuf;
#[cfg(target_os = "android")]
use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(target_os = "android")]
use serde::Deserialize;
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

#[cfg_attr(not(target_os = "android"), allow(unused_imports))]
pub use self::url::is_audiomack_url;

#[cfg(target_os = "android")]
const API_BASE: &str = "https://www.audiomack.com/api/music/url/song/";
#[cfg(target_os = "android")]
const DESKTOP_UA: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
     (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

#[cfg(target_os = "android")]
#[derive(Debug, Deserialize)]
struct ApiSong {
    #[serde(default)]
    artist: Option<String>,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    url: Option<String>,
}

#[cfg(target_os = "android")]
async fn fetch_song(api_path: &str) -> Result<ApiSong, String> {
    let http = reqwest::Client::builder()
        .user_agent(DESKTOP_UA)
        .build()
        .map_err(|e| format!("could not build http client: {e}"))?;

    let cache_buster = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);

    let response = http
        .get(format!("{API_BASE}{api_path}"))
        .query(&[("extended", "1"), ("_", &cache_buster.to_string())])
        .send()
        .await
        .map_err(|e| format!("network error contacting Audiomack: {e}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "Audiomack returned status {}",
            response.status()
        ));
    }
    response
        .json::<ApiSong>()
        .await
        .map_err(|e| format!("could not parse Audiomack response: {e}"))
}

#[cfg(target_os = "android")]
pub async fn fetch_info(track_url: &str) -> Result<MediaInfo, String> {
    let api_path = url::extract_api_path(track_url)
        .ok_or_else(|| "Not a recognised Audiomack song URL.".to_string())?;
    let song = fetch_song(&api_path).await?;
    let title = song.title.clone().unwrap_or_else(|| "Audiomack track".into());
    let stream_url = song.url.clone();
    if stream_url.as_deref().is_some_and(|u| u.contains("soundcloud.com")) {
        return Err(
            "This Audiomack track is hosted on SoundCloud — paste the SoundCloud URL instead."
                .into(),
        );
    }
    Ok(MediaInfo {
        url: track_url.to_string(),
        title,
        uploader: song.artist,
        duration_sec: None, // Audiomack's API doesn't ship duration with the URL endpoint
        thumbnail: None,
        platform: "audiomack".into(),
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

    let api_path = match url::extract_api_path(&input.url) {
        Some(p) => p,
        None => {
            let e = "Not a recognised Audiomack song URL.".to_string();
            emit_status(app, &job_id, "failed", Some(e.clone()), None);
            return Err(e);
        }
    };

    let song = match fetch_song(&api_path).await {
        Ok(s) => s,
        Err(e) => {
            emit_status(app, &job_id, "failed", Some(e.clone()), None);
            return Err(e);
        }
    };

    let stream_url = match song.url.clone() {
        Some(u) if !u.is_empty() => u,
        _ => {
            let e = "Audiomack returned no stream URL for this track".to_string();
            emit_status(app, &job_id, "failed", Some(e.clone()), None);
            return Err(e);
        }
    };
    if stream_url.contains("soundcloud.com") {
        let e = "This Audiomack track is hosted on SoundCloud — paste the SoundCloud URL instead."
            .to_string();
        emit_status(app, &job_id, "failed", Some(e.clone()), None);
        return Err(e);
    }

    let title_raw = format!(
        "{} - {}",
        song.artist.clone().unwrap_or_else(|| "Audiomack".into()),
        song.title.clone().unwrap_or_else(|| api_path.clone()),
    );
    let title = sanitize_filename(&title_raw);

    let _ = &input.output_dir; // kept for desktop parity

    let app_handle = app.clone();
    let registry_clone = registry.clone();

    tokio::spawn(async move {
        let result = run_download(&app_handle, &job_id, &stream_url, &title).await;
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
    stream_url: &str,
    title: &str,
) -> Result<PathBuf, String> {
    // Audiomack consistently serves MP3.
    let out = resolve_output_path(&format!("{title}.mp3")).await?;
    stream_to_disk(app, job_id, stream_url, &out).await?;
    Ok(out)
}
