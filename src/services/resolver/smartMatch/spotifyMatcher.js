const { ytdlp } = require('../utils/ytDlpRuntime');
const { createNormalizedResponse } = require('../types/normalized');
const { sanitizeFilename } = require('../utils/sanitizer');
const { scoreCandidate } = require('./scoreCandidate');
const { getSpotifyMetadata } = require('./spotifyMetadata');
const { normalizeTitle, normalizeArtist, stripFeaturedArtists, extractVersionMarkers } = require('./normalizers');

const SEARCH_OPTIONS = Object.freeze({
  dumpSingleJson: true,
  noWarnings: true,
  playlistEnd: 15,
  flatPlaylist: true,
  ignoreErrors: true,
  skipDownload: true,
  socketTimeout: 12,
  retries: 2,
  jsRuntimes: 'node',
  remoteComponents: 'ejs:github'
});

async function searchCandidates(queries) {
  const pool = [];
  const seen = new Set();

  const searches = await Promise.allSettled(queries.map(async (query) => {
    try {
      const result = await ytdlp(query, SEARCH_OPTIONS);
      return result && result.entries ? result.entries : result && result.title ? [result] : [];
    } catch (error) {
      if (process.env.VERCEL || process.env.NODE_ENV === 'development') {
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
  const targetTitle = normalizeTitle(stripFeaturedArtists(metadata.title));
  const targetVersions = extractVersionMarkers(metadata.title).sort().join('|');
  const creditedArtists = (metadata.artists || [metadata.primaryArtist || metadata.artist])
    .map(normalizeArtist)
    .filter(Boolean);

  const matchesIdentity = ({ candidate }) => {
    const title = normalizeTitle(stripFeaturedArtists(candidate.title));
    const text = normalizeArtist(`${candidate.artist || candidate.uploader || candidate.channel || ''} ${candidate.title || ''}`);
    const titleMatches = title === targetTitle || title.includes(targetTitle) || targetTitle.includes(title);
    const artistMatches = creditedArtists.some((artist) => text.includes(artist));
    const versionsMatch = extractVersionMarkers(candidate.title).sort().join('|') === targetVersions;
    const durationMatches = !metadata.duration || !candidate.duration || Math.abs(metadata.duration - candidate.duration) <= 7;
    return titleMatches && artistMatches && versionsMatch && durationMatches;
  };

  return matchesIdentity(first) && matchesIdentity(second);
}

async function resolveSpotifySmartMatch(url) {
  try {
    const metadata = await getSpotifyMetadata(url);
    const candidates = await searchCandidates([
      `ytsearch15:${metadata.primaryArtist} ${metadata.title} official audio`,
      `ytsearch15:${metadata.primaryArtist} ${metadata.title} topic`,
      `ytsearch15:${metadata.title} ${metadata.artist}`,
      `ytsearch15:${metadata.primaryArtist} - ${metadata.title}`
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
