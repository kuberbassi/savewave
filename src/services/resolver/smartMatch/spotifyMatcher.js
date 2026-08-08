const ytdlp = require('yt-dlp-exec');
const { createNormalizedResponse } = require('../types/normalized');
const { sanitizeFilename } = require('../utils/sanitizer');
const { scoreCandidate } = require('./scoreCandidate');
const { getSpotifyMetadata } = require('./spotifyMetadata');

async function searchCandidates(queries) {
  const pool = [];
  const seen = new Set();

  for (const query of queries) {
    try {
      const result = await ytdlp(query, { dumpSingleJson: true, noWarnings: true, playlistEnd: 10 });
      const entries = result && result.entries ? result.entries : result && result.title ? [result] : [];
      for (const item of entries) {
        const identity = item && (item.id || item.webpage_url || item.url);
        if (identity && !seen.has(identity)) {
          seen.add(identity);
          pool.push(item);
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.warn(`[Spotify search] ${error.message}`);
    }
  }
  return pool;
}

function candidateUrl(candidate) {
  if (candidate.webpage_url) return candidate.webpage_url;
  if (candidate.id) return `https://www.youtube.com/watch?v=${candidate.id}`;
  return candidate.url || null;
}

async function resolveSpotifySmartMatch(url) {
  try {
    const metadata = await getSpotifyMetadata(url);
    const candidates = await searchCandidates([
      `ytsearch10:${metadata.primaryArtist} ${metadata.title} official audio`,
      `ytsearch10:${metadata.title} ${metadata.artist} topic`,
      `ytsearch10:${metadata.title} ${metadata.artist}`
    ]);
    if (!candidates.length) throw new Error('No audio candidates were available for this track.');

    const ranked = candidates
      .map((candidate) => scoreCandidate(metadata, candidate, process.env.NODE_ENV === 'development'))
      .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    const runnerUp = ranked[1];
    const ambiguous = runnerUp && best.score < 100 && best.score - runnerUp.score < 5 && candidateUrl(best.candidate) !== candidateUrl(runnerUp.candidate);

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

module.exports = { resolveSpotifySmartMatch, searchCandidates, candidateUrl };
