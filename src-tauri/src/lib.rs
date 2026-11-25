mod commands;
mod sidecar;

use commands::AppState;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = AppState {
        jobs: Arc::new(RwLock::new(HashMap::new())),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .manage(state)
        .setup(|_app| {
            tauri::async_runtime::spawn(async {
                sidecar::auto_update_ytdlp_background().await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_capabilities,
            commands::get_engine_status,
            commands::get_release_info,
            commands::resolve_media,
            commands::download_media,
            commands::get_download_progress,
            commands::cancel_download,
            commands::open_external,
            commands::open_downloads_folder,
            commands::authenticate_instagram,
            commands::install_windows_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Savewave desktop");
}
