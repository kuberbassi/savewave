mod commands;
mod gallery;
mod jobs;
mod models;
mod security;
mod spotify;
mod ytdlp;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .manage(jobs::JobStore::default())
        .plugin(tauri_plugin_opener::init());
    #[cfg(target_os = "android")]
    let builder = builder.plugin(
        tauri::plugin::Builder::<tauri::Wry>::new("savewave-media")
            .setup(|_, api| {
                api.register_android_plugin(
                    "com.kuberbassi.savewave.media",
                    "SavewaveMediaPlugin",
                )?;
                Ok(())
            })
            .build(),
    );
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_shell::init());
    builder
        .invoke_handler(tauri::generate_handler![
            commands::get_capabilities,
            commands::get_engine_status,
            commands::get_release_info,
            commands::get_spotify_metadata,
            commands::search_spotify_candidates,
            commands::resolve_media,
            commands::download_media,
            commands::get_download_progress,
            commands::cancel_download
        ])
        .run(tauri::generate_context!())
        .expect("error while running Savewave");
}
