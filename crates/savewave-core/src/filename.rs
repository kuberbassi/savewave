pub fn sanitize_filename(raw: &str, max_len: usize) -> String {
    let cleaned: String = raw
        .chars()
        .map(|ch| match ch {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => ' ',
            c if c.is_control() => ' ',
            c => c,
        })
        .collect();
    let collapsed = cleaned
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim_matches(|c| c == '.' || c == ' ')
        .to_string();

    if collapsed.is_empty() {
        return "media".to_string();
    }

    let truncated: String = collapsed.chars().take(max_len).collect();
    let trimmed = truncated.trim_end_matches(|c| c == '.' || c == ' ').to_string();
    if trimmed.is_empty() {
        "media".to_string()
    } else {
        trimmed
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitizes_windows_illegal_chars() {
        assert_eq!(sanitize_filename("Artist: Song / Remix? *", 80), "Artist Song Remix");
        assert_eq!(sanitize_filename("   ...  ", 80), "media");
    }
}
