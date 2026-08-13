'use strict';
const fs = require('node:fs');
const { createSearchAdapter } = require('../src/services/resolver/smartMatch/spotifyMatcher');
const { getSpotifyMetadata } = require('../src/services/resolver/smartMatch/spotifyMetadata');
const { evaluateCandidate } = require('../src/core/spotify/matcher');
const { resolveSpotifySource } = require('../src/core/spotify/search-runtime');

const playlistId = process.argv[2] || '7AQKdFWAEiQ6BFuQ6w7hx8';
const idsFileIndex = process.argv.indexOf('--ids-file');
const idsFile = idsFileIndex >= 0 ? process.argv[idsFileIndex + 1] : null;
const outputIndex = process.argv.indexOf('--output');
const outputFile = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
const concurrency = Math.max(1, Math.min(6, Number(process.env.SPOTIFY_BENCHMARK_CONCURRENCY) || 4));

async function publicTrackIds() {
  const response = await fetch(`https://open.spotify.com/embed/playlist/${playlistId}`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Playlist metadata returned ${response.status}`);
  const html = await response.text();
  const marker = html.indexOf('__NEXT_DATA__');
  const start = html.indexOf('>', marker) + 1;
  const end = html.indexOf('</script>', start);
  if (marker < 0 || start <= 0 || end < 0) throw new Error('Spotify playlist metadata was unavailable.');
  const serialized = JSON.stringify(JSON.parse(html.slice(start, end)));
  return [...new Set([...serialized.matchAll(/spotify:track:([A-Za-z0-9]{22})/g)].map((match) => match[1]))];
}

async function main() {
  const ids = idsFile
    ? [...new Set(JSON.parse(fs.readFileSync(idsFile, 'utf8')))]
    : await publicTrackIds();
  const results = new Array(ids.length);
  let cursor = 0;
  async function worker() {
    while (cursor < ids.length) {
      const index = cursor++;
      const id = ids[index];
      const started = Date.now();
      let metadata = null;
      const attemptedCandidates = [];
      try {
        metadata = await getSpotifyMetadata(`https://open.spotify.com/track/${id}`);
        const baseAdapter = createSearchAdapter();
        const match = await resolveSpotifySource(metadata, { search: async (stage, track) => {
          const candidates = await baseAdapter.search(stage, track);
          attemptedCandidates.push(...candidates.map((candidate) => ({ ...candidate, searchStage: stage.name })));
          return candidates;
        } });
        if (!match) throw new Error('Could not confidently match this Spotify track.');
        const roundTrip = evaluateCandidate(JSON.parse(JSON.stringify(metadata)), JSON.parse(JSON.stringify(match.candidate)));
        const source = match.candidate.url || match.candidate.sourceUrl;
        results[index] = {
          position: index + 1, id, ok: true, title: metadata.title, creator: metadata.artist,
          spotifyDuration: metadata.duration, source, videoId: match.candidate.videoId || match.candidate.id,
          resultType: match.candidate.resultType, searchStage: match.candidate.searchStage,
          score: match.score, confidence: match.confidence, evidence: match.evidence,
          desktopAndroidIdentical: roundTrip.accepted && roundTrip.score === match.score,
          milliseconds: Date.now() - started
        };
      } catch (error) {
        const diagnostics = metadata ? attemptedCandidates.map((candidate) => evaluateCandidate(metadata, candidate))
          .sort((a, b) => b.score - a.score).map((result) => ({
            videoId: result.candidate.videoId || result.candidate.id, title: result.candidate.title,
            artists: result.candidate.artists, resultType: result.candidate.resultType,
            searchStage: result.candidate.searchStage, score: result.score,
            accepted: result.accepted, rejectionReasons: result.rejectionReasons, evidence: result.evidence
          })) : [];
        results[index] = {
          position: index + 1, id, ok: false, title: metadata?.title, creator: metadata?.artist,
          spotifyDuration: metadata?.duration, error: String(error.message || error),
          candidateDiagnostics: diagnostics, milliseconds: Date.now() - started
        };
      }
      const passed = results.filter((result) => result?.ok).length;
      process.stdout.write(`\rSpotify benchmark ${index + 1}/${ids.length} · matched ${passed}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  const passed = results.filter((result) => result.ok);
  const failed = results.filter((result) => !result.ok);
  process.stdout.write('\n');
  const timings = results.map((result) => result.milliseconds).sort((a, b) => a - b);
  const summary = {
    playlistId, idsFile, tested: results.length, matched: passed.length, failed: failed.length,
    matchRate: Number((passed.length / results.length * 100).toFixed(1)),
    desktopAndroidIdentical: passed.every((result) => result.desktopAndroidIdentical),
    averageMilliseconds: Math.round(timings.reduce((sum, value) => sum + value, 0) / Math.max(1, timings.length)),
    p95Milliseconds: timings[Math.min(timings.length - 1, Math.floor(timings.length * 0.95))] || 0,
    failures: failed
  };
  const report = { generatedAt: new Date().toISOString(), summary, tracks: results };
  if (outputFile) fs.writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, process.env.SPOTIFY_BENCHMARK_COMPACT === '1' ? 0 : 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
