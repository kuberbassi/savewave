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

fn adjacent_binary(name: &str) -> Result<std::path::PathBuf, String> {
    let executable = std::env::current_exe().map_err(|_| "ENGINE_UNAVAILABLE")?;
    let filename = if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.to_string()
    };
    let path = executable
        .parent()
        .ok_or("ENGINE_UNAVAILABLE")?
        .join(filename);
    path.is_file()
        .then_some(path)
        .ok_or("ENGINE_UNAVAILABLE".into())
}

#[tauri::command]
pub async fn get_spotify_metadata(url: String) -> Result<Value, String> {
    crate::spotify::metadata(&url).await
}

#[tauri::command]
pub async fn search_spotify_candidates(
    app: AppHandle,
    query: String,
) -> Result<Vec<Value>, String> {
    crate::spotify::candidates(&app, &query).await
}

#[tauri::command]
pub async fn search_youtube_music(query: String, filter: String) -> Result<Value, String> {
    crate::spotify::youtube_music_search(&query, &filter).await
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
    let ffmpeg_output = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|_| "ENGINE_UNAVAILABLE")?
        .args(["-version"])
        .output()
        .await
        .map_err(|_| "ENGINE_UNAVAILABLE")?;
    if !ffmpeg_output.status.success() {
        return Err("ENGINE_UNAVAILABLE".into());
    }
    let ffmpeg_version = String::from_utf8_lossy(&ffmpeg_output.stdout)
        .lines()
        .next()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .ok_or("ENGINE_UNAVAILABLE")?;
    Ok(EngineStatus {
        available: true,
        version: env!("CARGO_PKG_VERSION").into(),
        engine_version: Some(engine_version),
        ffmpeg_version: Some(ffmpeg_version),
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
            error_code: None,
            error_message: None,
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
                        error_code: None,
                        error_message: None,
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
                    error_code: None,
                    error_message: None,
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
                    error_code: Some("DOWNLOAD_FAILED".into()),
                    error_message: Some(
                        "The image download could not be completed. Please retry.".into(),
                    ),
                }),
            }
        });
        return Ok(queued);
    }
    let template = format!("{}-%(id)s.%(ext)s", title);
    let ffmpeg_path = adjacent_binary("ffmpeg")?;
    let args = ytdlp::download_args(
        &request.url,
        &request.mode,
        downloads.to_str().ok_or("SAVE_FAILED")?,
        temp_dir.to_str().ok_or("SAVE_FAILED")?,
        &template,
        ffmpeg_path.to_str().ok_or("ENGINE_UNAVAILABLE")?,
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
        error_code: None,
        error_message: None,
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
        let mut stdout = String::new();
        let mut stderr = String::new();
        let mut completed_filename = None;
        while let Some(event) = receiver.recv().await {
            if store
                .get(&id_for_task)
                .is_some_and(|job| job.state == "cancelled")
            {
                return;
            }
            match event {
                CommandEvent::Stdout(bytes) => {
                    let output = String::from_utf8_lossy(&bytes);
                    append_bounded(&mut stdout, &output);
                    if let Some(filename) = parse_output_filename(&stdout) {
                        completed_filename = Some(filename);
                    }
                    if let Some(percent) = parse_percent(&output) {
                        store.update(DownloadProgress {
                            job_id: id_for_task.clone(),
                            state: "downloading".into(),
                            percent: Some(percent),
                            downloaded_bytes: None,
                            total_bytes: None,
                            speed: None,
                            eta: None,
                            filename: completed_filename.clone(),
                            error_code: None,
                            error_message: None,
                        });
                    }
                }
                CommandEvent::Stderr(bytes) => {
                    append_bounded(&mut stderr, &String::from_utf8_lossy(&bytes))
                }
                CommandEvent::Terminated(payload) => {
                    let _ = std::fs::remove_dir_all(&temp_dir);
                    let success = payload.code == Some(0);
                    let (error_code, error_message) = if success {
                        (None, None)
                    } else {
                        let (code, message) = classify_download_error(&stderr);
                        (Some(code.into()), Some(message))
                    };
                    store.update(DownloadProgress {
                        job_id: id_for_task.clone(),
                        state: if success { "completed" } else { "error" }.into(),
                        percent: if success { Some(100.0) } else { None },
                        downloaded_bytes: None,
                        total_bytes: None,
                        speed: None,
                        eta: None,
                        filename: completed_filename.clone(),
                        error_code,
                        error_message,
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

fn parse_output_filename(output: &str) -> Option<String> {
    output.lines().find_map(|line| {
        let path = line.trim().strip_prefix("savewave-file:")?;
        std::path::Path::new(path)
            .file_name()
            .and_then(|name| name.to_str())
            .map(str::to_string)
    })
}

fn append_bounded(target: &mut String, value: &str) {
    target.push_str(value);
    if target.len() > 8_192 {
        let split = target.len() - 8_192;
        target.drain(..split);
    }
}

fn classify_download_error(stderr: &str) -> (&'static str, String) {
    let lower = stderr.to_ascii_lowercase();
    if lower.contains("ffmpeg not found") || lower.contains("ffprobe and ffmpeg not found") {
        return (
            "ENGINE_UNAVAILABLE",
            "The bundled media processor is unavailable. Reinstall Savewave and retry.".into(),
        );
    }
    if lower.contains("no space left") || lower.contains("disk full") {
        return (
            "SAVE_FAILED",
            "There is not enough free storage to finish this download.".into(),
        );
    }
    if lower.contains("permission denied") || lower.contains("access is denied") {
        return (
            "PERMISSION_DENIED",
            "Savewave could not write to the Downloads folder.".into(),
        );
    }
    if lower.contains("private video")
        || lower.contains("sign in")
        || lower.contains("cookies")
        || lower.contains("login")
    {
        return (
            "SOURCE_REJECTED",
            "This source is private or login-gated. Try public media instead.".into(),
        );
    }
    if lower.contains("http error 429") || lower.contains("too many requests") {
        return (
            "SOURCE_UNAVAILABLE",
            "The source is temporarily rate-limiting downloads. Wait a few minutes and retry.".into(),
        );
    }
    if lower.contains("http error 403") || lower.contains("forbidden") {
        return (
            "SOURCE_REJECTED",
            "The source refused this download. Try another public link or retry later.".into(),
        );
    }
    if lower.contains("http error 404") || lower.contains("not found") {
        return (
            "SOURCE_UNAVAILABLE",
            "The source media is no longer available.".into(),
        );
    }
    if lower.contains("timed out")
        || lower.contains("connection reset")
        || lower.contains("connection aborted")
        || lower.contains("unable to download")
    {
        return (
            "SOURCE_UNAVAILABLE",
            "The source interrupted the download. Check your connection and retry.".into(),
        );
    }
    (
        "DOWNLOAD_FAILED",
        "The download could not be completed. Please retry.".into(),
    )
}

#[cfg(test)]
mod tests {
    use super::{classify_download_error, parse_output_filename, parse_percent, version_is_newer};
    #[test]
    fn parses_normalized_progress() {
        assert_eq!(parse_percent("[download]  42.5% of 10MiB"), Some(42.5));
        assert_eq!(parse_percent("warning"), None);
    }
    #[test]
    fn parses_completed_filename_from_ytdlp_output() {
        assert_eq!(
            parse_output_filename("savewave-file:C:\\Downloads\\Song.webm\n"),
            Some("Song.webm".into())
        );
    }
    #[test]
    fn reports_missing_bundled_ffmpeg_actionably() {
        let (code, message) =
            classify_download_error("ERROR: Postprocessing: ffprobe and ffmpeg not found");
        assert_eq!(code, "ENGINE_UNAVAILABLE");
        assert!(message.contains("media processor"));
    }
    #[test]
    fn distinguishes_provider_http_errors_from_connection_failures() {
        let (code, message) = classify_download_error("ERROR: HTTP Error 403: Forbidden");
        assert_eq!(code, "SOURCE_REJECTED");
        assert!(message.contains("refused"));

        let (_, message) = classify_download_error("ERROR: HTTP Error 429: Too Many Requests");
        assert!(message.contains("rate-limiting"));

        let (_, message) = classify_download_error("ERROR: connection reset by peer");
        assert!(message.contains("connection"));
    }
    #[test]
    fn compares_release_versions_numerically() {
        assert!(version_is_newer("1.10.0", "1.9.9"));
        assert!(!version_is_newer("1.0.0", "1.0.0"));
        assert!(!version_is_newer("invalid", "1.0.0"));
    }
}
