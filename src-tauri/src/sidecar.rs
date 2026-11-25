use regex::Regex;
use savewave_core::errors::{classify_error_text, ErrorCode, SavewaveError};
use savewave_core::filename::sanitize_filename;
use savewave_core::models::{
    DownloadProgress, DownloadRequest, DownloadState, EngineStatus, MediaMode, MediaSource,
    ResolvedMedia,
};
use savewave_core::quality::{automatic_format_arguments, create_download_policy};
use savewave_core::sources::{canonical_media_url, detect_source, is_unavailable_source, validate_public_url};
use savewave_core::APP_VERSION;
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Arc, OnceLock};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::RwLock;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn progress_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"\[download\]\s+([\d.]+)%").unwrap())
}

fn speed_eta_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"at\s+([^\s]+/s)\s+ETA\s+([0-9:]+)").unwrap())
}

pub struct ActiveJob {
    pub progress: DownloadProgress,
    pub child: Option<Child>,
    pub temp_dir: PathBuf,
}

pub type JobStore = Arc<RwLock<HashMap<String, ActiveJob>>>;

pub fn managed_ytdlp_path() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(std::env::temp_dir)
        .join("Savewave")
        .join("bin")
        .join(if cfg!(target_os = "windows") {
            "yt-dlp.exe"
        } else {
            "yt-dlp"
        })
}

pub fn resolve_binary(name: &str) -> PathBuf {
    if name == "yt-dlp" {
        let managed = managed_ytdlp_path();
        if managed.exists() {
            return managed;
        }
    }
    resolve_bundled_binary(name)
}

fn resolve_bundled_binary(name: &str) -> PathBuf {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));

    let ext = if cfg!(target_os = "windows") { ".exe" } else { "" };
    let target_triple = if cfg!(all(target_os = "windows", target_arch = "x86_64")) {
        "x86_64-pc-windows-msvc"
    } else if cfg!(all(target_os = "windows", target_arch = "aarch64")) {
        "aarch64-pc-windows-msvc"
    } else {
        "x86_64-unknown-linux-gnu"
    };

    let candidates = [
        exe_dir.join(format!("{name}{ext}")),
        exe_dir.join("binaries").join(format!("{name}-{target_triple}{ext}")),
        exe_dir.join(format!("{name}-{target_triple}{ext}")),
        PathBuf::from("src-tauri").join("binaries").join(format!("{name}-{target_triple}{ext}")),
        PathBuf::from("assets").join("binaries").join(format!("{name}-{target_triple}{ext}")),
    ];

    for cand in &candidates {
        if cand.exists() {
            return cand.clone();
        }
    }
    PathBuf::from(format!("{name}{ext}"))
}

/// Keeps yt-dlp updated automatically in the background (at most once every 24h)
/// inside a user-writable folder so updates never require reinstalling Savewave.
pub async fn auto_update_ytdlp_background() {
    let managed = managed_ytdlp_path();
    let Some(bin_dir) = managed.parent() else {
        return;
    };
    let stamp = bin_dir.join(".last-ytdlp-update");
    if let Ok(meta) = tokio::fs::metadata(&stamp).await {
        if let Ok(modified) = meta.modified() {
            if modified
                .elapsed()
                .map(|d| d.as_secs() < 86_400)
                .unwrap_or(false)
            {
                return;
            }
        }
    }

    let _ = tokio::fs::create_dir_all(bin_dir).await;
    if !managed.exists() {
        let bundled = resolve_bundled_binary("yt-dlp");
        if bundled.exists() {
            let _ = tokio::fs::copy(&bundled, &managed).await;
        }
    }
    if managed.exists() {
        let _ = new_command(&managed).arg("-U").output().await;
        let _ = tokio::fs::write(&stamp, "ok").await;
    }
}

fn new_command(program: &Path) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

pub fn instagram_cookie_path() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(std::env::temp_dir)
        .join("Savewave")
        .join("instagram-session.txt")
}

pub async fn check_engine_status() -> EngineStatus {
    let ytdlp = resolve_binary("yt-dlp");
    let ffmpeg = resolve_binary("ffmpeg");

    let (yt_out, ff_out) = tokio::join!(
        new_command(&ytdlp).arg("--version").output(),
        new_command(&ffmpeg).arg("-version").output(),
    );

    match (yt_out, ff_out) {
        (Ok(y), Ok(f)) if y.status.success() && f.status.success() => {
            let engine_version = String::from_utf8_lossy(&y.stdout).trim().to_string();
            let ffmpeg_version = String::from_utf8_lossy(&f.stdout)
                .lines()
                .next()
                .unwrap_or("bundled")
                .trim()
                .to_string();
            EngineStatus {
                available: true,
                initializing: false,
                version: APP_VERSION.to_string(),
                engine_version: Some(engine_version),
                ffmpeg_version: Some(ffmpeg_version),
                update_available: false,
                error: None,
            }
        }
        _ => EngineStatus {
            available: false,
            initializing: false,
            version: APP_VERSION.to_string(),
            engine_version: None,
            ffmpeg_version: None,
            update_available: false,
            error: Some("Bundled yt-dlp or FFmpeg binary not found.".to_string()),
        },
    }
}

pub async fn resolve_media_with_sidecar(
    raw_url: &str,
    mode: MediaMode,
) -> Result<ResolvedMedia, SavewaveError> {
    let source = detect_source(raw_url);
    if is_unavailable_source(source, Some(raw_url)) {
        return Err(SavewaveError::from_code(ErrorCode::UnsupportedSource));
    }
    validate_public_url(raw_url)?;
    let url = canonical_media_url(raw_url);

    // Spotify is resolved 100% natively in Rust (savewave-core Spotify Matcher v2)!
    if source == MediaSource::Spotify {
        return savewave_core::spotify::resolve_spotify_smart_match(&url).await;
    }

    // Direct media links don't need yt-dlp metadata extraction
    if source == MediaSource::Direct {
        let filename = url
            .split('/')
            .next_back()
            .unwrap_or("direct-media")
            .split('?')
            .next()
            .unwrap_or("direct-media");
        let lower = filename.to_ascii_lowercase();
        let media_type = if lower.ends_with(".jpg")
            || lower.ends_with(".jpeg")
            || lower.ends_with(".png")
            || lower.ends_with(".webp")
        {
            "image"
        } else if lower.ends_with(".mp3")
            || lower.ends_with(".m4a")
            || lower.ends_with(".wav")
            || lower.ends_with(".flac")
            || lower.ends_with(".ogg")
            || lower.ends_with(".aac")
        {
            "audio"
        } else {
            "video"
        };
        return Ok(ResolvedMedia {
            success: true,
            platform: MediaSource::Direct,
            title: sanitize_filename(filename, 120),
            creator: "Direct Link".to_string(),
            thumbnail: if media_type == "image" {
                Some(url.clone())
            } else {
                None
            },
            duration: None,
            media_type: media_type.to_string(),
            quality_label: "Original direct file".to_string(),
            source_url: url,
            fallback_source_urls: Vec::new(),
            selection_required: false,
            match_options: Vec::new(),
        });
    }

    // YouTube, Instagram Reels, SoundCloud, Threads -> yt-dlp --dump-single-json
    let ytdlp = resolve_binary("yt-dlp");
    let mut cmd = new_command(&ytdlp);
    cmd.arg("--dump-single-json")
        .arg("--no-warnings")
        .arg("--no-playlist")
        .arg("--skip-download")
        .arg("--socket-timeout")
        .arg("15")
        .arg("--retries")
        .arg("2")
        .arg("--force-ipv4");

    if source == MediaSource::Instagram {
        let cookie_file = instagram_cookie_path();
        if cookie_file.exists() {
            cmd.arg("--cookies").arg(cookie_file);
        }
    }
    cmd.arg(&url);

    let output = cmd
        .output()
        .await
        .map_err(|_| SavewaveError::from_code(ErrorCode::EngineUnavailable))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let code = classify_error_text(&stderr);
        if source == MediaSource::Instagram
            && matches!(
                code,
                ErrorCode::AuthRequired | ErrorCode::SourceForbidden | ErrorCode::SourceRejected
            )
        {
            let _ = std::fs::remove_file(instagram_cookie_path());
        }
        return Err(SavewaveError::from_code(code));
    }

    let info: Value = serde_json::from_slice(&output.stdout)
        .map_err(|_| SavewaveError::from_code(ErrorCode::NoMediaFound))?;

    let title = info
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Untitled media")
        .trim()
        .to_string();
    let creator = info
        .get("uploader")
        .or_else(|| info.get("channel"))
        .or_else(|| info.get("artist"))
        .and_then(|v| v.as_str())
        .unwrap_or(source.as_str())
        .trim()
        .to_string();
    let thumbnail = info
        .get("thumbnail")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let duration = info
        .get("duration")
        .and_then(|v| v.as_f64())
        .map(|d| d.round() as u64);

    let media_type = match mode {
        MediaMode::Audio => "audio",
        MediaMode::Video => "video",
    };
    let quality_label = match mode {
        MediaMode::Audio => "Best available audio".to_string(),
        MediaMode::Video => {
            if let Some(h) = info.get("height").and_then(|v| v.as_u64()) {
                format!("Up to {h}p (Auto Best)")
            } else {
                "Best available quality".to_string()
            }
        }
    };

    Ok(ResolvedMedia {
        success: true,
        platform: source,
        title,
        creator,
        thumbnail,
        duration,
        media_type: media_type.to_string(),
        quality_label,
        source_url: url,
        fallback_source_urls: Vec::new(),
        selection_required: false,
        match_options: Vec::new(),
    })
}

pub async fn start_download_job(
    store: JobStore,
    request: DownloadRequest,
) -> Result<DownloadProgress, SavewaveError> {
    let source = request.source.unwrap_or_else(|| detect_source(&request.url));
    if is_unavailable_source(source, Some(&request.url)) {
        return Err(SavewaveError::from_code(ErrorCode::UnsupportedSource));
    }
    validate_public_url(&request.url)?;

    let job_id = uuid::Uuid::new_v4().to_string();
    let temp_dir = std::env::temp_dir().join("savewave").join(&job_id);
    tokio::fs::create_dir_all(&temp_dir)
        .await
        .map_err(|_| SavewaveError::from_code(ErrorCode::DownloadFailed))?;

    let downloads_dir = dirs::download_dir().unwrap_or_else(std::env::temp_dir);
    let policy = create_download_policy(request.mode, Some(source));
    let safe_title = sanitize_filename(request.title.as_deref().unwrap_or("media"), 100);
    let ytdlp = resolve_binary("yt-dlp");
    let ffmpeg = resolve_binary("ffmpeg");

    let mut args: Vec<String> = Vec::new();
    if source == MediaSource::Instagram {
        let cookie_file = instagram_cookie_path();
        if cookie_file.exists() {
            args.push("--cookies".into());
            args.push(cookie_file.to_string_lossy().into_owned());
        }
    }
    if policy.max_items > 1 {
        args.push("--yes-playlist".into());
        args.push("--playlist-end".into());
        args.push(policy.max_items.to_string());
    } else {
        args.push("--no-playlist".into());
    }
    args.extend([
        "--newline".into(),
        "--continue".into(),
        "--socket-timeout".into(),
        policy.socket_timeout_seconds.to_string(),
        "--retries".into(),
        policy.retries.to_string(),
        "--fragment-retries".into(),
        policy.fragment_retries.to_string(),
        "--extractor-retries".into(),
        policy.extractor_retries.to_string(),
        "--file-access-retries".into(),
        "3".into(),
        "--retry-sleep".into(),
        "1".into(),
        "--force-ipv4".into(),
        "--no-overwrites".into(),
        "--paths".into(),
        downloads_dir.to_string_lossy().into_owned(),
        "--paths".into(),
        format!("temp:{}", temp_dir.to_string_lossy()),
        "--ffmpeg-location".into(),
        ffmpeg.to_string_lossy().into_owned(),
        "--print".into(),
        "after_move:savewave-file:%(filepath)s".into(),
        "-o".into(),
        if policy.max_items > 1 {
            format!("{safe_title}-%(playlist_index)02d-%(id)s.%(ext)s")
        } else {
            format!("{safe_title}-%(id)s.%(ext)s")
        },
    ]);
    args.extend(automatic_format_arguments(request.mode, Some(source)));
    args.push(canonical_media_url(&request.url));

    let mut child = new_command(&ytdlp)
        .args(&args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|_| SavewaveError::from_code(ErrorCode::EngineUnavailable))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let initial = DownloadProgress {
        job_id: job_id.clone(),
        state: DownloadState::Downloading,
        percent: Some(0.0),
        downloaded_bytes: None,
        total_bytes: None,
        speed: None,
        eta: None,
        filename: None,
        filenames: Vec::new(),
        error_code: None,
        error_message: None,
    };

    store.write().await.insert(
        job_id.clone(),
        ActiveJob {
            progress: initial.clone(),
            child: Some(child),
            temp_dir: temp_dir.clone(),
        },
    );

    let store_bg = Arc::clone(&store);
    let job_id_bg = job_id.clone();
    let url_source = source;

    tokio::spawn(async move {
        let mut stderr_buf = String::new();

        let store_out = Arc::clone(&store_bg);
        let jid_out = job_id_bg.clone();
        let stdout_task = tokio::spawn(async move {
            if let Some(out) = stdout {
                let mut reader = BufReader::new(out).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    if let Some(caps) = progress_re().captures(&line) {
                        if let Ok(pct) = caps[1].parse::<f64>() {
                            let mut guard = store_out.write().await;
                            if let Some(job) = guard.get_mut(&jid_out) {
                                job.progress.percent = Some(pct.min(100.0));
                                if let Some(se) = speed_eta_re().captures(&line) {
                                    job.progress.speed = Some(se[1].to_string());
                                    job.progress.eta = Some(se[2].to_string());
                                }
                            }
                        }
                    }
                    if let Some(path_str) = line.strip_prefix("savewave-file:") {
                        let name = Path::new(path_str.trim())
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("saved-media")
                            .to_string();
                        let mut guard = store_out.write().await;
                        if let Some(job) = guard.get_mut(&jid_out) {
                            job.progress.filename = Some(name.clone());
                            if !job.progress.filenames.contains(&name) {
                                job.progress.filenames.push(name);
                            }
                        }
                    }
                }
            }
        });

        let stderr_task = tokio::spawn(async move {
            let mut acc = String::new();
            if let Some(err) = stderr {
                let mut reader = BufReader::new(err).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    if acc.len() < 16_000 {
                        acc.push_str(&line);
                        acc.push('\n');
                    }
                }
            }
            acc
        });

        let _ = stdout_task.await;
        if let Ok(err_text) = stderr_task.await {
            stderr_buf = err_text;
        }

        let mut child_opt = {
            let mut guard = store_bg.write().await;
            guard.get_mut(&job_id_bg).and_then(|j| j.child.take())
        };

        let status = match child_opt.as_mut() {
            Some(c) => c.wait().await.ok(),
            None => None,
        };

        let mut guard = store_bg.write().await;
        if let Some(job) = guard.get_mut(&job_id_bg) {
            if job.progress.state != DownloadState::Cancelled {
                if status.map(|s| s.success()).unwrap_or(false) {
                    job.progress.state = DownloadState::Completed;
                    job.progress.percent = Some(100.0);
                } else {
                    let code = classify_error_text(&stderr_buf);
                    if url_source == MediaSource::Instagram
                        && matches!(
                            code,
                            ErrorCode::AuthRequired
                                | ErrorCode::SourceForbidden
                                | ErrorCode::SourceRejected
                        )
                    {
                        let _ = std::fs::remove_file(instagram_cookie_path());
                    }
                    job.progress.state = DownloadState::Error;
                    job.progress.error_code = Some(code.as_str().to_string());
                    job.progress.error_message = Some(code.user_message().to_string());
                }
            }
        }
        let _ = tokio::fs::remove_dir_all(&temp_dir).await;
    });

    Ok(initial)
}
