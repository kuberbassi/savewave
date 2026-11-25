use crate::errors::{ErrorCode, SavewaveError};
use crate::models::MediaSource;
use regex::Regex;
use std::net::IpAddr;
use std::sync::OnceLock;
use url::Url;

fn direct_ext_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?i)\.(mp4|webm|mp3|m4a|aac|ogg|wav|flac|jpg|jpeg|png|webp)(?:$|[?#])")
            .unwrap()
    })
}

fn yt_shorts_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^/shorts/([A-Za-z0-9_-]{11})/?$").unwrap())
}

fn ig_reel_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^/reels?/[A-Za-z0-9_-]{5,}/?$").unwrap())
}

fn is_domain(host: &str, domain: &str) -> bool {
    host == domain || host.ends_with(&format!(".{domain}"))
}

pub fn normalize_url(value: &str) -> Option<Url> {
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed.len() > 2048 {
        return None;
    }
    // Support spotify:track:<id> URIs directly
    if let Some(rest) = trimmed.strip_prefix("spotify:track:") {
        let id: String = rest.chars().take_while(|c| c.is_ascii_alphanumeric()).collect();
        if id.len() == 22 {
            return Url::parse(&format!("https://open.spotify.com/track/{id}")).ok();
        }
    }
    let parsed = Url::parse(trimmed).ok()?;
    match parsed.scheme() {
        "http" | "https" => Some(parsed),
        _ => None,
    }
}

pub fn canonical_media_url(value: &str) -> String {
    let Some(url) = normalize_url(value) else {
        return value.trim().to_string();
    };
    let host = url.host_str().unwrap_or_default().to_ascii_lowercase();
    if is_domain(&host, "youtube.com") {
        if let Some(caps) = yt_shorts_re().captures(url.path()) {
            return format!("https://www.youtube.com/watch?v={}", &caps[1]);
        }
    }
    url.to_string()
}

pub fn detect_source(value: &str) -> MediaSource {
    let Some(url) = normalize_url(value) else {
        return MediaSource::Unknown;
    };
    let raw_host = url.host_str().unwrap_or_default().to_ascii_lowercase();
    let host = raw_host.strip_prefix("www.").unwrap_or(&raw_host);

    if host == "youtu.be" || is_domain(host, "youtube.com") {
        return MediaSource::Youtube;
    }
    if is_domain(host, "instagram.com") {
        return MediaSource::Instagram;
    }
    if is_domain(host, "facebook.com") || host == "fb.watch" {
        return MediaSource::Facebook;
    }
    if is_domain(host, "threads.net") || is_domain(host, "threads.com") {
        return MediaSource::Threads;
    }
    if is_domain(host, "twitter.com") || host == "x.com" {
        return MediaSource::Twitter;
    }
    if is_domain(host, "soundcloud.com") || host == "on.soundcloud.com" {
        return MediaSource::Soundcloud;
    }
    if host == "open.spotify.com" || host == "spotify.link" || host == "spoti.fi" {
        return MediaSource::Spotify;
    }
    if direct_ext_re().is_match(url.path()) {
        return MediaSource::Direct;
    }
    MediaSource::Unknown
}

pub fn is_supported_instagram_reel_url(value: &str) -> bool {
    let Some(url) = normalize_url(value) else {
        return false;
    };
    let host = url.host_str().unwrap_or_default().to_ascii_lowercase();
    is_domain(&host, "instagram.com") && ig_reel_re().is_match(url.path())
}

pub fn is_unavailable_source(source: MediaSource, url: Option<&str>) -> bool {
    match source {
        MediaSource::Instagram => !url.map(is_supported_instagram_reel_url).unwrap_or(false),
        MediaSource::Facebook | MediaSource::Twitter => true,
        _ => false,
    }
}

pub fn is_private_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            v4.is_private()
                || v4.is_loopback()
                || v4.is_link_local()
                || v4.is_broadcast()
                || v4.is_unspecified()
                || v4.is_multicast()
                || (v4.octets()[0] == 100 && (v4.octets()[1] & 0b1100_0000) == 64)
        }
        IpAddr::V6(v6) => {
            v6.is_loopback()
                || v6.is_unspecified()
                || v6.is_multicast()
                || (v6.segments()[0] & 0xfe00) == 0xfc00
                || (v6.segments()[0] & 0xffc0) == 0xfe80
        }
    }
}

pub fn validate_public_url(value: &str) -> Result<Url, SavewaveError> {
    let url = normalize_url(value).ok_or_else(|| SavewaveError::from_code(ErrorCode::InvalidUrl))?;
    if !url.username().is_empty() || url.password().is_some() {
        return Err(SavewaveError::from_code(ErrorCode::InvalidUrl));
    }
    let host = url
        .host_str()
        .ok_or_else(|| SavewaveError::from_code(ErrorCode::InvalidUrl))?
        .to_ascii_lowercase();
    if host == "localhost" || host.ends_with(".local") || host.ends_with(".internal") {
        return Err(SavewaveError::from_code(ErrorCode::InvalidUrl));
    }
    if let Ok(ip) = host.parse::<IpAddr>() {
        if is_private_ip(ip) {
            return Err(SavewaveError::from_code(ErrorCode::InvalidUrl));
        }
    }
    Ok(url)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_all_supported_sources() {
        assert_eq!(detect_source("https://youtu.be/dQw4w9WgXcQ"), MediaSource::Youtube);
        assert_eq!(detect_source("https://www.youtube.com/shorts/dQw4w9WgXcQ"), MediaSource::Youtube);
        assert_eq!(detect_source("https://open.spotify.com/intl-hi/track/1EwIdgeVfiXTIDfFHpgqfI"), MediaSource::Spotify);
        assert_eq!(detect_source("https://spotify.link/abc123"), MediaSource::Spotify);
        assert_eq!(detect_source("spotify:track:1EwIdgeVfiXTIDfFHpgqfI"), MediaSource::Spotify);
        assert_eq!(detect_source("https://www.instagram.com/reel/Cx1234567/"), MediaSource::Instagram);
        assert!(!is_unavailable_source(MediaSource::Instagram, Some("https://www.instagram.com/reel/Cx1234567/")));
        assert!(is_unavailable_source(MediaSource::Instagram, Some("https://www.instagram.com/p/Cx1234567/")));
        assert!(is_unavailable_source(MediaSource::Facebook, Some("https://facebook.com/watch?v=1")));
        assert!(is_unavailable_source(MediaSource::Twitter, Some("https://x.com/user/status/1")));
        assert_eq!(detect_source("https://cdn.example.com/clip.mp4"), MediaSource::Direct);
    }

    #[test]
    fn blocks_ssrf_private_hosts() {
        assert!(validate_public_url("http://127.0.0.1/test.mp4").is_err());
        assert!(validate_public_url("http://localhost:8080/a.mp4").is_err());
        assert!(validate_public_url("http://192.168.1.5/a.mp4").is_err());
        assert!(validate_public_url("https://open.spotify.com/track/1EwIdgeVfiXTIDfFHpgqfI").is_ok());
    }
}
