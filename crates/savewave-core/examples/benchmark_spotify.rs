use savewave_core::spotify::{metadata, resolve_spotify_decision, MatchDecision};
use std::time::Instant;

const PLAYLIST_ID: &str = "7AQKdFWAEiQ6BFuQ6w7hx8";

async fn fetch_playlist_track_ids(limit: usize) -> Vec<String> {
    let url = format!("https://open.spotify.com/embed/playlist/{PLAYLIST_ID}");
    let html = reqwest::get(&url)
        .await
        .expect("fetch playlist")
        .text()
        .await
        .expect("read playlist html");
    let re = regex::Regex::new(r"spotify:track:([A-Za-z0-9]{22})").unwrap();
    let mut seen = std::collections::HashSet::new();
    let mut ids = Vec::new();
    for caps in re.captures_iter(&html) {
        let id = caps[1].to_string();
        if seen.insert(id.clone()) {
            ids.push(id);
            if ids.len() >= limit {
                break;
            }
        }
    }
    ids
}

#[tokio::main]
async fn main() {
    let limit = std::env::args()
        .nth(1)
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(15);

    let ids = fetch_playlist_track_ids(limit).await;
    println!("Benchmarking {} Spotify tracks with Rust savewave-core...", ids.len());

    let mut matched = 0usize;
    let mut ambiguous = 0usize;
    let mut failed = 0usize;
    let mut timings_ms: Vec<u128> = Vec::new();

    for (idx, id) in ids.iter().enumerate() {
        let start = Instant::now();
        let url = format!("https://open.spotify.com/track/{id}");
        match metadata::get_spotify_metadata(&url).await {
            Ok(track) => {
                let decision = resolve_spotify_decision(&track).await;
                let elapsed = start.elapsed().as_millis();
                timings_ms.push(elapsed);
                match decision {
                    MatchDecision::Matched { best, .. } => {
                        matched += 1;
                        println!(
                            "[{:>2}/{}] MATCHED ({}ms, score {:.1}, odesli={}) {} - {} -> {}",
                            idx + 1,
                            ids.len(),
                            elapsed,
                            best.score,
                            best.evidence.odesli_linked,
                            track.title,
                            track.artist,
                            best.candidate.video_id
                        );
                    }
                    MatchDecision::Ambiguous { options } => {
                        ambiguous += 1;
                        println!(
                            "[{:>2}/{}] CHOICE  ({}ms) {} - {} ({} options)",
                            idx + 1,
                            ids.len(),
                            elapsed,
                            track.title,
                            track.artist,
                            options.len()
                        );
                    }
                    MatchDecision::Rejected { .. } => {
                        failed += 1;
                        println!(
                            "[{:>2}/{}] FAILED  ({}ms) {} - {}",
                            idx + 1,
                            ids.len(),
                            elapsed,
                            track.title,
                            track.artist
                        );
                    }
                }
            }
            Err(e) => {
                failed += 1;
                let elapsed = start.elapsed().as_millis();
                timings_ms.push(elapsed);
                println!("[{:>2}/{}] METAERR ({}ms) {} -> {}", idx + 1, ids.len(), elapsed, id, e);
            }
        }
    }

    timings_ms.sort_unstable();
    let total = ids.len().max(1);
    let avg = timings_ms.iter().sum::<u128>() / timings_ms.len().max(1) as u128;
    let p95 = timings_ms
        .get(((timings_ms.len() as f64) * 0.95).floor() as usize)
        .or_else(|| timings_ms.last())
        .copied()
        .unwrap_or(0);

    println!("\n=== RUST SPOTIFY MATCHER BENCHMARK SUMMARY ===");
    println!("Tested:       {}", ids.len());
    println!("Auto-Matched: {} ({:.1}%)", matched, matched as f64 / total as f64 * 100.0);
    println!("Choice Modal: {}", ambiguous);
    println!("Failed:       {}", failed);
    println!("Covered Rate: {:.1}%", (matched + ambiguous) as f64 / total as f64 * 100.0);
    println!("Avg Latency:  {} ms", avg);
    println!("P95 Latency:  {} ms", p95);
}
