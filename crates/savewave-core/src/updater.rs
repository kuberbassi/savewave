use crate::models::{PlatformType, ReleaseInfo};
use crate::APP_VERSION;
use sha2::{Digest, Sha256};
use std::time::Duration;
use url::Url;

pub const RELEASE_MANIFEST_URL: &str =
    "https://raw.githubusercontent.com/kuberbassi/savewave/main/public/client-version.json";

const TRUSTED_HOSTS: &[&str] = &[
    "github.com",
    "savewave.kuberbassi.com",
    "kuberbassi.com",
    "www.kuberbassi.com",
];

pub fn is_trusted_external_url(raw: &str) -> bool {
    let Ok(url) = Url::parse(raw) else {
        return false;
    };
    if url.scheme() != "https" || !url.username().is_empty() || url.password().is_some() {
        return false;
    }
    let Some(host) = url.host_str() else {
        return false;
    };
    let lower = host.to_ascii_lowercase();
    TRUSTED_HOSTS.iter().any(|h| *h == lower)
}

pub fn version_is_newer(candidate: &str, installed: &str) -> bool {
    let parse = |v: &str| -> Option<Vec<u64>> {
        v.trim_start_matches('v')
            .split('.')
            .map(|p| p.parse::<u64>().ok())
            .collect()
    };
    let (Some(next), Some(curr)) = (parse(candidate), parse(installed)) else {
        return false;
    };
    let len = next.len().max(curr.len());
    for i in 0..len {
        let a = *next.get(i).unwrap_or(&0);
        let b = *curr.get(i).unwrap_or(&0);
        if a != b {
            return a > b;
        }
    }
    false
}

pub fn verify_sha256(bytes: &[u8], expected_hex: &str) -> bool {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let actual = hex::encode(hasher.finalize());
    actual.eq_ignore_ascii_case(expected_hex.trim())
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawManifest {
    version: String,
    download_url: String,
    windows_download_url: Option<String>,
    android_download_url: Option<String>,
    release_url: String,
    changelog_url: String,
    summary: String,
}

pub async fn fetch_release_info(platform: PlatformType) -> Option<ReleaseInfo> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .ok()?;
    let resp = client
        .get(RELEASE_MANIFEST_URL)
        .header("Cache-Control", "no-cache")
        .send()
        .await
        .ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let raw: RawManifest = resp.json().await.ok()?;
    let download_url = match platform {
        PlatformType::Android => raw
            .android_download_url
            .clone()
            .unwrap_or_else(|| raw.download_url.clone()),
        _ => raw
            .windows_download_url
            .clone()
            .unwrap_or_else(|| raw.download_url.clone()),
    };
    if !is_trusted_external_url(&download_url)
        || !is_trusted_external_url(&raw.release_url)
        || !is_trusted_external_url(&raw.changelog_url)
    {
        return None;
    }
    let update_available = version_is_newer(&raw.version, APP_VERSION);
    Some(ReleaseInfo {
        version: raw.version,
        download_url,
        windows_download_url: raw.windows_download_url,
        android_download_url: raw.android_download_url,
        release_url: raw.release_url,
        changelog_url: raw.changelog_url,
        summary: raw.summary,
        update_available,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compares_semver_versions() {
        assert!(version_is_newer("2.0.1", "2.0.0"));
        assert!(version_is_newer("2.1.0", "2.0.9"));
        assert!(!version_is_newer("2.0.0", "2.0.0"));
        assert!(!version_is_newer("1.0.17", "2.0.0"));
    }
}
