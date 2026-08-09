use regex::Regex;
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    path::{Path, PathBuf},
    time::Duration,
};
use url::Url;

const MAX_ITEMS: usize = 20;
const MAX_IMAGE_BYTES: usize = 50 * 1024 * 1024;

#[derive(Clone, Debug)]
pub struct GalleryImage {
    pub url: String,
    pub extension: String,
}
#[derive(Clone, Debug)]
pub struct Gallery {
    pub platform: String,
    pub title: String,
    pub creator: String,
    pub images: Vec<GalleryImage>,
}

pub fn is_instagram_url(value: &str) -> bool {
    Url::parse(value)
        .ok()
        .and_then(|url| url.host_str().map(str::to_ascii_lowercase))
        .is_some_and(|host| host == "instagram.com" || host.ends_with(".instagram.com"))
}

pub async fn resolve_instagram(
    source_url: &str,
    info: Option<&Value>,
    stderr: &str,
) -> Result<Option<Gallery>, String> {
    if !is_instagram_url(source_url) {
        return Ok(None);
    }
    let child_re = Regex::new(r"\[Instagram\]\s+([A-Za-z0-9_-]+):\s+No video formats found")
        .expect("valid regex");
    let mut seen = HashSet::new();
    let child_ids: Vec<String> = child_re
        .captures_iter(stderr)
        .filter_map(|capture| capture.get(1).map(|value| value.as_str().to_string()))
        .filter(|id| seen.insert(id.clone()))
        .take(MAX_ITEMS)
        .collect();
    if child_ids.is_empty() {
        return Ok(None);
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        // Instagram serves the stable public embed document to this minimal
        // user agent; full browser UA strings can receive the app shell only.
        .user_agent("Mozilla/5.0")
        .build()
        .map_err(|_| "SOURCE_UNAVAILABLE")?;
    let mut candidates_by_item = Vec::with_capacity(child_ids.len());
    for id in &child_ids {
        let response = client
            .get(format!("https://www.instagram.com/p/{id}/embed/captioned/"))
            .send()
            .await
            .map_err(|_| "SOURCE_UNAVAILABLE")?;
        if !response.status().is_success() {
            return Err("SOURCE_REJECTED".into());
        }
        let html = response.text().await.map_err(|_| "SOURCE_UNAVAILABLE")?;
        candidates_by_item.push(extract_jpeg_candidates(&html));
    }
    let mut occurrence: HashMap<String, usize> = HashMap::new();
    for candidates in &candidates_by_item {
        for name in candidates.keys() {
            *occurrence.entry(name.clone()).or_default() += 1;
        }
    }
    let mut images = Vec::with_capacity(child_ids.len());
    for candidates in candidates_by_item {
        let selected = candidates
            .into_iter()
            .filter(|(name, _)| occurrence.get(name) == Some(&1))
            .max_by_key(|(_, url)| image_quality(url))
            .map(|(_, url)| url)
            .ok_or("NO_MEDIA_FOUND")?;
        images.push(GalleryImage {
            url: selected,
            extension: "jpg".into(),
        });
    }
    let title = info
        .and_then(|value| value["title"].as_str())
        .unwrap_or("Instagram post")
        .to_string();
    let creator = info
        .and_then(|value| value["uploader"].as_str().or(value["channel"].as_str()))
        .or_else(|| title.strip_prefix("Post by "))
        .unwrap_or("Instagram creator")
        .to_string();
    Ok(Some(Gallery {
        platform: "instagram".into(),
        title,
        creator,
        images,
    }))
}

fn extract_jpeg_candidates(html: &str) -> HashMap<String, String> {
    let normalized = html
        .replace("\\/", "/")
        .replace("\\u0026", "&")
        .replace("&amp;", "&");
    let url_re = Regex::new(r#"https://[^\s\"'<>]+?\.jpg(?:\?[^\s\"'<>]*)?"#).expect("valid regex");
    let mut result: HashMap<String, String> = HashMap::new();
    for found in url_re.find_iter(&normalized) {
        let url = found
            .as_str()
            .trim_end_matches(['\\', ')', ','])
            .to_string();
        let Ok(parsed) = Url::parse(&url) else {
            continue;
        };
        let Some(host) = parsed.host_str() else {
            continue;
        };
        if !(host == "cdninstagram.com"
            || host.ends_with(".cdninstagram.com")
            || host == "fbcdn.net"
            || host.ends_with(".fbcdn.net"))
        {
            continue;
        }
        let Some(name) = parsed
            .path_segments()
            .and_then(|mut parts| parts.next_back())
            .map(str::to_string)
        else {
            continue;
        };
        result
            .entry(name)
            .and_modify(|current| {
                if image_quality(&url) > image_quality(current) {
                    *current = url.clone();
                }
            })
            .or_insert(url);
    }
    result
}

fn image_quality(url: &str) -> usize {
    let dimensions = Regex::new(r"[sp](\d{2,4})x(\d{2,4})").expect("valid regex");
    dimensions
        .captures_iter(url)
        .filter_map(|capture| {
            Some(
                capture.get(1)?.as_str().parse::<usize>().ok()?
                    * capture.get(2)?.as_str().parse::<usize>().ok()?,
            )
        })
        .max()
        .unwrap_or(url.len())
}

pub async fn save_images<F, C>(
    gallery: &Gallery,
    downloads: &Path,
    temp_dir: &Path,
    mut progress: F,
    is_cancelled: C,
) -> Result<String, String>
where
    F: FnMut(f64),
    C: Fn() -> bool,
{
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|_| "DOWNLOAD_FAILED")?;
    let stem = crate::security::sanitize_filename(&gallery.title);
    for (offset, image) in gallery.images.iter().enumerate() {
        if is_cancelled() {
            return Err("CANCELLED".into());
        }
        let parsed = Url::parse(&image.url).map_err(|_| "DOWNLOAD_FAILED")?;
        let host = parsed.host_str().ok_or("DOWNLOAD_FAILED")?;
        if !(host == "cdninstagram.com"
            || host.ends_with(".cdninstagram.com")
            || host == "fbcdn.net"
            || host.ends_with(".fbcdn.net"))
        {
            return Err("DOWNLOAD_FAILED".into());
        }
        let response = client
            .get(parsed)
            .send()
            .await
            .map_err(|_| "DOWNLOAD_FAILED")?;
        let is_image = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .is_some_and(|value| value.starts_with("image/"));
        if !response.status().is_success()
            || !is_image
            || response
                .content_length()
                .is_some_and(|length| length > MAX_IMAGE_BYTES as u64)
        {
            return Err("DOWNLOAD_FAILED".into());
        }
        let bytes = response.bytes().await.map_err(|_| "DOWNLOAD_FAILED")?;
        if bytes.is_empty() || bytes.len() > MAX_IMAGE_BYTES {
            return Err("DOWNLOAD_FAILED".into());
        }
        let filename = format!("{} ({}).{}", stem, offset + 1, image.extension);
        let temp_path = temp_dir.join(&filename);
        std::fs::write(&temp_path, &bytes).map_err(|_| "SAVE_FAILED")?;
        let destination = available_path(downloads, &filename);
        std::fs::rename(&temp_path, &destination)
            .or_else(|_| {
                std::fs::copy(&temp_path, &destination)
                    .map(|_| ())
                    .and_then(|_| std::fs::remove_file(&temp_path))
            })
            .map_err(|_| "SAVE_FAILED")?;
        progress(((offset + 1) as f64 / gallery.images.len() as f64) * 100.0);
    }
    Ok(format!("{} ({} images)", stem, gallery.images.len()))
}

fn available_path(directory: &Path, filename: &str) -> PathBuf {
    let direct = directory.join(filename);
    if !direct.exists() {
        return direct;
    }
    let path = Path::new(filename);
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("image");
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("jpg");
    for copy in 2..10_000 {
        let candidate = directory.join(format!("{stem} - copy {copy}.{extension}"));
        if !candidate.exists() {
            return candidate;
        }
    }
    directory.join(format!("{stem}-{}.{extension}", uuid::Uuid::new_v4()))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn extracts_only_instagram_media_and_prefers_larger_variant() {
        let html = r#"https:\/\/scontent.cdninstagram.com\/v\/common.jpg?stp=s320x320&amp;x=1 https:\/\/scontent.cdninstagram.com\/v\/common.jpg?stp=s1080x1080&amp;x=2 https://example.com/not-media.jpg"#;
        let images = extract_jpeg_candidates(html);
        assert_eq!(images.len(), 1);
        assert!(images["common.jpg"].contains("s1080x1080"));
    }
    #[test]
    fn collision_paths_never_overwrite() {
        let folder =
            std::env::temp_dir().join(format!("savewave-gallery-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&folder).unwrap();
        std::fs::write(folder.join("Post (1).jpg"), b"old").unwrap();
        assert_eq!(
            available_path(&folder, "Post (1).jpg").file_name().unwrap(),
            "Post (1) - copy 2.jpg"
        );
        let _ = std::fs::remove_dir_all(folder);
    }

    #[test]
    #[ignore = "live Instagram gallery check; run explicitly"]
    fn resolves_known_public_seven_image_carousel_live() {
        let stderr = [
            "DbAfDJFyy7X",
            "DbAfDXxy-mG",
            "DbAfDewScGB",
            "DbAfDjFScGl",
            "DbAfDrwyTl2",
            "DbAfDvkyCgR",
            "DbAfD0hSp7f",
        ]
        .into_iter()
        .map(|id| format!("[Instagram] {id}: No video formats found!\n"))
        .collect::<String>();
        let info = serde_json::json!({"title":"Post by carryminati","uploader":"carryminati"});
        let result = tauri::async_runtime::block_on(resolve_instagram(
            "https://www.instagram.com/p/DbAfLk-DYyX/",
            Some(&info),
            &stderr,
        ))
        .unwrap()
        .unwrap();
        assert_eq!(result.images.len(), 7);
        assert_eq!(result.title, "Post by carryminati");
        let folder =
            std::env::temp_dir().join(format!("savewave-live-gallery-{}", uuid::Uuid::new_v4()));
        let staging = folder.join("staging");
        std::fs::create_dir_all(&staging).unwrap();
        let label = tauri::async_runtime::block_on(save_images(
            &result,
            &folder,
            &staging,
            |_| {},
            || false,
        ))
        .unwrap();
        assert_eq!(label, "Post by carryminati (7 images)");
        for index in 1..=7 {
            assert!(folder
                .join(format!("Post by carryminati ({index}).jpg"))
                .exists());
        }
        let _ = std::fs::remove_dir_all(folder);
    }
}
