use crate::spotify::MatchCandidate;
use regex::Regex;
use serde_json::{json, Value};
use std::collections::HashSet;
use std::sync::OnceLock;
use std::time::Duration;
use tokio::sync::RwLock;

const YTM_HOME: &str = "https://music.youtube.com/";
const USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36";

const PARAMS_SONGS: &str = "EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D";
const PARAMS_VIDEOS: &str = "EgWKAQIQAWoKEAkQChAFEAMQBA%3D%3D";

#[derive(Clone)]
struct YtmSession {
    api_key: String,
    client_version: String,
}

fn session_cache() -> &'static RwLock<Option<YtmSession>> {
    static CACHE: OnceLock<RwLock<Option<YtmSession>>> = OnceLock::new();
    CACHE.get_or_init(|| RwLock::new(None))
}

fn api_key_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r#""INNERTUBE_API_KEY":"([^"]+)""#).unwrap())
}

fn client_version_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r#""INNERTUBE_CLIENT_VERSION":"([^"]+)""#).unwrap())
}

fn duration_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^\d{1,2}:\d{2}(?::\d{2})?$").unwrap())
}

fn plays_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?i)^\d[\d,.]*\s*(?:[KMB]\s*)?(?:plays|views)?$").unwrap())
}

fn http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .user_agent(USER_AGENT)
        .build()
        .expect("reqwest client")
}

async fn bootstrap(force: bool) -> Option<YtmSession> {
    if !force {
        if let Some(cached) = session_cache().read().await.clone() {
            return Some(cached);
        }
    }
    let client = http_client();
    let resp = client
        .get(YTM_HOME)
        .header("Accept-Language", "en-US,en;q=0.9")
        .send()
        .await
        .ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let html = resp.text().await.ok()?.replace("\\\"", "\"");
    let api_key = api_key_re().captures(&html)?.get(1)?.as_str().to_string();
    let client_version = client_version_re()
        .captures(&html)?
        .get(1)?
        .as_str()
        .to_string();
    let session = YtmSession {
        api_key,
        client_version,
    };
    *session_cache().write().await = Some(session.clone());
    Some(session)
}

pub async fn search_youtube_music(query: &str, filter: &str) -> Vec<MatchCandidate> {
    let params = match filter {
        "songs" => PARAMS_SONGS,
        _ => PARAMS_VIDEOS,
    };

    for attempt in 0..2 {
        let Some(session) = bootstrap(attempt > 0).await else {
            continue;
        };
        let url = format!(
            "https://music.youtube.com/youtubei/v1/search?key={}&prettyPrint=false",
            session.api_key
        );
        let body = json!({
            "context": {
                "client": {
                    "clientName": "WEB_REMIX",
                    "clientVersion": session.client_version,
                    "hl": "en"
                }
            },
            "query": query,
            "params": params
        });

        let client = http_client();
        let resp = match client
            .post(&url)
            .header("Accept-Language", "en-US,en;q=0.9")
            .header("Origin", YTM_HOME)
            .json(&body)
            .send()
            .await
        {
            Ok(r) if r.status().is_success() => r,
            _ => {
                *session_cache().write().await = None;
                continue;
            }
        };

        if let Ok(payload) = resp.json::<Value>().await {
            let parsed = parse_youtube_music_results(&payload, filter);
            if !parsed.is_empty() || attempt == 1 {
                return parsed;
            }
        }
    }
    Vec::new()
}

pub fn parse_duration_seconds(raw: &str) -> Option<u64> {
    let parts: Option<Vec<u64>> = raw.trim().split(':').map(|p| p.parse::<u64>().ok()).collect();
    let parts = parts?;
    if parts.is_empty() {
        return None;
    }
    Some(parts.into_iter().fold(0u64, |acc, part| acc * 60 + part))
}

fn text_of(val: &Value) -> String {
    if let Some(simple) = val.get("simpleText").and_then(|v| v.as_str()) {
        return simple.trim().to_string();
    }
    val.get("runs")
        .and_then(|v| v.as_array())
        .map(|runs| {
            runs.iter()
                .filter_map(|r| r.get("text").and_then(|t| t.as_str()))
                .collect::<String>()
                .trim()
                .to_string()
        })
        .unwrap_or_default()
}

fn collect_renderers<'a>(value: &'a Value, out: &mut Vec<&'a Value>) {
    match value {
        Value::Object(map) => {
            if let Some(renderer) = map.get("musicResponsiveListItemRenderer") {
                out.push(renderer);
            }
            for child in map.values() {
                collect_renderers(child, out);
            }
        }
        Value::Array(arr) => {
            for child in arr {
                collect_renderers(child, out);
            }
        }
        _ => {}
    }
}

fn parse_renderer(renderer: &Value, result_type: &str) -> Option<MatchCandidate> {
    let columns: Vec<&Value> = renderer
        .get("flexColumns")
        .and_then(|v| v.as_array())?
        .iter()
        .filter_map(|c| c.pointer("/musicResponsiveListItemFlexColumnRenderer/text"))
        .collect();

    let first_col = *columns.first()?;
    let title = text_of(first_col);
    if title.is_empty() {
        return None;
    }

    let video_id = renderer
        .pointer("/playlistItemData/videoId")
        .or_else(|| renderer.pointer("/navigationEndpoint/watchEndpoint/videoId"))
        .and_then(|v| v.as_str())
        .or_else(|| {
            first_col
                .get("runs")
                .and_then(|v| v.as_array())
                .and_then(|runs| {
                    runs.iter().find_map(|r| {
                        r.pointer("/navigationEndpoint/watchEndpoint/videoId")
                            .and_then(|v| v.as_str())
                    })
                })
        })?
        .to_string();

    let mut runs: Vec<&Value> = Vec::new();
    for col in columns.iter().skip(1) {
        if let Some(arr) = col.get("runs").and_then(|v| v.as_array()) {
            runs.extend(arr.iter());
        }
    }

    let mut artists: Vec<String> = Vec::new();
    let mut album: Option<String> = None;
    let mut duration_text: Option<String> = None;

    // Build bullet-separated subtitle groups
    let mut groups: Vec<String> = vec![String::new()];
    for run in &runs {
        let text = run.get("text").and_then(|v| v.as_str()).unwrap_or_default();
        if text.trim() == "•" {
            groups.push(String::new());
        } else if !text.is_empty() {
            if let Some(last) = groups.last_mut() {
                last.push_str(text);
            }
        }

        if duration_text.is_none() && duration_re().is_match(text.trim()) {
            duration_text = Some(text.trim().to_string());
        }

        let browse_id = run
            .pointer("/navigationEndpoint/browseEndpoint/browseId")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        let page_type = run
            .pointer("/navigationEndpoint/browseEndpoint/browseEndpointContextSupportedConfigs/browseEndpointContextMusicConfig/pageType")
            .and_then(|v| v.as_str())
            .unwrap_or_default();

        if browse_id.starts_with("UC") || page_type.contains("ARTIST") {
            let trimmed = text.trim();
            if !trimmed.is_empty() {
                artists.push(trimmed.to_string());
            }
        } else if album.is_none() && (browse_id.starts_with("MPRE") || page_type.contains("ALBUM")) {
            let trimmed = text.trim();
            if !trimmed.is_empty() {
                album = Some(trimmed.to_string());
            }
        }
    }

    let groups: Vec<String> = groups
        .into_iter()
        .map(|g| g.trim().to_string())
        .filter(|g| !g.is_empty())
        .collect();

    if artists.is_empty() {
        if let Some(first_group) = groups.first() {
            if !plays_re().is_match(first_group) {
                artists.push(first_group.clone());
            }
        }
    }
    if artists.is_empty() {
        return None;
    }

    if album.is_none() && result_type == "song" {
        album = groups
            .iter()
            .skip(1)
            .find(|g| Some(g.as_str()) != duration_text.as_deref() && !plays_re().is_match(g))
            .cloned();
    }

    let badges_str = renderer
        .get("badges")
        .map(|b| b.to_string())
        .unwrap_or_default();
    let explicit = if badges_str.contains("MUSIC_EXPLICIT_BADGE") {
        Some(true)
    } else {
        None
    };

    let primary = artists[0].clone();
    Some(MatchCandidate {
        url: format!("https://www.youtube.com/watch?v={video_id}"),
        video_id,
        result_type: result_type.to_string(),
        title,
        artists,
        artist: Some(primary.clone()),
        uploader: Some(primary),
        album,
        duration: duration_text.as_deref().and_then(parse_duration_seconds),
        explicit,
        isrc: None,
        verified: result_type == "song",
        odesli_linked: false,
        search_stage: None,
    })
}

pub fn parse_youtube_music_results(payload: &Value, filter: &str) -> Vec<MatchCandidate> {
    let result_type = if filter == "songs" { "song" } else { "video" };
    let mut renderers = Vec::new();
    collect_renderers(payload, &mut renderers);
    let mut seen = HashSet::new();
    renderers
        .into_iter()
        .filter_map(|r| parse_renderer(r, result_type))
        .filter(|c| seen.insert(c.video_id.clone()))
        .take(20)
        .collect()
}
