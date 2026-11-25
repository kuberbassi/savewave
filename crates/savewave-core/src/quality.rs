use crate::models::{MediaMode, MediaSource};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadPolicy {
    pub format_selector: String,
    pub extract_audio: bool,
    pub audio_format: Option<String>,
    pub merge_output_format: Option<String>,
    pub socket_timeout_seconds: u32,
    pub retries: u32,
    pub fragment_retries: u32,
    pub extractor_retries: u32,
    pub max_items: u32,
}

pub fn create_download_policy(mode: MediaMode, source: Option<MediaSource>) -> DownloadPolicy {
    let social_source = matches!(
        source,
        Some(
            MediaSource::Instagram
                | MediaSource::Facebook
                | MediaSource::Threads
                | MediaSource::Twitter
        )
    );
    let multi_item_source = social_source && !matches!(source, Some(MediaSource::Instagram));
    let max_items = if multi_item_source { 20 } else { 1 };

    match mode {
        MediaMode::Audio => DownloadPolicy {
            format_selector: "bestaudio/best".to_string(),
            extract_audio: true,
            audio_format: Some("best".to_string()),
            merge_output_format: None,
            socket_timeout_seconds: 20,
            retries: 5,
            fragment_retries: 5,
            extractor_retries: 3,
            max_items,
        },
        MediaMode::Video if social_source => DownloadPolicy {
            format_selector: "best".to_string(),
            extract_audio: false,
            audio_format: None,
            merge_output_format: None,
            socket_timeout_seconds: 20,
            retries: 5,
            fragment_retries: 5,
            extractor_retries: 3,
            max_items,
        },
        MediaMode::Video => DownloadPolicy {
            format_selector: "bestvideo+bestaudio/best".to_string(),
            extract_audio: false,
            audio_format: None,
            merge_output_format: Some("mp4/mkv".to_string()),
            socket_timeout_seconds: 20,
            retries: 5,
            fragment_retries: 5,
            extractor_retries: 3,
            max_items,
        },
    }
}

pub fn automatic_format_arguments(mode: MediaMode, source: Option<MediaSource>) -> Vec<String> {
    let policy = create_download_policy(mode, source);
    let mut args = vec!["-f".to_string(), policy.format_selector];
    if policy.extract_audio {
        args.push("--extract-audio".to_string());
        args.push("--audio-format".to_string());
        args.push(policy.audio_format.unwrap_or_else(|| "best".to_string()));
    } else if let Some(merge_fmt) = policy.merge_output_format {
        args.push("--merge-output-format".to_string());
        args.push(merge_fmt);
    }
    args
}
