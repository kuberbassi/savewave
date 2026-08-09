use regex::Regex;
use serde_json::{json, Value};
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

fn track_id(url: &str) -> Result<String, String> {
    let parsed = crate::security::validate_url(url)?;
    if parsed.host_str() != Some("open.spotify.com") {
        return Err("INVALID_URL".into());
    }
    let parts: Vec<_> = parsed
        .path_segments()
        .map(|items| items.collect())
        .unwrap_or_default();
    if parts.len() == 2
        && parts[0] == "track"
        && parts[1].len() == 22
        && parts[1].chars().all(|c| c.is_ascii_alphanumeric())
    {
        Ok(parts[1].to_string())
    } else {
        Err("UNSUPPORTED_SOURCE".into())
    }
}

fn embedded_entity(html: &str) -> Option<Value> {
    let capture = Regex::new(r#"(?s)<script[^>]*id=[\"']__NEXT_DATA__[\"'][^>]*>(.*?)</script>"#)
        .ok()?
        .captures(html)?;
    let payload: Value = serde_json::from_str(capture.get(1)?.as_str()).ok()?;
    payload
        .pointer("/props/pageProps/state/data/entity")
        .cloned()
}

pub async fn metadata(url: &str) -> Result<Value, String> {
    let id = track_id(url)?;
    let client = reqwest::Client::builder()
        .user_agent("Savewave/1.0")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|_| "SOURCE_UNAVAILABLE")?;
    let embed_url = format!("https://open.spotify.com/embed/track/{id}");
    let html = client
        .get(embed_url)
        .send()
        .await
        .map_err(|_| "SOURCE_UNAVAILABLE")?
        .error_for_status()
        .map_err(|_| "SOURCE_REJECTED")?
        .text()
        .await
        .map_err(|_| "SOURCE_UNAVAILABLE")?;
    let entity = embedded_entity(&html).ok_or("NO_MEDIA_FOUND")?;
    if entity["isPlayable"].as_bool() == Some(false) {
        return Err("SOURCE_REJECTED".into());
    }
    let title = entity["title"]
        .as_str()
        .or_else(|| entity["name"].as_str())
        .unwrap_or("")
        .trim();
    let artists: Vec<String> = entity["artists"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|artist| artist["name"].as_str().map(str::to_string))
        .collect();
    if title.is_empty() || artists.is_empty() {
        return Err("NO_MEDIA_FOUND".into());
    }
    let artwork = entity
        .pointer("/visualIdentity/image")
        .and_then(Value::as_array)
        .and_then(|images| {
            images.iter().max_by_key(|image| {
                image["maxWidth"].as_u64().unwrap_or(0) * image["maxHeight"].as_u64().unwrap_or(0)
            })
        })
        .and_then(|image| image["url"].as_str())
        .map(str::to_string);
    Ok(
        json!({"title":title,"primaryArtist":artists[0],"artists":artists,"album":"","duration":entity["duration"].as_f64().map(|ms| ms / 1000.0),"isrc":null,"thumbnail":artwork,"spotifyTrackId":id}),
    )
}

pub async fn candidates(app: &AppHandle, title: &str, artist: &str) -> Result<Vec<Value>, String> {
    let mut seen = std::collections::HashSet::new();
    let mut candidates = Vec::new();
    for query in [
        format!("ytsearch25:{artist} Topic {title}"),
        format!("ytsearch15:{artist} {title} official audio"),
        format!("ytsearch15:{artist} {title} topic"),
        format!("ytsearch15:{title} {artist}"),
        format!("ytsearch15:{artist} - {title}"),
    ] {
        let output = app
            .shell()
            .sidecar("yt-dlp")
            .map_err(|_| "ENGINE_UNAVAILABLE")?
            .args([
                "--dump-single-json",
                "--flat-playlist",
                "--playlist-end",
                "15",
                "--no-warnings",
                "--socket-timeout",
                "12",
                "--retries",
                "2",
                "--js-runtimes",
                "node",
                "--remote-components",
                "ejs:github",
                &query,
            ])
            .output()
            .await
            .map_err(|_| "SOURCE_UNAVAILABLE")?;
        if !output.status.success() {
            continue;
        }
        let value: Value = serde_json::from_slice(&output.stdout).unwrap_or_default();
        for entry in value["entries"].as_array().into_iter().flatten() {
            let Some(id) = entry["id"].as_str() else {
                continue;
            };
            if !seen.insert(id.to_string()) {
                continue;
            }
            candidates.push(json!({"id":id,"title":entry["title"],"artist":entry["artist"],"uploader":entry["uploader"],"duration":entry["duration"],"official":entry["channel_is_verified"].as_bool().unwrap_or(false),"sourceUrl":format!("https://www.youtube.com/watch?v={id}")}));
        }
    }
    if candidates.is_empty() {
        Err("NO_MEDIA_FOUND".into())
    } else {
        Ok(candidates)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_individual_tracks_are_accepted() {
        assert!(track_id("https://open.spotify.com/track/1dGF5ymTyBB2ZmOypkeU1F?si=x").is_ok());
        assert!(track_id("https://open.spotify.com/playlist/123").is_err());
    }
    #[test]
    #[ignore = "live Spotify check; run explicitly"]
    fn resolves_public_track_metadata_live() {
        let value = tauri::async_runtime::block_on(metadata(
            "https://open.spotify.com/track/1dGF5ymTyBB2ZmOypkeU1F",
        ))
        .expect("public metadata");
        assert!(value["title"]
            .as_str()
            .is_some_and(|title| !title.is_empty()));
        assert!(value["primaryArtist"]
            .as_str()
            .is_some_and(|artist| !artist.is_empty()));
    }
}
