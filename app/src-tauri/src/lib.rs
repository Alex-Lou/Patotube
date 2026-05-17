mod commands;
mod files;
mod media_info;
mod stream_proxy;
#[cfg(not(target_os = "android"))]
mod downloader;
mod events;
mod jobs;
mod output_path;
mod streamer;
mod youtube_url;
mod youtube_kernel;
mod soundcloud_kernel;
mod bandcamp_kernel;
mod audiomack_kernel;
mod archive_kernel;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Single-instance MUST be registered before tauri-plugin-deep-link, otherwise a second launch never reaches the first window.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }));
    }

    builder = builder
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init());

    // Desktop-only plugins (no Android updater / deep-link in Tauri 2).
    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init())
            .plugin(tauri_plugin_deep_link::init());
    }

    // Custom scheme that proxies the in-app preview player through
    // Rust — see stream_proxy.rs for the why (User-Agent + CORS).
    builder = builder.register_asynchronous_uri_scheme_protocol(
        "patostream",
        |_ctx, request, responder| {
            tauri::async_runtime::spawn(async move {
                let response = stream_proxy::handle(request).await;
                responder.respond(response);
            });
        },
    );

    builder
        .setup(|_app| {
            // Linux/dev: register the patotube:// scheme at runtime (production Windows installers do it themselves).
            #[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = _app.deep_link().register_all();
            }
            Ok(())
        })
        .manage(jobs::JobRegistry::default())
        .invoke_handler(tauri::generate_handler![
            commands::fetch_media_info,
            commands::start_download,
            commands::cancel_download,
            commands::pick_folder,
            commands::default_download_dir,
            commands::open_path,
            commands::show_in_folder,
            commands::search_youtube,
            commands::get_youtube_stream_url,
            commands::get_youtube_native_stream,
            files::list_downloads,
            files::delete_download,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Patotube");
}
