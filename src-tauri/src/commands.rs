use crate::{
    gallery,
    jobs::JobStore,
    models::{DownloadProgress, EngineStatus, MediaRequest, ReleaseInfo, ResolvedMedia},
    security::sanitize_filename,
    ytdlp,
};
use serde_json::Value;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use uuid::Uuid;

#[tauri::command]
pub async fn get_spotify_metadata(url: String) -> Result<Value, String> {
    crate::spotify::metadata(&url).await
}

#[tauri::command]
pub async fn search_spotify_candidates(
    app: AppHandle,
    title: String,
    artist: String,
) -> Result<Vec<Value>, String> {
    crate::spotify::candidates(&app, &title, &artist).await
}

#[tauri::command]
pub async fn get_capabilities() -> Value {
    serde_json::json!({"platform":"desktop","sources":{"youtube":{"video":true,"audio":true,"media":true},"instagram":{"media":true},"facebook":{"media":true},"threads":{"media":true},"twitter":{"media":true},"soundcloud":{"audio":true},"spotify":{"audio":true,"smartMatch":true},"direct":{"video":true,"audio":true,"media":true},"unknown":{}}})
}

#[tauri::command]
pub async fn get_engine_status(app: AppHandle) -> Result<EngineStatus, String> {
    let shell_output = app
        .shell()
        .sidecar("yt-dlp")
        .ok()
        .map(|command| command.args(["--version"]).output());
    let engine_version = match shell_output {
        Some(request) => match request.await {
            Ok(output) if output.status.success() => {
                String::from_utf8_lossy(&output.stdout).trim().to_string()
            }
            _ => adjacent_ytdlp_version().await?,
        },
        None => adjacent_ytdlp_version().await?,
    };
    Ok(EngineStatus {
        available: true,
        version: env!("CARGO_PKG_VERSION").into(),
        engine_version: Some(engine_version),
        ffmpeg_version: None,
        update_available: false,
    })
}

async fn adjacent_ytdlp_version() -> Result<String, String> {
    let executable = std::env::current_exe().map_err(|_| "ENGINE_UNAVAILABLE")?;
    let name = if cfg!(windows) {
        "yt-dlp.exe"
    } else {
        "yt-dlp"
    };
    let path = executable.parent().ok_or("ENGINE_UNAVAILABLE")?.join(name);
    let output = tokio::task::spawn_blocking(move || {
        std::process::Command::new(path).arg("--version").output()
    })
    .await
    .map_err(|_| "ENGINE_UNAVAILABLE")?
    .map_err(|_| "ENGINE_UNAVAILABLE")?;
    if !output.status.success() {
        return Err("ENGINE_UNAVAILABLE".into());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[tauri::command]
pub async fn get_release_info() -> Result<ReleaseInfo, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .user_agent(concat!("Savewave/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|_| "UPDATE_CHECK_FAILED")?;
    let mut release: ReleaseInfo = client
        .get(
            "https://raw.githubusercontent.com/kuberbassi/savewave/main/public/client-version.json",
        )
        .header(reqwest::header::CACHE_CONTROL, "no-cache")
        .send()
        .await
        .map_err(|_| "UPDATE_CHECK_FAILED")?
        .error_for_status()
        .map_err(|_| "UPDATE_CHECK_FAILED")?
        .json()
        .await
        .map_err(|_| "UPDATE_CHECK_FAILED")?;
    for value in [
        &release.download_url,
        &release.release_url,
        &release.changelog_url,
    ] {
        let parsed = url::Url::parse(value).map_err(|_| "UPDATE_CHECK_FAILED")?;
        if parsed.scheme() != "https"
            || !parsed.host_str().is_some_and(|host| {
                host == "github.com"
                    || host.ends_with(".github.com")
                    || host == "raw.githubusercontent.com"
                    || host == "savewave.kuberbassi.com"
            })
        {
            return Err("UPDATE_CHECK_FAILED".into());
        }
    }
    release.update_available = version_is_newer(&release.version, env!("CARGO_PKG_VERSION"));
    Ok(release)
}

fn version_is_newer(candidate: &str, installed: &str) -> bool {
    fn parts(value: &str) -> Option<Vec<u64>> {
        value
            .trim_start_matches('v')
            .split('.')
            .map(str::parse)
            .collect::<Result<Vec<_>, _>>()
            .ok()
    }
    matches!((parts(candidate), parts(installed)), (Some(candidate), Some(installed)) if candidate > installed)
}

#[tauri::command]
pub async fn resolve_media(app: AppHandle, request: MediaRequest) -> Result<ResolvedMedia, String> {
    crate::security::validate_public_destination(&request.url).await?;
    let args = ytdlp::resolve_args(&request.url)?;
    let output = app
        .shell()
        .sidecar("yt-dlp")
        .map_err(|_| "ENGINE_UNAVAILABLE")?
        .args(args)
        .output()
        .await
        .map_err(|_| "SOURCE_UNAVAILABLE")?;
    let info: Option<Value> = serde_json::from_slice(&output.stdout).ok();
    if !output.status.success() {
        if let Some(found) = gallery::resolve_instagram(
            &request.url,
            info.as_ref(),
            &String::from_utf8_lossy(&output.stderr),
        )
        .await?
        {
            let count = found.images.len();
            return Ok(ResolvedMedia {
                success: true,
                platform: found.platform,
                title: found.title,
                creator: found.creator,
                thumbnail: found.images.first().map(|image| image.url.clone()),
                duration: None,
                media_type: "image".into(),
                quality_label: format!("{count} original images"),
                source_url: request.url,
            });
        }
        return Err("SOURCE_REJECTED".into());
    }
    let info = info.ok_or("NO_MEDIA_FOUND")?;
    Ok(ResolvedMedia {
        success: true,
        platform: info["extractor_key"]
            .as_str()
            .unwrap_or("web")
            .to_lowercase(),
        title: info["title"].as_str().unwrap_or("Media").into(),
        creator: info["uploader"]
            .as_str()
            .or(info["channel"].as_str())
            .unwrap_or("Unknown creator")
            .into(),
        thumbnail: info["thumbnail"].as_str().map(str::to_string),
        duration: info["duration"].as_f64(),
        media_type: request.mode,
        quality_label: "Best available".into(),
        source_url: request.url,
    })
}

#[tauri::command]
pub async fn download_media(
    app: AppHandle,
    jobs: State<'_, JobStore>,
    request: MediaRequest,
) -> Result<DownloadProgress, String> {
    crate::security::validate_public_destination(&request.url).await?;
    let job_id = Uuid::new_v4().to_string();
    let downloads = app.path().download_dir().map_err(|_| "SAVE_FAILED")?;
    let title = sanitize_filename(request.title.as_deref().unwrap_or("media"));
    let temp_dir = app
        .path()
        .app_cache_dir()
        .map_err(|_| "SAVE_FAILED")?
        .join("jobs")
        .join(&job_id);
    std::fs::create_dir_all(&temp_dir).map_err(|_| "SAVE_FAILED")?;
    let image_gallery = if gallery::is_instagram_url(&request.url) {
        let output = app
            .shell()
            .sidecar("yt-dlp")
            .map_err(|_| "ENGINE_UNAVAILABLE")?
            .args(ytdlp::resolve_args(&request.url)?)
            .output()
            .await
            .map_err(|_| "SOURCE_UNAVAILABLE")?;
        let info: Option<Value> = serde_json::from_slice(&output.stdout).ok();
        gallery::resolve_instagram(
            &request.url,
            info.as_ref(),
            &String::from_utf8_lossy(&output.stderr),
        )
        .await?
    } else {
        None
    };
    if let Some(found) = image_gallery {
        let queued = DownloadProgress {
            job_id: job_id.clone(),
            state: "downloading".into(),
            percent: Some(0.0),
            downloaded_bytes: None,
            total_bytes: None,
            speed: None,
            eta: None,
            filename: None,
        };
        jobs.insert(queued.clone(), None, Some(temp_dir.clone()));
        let store = app.state::<JobStore>().inner().clone();
        let id_for_task = job_id.clone();
        tauri::async_runtime::spawn(async move {
            let progress_store = store.clone();
            let progress_id = id_for_task.clone();
            let cancel_store = store.clone();
            let cancel_id = id_for_task.clone();
            let result = gallery::save_images(
                &found,
                &downloads,
                &temp_dir,
                move |percent| {
                    progress_store.update(DownloadProgress {
                        job_id: progress_id.clone(),
                        state: "downloading".into(),
                        percent: Some(percent),
                        downloaded_bytes: None,
                        total_bytes: None,
                        speed: None,
                        eta: None,
                        filename: None,
                    });
                },
                move || {
                    cancel_store
                        .get(&cancel_id)
                        .is_some_and(|job| job.state == "cancelled")
                },
            )
            .await;
            let _ = std::fs::remove_dir_all(&temp_dir);
            if store
                .get(&id_for_task)
                .is_some_and(|job| job.state == "cancelled")
            {
                return;
            }
            match result {
                Ok(filename) => store.update(DownloadProgress {
                    job_id: id_for_task,
                    state: "completed".into(),
                    percent: Some(100.0),
                    downloaded_bytes: None,
                    total_bytes: None,
                    speed: None,
                    eta: None,
                    filename: Some(filename),
                }),
                Err(_) => store.update(DownloadProgress {
                    job_id: id_for_task,
                    state: "error".into(),
                    percent: None,
                    downloaded_bytes: None,
                    total_bytes: None,
                    speed: None,
                    eta: None,
                    filename: None,
                }),
            }
        });
        return Ok(queued);
    }
    let template = format!("{}-%(id)s.%(ext)s", title);
    let args = ytdlp::download_args(
        &request.url,
        &request.mode,
        downloads.to_str().ok_or("SAVE_FAILED")?,
        temp_dir.to_str().ok_or("SAVE_FAILED")?,
        &template,
    )?;
    let queued = DownloadProgress {
        job_id: job_id.clone(),
        state: "downloading".into(),
        percent: Some(0.0),
        downloaded_bytes: None,
        total_bytes: None,
        speed: None,
        eta: None,
        filename: None,
    };
    let (mut receiver, child) = app
        .shell()
        .sidecar("yt-dlp")
        .map_err(|_| "ENGINE_UNAVAILABLE")?
        .args(args)
        .spawn()
        .map_err(|_| "DOWNLOAD_FAILED")?;
    jobs.insert(queued.clone(), Some(child), Some(temp_dir.clone()));
    let store = app.state::<JobStore>().inner().clone();
    let id_for_task = job_id.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = receiver.recv().await {
            if store
                .get(&id_for_task)
                .is_some_and(|job| job.state == "cancelled")
            {
                return;
            }
            match event {
                CommandEvent::Stdout(bytes) => {
                    if let Some(percent) = parse_percent(&String::from_utf8_lossy(&bytes)) {
                        store.update(DownloadProgress {
                            job_id: id_for_task.clone(),
                            state: "downloading".into(),
                            percent: Some(percent),
                            downloaded_bytes: None,
                            total_bytes: None,
                            speed: None,
                            eta: None,
                            filename: None,
                        });
                    }
                }
                CommandEvent::Terminated(payload) => {
                    let _ = std::fs::remove_dir_all(&temp_dir);
                    let success = payload.code == Some(0);
                    store.update(DownloadProgress {
                        job_id: id_for_task.clone(),
                        state: if success { "completed" } else { "error" }.into(),
                        percent: if success { Some(100.0) } else { None },
                        downloaded_bytes: None,
                        total_bytes: None,
                        speed: None,
                        eta: None,
                        filename: None,
                    });
                    break;
                }
                _ => {}
            }
        }
    });
    Ok(queued)
}

#[tauri::command]
pub fn get_download_progress(
    jobs: State<'_, JobStore>,
    job_id: String,
) -> Result<DownloadProgress, String> {
    jobs.get(&job_id).ok_or("DOWNLOAD_FAILED".into())
}
#[tauri::command]
pub fn cancel_download(jobs: State<'_, JobStore>, job_id: String) -> Result<(), String> {
    jobs.cancel(&job_id)
}

fn parse_percent(line: &str) -> Option<f64> {
    let before = line.split('%').next()?;
    before.split_whitespace().last()?.parse().ok()
}

#[cfg(test)]
mod tests {
    use super::{parse_percent, version_is_newer};
    #[test]
    fn parses_normalized_progress() {
        assert_eq!(parse_percent("[download]  42.5% of 10MiB"), Some(42.5));
        assert_eq!(parse_percent("warning"), None);
    }
    #[test]
    fn compares_release_versions_numerically() {
        assert!(version_is_newer("1.10.0", "1.9.9"));
        assert!(!version_is_newer("1.0.0", "1.0.0"));
        assert!(!version_is_newer("invalid", "1.0.0"));
    }
}
