use std::net::{IpAddr, Ipv4Addr};
use url::Url;

fn is_public_ip(address: IpAddr) -> bool {
    match address {
        IpAddr::V4(ip) => {
            let [a, b, _, _] = ip.octets();
            !(ip.is_private()
                || ip.is_loopback()
                || ip.is_link_local()
                || ip.is_unspecified()
                || ip.is_multicast()
                || ip == Ipv4Addr::BROADCAST
                || a == 0
                || a >= 240
                || (a == 100 && (64..=127).contains(&b))
                || (a == 192 && b == 0)
                || (a == 198 && (b == 18 || b == 19))
                || (a == 198 && b == 51)
                || (a == 203 && b == 0))
        }
        IpAddr::V6(ip) => {
            let first = ip.segments()[0];
            !(ip.is_loopback()
                || ip.is_unspecified()
                || ip.is_multicast()
                || (first & 0xfe00) == 0xfc00
                || (first & 0xffc0) == 0xfe80
                || ip
                    .to_ipv4_mapped()
                    .is_some_and(|mapped| !is_public_ip(IpAddr::V4(mapped))))
        }
    }
}
pub fn validate_url(value: &str) -> Result<Url, String> {
    let parsed = Url::parse(value).map_err(|_| "INVALID_URL".to_string())?;
    if !matches!(parsed.scheme(), "http" | "https")
        || parsed.host_str().is_none()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err("INVALID_URL".into());
    }
    let host = parsed.host_str().unwrap().to_ascii_lowercase();
    let bare_host = host.trim_matches(['[', ']']);
    if host == "localhost"
        || host.ends_with(".localhost")
        || host.ends_with(".local")
        || bare_host
            .parse::<IpAddr>()
            .is_ok_and(|address| !is_public_ip(address))
    {
        return Err("SOURCE_REJECTED".into());
    }
    Ok(parsed)
}

pub async fn validate_public_destination(value: &str) -> Result<Url, String> {
    let parsed = validate_url(value)?;
    let host = parsed.host_str().ok_or("INVALID_URL")?;
    let port = parsed.port_or_known_default().ok_or("INVALID_URL")?;
    let addresses: Vec<_> = tokio::net::lookup_host((host, port))
        .await
        .map_err(|_| "SOURCE_UNAVAILABLE")?
        .collect();
    if addresses.is_empty() || addresses.iter().any(|address| !is_public_ip(address.ip())) {
        return Err("SOURCE_REJECTED".into());
    }
    Ok(parsed)
}

pub fn sanitize_filename(value: &str) -> String {
    let clean: String = value
        .chars()
        .filter(|c| {
            !matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') && !c.is_control()
        })
        .collect();
    let normalized = clean.split_whitespace().collect::<Vec<_>>().join(" ");
    let trimmed = normalized.trim_matches(&[' ', '.'][..]);
    let limited: String = trimmed.chars().take(140).collect();
    let base = limited.split('.').next().unwrap_or("").to_ascii_uppercase();
    let reserved = matches!(base.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || (base.len() == 4
            && matches!(&base[..3], "COM" | "LPT")
            && base[3..]
                .parse::<u8>()
                .is_ok_and(|number| (1..=9).contains(&number)));
    if limited.is_empty() {
        "media".into()
    } else if reserved {
        format!("_{limited}")
    } else {
        limited
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_http_urls_are_accepted() {
        assert!(validate_url("https://example.com/video").is_ok());
        assert!(validate_url("file:///secret").is_err());
    }
    #[test]
    fn loopback_is_rejected() {
        assert!(validate_url("http://127.0.0.1/test").is_err());
        assert!(validate_url("http://169.254.169.254/latest/meta-data").is_err());
        assert!(validate_url("http://10.0.0.4/media").is_err());
        assert!(validate_url("http://[::1]/media").is_err());
    }
    #[test]
    fn filenames_are_safe() {
        assert_eq!(sanitize_filename("Artist: Song?.mp4"), "Artist Song.mp4");
        assert_eq!(sanitize_filename("CON.mp4"), "_CON.mp4");
        assert_eq!(sanitize_filename("lpt1"), "_lpt1");
    }
}
