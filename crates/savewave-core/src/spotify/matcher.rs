use crate::spotify::{CandidateEvaluation, MatchCandidate, MatchEvidence, TrackIdentity};
use deunicode::deunicode;
use regex::Regex;
use std::collections::HashSet;
use std::sync::OnceLock;
use unicode_normalization::UnicodeNormalization;

const GENERIC_WORDS: &[&str] = &[
    "official",
    "audio",
    "video",
    "lyrics",
    "lyric",
    "lyrical",
    "visualizer",
    "hd",
    "hq",
    "4k",
    "full",
    "song",
    "music",
    "mv",
];

const KNOWN_MUSIC_LABELS: &[&str] = &[
    "t series",
    "sony music india",
    "sony music south",
    "sony music",
    "zee music company",
    "saregama",
    "yrf",
    "tips official",
    "tips music",
    "speed records",
    "desi melodies",
    "white hill music",
    "ultra records",
    "spinnin records",
    "monstercat",
    "ncs",
    "nocopyrightsounds",
    "colors",
    "lyrical lemonade",
    "hybe labels",
    "smtown",
    "jyp entertainment",
    "yg entertainment",
    "the first take",
    "vevo",
];

fn version_patterns() -> &'static [(&'static str, Regex)] {
    static PATS: OnceLock<Vec<(&'static str, Regex)>> = OnceLock::new();
    PATS.get_or_init(|| {
        vec![
            ("remix", Regex::new(r"\bremix\b").unwrap()),
            ("live", Regex::new(r"\blive\b|\bconcert\b").unwrap()),
            ("acoustic", Regex::new(r"\bacoustic\b").unwrap()),
            ("remaster", Regex::new(r"\bremaster(?:ed)?\b").unwrap()),
            ("cover", Regex::new(r"\bcover\b").unwrap()),
            ("instrumental", Regex::new(r"\binstrumental\b").unwrap()),
            ("karaoke", Regex::new(r"\bkaraoke\b").unwrap()),
            ("slowed", Regex::new(r"\bslowed\b").unwrap()),
            ("sped-up", Regex::new(r"\bsped\s*up\b|\bspeed\s*up\b").unwrap()),
            ("nightcore", Regex::new(r"\bnightcore\b").unwrap()),
            ("8d", Regex::new(r"\b8d\b").unwrap()),
            ("clean", Regex::new(r"\bclean(?:\s+version)?\b").unwrap()),
            ("demo", Regex::new(r"\bdemo\b").unwrap()),
            ("extended", Regex::new(r"\bextended\b").unwrap()),
            ("edit", Regex::new(r"\b(?:radio\s+)?edit\b").unwrap()),
            ("anniversary", Regex::new(r"\banniversary\b").unwrap()),
        ]
    })
}

fn non_song_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"\b(reaction|tutorial|interview|documentary|review|behind the scenes)\b")
            .unwrap()
    })
}

fn catalog_qualifier_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r#"(?iu)\s*(?:-\s*from\s+(?:["“][^"”]+["”]|.+?)|[\[(]\s*from\s+(?:["“][^"”]+["”]|[^\])]+)\s*[\])]|\|\s*[^|]+$)"#).unwrap()
    })
}

fn feat_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?iu)\s*[\[(](?:feat(?:uring)?\.?|ft\.?|with)\s+([^\])]+)[\])]").unwrap()
    })
}

pub fn normalize(value: &str) -> String {
    let decomposed: String = value
        .nfkd()
        .filter(|c| !('\u{0300}'..='\u{036f}').contains(c))
        .collect();
    let lower = decomposed.to_lowercase();
    let mut cleaned = String::with_capacity(lower.len());
    for ch in lower.chars() {
        match ch {
            '\'' | '\u{2019}' => {}
            '-' | '\u{2013}' | '\u{2014}' | '_' | '/' | '|' | '&' => cleaned.push(' '),
            c if c.is_alphanumeric() || c == ' ' => cleaned.push(c),
            _ => cleaned.push(' '),
        }
    }
    cleaned.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Transliterate any script (Cyrillic, CJK, Devanagari, Korean, Arabic, Greek, etc.)
/// to normalized ASCII so cross-script artist/title pairs like "фрози" vs "Frozy"
/// or "飯卡" vs "饭卡" match cleanly!
pub fn transliterate_ascii(value: &str) -> String {
    normalize(&deunicode(value))
}

fn strip_catalog_qualifier(value: &str) -> String {
    catalog_qualifier_re().replace_all(value, " ").trim().to_string()
}

pub fn version_markers(value: &str) -> Vec<&'static str> {
    let text = normalize(value);
    version_patterns()
        .iter()
        .filter(|(_, re)| re.is_match(&text))
        .map(|(name, _)| *name)
        .collect()
}

fn canonical_title(value: &str, credited_artists: &[String]) -> String {
    let mut title = strip_catalog_qualifier(value);
    if let Some(caps) = feat_re().captures(&title.clone()) {
        let credit = normalize(&caps[1]);
        let known = credited_artists.iter().any(|a| {
            let na = normalize(a);
            !na.is_empty() && (credit.contains(&na) || na.contains(&credit))
        });
        if known {
            title = title.replace(&caps[0], " ");
        }
    }
    strip_catalog_qualifier(&title)
}

fn feature_agnostic_title(value: &str) -> String {
    let stripped = strip_catalog_qualifier(value);
    feat_re().replace_all(&stripped, " ").trim().to_string()
}

fn tokens(value: &str) -> Vec<String> {
    let generic: HashSet<&str> = GENERIC_WORDS.iter().copied().collect();
    let mut seen = HashSet::new();
    normalize(value)
        .split_whitespace()
        .filter(|t| !t.is_empty() && !generic.contains(*t))
        .filter_map(|t| {
            let s = t.to_string();
            if seen.insert(s.clone()) {
                Some(s)
            } else {
                None
            }
        })
        .collect()
}

fn token_similarity(first: &str, second: &str) -> f64 {
    let left = tokens(first);
    let right = tokens(second);
    if left.is_empty() || right.is_empty() {
        return 0.0;
    }
    let right_set: HashSet<&str> = right.iter().map(|s| s.as_str()).collect();
    let overlap = left.iter().filter(|t| right_set.contains(t.as_str())).count() as f64;
    (overlap / left.len() as f64 + overlap / right.len() as f64) / 2.0
}

fn raw_text_similarity(left: &str, right: &str) -> f64 {
    if left.is_empty() || right.is_empty() {
        return 0.0;
    }
    if left == right {
        return 1.0;
    }
    let contained = left.chars().count() >= 3
        && right.chars().count() >= 3
        && (left.contains(right) || right.contains(left));
    let contain_score: f64 = if contained { 0.96 } else { 0.0 };
    let tok = token_similarity(left, right);
    let lev = strsim::normalized_levenshtein(left, right);
    let jw = if left.chars().count() >= 3 && right.chars().count() >= 3 {
        strsim::jaro_winkler(left, right) * 0.95
    } else {
        0.0
    };
    contain_score.max(tok).max(lev).max(jw)
}

pub fn text_similarity(first: &str, second: &str) -> f64 {
    let left = normalize(first);
    let right = normalize(second);
    let direct = raw_text_similarity(&left, &right);

    // Cross-script transliteration comparison (fixes Cyrillic/CJK/Devanagari/etc. vs Latin)
    let left_ascii = transliterate_ascii(first);
    let right_ascii = transliterate_ascii(second);
    let translit = if !left_ascii.is_empty() && !right_ascii.is_empty() {
        raw_text_similarity(&left_ascii, &right_ascii) * 0.98
    } else {
        0.0
    };

    direct.max(translit)
}

fn candidate_artists(candidate: &MatchCandidate) -> Vec<String> {
    let raw: Vec<&str> = if !candidate.artists.is_empty() {
        candidate.artists.iter().map(|s| s.as_str()).collect()
    } else {
        [
            candidate.artist.as_deref(),
            candidate.uploader.as_deref(),
            Some(candidate.title.as_str()),
        ]
        .into_iter()
        .flatten()
        .collect()
    };
    let mut seen = HashSet::new();
    raw.into_iter()
        .map(normalize)
        .filter(|s| !s.is_empty() && seen.insert(s.clone()))
        .collect()
}

fn is_known_music_label(uploader: &str) -> bool {
    let norm = normalize(uploader);
    KNOWN_MUSIC_LABELS
        .iter()
        .any(|label| norm == *label || norm.contains(label))
}

fn artist_similarity(track: &TrackIdentity, candidate: &MatchCandidate) -> f64 {
    let mut expected: Vec<String> = Vec::new();
    let mut seen = HashSet::new();
    for a in std::iter::once(&track.primary_artist).chain(track.artists.iter()) {
        let n = normalize(a);
        if !n.is_empty() && seen.insert(n.clone()) {
            expected.push(n);
        }
    }
    let actual = candidate_artists(candidate);
    if expected.is_empty() || actual.is_empty() {
        return 0.0;
    }

    // Also inspect candidate title when uploader is a label (e.g. T-Series / Sony Music)
    let title_norm = normalize(&candidate.title);
    let title_ascii = transliterate_ascii(&candidate.title);

    let best_for = |artist: &str| -> f64 {
        let artist_ascii = transliterate_ascii(artist);
        let mut best = actual
            .iter()
            .map(|val| {
                if val.contains(artist) || artist.contains(val.as_str()) {
                    1.0
                } else {
                    text_similarity(artist, val)
                }
            })
            .fold(0.0_f64, f64::max);

        // If candidate uploader is a major label and the artist appears in the video title,
        // recover strong artist evidence!
        if best < 0.85
            && (candidate
                .uploader
                .as_deref()
                .map(is_known_music_label)
                .unwrap_or(false)
                || actual.iter().any(|a| is_known_music_label(a)))
            && (title_norm.contains(artist)
                || (!artist_ascii.is_empty()
                    && artist_ascii.len() >= 3
                    && title_ascii.contains(&artist_ascii)))
        {
            best = best.max(0.88);
        }
        best
    };

    let primary = best_for(&expected[0]);
    let credited = expected.iter().map(|a| best_for(a)).sum::<f64>() / expected.len() as f64;
    0.7 * primary + 0.3 * credited
}

pub fn duration_similarity(expected: Option<u64>, actual: Option<u64>) -> Option<f64> {
    let (e, a) = (expected?, actual?);
    if e == 0 || a == 0 {
        return None;
    }
    let diff = e.abs_diff(a) as f64;
    Some((-0.1 * diff).exp())
}

fn incompatible_versions(track: &TrackIdentity, candidate: &MatchCandidate) -> Vec<&'static str> {
    let expected: HashSet<&str> = version_markers(&track.title).into_iter().collect();
    let actual: HashSet<&str> = version_markers(&candidate.title).into_iter().collect();
    let required: HashSet<&str> = [
        "remix",
        "live",
        "acoustic",
        "cover",
        "instrumental",
        "karaoke",
        "slowed",
        "sped-up",
        "nightcore",
        "8d",
        "clean",
        "demo",
        "extended",
        "edit",
        "anniversary",
    ]
    .into_iter()
    .collect();

    let mut conflicts = Vec::new();
    for m in &actual {
        if !expected.contains(m) {
            conflicts.push(*m);
        }
    }
    for m in &expected {
        if required.contains(m) && !actual.contains(m) {
            conflicts.push(*m);
        }
    }
    conflicts
}

fn authoritative_owner(track: &TrackIdentity, candidate: &MatchCandidate) -> bool {
    let owner = normalize(
        candidate
            .uploader
            .as_deref()
            .or(candidate.artist.as_deref())
            .unwrap_or_default(),
    );
    if owner.is_empty() {
        return false;
    }
    std::iter::once(&track.primary_artist)
        .chain(track.artists.iter())
        .any(|a| {
            let na = normalize(a);
            if na.is_empty() {
                return false;
            }
            owner == na
                || owner == format!("{na} topic")
                || owner == format!("{na} vevo")
                || owner == format!("{na} official")
                || owner == format!("{na} official channel")
        })
}

pub fn evaluate_candidate(track: &TrackIdentity, candidate: &MatchCandidate) -> CandidateEvaluation {
    let mut rejection_reasons: Vec<String> = Vec::new();
    let artists = candidate_artists(candidate);
    if candidate.title.trim().is_empty() || artists.is_empty() {
        rejection_reasons.push("MISSING_IDENTITY".into());
    }
    if let (Some(ti), Some(ci)) = (&track.isrc, &candidate.isrc) {
        if !ti.eq_ignore_ascii_case(ci) {
            rejection_reasons.push("ISRC_CONFLICT".into());
        }
    }
    if !incompatible_versions(track, candidate).is_empty() {
        rejection_reasons.push("VERSION_CONFLICT".into());
    }
    if track.explicit == Some(true) && candidate.explicit == Some(false) {
        rejection_reasons.push("EXPLICIT_CONFLICT".into());
    }

    let duration_diff = match (track.duration, candidate.duration) {
        (Some(e), Some(a)) => Some(e.abs_diff(a)),
        _ => None,
    };

    let expected_title = canonical_title(&track.title, &track.artists);
    let actual_title = canonical_title(&candidate.title, &track.artists);
    let title = text_similarity(&expected_title, &actual_title)
        .max(text_similarity(
            &feature_agnostic_title(&track.title),
            &feature_agnostic_title(&candidate.title),
        ));

    let measured_artist = artist_similarity(track, candidate);

    // Structured song cross-script / localized catalog recovery:
    // If YTM returns a structured song with exact/near-exact title (>= 0.90) and
    // duration within 3 seconds, or Odesli cross-platform catalog links it directly,
    // recover localized artist aliases (e.g. "фрози" vs "Frozy", "飯卡" vs "饭卡").
    let localized_catalog_recovery = candidate.result_type == "song"
        && title >= 0.85
        && duration_diff.map(|d| d <= 3).unwrap_or(false)
        && (measured_artist >= 0.35 || candidate.odesli_linked);

    let artist = if authoritative_owner(track, candidate) {
        measured_artist.max(0.92)
    } else if localized_catalog_recovery {
        measured_artist.max(0.86)
    } else {
        measured_artist
    };

    // Tiered duration limit: strict for songs, slightly more generous for official videos
    // with intros/outros when title + artist are very strong.
    let base_duration_limit = track.duration.map(|d| (d as f64 * 0.08).max(12.0) as u64);
    let duration_limit = match base_duration_limit {
        Some(limit) if candidate.result_type != "song" && title >= 0.90 && artist >= 0.85 => {
            Some(limit.max(25))
        }
        other => other,
    };
    if let (Some(diff), Some(limit)) = (duration_diff, duration_limit) {
        if diff > limit {
            rejection_reasons.push("DURATION_MISMATCH".into());
        }
    }

    if title < 0.60 {
        rejection_reasons.push("TITLE_MISMATCH".into());
    }
    if artist < 0.68 {
        rejection_reasons.push("ARTIST_MISMATCH".into());
    }
    if candidate.result_type == "generic-video" && non_song_re().is_match(&normalize(&candidate.title))
    {
        rejection_reasons.push("NON_SONG_CONTENT".into());
    }

    let measured_duration = duration_similarity(track.duration, candidate.duration);
    let duration = if candidate.result_type == "song"
        && title >= 0.92
        && artist >= 0.85
        && duration_diff
            .zip(duration_limit)
            .map(|(d, l)| d <= l)
            .unwrap_or(false)
    {
        Some(measured_duration.unwrap_or(0.0).max(0.78))
    } else {
        measured_duration
    };

    let album = match (&track.album, &candidate.album) {
        (Some(ta), Some(ca)) if !ta.is_empty() && !ca.is_empty() => Some(text_similarity(ta, ca)),
        _ => None,
    };

    let mut weighted: Vec<(f64, f64)> = vec![(title, 0.42), (artist, 0.33)];
    if let Some(d) = duration {
        weighted.push((d, 0.20));
    }
    if let Some(a) = album {
        weighted.push((a, 0.05));
    }
    let total_w: f64 = weighted.iter().map(|(_, w)| *w).sum();
    let identity = if total_w > 0.0 {
        weighted.iter().map(|(v, w)| v * w).sum::<f64>() / total_w
    } else {
        0.0
    };

    let isrc_match = match (&track.isrc, &candidate.isrc) {
        (Some(ti), Some(ci)) => ti.eq_ignore_ascii_case(ci),
        _ => false,
    };

    let source_tie_break = if candidate.odesli_linked && candidate.result_type == "song" {
        0.015
    } else if candidate.odesli_linked {
        0.010
    } else if candidate.result_type == "song" {
        0.006
    } else if candidate.verified {
        0.003
    } else {
        0.0
    };

    let raw_score = ((identity + source_tie_break).min(1.0) * 1000.0).round() / 10.0;
    let final_score = if isrc_match && rejection_reasons.is_empty() {
        100.0
    } else {
        raw_score
    };

    let confidence = if final_score >= 90.0 {
        "very-high"
    } else if final_score >= 82.0 {
        "high"
    } else {
        "low"
    }
    .to_string();

    CandidateEvaluation {
        candidate: candidate.clone(),
        score: final_score,
        confidence,
        accepted: rejection_reasons.is_empty(),
        rejection_reasons,
        evidence: MatchEvidence {
            title,
            artist,
            duration,
            album,
            isrc_match,
            odesli_linked: candidate.odesli_linked,
            duration_diff,
        },
    }
}

pub fn same_recording(track: &TrackIdentity, first: &MatchCandidate, second: &MatchCandidate) -> bool {
    let first_eval = evaluate_candidate(track, first);
    let second_eval = evaluate_candidate(track, second);
    if !first_eval.accepted || !second_eval.accepted {
        return false;
    }
    if first_eval.evidence.title < 0.70 || second_eval.evidence.title < 0.70 {
        return false;
    }
    if version_markers(&first.title) != version_markers(&second.title) {
        return false;
    }
    if first_eval.evidence.artist < 0.78 || second_eval.evidence.artist < 0.78 {
        return false;
    }
    match (first.duration, second.duration) {
        (Some(a), Some(b)) => a.abs_diff(b) <= 4,
        _ => true,
    }
}

pub fn rank_candidates(track: &TrackIdentity, candidates: &[MatchCandidate]) -> Vec<CandidateEvaluation> {
    let mut evaluated: Vec<(usize, CandidateEvaluation)> = candidates
        .iter()
        .enumerate()
        .map(|(i, c)| (i, evaluate_candidate(track, c)))
        .filter(|(_, e)| e.accepted)
        .collect();
    evaluated.sort_by(|(ia, a), (ib, b)| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| ia.cmp(ib))
    });
    evaluated.into_iter().map(|(_, e)| e).collect()
}

pub fn confident_match(track: &TrackIdentity, candidates: &[MatchCandidate]) -> Option<CandidateEvaluation> {
    let ranked = rank_candidates(track, candidates);
    let best = ranked.first()?;
    let runner_up = ranked.get(1);

    let min_score = if best.candidate.odesli_linked && best.candidate.result_type == "song" {
        80.0
    } else if best.candidate.result_type == "song" {
        82.0
    } else {
        84.0
    };

    if best.score < min_score {
        return None;
    }
    if best.evidence.isrc_match || best.evidence.odesli_linked {
        return Some(best.clone());
    }
    let structured_or_owned = best.candidate.result_type == "song"
        || authoritative_owner(track, &best.candidate)
        || (best.candidate.result_type == "video"
            && best
                .candidate
                .uploader
                .as_deref()
                .map(is_known_music_label)
                .unwrap_or(false)
            && best.evidence.artist >= 0.85);
    if !structured_or_owned && runner_up.is_none() {
        return None;
    }
    match runner_up {
        None => Some(best.clone()),
        Some(second) => {
            if best.score - second.score >= 2.5
                || same_recording(track, &best.candidate, &second.candidate)
                || (best.candidate.result_type == "song" && second.candidate.result_type != "song")
            {
                Some(best.clone())
            } else {
                None
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_candidate(
        id: &str,
        result_type: &str,
        title: &str,
        artists: &[&str],
        duration: Option<u64>,
    ) -> MatchCandidate {
        MatchCandidate {
            video_id: id.into(),
            url: format!("https://www.youtube.com/watch?v={id}"),
            result_type: result_type.into(),
            title: title.into(),
            artists: artists.iter().map(|s| s.to_string()).collect(),
            artist: artists.first().map(|s| s.to_string()),
            uploader: artists.first().map(|s| s.to_string()),
            album: None,
            duration,
            explicit: None,
            isrc: None,
            verified: result_type == "song",
            odesli_linked: false,
            search_stage: None,
        }
    }

    #[test]
    fn matches_cyrillic_to_latin_transliterated_artist() {
        // Real track #15 from baseline that previously FAILED with ARTIST_MISMATCH!
        let track = TrackIdentity {
            track_id: "1EwIdgeVfiXTIDfFHpgqfI".into(),
            title: "kompa pasión".into(),
            artist: "фрози".into(),
            artists: vec!["фрози".into()],
            primary_artist: "фрози".into(),
            album: None,
            duration: Some(148),
            release_year: None,
            explicit: None,
            isrc: None,
            thumbnail: None,
        };
        let candidates = vec![
            sample_candidate("KXTyCbyAdUo", "generic-video", "kompa pasión (sped up)", &["фрози"], Some(128)),
            sample_candidate("gNYepazLmAI", "generic-video", "kompa pasión (slowed)", &["фрози"], Some(174)),
            sample_candidate("KM1LU0qbb9U", "song", "kompa pasión", &["Frozy"], Some(148)),
        ];
        let matched = confident_match(&track, &candidates).expect("should match Frozy song");
        assert_eq!(matched.candidate.video_id, "KM1LU0qbb9U");
        assert!(matched.score >= 85.0);
    }

    #[test]
    fn rejects_slowed_and_sped_up_traps() {
        let track = TrackIdentity {
            track_id: "abc".into(),
            title: "Blinding Lights".into(),
            artist: "The Weeknd".into(),
            artists: vec!["The Weeknd".into()],
            primary_artist: "The Weeknd".into(),
            album: Some("After Hours".into()),
            duration: Some(200),
            release_year: Some(2020),
            explicit: None,
            isrc: None,
            thumbnail: None,
        };
        let trap = sample_candidate("trap1", "song", "Blinding Lights (Slowed + Reverb)", &["The Weeknd"], Some(200));
        let eval = evaluate_candidate(&track, &trap);
        assert!(!eval.accepted);
        assert!(eval.rejection_reasons.contains(&"VERSION_CONFLICT".to_string()));
    }

    #[test]
    fn matches_bollywood_label_upload() {
        let track = TrackIdentity {
            track_id: "bolly".into(),
            title: "Kesariya (From \"Brahmāstra\")".into(),
            artist: "Pritam, Arijit Singh".into(),
            artists: vec!["Pritam".into(), "Arijit Singh".into()],
            primary_artist: "Pritam".into(),
            album: Some("Brahmāstra".into()),
            duration: Some(268),
            release_year: Some(2022),
            explicit: None,
            isrc: None,
            thumbnail: None,
        };
        let label_vid = sample_candidate(
            "BddP6PYo2gs",
            "video",
            "Kesariya - Brahmāstra | Ranbir Kapoor | Alia Bhatt | Pritam | Arijit Singh | Amitabh Bhattacharya",
            &["Sony Music India"],
            Some(270),
        );
        let matched = confident_match(&track, &[label_vid]).expect("should match label upload");
        assert_eq!(matched.candidate.video_id, "BddP6PYo2gs");
    }
}
