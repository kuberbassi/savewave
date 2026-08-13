'use strict';

const VERSION_PATTERNS = Object.freeze({
  remix: /\bremix\b/u,
  live: /\blive\b|\bconcert\b/u,
  acoustic: /\bacoustic\b/u,
  remaster: /\bremaster(?:ed)?\b/u,
  cover: /\bcover\b/u,
  instrumental: /\binstrumental\b/u,
  karaoke: /\bkaraoke\b/u,
  slowed: /\bslowed\b/u,
  'sped-up': /\bsped\s*up\b|\bspeed\s*up\b/u,
  nightcore: /\bnightcore\b/u,
  '8d': /\b8d\b/u,
  clean: /\bclean(?:\s+version)?\b/u,
  demo: /\bdemo\b/u,
  extended: /\bextended\b/u,
  edit: /\b(?:radio\s+)?edit\b/u
});

const NON_SONG_PATTERNS = /\b(reaction|tutorial|interview|documentary|review|behind the scenes)\b/u;
const GENERIC_WORDS = new Set(['official', 'audio', 'video', 'lyrics', 'lyric', 'visualizer', 'hd', 'hq']);

function normalize(value) {
  return String(value || '').normalize('NFKD').toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/[-–—_/|]+/g, ' ')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .replace(/\s+/g, ' ').trim();
}

function stripCatalogQualifier(value) {
  return String(value || '')
    .replace(/\s*-\s*from\s+["“][^"”]+["”]\s*$/giu, ' ')
    .replace(/\s*[\[(]\s*from\s+["“][^"”]+["”]\s*[\])]\s*$/giu, ' ')
    .trim();
}

function versionMarkers(value) {
  const text = normalize(value);
  return Object.entries(VERSION_PATTERNS).filter(([, pattern]) => pattern.test(text)).map(([marker]) => marker);
}

function canonicalTitle(value, creditedArtists = []) {
  let title = stripCatalogQualifier(value);
  const credits = title.match(/\s*[\[(](?:feat(?:uring)?\.?|ft\.?|with)\s+([^\])]+)[\])]/iu);
  if (credits) {
    const credit = normalize(credits[1]);
    const known = creditedArtists.map(normalize).some((artist) => artist && (credit.includes(artist) || artist.includes(credit)));
    if (known) title = title.replace(credits[0], ' ');
  }
  return title.trim();
}

function editSimilarity(first, second) {
  if (first === second) return 1;
  if (!first || !second) return 0;
  let row = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let i = 1; i <= first.length; i += 1) {
    const next = [i];
    for (let j = 1; j <= second.length; j += 1) {
      next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (first[i - 1] === second[j - 1] ? 0 : 1));
    }
    row = next;
  }
  return 1 - row[second.length] / Math.max(first.length, second.length);
}

function tokens(value) {
  return [...new Set(normalize(value).split(' ').filter((token) => token && !GENERIC_WORDS.has(token)))];
}

function tokenSimilarity(first, second) {
  const left = tokens(first); const right = tokens(second);
  if (!left.length || !right.length) return 0;
  const overlap = left.filter((token) => right.includes(token)).length;
  return (overlap / left.length + overlap / right.length) / 2;
}

function textSimilarity(first, second) {
  const left = normalize(first); const right = normalize(second);
  return Math.max(tokenSimilarity(left, right), editSimilarity(left, right));
}

function candidateArtists(candidate) {
  const values = Array.isArray(candidate.artists) && candidate.artists.length
    ? candidate.artists
    : [candidate.artist, candidate.author, candidate.uploader, candidate.title];
  return [...new Set(values.map(normalize).filter(Boolean))];
}

function artistSimilarity(track, candidate) {
  const expected = [...new Set([track.primaryArtist, ...(track.artists || [])].map(normalize).filter(Boolean))];
  const actual = candidateArtists(candidate);
  if (!expected.length || !actual.length) return 0;
  const bestFor = (artist) => Math.max(...actual.map((value) => value.includes(artist) || artist.includes(value) ? 1 : textSimilarity(artist, value)), 0);
  const primary = bestFor(expected[0]);
  const credited = expected.reduce((sum, artist) => sum + bestFor(artist), 0) / expected.length;
  return 0.7 * primary + 0.3 * credited;
}

function durationSimilarity(expected, actual) {
  if (!Number.isFinite(expected) || !Number.isFinite(actual) || expected <= 0 || actual <= 0) return null;
  return Math.exp(-0.1 * Math.abs(expected - actual));
}

function incompatibleVersions(track, candidate) {
  const expected = new Set(versionMarkers(track.title));
  return versionMarkers(candidate.title).filter((marker) => !expected.has(marker));
}

function authoritativeOwner(track, candidate) {
  const owner = normalize(candidate.uploader || candidate.author || candidate.artist || '');
  return [...new Set([track.primaryArtist, ...(track.artists || [])].map(normalize).filter(Boolean))]
    .some((artist) => owner === artist || owner === `${artist} topic` || owner === `${artist} vevo`);
}

function evaluateCandidate(track, candidate) {
  const rejectionReasons = [];
  const artists = candidateArtists(candidate);
  if (!candidate || !candidate.title || !artists.length) {
    rejectionReasons.push('MISSING_IDENTITY');
  }
  if (track.isrc && candidate.isrc && normalize(track.isrc) !== normalize(candidate.isrc)) rejectionReasons.push('ISRC_CONFLICT');
  if (incompatibleVersions(track, candidate).length) rejectionReasons.push('VERSION_CONFLICT');
  if (track.explicit === true && candidate.explicit === false) rejectionReasons.push('EXPLICIT_CONFLICT');
  const durationDiff = Number.isFinite(track.duration) && Number.isFinite(candidate.duration)
    ? Math.abs(track.duration - candidate.duration) : null;
  const durationLimit = Number.isFinite(track.duration) ? Math.max(12, track.duration * 0.08) : null;
  if (durationDiff !== null && durationLimit !== null && durationDiff > durationLimit) rejectionReasons.push('DURATION_MISMATCH');

  const expectedTitle = canonicalTitle(track.title, track.artists || []);
  const actualTitle = canonicalTitle(candidate.title, track.artists || []);
  const title = textSimilarity(expectedTitle, actualTitle);
  const artist = artistSimilarity(track, candidate);
  if (title < 0.6) rejectionReasons.push('TITLE_MISMATCH');
  if (artist < 0.7) rejectionReasons.push('ARTIST_MISMATCH');
  if (candidate.resultType === 'generic-video' && NON_SONG_PATTERNS.test(normalize(candidate.title))) rejectionReasons.push('NON_SONG_CONTENT');

  const duration = durationSimilarity(track.duration, candidate.duration);
  const album = track.album && candidate.album ? textSimilarity(track.album, candidate.album) : null;
  const weighted = [
    [title, 0.42], [artist, 0.33],
    ...(duration === null ? [] : [[duration, 0.20]]),
    ...(album === null ? [] : [[album, 0.05]])
  ];
  const weight = weighted.reduce((sum, item) => sum + item[1], 0);
  const identity = weight ? weighted.reduce((sum, item) => sum + item[0] * item[1], 0) / weight : 0;
  const isrcMatch = Boolean(track.isrc && candidate.isrc && normalize(track.isrc) === normalize(candidate.isrc));
  const sourceTieBreak = candidate.resultType === 'song' ? 0.006 : candidate.verified ? 0.003 : 0;
  const score = Math.round(Math.min(1, identity + sourceTieBreak) * 1000) / 10;

  return {
    candidate,
    score: isrcMatch && !rejectionReasons.length ? 100 : score,
    confidence: score >= 90 ? 'very-high' : score >= 84 ? 'high' : 'low',
    accepted: rejectionReasons.length === 0,
    rejectionReasons,
    evidence: { title, artist, duration, album, isrcMatch, durationDiff }
  };
}

function sameRecording(track, first, second) {
  if (!first || !second) return false;
  const firstOwner = normalize(first.uploader || first.author || '');
  const secondOwner = normalize(second.uploader || second.author || '');
  const structuredTypes = new Set(['song', 'video']);
  const hasStructuredResult = structuredTypes.has(first.resultType) || structuredTypes.has(second.resultType);
  if (!hasStructuredResult && (!firstOwner || !secondOwner || firstOwner === secondOwner)) return false;
  const firstEval = evaluateCandidate(track, first); const secondEval = evaluateCandidate(track, second);
  if (!firstEval.accepted || !secondEval.accepted) return false;
  if (firstEval.evidence.title < 0.7 || secondEval.evidence.title < 0.7) return false;
  if (versionMarkers(first.title).join('|') !== versionMarkers(second.title).join('|')) return false;
  if (firstEval.evidence.artist < 0.8 || secondEval.evidence.artist < 0.8) return false;
  return !Number.isFinite(first.duration) || !Number.isFinite(second.duration) || Math.abs(first.duration - second.duration) <= 3;
}

function rankCandidates(track, candidates) {
  return candidates.map((candidate, index) => ({ ...evaluateCandidate(track, candidate), index }))
    .filter((result) => result.accepted)
    .sort((a, b) => b.score - a.score || a.index - b.index);
}

function confidentMatch(track, candidates) {
  const ranked = rankCandidates(track, candidates);
  const best = ranked[0]; const runnerUp = ranked[1];
  if (!best || best.score < 84) return null;
  if (best.evidence.isrcMatch) return best;
  const structuredOrOwned = best.candidate.resultType === 'song' || authoritativeOwner(track, best.candidate);
  if (!structuredOrOwned && !runnerUp) return null;
  if (!runnerUp || best.score - runnerUp.score >= 3 || sameRecording(track, best.candidate, runnerUp.candidate)) return best;
  return null;
}

function scoreCandidate(track, candidate) {
  const result = evaluateCandidate(track, candidate);
  if (!result.accepted) return Math.min(result.score, 79.9);
  if (!candidate.resultType && !authoritativeOwner(track, candidate)) return Math.min(result.score, 79.9);
  return result.score;
}

module.exports = {
  canonicalTitle, confidentMatch, durationSimilarity, evaluateCandidate, normalize,
  rankCandidates, sameRecording, scoreCandidate, textSimilarity, versionMarkers
};
