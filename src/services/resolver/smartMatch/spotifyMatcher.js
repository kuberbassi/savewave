'use strict';

const { ytdlp } = require('../utils/ytDlpRuntime');
const { createNormalizedResponse } = require('../types/normalized');
const { sanitizeFilename } = require('../utils/sanitizer');
const { resolveSpotifyDecision } = require('../../../core/spotify/search-runtime.js');
const { getSpotifyMetadata } = require('./spotifyMetadata');
const { searchYouTubeMusic } = require('./youtubeMusic');

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

function candidateUrl(candidate) {
  if (candidate.url) return candidate.url;
  if (candidate.sourceUrl) return candidate.sourceUrl;
  if (candidate.webpage_url) return candidate.webpage_url;
  if (candidate.videoId || candidate.id) return `https://www.youtube.com/watch?v=${candidate.videoId || candidate.id}`;
  return null;
}

function genericCandidate(item) {
  const id = item?.id;
  if (!id || !item?.title) return null;
  return {
    videoId: id,
    url: `https://www.youtube.com/watch?v=${id}`,
    resultType: 'generic-video',
    title: item.title,
    artists: [item.artist, item.uploader, item.channel].filter(Boolean),
    artist: item.artist,
    uploader: item.uploader || item.channel,
    duration: Number.isFinite(item.duration) ? item.duration : undefined,
    verified: Boolean(item.channel_is_verified || item.isOfficialArtistChannel)
  };
}

async function searchCandidates(queries) {
  const pool = [];
  const seen = new Set();
  for (const query of queries) {
    try {
      const result = await ytdlp(query, SEARCH_OPTIONS);
      const entries = result?.entries || (result?.title ? [result] : []);
      for (const item of entries) {
        const candidate = genericCandidate(item);
        if (candidate && !seen.has(candidate.videoId)) {
          seen.add(candidate.videoId);
          pool.push(candidate);
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        const summary = String(error.message || 'search failed').split(/\r?\n/, 1)[0];
        console.warn(`[Spotify search] ${summary}`);
      }
    }
  }
  return pool;
}

function createSearchAdapter() {
  return {
    async search(stage) {
      if (stage.filter === 'generic') return searchCandidates([`ytsearch15:${stage.query}`]);
      try {
        return await searchYouTubeMusic(stage.query, stage.filter);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') console.warn(`[YouTube Music] ${error.message}`);
        return [];
      }
    }
  };
}

async function resolveSpotifySmartMatch(url) {
  try {
    const metadata = await getSpotifyMetadata(url);
    const decision = await resolveSpotifyDecision(metadata, createSearchAdapter());
    if (decision.status === 'ambiguous') {
      const matchOptions = decision.candidates.map(({ candidate, score }) => ({
        sourceUrl: candidateUrl(candidate), title: candidate.title,
        creator: (candidate.artists || []).join(', ') || candidate.artist || candidate.uploader || 'YouTube source',
        duration: candidate.duration, score
      })).filter((option) => option.sourceUrl);
      if (matchOptions.length === 2) return createNormalizedResponse({
        success: true, platform: 'spotify', type: 'audio', title: metadata.title, creator: metadata.artist,
        thumbnail: metadata.thumbnail || null, duration: metadata.duration || null,
        qualityLabel: 'Your choice required', selectionRequired: true, matchOptions
      });
    }
    if (decision.status !== 'matched') throw new Error('Could not confidently match this Spotify track. Try a direct audio or YouTube link instead.');
    const best = decision.match;

    const directUrl = candidateUrl(best.candidate);
    if (!directUrl) throw new Error('The matched source did not provide a downloadable URL.');

    return createNormalizedResponse({
      success: true,
      platform: 'spotify',
      type: 'audio',
      title: metadata.title,
      creator: metadata.artist,
      thumbnail: metadata.thumbnail || null,
      duration: metadata.duration || best.candidate.duration || null,
      filename: sanitizeFilename(`${metadata.title} - ${metadata.artist}`, 'mp3'),
      qualityLabel: 'Verified high-confidence match',
      isMatched: true,
      download: { directUrl, mode: 'mp3' }
    });
  } catch (error) {
    throw new Error(error.message || 'Could not confidently match this Spotify track.');
  }
}

module.exports = { candidateUrl, createSearchAdapter, genericCandidate, resolveSpotifySmartMatch, searchCandidates, SEARCH_OPTIONS };
