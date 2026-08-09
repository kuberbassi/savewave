'use strict';
const { resolveSpotifySmartMatch } = require('../src/services/resolver/smartMatch/spotifyMatcher');

const playlistId = process.argv[2] || '7AQKdFWAEiQ6BFuQ6w7hx8';
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
  const ids = await publicTrackIds();
  const results = new Array(ids.length);
  let cursor = 0;
  async function worker() {
    while (cursor < ids.length) {
      const index = cursor++;
      const id = ids[index];
      const started = Date.now();
      try {
        const media = await resolveSpotifySmartMatch(`https://open.spotify.com/track/${id}`);
        results[index] = { id, ok: true, title: media.title, creator: media.creator, source: media.download.directUrl, milliseconds: Date.now() - started };
      } catch (error) {
        results[index] = { id, ok: false, error: String(error.message || error), milliseconds: Date.now() - started };
      }
      const passed = results.filter((result) => result?.ok).length;
      process.stdout.write(`\rSpotify benchmark ${index + 1}/${ids.length} · matched ${passed}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  const passed = results.filter((result) => result.ok);
  const failed = results.filter((result) => !result.ok);
  process.stdout.write('\n');
  console.log(JSON.stringify({ playlistId, tested: results.length, matched: passed.length, failed: failed.length, matchRate: Number((passed.length / results.length * 100).toFixed(1)), failures: failed }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
