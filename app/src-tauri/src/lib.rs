mod commands;
mod downloader;
mod jobs;
// Pure URL/filename helpers, kept outside the cfg-gated extractor so
// they can be unit-tested on the desktop host. See youtube_url.rs.
mod youtube_url;

// Android-only YouTube extraction kernel. Splits across submodules
// for client profiles, the youtubei/v1/player REST call, stream
// picking, downloading, output-path resolution, and event emission.
// See `app/src-tauri/src/youtube_kernel/mod.rs`.
#[cfg(target_os = "android")]
mod youtube_kernel;

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
