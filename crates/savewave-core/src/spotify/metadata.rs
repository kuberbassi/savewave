use crate::errors::{ErrorCode, SavewaveError};
use crate::spotify::TrackIdentity;
use regex::Regex;
use serde_json::Value;
use std::sync::OnceLock;
use std::time::Duration;

fn track_id_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?:open\.spotify\.com/(?:intl-[a-zA-Z-]+/)?track/|spotify:track:)([A-Za-z0-9]{22})")
            .unwrap()
    })
}

fn next_data_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r#"(?is)<script[^>]*id=["']__NEXT_DATA__["'][^>]*>(.*?)</script>"#).unwrap()
    })
}

fn title_tag_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?is)<title[^>]*>([^<]+)</title>").unwrap())
}

fn og_desc_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r#"(?is)<meta[^>]+(?:property|name)=["'](?:og:description|description)["'][^>]+content=["']([^"']+)["']"#).unwrap()
    })
}

fn isrc_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^[A-Z]{2}[A-Z0-9]{3}\d{7}$").unwrap())
}

pub fn parse_track_id(input: &str) -> Option<String> {
    track_id_re()
        .captures(input.trim())
        .map(|caps| caps[1].to_string())
}

fn decode_html(input: &str) -> String {
    input
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#x27;", "'")
        .replace("&#39;", "'")
        .replace("&ndash;", "-")
        .replace("&mdash;", "-")
}

fn extract_artist_from_html(html: &str) -> String {
    let title = title_tag_re()
        .captures(html)
        .map(|c| decode_html(&c[1]))
        .unwrap_or_default();
    let descs: Vec<String> = og_desc_re()
        .captures_iter(html)
        .map(|c| decode_html(&c[1]))
        .collect();
    let combined = format!("{title} · {}", descs.join(" · "));

    let patterns = [
        r"(?i)(?:song(?: and lyrics)?|track) by ([^|·]+?)(?:\s*[|·]|$)",
        r#"(?i)(?:song|track)\s*[·-]\s*([^·"|}]+?)(?:\s*[·"|}]|$)"#,
        r"(?i)(?:listen to|stream) .+? by ([^|·]+?)(?:\s+(?:on spotify)|[|·]|$)",
        r"(?i).+?\s+-\s+([^|]+?)\s*\|\s*spotify",
    ];
    for pat in patterns {
        if let Ok(re) = Regex::new(pat) {
            if let Some(caps) = re.captures(&combined) {
                let candidate = caps[1].trim();
                if !candidate.is_empty() {
                    return candidate.to_string();
                }
            }
        }
    }
    String::new()
}

struct EmbedMeta {
    title: String,
    artists: Vec<String>,
    album: Option<String>,
    duration: Option<u64>,
    release_year: Option<u32>,
    explicit: Option<bool>,
    playable: bool,
    isrc: Option<String>,
    thumbnail: Option<String>,
}

fn extract_embed_metadata(html: &str) -> Option<EmbedMeta> {
    let caps = next_data_re().captures(html)?;
    let decoded = decode_html(&caps[1]);
    let payload: Value = serde_json::from_str(&decoded).ok()?;
    let entity = payload
        .pointer("/props/pageProps/state/data/entity")?;
    if entity.get("type").and_then(|v| v.as_str()) != Some("track") {
        return None;
    }

    let title = entity
        .get("title")
        .or_else(|| entity.get("name"))
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .trim()
        .to_string();

    let artists: Vec<String> = entity
        .get("artists")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        })
        .unwrap_or_default();

    let album = entity
        .pointer("/album/name")
        .or_else(|| entity.pointer("/album/title"))
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let duration = entity
        .get("duration")
        .and_then(|v| v.as_f64())
        .map(|ms| (ms / 1000.0).round() as u64)
        .filter(|&s| (10..=7200).contains(&s));

    let release_year = entity
        .pointer("/releaseDate/isoString")
        .and_then(|v| v.as_str())
        .and_then(|s| s.get(0..4))
        .and_then(|y| y.parse::<u32>().ok());

    let explicit = entity.get("isExplicit").and_then(|v| v.as_bool());
    let playable = entity.get("isPlayable").and_then(|v| v.as_bool()).unwrap_or(true);

    let isrc = entity
        .pointer("/externalIds/isrc")
        .or_else(|| entity.get("isrc"))
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_ascii_uppercase())
        .filter(|s| isrc_re().is_match(s));

    let thumbnail = entity
        .pointer("/visualIdentity/image")
        .and_then(|v| v.as_array())
        .and_then(|images| {
            images
                .iter()
                .filter_map(|img| {
                    let url = img.get("url")?.as_str()?;
                    let w = img.get("maxWidth").and_then(|v| v.as_u64()).unwrap_or(0);
                    let h = img.get("maxHeight").and_then(|v| v.as_u64()).unwrap_or(0);
                    Some((w * h, url.to_string()))
                })
                .max_by_key(|(area, _)| *area)
                .map(|(_, url)| url)
        });

    Some(EmbedMeta {
        title,
        artists,
        album,
        duration,
        release_year,
        explicit,
        playable,
        isrc,
        thumbnail,
    })
}

async fn resolve_short_link(client: &reqwest::Client, url: &str) -> String {
    let lower = url.to_ascii_lowercase();
    if lower.contains("spotify.link/") || lower.contains("spoti.fi/") {
        if let Ok(resp) = client.get(url).send().await {
            return resp.url().to_string();
        }
    }
    url.to_string()
}

pub async fn get_spotify_metadata(input_url: &str) -> Result<TrackIdentity, SavewaveError> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Savewave/2.0")
        .build()
        .map_err(|_| SavewaveError::from_code(ErrorCode::NetworkError))?;

    let resolved_url = resolve_short_link(&client, input_url).await;
    let track_id = parse_track_id(&resolved_url).ok_or_else(|| {
        SavewaveError::new(
            ErrorCode::InvalidUrl,
            "Paste an individual Spotify track link.",
        )
    })?;

    let canonical = format!("https://open.spotify.com/track/{track_id}");
    let embed_url = format!("https://open.spotify.com/embed/track/{track_id}");
    let oembed_url = format!("https://open.spotify.com/oembed?url={canonical}");

    let (oembed_res, embed_res) = tokio::join!(
        client.get(&oembed_url).send(),
        client.get(&embed_url).send(),
    );

    let oembed: Value = match oembed_res {
        Ok(r) if r.status().is_success() => r.json().await.unwrap_or(Value::Null),
        _ => Value::Null,
    };

    let embed: Option<EmbedMeta> = match embed_res {
        Ok(r) if r.status().is_success() => {
            let html = r.text().await.unwrap_or_default();
            extract_embed_metadata(&html)
        }
        _ => None,
    };

    let mut fallback_artist = String::new();
    if embed.as_ref().map(|e| e.artists.is_empty()).unwrap_or(true) {
        if let Ok(r) = client.get(&canonical).send().await {
            if r.status().is_success() {
                if let Ok(html) = r.text().await {
                    fallback_artist = extract_artist_from_html(&html);
                }
            }
        }
    }

    if let Some(ref e) = embed {
        if !e.playable {
            return Err(SavewaveError::new(
                ErrorCode::SourceForbidden,
                "This Spotify track is not publicly playable in the current region.",
            ));
        }
    }

    let title = embed
        .as_ref()
        .map(|e| e.title.clone())
        .filter(|s| !s.is_empty())
        .or_else(|| {
            oembed
                .get("title")
                .and_then(|v| v.as_str())
                .map(|s| s.trim().to_string())
        })
        .unwrap_or_default();

    let artists: Vec<String> = if let Some(ref e) = embed {
        if !e.artists.is_empty() {
            e.artists.clone()
        } else {
            split_artists(&fallback_artist)
        }
    } else {
        split_artists(&fallback_artist)
    };

    if title.is_empty() || artists.is_empty() {
        return Err(SavewaveError::new(
            ErrorCode::NoMediaFound,
            "Spotify did not expose enough public metadata for a safe match.",
        ));
    }

    let primary_artist = artists[0].clone();
    let artist = artists.join(", ");
    let thumbnail = embed
        .as_ref()
        .and_then(|e| e.thumbnail.clone())
        .or_else(|| {
            oembed
                .get("thumbnail_url")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        });

    Ok(TrackIdentity {
        track_id,
        title,
        artist,
        artists,
        primary_artist,
        album: embed.as_ref().and_then(|e| e.album.clone()),
        duration: embed.as_ref().and_then(|e| e.duration),
        release_year: embed.as_ref().and_then(|e| e.release_year),
        explicit: embed.as_ref().and_then(|e| e.explicit),
        isrc: embed.as_ref().and_then(|e| e.isrc.clone()),
        thumbnail,
    })
}

fn split_artists(raw: &str) -> Vec<String> {
    let re = Regex::new(r"(?i),|&|\bfeat\.?\b|\bft\.?\b").unwrap();
    re.split(raw)
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_regional_and_uri_spotify_links() {
        assert_eq!(
            parse_track_id("https://open.spotify.com/track/1EwIdgeVfiXTIDfFHpgqfI?si=abc"),
            Some("1EwIdgeVfiXTIDfFHpgqfI".to_string())
        );
        assert_eq!(
            parse_track_id("https://open.spotify.com/intl-hi/track/1EwIdgeVfiXTIDfFHpgqfI"),
            Some("1EwIdgeVfiXTIDfFHpgqfI".to_string())
        );
        assert_eq!(
            parse_track_id("spotify:track:1EwIdgeVfiXTIDfFHpgqfI"),
            Some("1EwIdgeVfiXTIDfFHpgqfI".to_string())
        );
    }
}
