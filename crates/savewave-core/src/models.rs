use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PlatformType {
    Web,
    Desktop,
    Android,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MediaMode {
    Video,
    Audio,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MediaSource {
    Youtube,
    Instagram,
    Facebook,
    Threads,
    Twitter,
    Soundcloud,
    Spotify,
    Direct,
    Unknown,
}

impl MediaSource {
    pub fn as_str(&self) -> &'static str {
        match self {
            MediaSource::Youtube => "youtube",
            MediaSource::Instagram => "instagram",
            MediaSource::Facebook => "facebook",
            MediaSource::Threads => "threads",
            MediaSource::Twitter => "twitter",
            MediaSource::Soundcloud => "soundcloud",
            MediaSource::Spotify => "spotify",
            MediaSource::Direct => "direct",
            MediaSource::Unknown => "unknown",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DownloadState {
    Idle,
    Detecting,
    Resolving,
    Resolved,
    Downloading,
    Processing,
    Completed,
    Cancelled,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchOption {
    pub source_url: String,
    pub title: String,
    pub creator: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<u64>,
    pub score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedMedia {
    pub success: bool,
    pub platform: MediaSource,
    pub title: String,
    pub creator: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<u64>,
    #[serde(rename = "type")]
    pub media_type: String, // "video" | "audio" | "image"
    pub quality_label: String,
    pub source_url: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fallback_source_urls: Vec<String>,
    #[serde(default)]
    pub selection_required: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub match_options: Vec<MatchOption>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadRequest {
    pub url: String,
    pub mode: MediaMode,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<MediaSource>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub job_id: String,
    pub state: DownloadState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub percent: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub downloaded_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speed: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub eta: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filename: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub filenames: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceCapability {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub video: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audio: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub smart_match: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformCapabilities {
    pub platform: PlatformType,
    pub sources: HashMap<MediaSource, SourceCapability>,
}

impl PlatformCapabilities {
    pub fn default_native(platform: PlatformType) -> Self {
        let mut sources = HashMap::new();
        sources.insert(
            MediaSource::Youtube,
            SourceCapability {
                video: Some(true),
                audio: Some(true),
                media: Some(true),
                smart_match: None,
            },
        );
        sources.insert(
            MediaSource::Instagram,
            SourceCapability {
                video: Some(true),
                audio: Some(true),
                media: None,
                smart_match: None,
            },
        );
        sources.insert(MediaSource::Facebook, SourceCapability::default());
        sources.insert(
            MediaSource::Threads,
            SourceCapability {
                video: Some(true),
                audio: Some(true),
                media: Some(true),
                smart_match: None,
            },
        );
        sources.insert(MediaSource::Twitter, SourceCapability::default());
        sources.insert(
            MediaSource::Soundcloud,
            SourceCapability {
                video: None,
                audio: Some(true),
                media: None,
                smart_match: None,
            },
        );
        sources.insert(
            MediaSource::Spotify,
            SourceCapability {
                video: None,
                audio: Some(true),
                media: None,
                smart_match: Some(true),
            },
        );
        sources.insert(
            MediaSource::Direct,
            SourceCapability {
                video: Some(true),
                audio: Some(true),
                media: Some(true),
                smart_match: None,
            },
        );
        sources.insert(MediaSource::Unknown, SourceCapability::default());
        Self { platform, sources }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineStatus {
    pub available: bool,
    #[serde(default)]
    pub initializing: bool,
    pub version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub engine_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ffmpeg_version: Option<String>,
    #[serde(default)]
    pub update_available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseInfo {
    pub version: String,
    pub download_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub windows_download_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub android_download_url: Option<String>,
    pub release_url: String,
    pub changelog_url: String,
    pub summary: String,
    pub update_available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryItem {
    pub id: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uploader: Option<String>,
    pub platform: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail: Option<String>,
    pub media_type: String,
    pub timestamp: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub local_reference: Option<String>,
}
