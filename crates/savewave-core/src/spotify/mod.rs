pub mod matcher;
pub mod metadata;
pub mod odesli;
pub mod ytm;

use crate::errors::{ErrorCode, SavewaveError};
use crate::filename::sanitize_filename;
use crate::models::{MatchOption, MediaSource, ResolvedMedia};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackIdentity {
    pub track_id: String,
    pub title: String,
    pub artist: String,
    pub artists: Vec<String>,
    pub primary_artist: String,
    pub album: Option<String>,
    pub duration: Option<u64>,
    pub release_year: Option<u32>,
    pub explicit: Option<bool>,
    pub isrc: Option<String>,
    pub thumbnail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchCandidate {
    pub video_id: String,
    pub url: String,
    pub result_type: String, // "song" | "video" | "generic-video" | "odesli-song" | "odesli-video"
    pub title: String,
    pub artists: Vec<String>,
    pub artist: Option<String>,
    pub uploader: Option<String>,
    pub album: Option<String>,
    pub duration: Option<u64>,
    pub explicit: Option<bool>,
    pub isrc: Option<String>,
    pub verified: bool,
    pub odesli_linked: bool,
    pub search_stage: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchEvidence {
    pub title: f64,
    pub artist: f64,
    pub duration: Option<f64>,
    pub album: Option<f64>,
    pub isrc_match: bool,
    pub odesli_linked: bool,
    pub duration_diff: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CandidateEvaluation {
    pub candidate: MatchCandidate,
    pub score: f64,
    pub confidence: String,
    pub accepted: bool,
    pub rejection_reasons: Vec<String>,
    pub evidence: MatchEvidence,
}

#[derive(Debug, Clone)]
pub enum MatchDecision {
    Matched {
        best: CandidateEvaluation,
        alternatives: Vec<MatchCandidate>,
    },
    Ambiguous {
        options: Vec<CandidateEvaluation>,
    },
    Rejected {
        best_plausible: Vec<CandidateEvaluation>,
    },
}

fn dedupe_candidates(candidates: Vec<MatchCandidate>) -> Vec<MatchCandidate> {
    let mut seen: HashSet<String> = HashSet::new();
    let mut out = Vec::new();
    for mut cand in candidates {
        if cand.video_id.is_empty() || cand.title.trim().is_empty() {
            continue;
        }
        if let Some(d) = cand.duration {
            if d == 0 || d > 7200 {
                continue;
            }
        }
        if seen.contains(&cand.video_id) {
            // Preserve odesli_linked flag if a previously seen YTM song matches an Odesli ID
            if cand.odesli_linked {
                if let Some(existing) = out.iter_mut().find(|c: &&mut MatchCandidate| c.video_id == cand.video_id) {
                    existing.odesli_linked = true;
                }
            }
            continue;
        }
        seen.insert(cand.video_id.clone());
        cand.url = format!("https://www.youtube.com/watch?v={}", cand.video_id);
        out.push(cand);
    }
    out
}

pub async fn resolve_spotify_decision(track: &TrackIdentity) -> MatchDecision {
    let mut pool: Vec<MatchCandidate> = Vec::new();

    // Stage 1 (Parallel): Odesli cross-platform lookup + YTM primary queries!
    let q_all = format!("{} - {}", track.artists.join(", "), track.title);
    let q_primary = format!("{} - {}", track.primary_artist, track.title);
    let q_title_artist = format!("{} {}", track.title, track.primary_artist);
    let spotify_url = format!("https://open.spotify.com/track/{}", track.track_id);

    let (odesli_res, ytm_all, ytm_title_artist) = tokio::join!(
        odesli::lookup_youtube_candidates(&spotify_url, track),
        ytm::search_youtube_music(&q_all, "songs"),
        ytm::search_youtube_music(&q_title_artist, "songs"),
    );

    let odesli_ids: HashSet<String> = odesli_res.iter().map(|c| c.video_id.clone()).collect();

    for mut c in ytm_all {
        if odesli_ids.contains(&c.video_id) {
            c.odesli_linked = true;
        }
        c.search_stage = Some("all-artists-song".into());
        pool.push(c);
    }
    for mut c in ytm_title_artist {
        if odesli_ids.contains(&c.video_id) {
            c.odesli_linked = true;
        }
        c.search_stage = Some("title-first-song".into());
        pool.push(c);
    }
    // Add Odesli candidates after YTM so structured YTM metadata (duration/album) wins on dedupe,
    // while keeping Odesli direct hits if YTM search missed them!
    pool.extend(odesli_res);

    let deduped = dedupe_candidates(pool.clone());
    if let Some(best) = matcher::confident_match(track, &deduped) {
        let alternatives = matcher::rank_candidates(track, &deduped)
            .into_iter()
            .map(|e| e.candidate)
            .filter(|c| c.video_id != best.candidate.video_id && matcher::same_recording(track, &best.candidate, c))
            .take(2)
            .collect();
        return MatchDecision::Matched { best, alternatives };
    }

    // Stage 2 (Parallel fallback): transliterated ASCII query + title-only YTM songs + YTM videos
    let ascii_artist = matcher::transliterate_ascii(&track.primary_artist);
    let ascii_title = matcher::transliterate_ascii(&track.title);
    let q_ascii = format!("{ascii_title} {ascii_artist}").trim().to_string();

    let (ytm_primary, ytm_title_only, ytm_ascii, ytm_videos) = tokio::join!(
        async {
            if track.artists.len() > 1 {
                ytm::search_youtube_music(&q_primary, "songs").await
            } else {
                Vec::new()
            }
        },
        ytm::search_youtube_music(&track.title, "songs"),
        async {
            if !q_ascii.eq_ignore_ascii_case(&q_title_artist) && !q_ascii.is_empty() {
                ytm::search_youtube_music(&q_ascii, "songs").await
            } else {
                Vec::new()
            }
        },
        ytm::search_youtube_music(&q_all, "videos"),
    );

    for (stage_name, batch) in [
        ("primary-artist-song", ytm_primary),
        ("title-only-song", ytm_title_only),
        ("ascii-translit-song", ytm_ascii),
        ("music-video", ytm_videos),
    ] {
        for mut c in batch {
            if odesli_ids.contains(&c.video_id) {
                c.odesli_linked = true;
            }
            c.search_stage = Some(stage_name.into());
            pool.push(c);
        }
    }

    let final_candidates = dedupe_candidates(pool);
    if let Some(best) = matcher::confident_match(track, &final_candidates) {
        let alternatives = matcher::rank_candidates(track, &final_candidates)
            .into_iter()
            .map(|e| e.candidate)
            .filter(|c| c.video_id != best.candidate.video_id && matcher::same_recording(track, &best.candidate, c))
            .take(2)
            .collect();
        return MatchDecision::Matched { best, alternatives };
    }

    let ranked = matcher::rank_candidates(track, &final_candidates);
    let plausible: Vec<CandidateEvaluation> = ranked
        .into_iter()
        .filter(|e| e.score >= 76.0)
        .take(2)
        .collect();

    if plausible.len() == 2 {
        return MatchDecision::Ambiguous { options: plausible };
    }
    if plausible.len() == 1 && plausible[0].score >= 80.0 {
        return MatchDecision::Matched {
            best: plausible[0].clone(),
            alternatives: Vec::new(),
        };
    }

    MatchDecision::Rejected {
        best_plausible: plausible,
    }
}

pub async fn resolve_spotify_smart_match(url: &str) -> Result<ResolvedMedia, SavewaveError> {
    let track = metadata::get_spotify_metadata(url).await?;
    match resolve_spotify_decision(&track).await {
        MatchDecision::Matched { best, alternatives } => {
            let quality_label = if best.evidence.isrc_match {
                "ISRC exact match".to_string()
            } else if best.evidence.odesli_linked {
                "Verified catalog match".to_string()
            } else if best.confidence == "very-high" {
                "Verified high-confidence match".to_string()
            } else {
                "High-confidence match".to_string()
            };

            let fallback_source_urls = alternatives.into_iter().map(|c| c.url).collect();
            let _safe_name = sanitize_filename(&format!("{} - {}", track.title, track.artist), 120);

            Ok(ResolvedMedia {
                success: true,
                platform: MediaSource::Spotify,
                title: track.title,
                creator: track.artist,
                thumbnail: track.thumbnail,
                duration: track.duration.or(best.candidate.duration),
                media_type: "audio".to_string(),
                quality_label,
                source_url: best.candidate.url,
                fallback_source_urls,
                selection_required: false,
                match_options: Vec::new(),
            })
        }
        MatchDecision::Ambiguous { options } => {
            let match_options = options
                .into_iter()
                .map(|eval| MatchOption {
                    source_url: eval.candidate.url,
                    title: eval.candidate.title,
                    creator: if !eval.candidate.artists.is_empty() {
                        eval.candidate.artists.join(", ")
                    } else {
                        eval.candidate
                            .uploader
                            .unwrap_or_else(|| "YouTube source".to_string())
                    },
                    duration: eval.candidate.duration,
                    score: eval.score,
                })
                .collect();

            Ok(ResolvedMedia {
                success: true,
                platform: MediaSource::Spotify,
                title: track.title,
                creator: track.artist,
                thumbnail: track.thumbnail,
                duration: track.duration,
                media_type: "audio".to_string(),
                quality_label: "Your choice required".to_string(),
                source_url: String::new(),
                fallback_source_urls: Vec::new(),
                selection_required: true,
                match_options,
            })
        }
        MatchDecision::Rejected { .. } => {
            Err(SavewaveError::from_code(ErrorCode::MatchConfidenceLow))
        }
    }
}
