use crate::spotify::{MatchCandidate, TrackIdentity};
use serde_json::Value;
use std::time::Duration;

/// Fast, anonymous cross-platform lookup via Songlink/Odesli.
/// Used strictly as a candidate seeder — every returned video ID is still
/// evaluated against our Rust matcher so zero wrong matches slip through.
pub async fn lookup_youtube_candidates(
    spotify_url: &str,
    track: &TrackIdentity,
) -> Vec<MatchCandidate> {
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .user_agent("Savewave/2.0")
        .build()
    {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let endpoint = format!(
        "https://api.song.link/v1-alpha.1/links?url={}",
        urlencoding_minimal(spotify_url)
    );

    let resp = match client.get(&endpoint).send().await {
        Ok(r) if r.status().is_success() => r,
        _ => return Vec::new(),
    };

    let payload: Value = match resp.json().await {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };

    let entities = match payload.get("entitiesByUniqueId").and_then(|v| v.as_object()) {
        Some(e) => e,
        None => return Vec::new(),
    };

    let mut candidates = Vec::new();

    for (platform_key, result_type) in [
        ("youtubeMusic", "song"),
        ("youtube", "video"),
    ] {
        let Some(uid) = payload
            .pointer(&format!("/linksByPlatform/{platform_key}/entityUniqueId"))
            .and_then(|v| v.as_str())
        else {
            continue;
        };

        let Some(entity) = entities.get(uid) else {
            continue;
        };

        let Some(video_id) = entity.get("id").and_then(|v| v.as_str()) else {
            continue;
        };
        if video_id.len() != 11 {
            continue;
        }

        let title = entity
            .get("title")
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| track.title.clone());

        let artist_name = entity
            .get("artistName")
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        let artists = match artist_name.clone() {
            Some(a) => vec![a],
            None => track.artists.clone(),
        };

        candidates.push(MatchCandidate {
            video_id: video_id.to_string(),
            url: format!("https://www.youtube.com/watch?v={video_id}"),
            result_type: result_type.to_string(),
            title,
            artists,
            artist: artist_name.clone(),
            uploader: artist_name,
            album: track.album.clone(),
            duration: track.duration, // Odesli does not expose duration; YTM dedupe overrides when present
            explicit: track.explicit,
            isrc: track.isrc.clone(),
            verified: result_type == "song",
            odesli_linked: true,
            search_stage: Some(format!("odesli-{platform_key}")),
        });
    }

    candidates
}

fn urlencoding_minimal(input: &str) -> String {
    let mut out = String::with_capacity(input.len() + 16);
    for b in input.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => {
                out.push_str(&format!("%{:02X}", b));
            }
        }
    }
    out
}
