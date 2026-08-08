const ytdlp = require('yt-dlp-exec');
const { createNormalizedResponse } = require('../types/normalized');
const { sanitizeFilename } = require('../utils/sanitizer');
const { scoreCandidate } = require('./scoreCandidate');
const { getSpotifyMetadata } = require('./spotifyMetadata');
const { normalizeTitle, normalizeArtist } = require('./normalizers');

const SEARCH_OPTIONS = Object.freeze({
  dumpSingleJson: true,
  noWarnings: true,
  playlistEnd: 12,
  flatPlaylist: true,
  ignoreErrors: true,
  skipDownload: true,
  socketTimeout: 12,
  retries: 2
});

async function searchCandidates(queries) {
  const pool = [];
  const seen = new Set();

  const searches = await Promise.allSettled(queries.map(async (query) => {
    try {
      const result = await ytdlp(query, SEARCH_OPTIONS);
      return result && result.entries ? result.entries : result && result.title ? [result] : [];
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        const summary = String(error.message || 'search failed').split(/\r?\n/, 1)[0];
        console.warn(`[Spotify search] ${summary}`);
      }
      return [];
    }
  }));

  for (const search of searches) {
    const entries = search.status === 'fulfilled' ? search.value : [];
    for (const item of entries) {
      const identity = item && (item.id || item.webpage_url || item.url);
      if (identity && !seen.has(identity)) {
        seen.add(identity);
        pool.push(item);
      }
    }
  }
  return pool;
}

function candidateUrl(candidate) {
  if (candidate.webpage_url) return candidate.webpage_url;
  if (candidate.id) return `https://www.youtube.com/watch?v=${candidate.id}`;
  return candidate.url || null;
}

function sameRecordingIdentity(first, second, metadata) {
  if (!first || !second) return false;
  const targetArtist = normalizeArtist(metadata.primaryArtist || metadata.artist);
  const firstText = normalizeArtist(`${first.candidate.artist || first.candidate.uploader || first.candidate.channel || ''} ${first.candidate.title || ''}`);
  const secondText = normalizeArtist(`${second.candidate.artist || second.candidate.uploader || second.candidate.channel || ''} ${second.candidate.title || ''}`);
  return normalizeTitle(first.candidate.title).includes(normalizeTitle(metadata.title)) &&
    normalizeTitle(second.candidate.title).includes(normalizeTitle(metadata.title)) &&
    firstText.includes(targetArtist) && secondText.includes(targetArtist);
}

async function resolveSpotifySmartMatch(url) {
  try {
    const metadata = await getSpotifyMetadata(url);
    const candidates = await searchCandidates([
      `ytsearch12:${metadata.primaryArtist} ${metadata.title} official audio`,
      `ytsearch12:${metadata.primaryArtist} ${metadata.title} topic`,
      `ytsearch12:${metadata.title} ${metadata.artist}`
    ]);
    if (!candidates.length) throw new Error('No audio candidates were available for this track.');

    const ranked = candidates
      .map((candidate) => scoreCandidate(metadata, candidate, process.env.NODE_ENV === 'development'))
      .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    const runnerUp = ranked[1];
    const ambiguous = runnerUp && best.score - runnerUp.score < 5 &&
      candidateUrl(best.candidate) !== candidateUrl(runnerUp.candidate) &&
      !sameRecordingIdentity(best, runnerUp, metadata);

    if (!best || !best.pass || ambiguous) {
      throw new Error('Could not confidently match this Spotify track. Try a direct audio or YouTube link instead.');
    }

    const directUrl = candidateUrl(best.candidate);
    if (!directUrl) throw new Error('The matched source did not provide a downloadable URL.');

    return createNormalizedResponse({
      success: true,
      platform: 'spotify',
      type: 'audio',
      title: metadata.title,
      creator: metadata.artist,
      thumbnail: metadata.thumbnail || best.candidate.thumbnail || null,
      duration: metadata.duration || best.candidate.duration || null,
      filename: sanitizeFilename(`${metadata.title} - ${metadata.artist}`, 'mp3'),
      qualityLabel: `Verified match (${best.confidenceLabel})`,
      isMatched: true,
      download: { directUrl, mode: 'mp3' }
    });
  } catch (error) {
    throw new Error(error.message || 'Could not confidently match this Spotify track.');
  }
}

module.exports = { resolveSpotifySmartMatch, searchCandidates, candidateUrl, sameRecordingIdentity, SEARCH_OPTIONS };
