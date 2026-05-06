mod commands;
mod downloader;
mod jobs;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
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
