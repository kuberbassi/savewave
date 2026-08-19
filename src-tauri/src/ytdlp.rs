use crate::security::validate_url;

fn supports_multi_item(url: &str) -> bool {
    validate_url(url)
        .ok()
        .and_then(|parsed| parsed.host_str().map(str::to_ascii_lowercase))
        .is_some_and(|host| {
            host.ends_with("instagram.com")
                || host.ends_with("facebook.com")
                || host == "fb.watch"
                || host.ends_with("threads.net")
                || host.ends_with("twitter.com")
                || host == "x.com"
        })
}

pub fn resolve_args(url: &str) -> Result<Vec<String>, String> {
    validate_url(url)?;
    let playlist_mode = if supports_multi_item(url) {
        "--yes-playlist"
    } else {
        "--no-playlist"
    };
    Ok(vec![
        "--dump-single-json",
        playlist_mode,
        "--playlist-end",
        "20",
        "--no-warnings",
        "--socket-timeout",
        "15",
        "--retries",
        "3",
        "--fragment-retries",
        "3",
        "--js-runtimes",
        "node",
        "--remote-components",
        "ejs:github",
        url,
    ]
    .into_iter()
    .map(str::to_string)
    .collect())
}

pub fn download_args(
    url: &str,
    mode: &str,
    output_dir: &str,
    temp_dir: &str,
    template: &str,
    ffmpeg_location: &str,
) -> Result<Vec<String>, String> {
    validate_url(url)?;
    let temp_path = format!("temp:{temp_dir}");
    let playlist_mode = if supports_multi_item(url) {
        "--yes-playlist"
    } else {
        "--no-playlist"
    };
    let mut args = vec![
        playlist_mode.into(),
        "--playlist-end".into(),
        "20".into(),
        "--no-warnings".into(),
        "--newline".into(),
        "--continue".into(),
        "--socket-timeout".into(),
        "15".into(),
        "--retries".into(),
        "5".into(),
        "--fragment-retries".into(),
        "5".into(),
        "--extractor-retries".into(),
        "3".into(),
        "--file-access-retries".into(),
        "3".into(),
        "--retry-sleep".into(),
        "1".into(),
        "--js-runtimes".into(),
        "node".into(),
        "--remote-components".into(),
        "ejs:github".into(),
        "--no-overwrites".into(),
        "--paths".into(),
        output_dir.into(),
        "--paths".into(),
        temp_path,
        "-o".into(),
        template.into(),
        "--ffmpeg-location".into(),
        ffmpeg_location.into(),
        "--print".into(),
        "after_move:savewave-file:%(filepath)s".into(),
    ];
    if mode == "audio" {
        // Select the actual best source audio, then extract/remux it into its
        // natural audio extension. `best` does not force lossy MP3 conversion.
        args.extend([
            "-f".into(),
            "bestaudio/best".into(),
            "--extract-audio".into(),
            "--audio-format".into(),
            "best".into(),
        ]);
    } else {
        // Preserve the best video and audio streams. Prefer MP4 when their
        // codecs are compatible, with MKV as a lossless container fallback.
        args.extend([
            "-f".into(),
            // Prefer separate direct video/audio streams. `bestvideo*` also
            // accepts combined HLS formats, which can outrank the direct
            // streams and then fail part-way through with HTTP fragment
            // errors even though reliable DASH streams are available.
            "bestvideo+bestaudio/best".into(),
            "--merge-output-format".into(),
            "mp4/mkv".into(),
        ]);
    }
    args.push(url.into());
    Ok(args)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn user_url_is_one_structured_argument() {
        let args = download_args(
            "https://example.com/a?v=1&x=2",
            "video",
            "C:/Downloads",
            "C:/Temp/job",
            "%(title)s.%(ext)s",
            "/opt/ffmpeg",
        )
        .unwrap();
        assert_eq!(args.last().unwrap(), "https://example.com/a?v=1&x=2");
    }
    #[test]
    fn audio_uses_best_source_and_natural_extension() {
        let args = download_args(
            "https://example.com/a",
            "audio",
            "/tmp",
            "/tmp/job",
            "%(title)s.%(ext)s",
            "/opt/ffmpeg",
        )
        .unwrap();
        assert!(args.contains(&"bestaudio/best".into()));
        assert!(args
            .windows(2)
            .any(|pair| pair == ["--audio-format", "best"]));
        assert!(!args.iter().any(|arg| arg == "mp3"));
        assert!(args
            .windows(2)
            .any(|pair| pair == ["--ffmpeg-location", "/opt/ffmpeg"]));
        assert!(args.windows(2).any(|pair| pair == ["--retries", "5"]));
    }
    #[test]
    fn video_uses_best_streams_with_lossless_container_fallback() {
        let args = download_args(
            "https://example.com/a",
            "video",
            "/tmp",
            "/tmp/job",
            "%(title)s.%(ext)s",
            "/opt/ffmpeg",
        )
        .unwrap();
        assert!(args.contains(&"bestvideo+bestaudio/best".into()));
        assert!(args
            .windows(2)
            .any(|pair| pair == ["--merge-output-format", "mp4/mkv"]));
    }
    #[test]
    fn social_posts_allow_bounded_carousels_but_youtube_stays_single_item() {
        let social = download_args(
            "https://instagram.com/p/example",
            "video",
            "/tmp",
            "/tmp/job",
            "%(title)s.%(ext)s",
            "/opt/ffmpeg",
        )
        .unwrap();
        assert!(social.contains(&"--yes-playlist".into()));
        assert!(social
            .windows(2)
            .any(|pair| pair == ["--playlist-end", "20"]));
        let youtube = resolve_args("https://youtube.com/watch?v=abc").unwrap();
        assert!(youtube.contains(&"--no-playlist".into()));
    }
}
