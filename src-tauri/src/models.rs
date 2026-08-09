use serde::{Deserialize, Serialize};

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaRequest {
    pub url: String,
    pub mode: String,
    pub title: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedMedia {
    pub success: bool,
    pub platform: String,
    pub title: String,
    pub creator: String,
    pub thumbnail: Option<String>,
    pub duration: Option<f64>,
    #[serde(rename = "type")]
    pub media_type: String,
    pub quality_label: String,
    pub source_url: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineStatus {
    pub available: bool,
    pub version: String,
    pub engine_version: Option<String>,
    pub ffmpeg_version: Option<String>,
    pub update_available: bool,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseInfo {
    pub version: String,
    pub download_url: String,
    pub release_url: String,
    pub changelog_url: String,
    #[serde(default)]
    pub summary: String,
    #[serde(skip_deserializing, default)]
    pub update_available: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub job_id: String,
    pub state: String,
    pub percent: Option<f64>,
    pub downloaded_bytes: Option<u64>,
    pub total_bytes: Option<u64>,
    pub speed: Option<f64>,
    pub eta: Option<f64>,
    pub filename: Option<String>,
}
