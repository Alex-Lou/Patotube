mod commands;
// `MediaInfo` lives on its own so every kernel can import it without
// dragging the yt-dlp orchestration with it. The orchestrator
// (`downloader`) is desktop-only — Android uses the native kernels
// for every supported platform.
mod media_info;
#[cfg(not(target_os = "android"))]
mod downloader;
mod events;
mod jobs;
// Shared platform helpers used by every kernel.
mod output_path;
mod streamer;
// Pure URL/filename helpers, kept outside the cfg-gated extractor so
// they can be unit-tested on the desktop host. See youtube_url.rs.
mod youtube_url;

// YouTube extraction kernel. Always compiled (so the pure-Rust
// signature / n-parameter / stream-picking submodules can be
// unit-tested on the desktop host); the network layer
// (`download.rs`, `player_api.rs`) and the orchestration entry
// points (`fetch_info`, `start`) are themselves cfg-gated to
// Android inside the module. See `youtube_kernel/mod.rs`.
mod youtube_kernel;

// SoundCloud extraction kernel. Same cfg layout as
// `youtube_kernel`: always-compiled pure modules + Android-only
// HTTP layer + orchestration. See `soundcloud_kernel/mod.rs`.
mod soundcloud_kernel;

// Bandcamp extraction kernel — page scrape → trackinfo[0].mp3-128.
mod bandcamp_kernel;

// Audiomack extraction kernel — public API → stream URL.
mod audiomack_kernel;

// Internet Archive extraction kernel — supports both audio AND
// video items via the public /metadata/<id> JSON endpoint.
mod archive_kernel;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init());

    // Auto-updater (desktop only — Tauri does not support Android/iOS
    // self-updates yet; mobile users grab a fresh APK manually).
    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
    }

    builder
        .manage(jobs::JobRegistry::default())
        .invoke_handler(tauri::generate_handler![
            commands::fetch_media_info,
            commands::start_download,
            commands::cancel_download,
            commands::pick_folder,
            commands::default_download_dir,
            commands::open_path,
            commands::show_in_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Patotube");
}
