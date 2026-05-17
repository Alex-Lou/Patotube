use serde::Deserialize;
use tauri::{AppHandle, Manager, State};

#[cfg(not(target_os = "android"))]
use crate::downloader;
use crate::jobs::JobRegistry;
use crate::media_info::MediaInfo;

#[derive(Debug, Deserialize, Clone)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum FormatChoice {
    Video { quality: String },
    Audio { bitrate: u32 },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartDownloadInput {
    pub job_id: String,
    pub url: String,
    pub format: FormatChoice,
    pub output_dir: String,
}

#[tauri::command]
pub async fn fetch_media_info(app: AppHandle, url: String) -> Result<MediaInfo, String> {
    // SoundCloud / Bandcamp / Internet Archive are handled by their
    // own native Rust kernels on every platform — much faster than
    // spawning yt-dlp (no subprocess startup, no page parsing
    // overhead). YouTube falls through to yt-dlp on desktop and to
    // the Android-only youtube_kernel on mobile.
    if crate::soundcloud_kernel::is_soundcloud_url(&url) {
        return crate::soundcloud_kernel::fetch_info(&url).await;
    }
    if crate::bandcamp_kernel::is_bandcamp_url(&url) {
        return crate::bandcamp_kernel::fetch_info(&url).await;
    }
    if crate::archive_kernel::is_archive_url(&url) {
        return crate::archive_kernel::fetch_info(&url).await;
    }
    #[cfg(target_os = "android")]
    {
        let _ = &app;
        if crate::audiomack_kernel::is_audiomack_url(&url) {
            return crate::audiomack_kernel::fetch_info(&url).await;
        }
        return crate::youtube_kernel::fetch_info(&url).await;
    }
    #[cfg(not(target_os = "android"))]
    {
        downloader::fetch_info(&app, &url).await
    }
}

#[tauri::command]
pub async fn start_download(
    app: AppHandle,
    registry: State<'_, JobRegistry>,
    job_id: String,
    url: String,
    format: FormatChoice,
    output_dir: String,
) -> Result<(), String> {
    let input = StartDownloadInput {
        job_id,
        url,
        format,
        output_dir,
    };
    eprintln!(
        "[patotube] commands::start_download received job={} url={}",
        input.job_id, input.url
    );
    if crate::soundcloud_kernel::is_soundcloud_url(&input.url) {
        return crate::soundcloud_kernel::start(&app, &registry, input).await;
    }
    if crate::bandcamp_kernel::is_bandcamp_url(&input.url) {
        return crate::bandcamp_kernel::start(&app, &registry, input).await;
    }
    if crate::archive_kernel::is_archive_url(&input.url) {
        return crate::archive_kernel::start(&app, &registry, input).await;
    }
    #[cfg(target_os = "android")]
    {
        if crate::audiomack_kernel::is_audiomack_url(&input.url) {
            return crate::audiomack_kernel::start(&app, &registry, input).await;
        }
        return crate::youtube_kernel::start(&app, &registry, input).await;
    }
    #[cfg(not(target_os = "android"))]
    {
        downloader::start(&app, &registry, input).await
    }
}

#[tauri::command]
pub async fn cancel_download(
    registry: State<'_, JobRegistry>,
    job_id: String,
) -> Result<(), String> {
    registry.cancel(&job_id).await;
    Ok(())
}

#[tauri::command]
pub async fn pick_folder(app: AppHandle) -> Result<Option<String>, String> {
    #[cfg(desktop)]
    {
        use tauri_plugin_dialog::DialogExt;
        let (tx, rx) = tokio::sync::oneshot::channel();
        app.dialog().file().pick_folder(move |fp| {
            let _ = tx.send(fp.map(|p| p.to_string()));
        });
        rx.await.map_err(|e| e.to_string())
    }
    #[cfg(not(desktop))]
    {
        let _ = app;
        Ok(None)
    }
}

#[tauri::command]
pub fn default_download_dir(app: AppHandle) -> Result<String, String> {
    let path = app
        .path()
        .download_dir()
        .map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn open_path(app: AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_path(path, None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn show_in_folder(app: AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .reveal_item_in_dir(path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_youtube(
    query: String,
    limit: u32,
) -> Result<Vec<crate::youtube_kernel::search::SearchResult>, String> {
    let n = limit.clamp(1, 50) as usize;
    crate::youtube_kernel::search::search(&query, n).await
}

#[tauri::command]
pub async fn get_youtube_stream_url(video_id: String) -> Result<String, String> {
    crate::youtube_kernel::stream_url::fetch_combined_stream(&video_id).await
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeStreamInfo {
    pub url: String,
    /// Mandatory: googlevideo signs URLs against the client UA. The
    /// Android-native MediaPlayer that takes over playback when the
    /// screen locks MUST replay this exact header, otherwise the CDN
    /// returns 403 on the very first byte range.
    pub user_agent: String,
}

#[tauri::command]
pub async fn get_youtube_native_stream(video_id: String) -> Result<NativeStreamInfo, String> {
    let s = crate::youtube_kernel::stream_url::resolve(&video_id).await?;
    Ok(NativeStreamInfo {
        url: s.url,
        user_agent: s.user_agent,
    })
}
