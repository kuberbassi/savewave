'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createSearchAdapter } = require('../src/services/resolver/smartMatch/spotifyMatcher');
const { resolveSpotifyDecision } = require('../src/core/spotify/search-runtime');
const { rankCandidates } = require('../src/core/spotify/matcher');

function parseCsv(text) {
  const rows = [];
  let row = []; let field = ''; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') { row.push(field); field = ''; }
    else if (character === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += character;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

function durationSeconds(value) {
  const pieces = String(value || '').split(':').map(Number);
  if (pieces.length !== 2 || pieces.some((piece) => !Number.isFinite(piece))) return undefined;
  return pieces[0] * 60 + pieces[1];
}

function csvTracks(file) {
  const [headers, ...rows] = parseCsv(fs.readFileSync(file, 'utf8'));
  const position = Object.fromEntries(headers.map((header, index) => [header.trim(), index]));
  return rows.filter((row) => row.length > 1).map((row) => {
    const artists = String(row[position.Artist] || '').split(',').map((artist) => artist.trim()).filter(Boolean);
    const releaseDate = String(row[position['Album Date']] || '').trim();
    return {
      trackId: String(row[position['Spotify Track Id']] || '').trim(),
      title: String(row[position.Song] || '').trim(),
      artist: artists.join(', '), artists, primaryArtist: artists[0] || '',
      album: String(row[position.Album] || '').trim() || undefined,
      duration: durationSeconds(row[position.Duration]),
      releaseDate: releaseDate || undefined,
      releaseYear: /^\d{4}/.test(releaseDate) ? Number(releaseDate.slice(0, 4)) : undefined,
      isrc: String(row[position.ISRC] || '').trim().toUpperCase() || undefined,
      corpus: path.basename(file)
    };
  }).filter((track) => track.trackId && track.title && track.primaryArtist);
}

function textTracks(file) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).map((line, index) => {
    const separator = line.indexOf(' - ');
    if (separator < 1) return null;
    const artist = line.slice(0, separator).trim();
    return {
      trackId: `text-${index + 1}`, title: line.slice(separator + 3).trim(), artist,
      artists: artist.split(',').map((value) => value.trim()).filter(Boolean),
      primaryArtist: artist.split(',')[0].trim(), corpus: path.basename(file)
    };
  }).filter(Boolean);
}

async function main() {
  const outputIndex = process.argv.indexOf('--output');
  const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
  const idsIndex = process.argv.indexOf('--ids-file');
  const idsFile = idsIndex >= 0 ? process.argv[idsIndex + 1] : null;
  const args = process.argv.slice(2).filter((value, index, values) =>
    !value.startsWith('--') && !['--output', '--ids-file'].includes(values[index - 1]));
  if (!args.length) throw new Error('Pass one or more Spotify CSV or artist-title text files.');
  const concurrency = Math.max(1, Math.min(12, Number(process.env.SPOTIFY_BENCHMARK_CONCURRENCY) || 10));
  const input = args.flatMap((file) => path.extname(file).toLowerCase() === '.csv' ? csvTracks(file) : textTracks(file));
  const selectedIds = idsFile ? new Set(JSON.parse(fs.readFileSync(idsFile, 'utf8'))) : null;
  const tracks = [...new Map(input.map((track) => [track.trackId, track])).values()]
    .filter((track) => !selectedIds || selectedIds.has(track.trackId));
  const results = new Array(tracks.length); let cursor = 0; let completed = 0;
  const adapter = createSearchAdapter();

  async function worker() {
    while (cursor < tracks.length) {
      const index = cursor++; const track = tracks[index]; const started = Date.now();
      try {
        const attempted = [];
        const decision = await resolveSpotifyDecision(track, { search: async (stage, metadata) => {
          const candidates = await adapter.search(stage, metadata);
          attempted.push(...candidates.map((candidate) => ({ ...candidate, searchStage: stage.name })));
          return candidates;
        } });
        if (decision.status === 'matched') {
          results[index] = { id: track.trackId, corpus: track.corpus, title: track.title, artist: track.artist,
            status: 'matched', score: Number(decision.match.score.toFixed(1)), source: decision.match.candidate.url || decision.match.candidate.sourceUrl,
            matchedTitle: decision.match.candidate.title, matchedArtists: decision.match.candidate.artists, milliseconds: Date.now() - started };
        } else if (decision.status === 'ambiguous') {
          results[index] = { id: track.trackId, corpus: track.corpus, title: track.title, artist: track.artist,
            status: 'choice', choices: decision.candidates.map(({ candidate, score }) => ({ title: candidate.title, artists: candidate.artists, score })), milliseconds: Date.now() - started };
        } else results[index] = { id: track.trackId, corpus: track.corpus, title: track.title, artist: track.artist, status: 'rejected',
          diagnostics: rankCandidates(track, attempted).slice(0, 3).map((result) => ({
            title: result.candidate.title, artists: result.candidate.artists, score: Number(result.score.toFixed(1)),
            stage: result.candidate.searchStage, rejectionReasons: result.rejectionReasons
          })), milliseconds: Date.now() - started };
      } catch (error) {
        results[index] = { id: track.trackId, corpus: track.corpus, title: track.title, artist: track.artist, status: 'error', error: error.message, milliseconds: Date.now() - started };
      }
      completed += 1;
      process.stdout.write(`\rCorpus benchmark ${completed}/${tracks.length}`);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  process.stdout.write('\n');
  const counts = results.reduce((totals, result) => ({ ...totals, [result.status]: (totals[result.status] || 0) + 1 }), {});
  const matched = results.filter((result) => result.status === 'matched');
  const summary = {
    generatedAt: new Date().toISOString(), inputRows: input.length, uniqueTracks: tracks.length, concurrency, counts,
    automaticMatchRate: Number(((matched.length / tracks.length) * 100).toFixed(1)),
    coveredWithChoiceRate: Number((((matched.length + (counts.choice || 0)) / tracks.length) * 100).toFixed(1)),
    averageAcceptedScore: matched.length ? Number((matched.reduce((sum, result) => sum + result.score, 0) / matched.length).toFixed(1)) : null,
    correctnessUnverified: true
  };
  const report = { summary, unresolved: results.filter((result) => result.status !== 'matched'), lowConfidenceAccepted: matched.filter((result) => result.score < 90) };
  if (output) fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(summary));
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { csvTracks, durationSeconds, parseCsv, textTracks };
