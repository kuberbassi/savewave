'use strict';

const { confidentMatch, rankCandidates, sameRecording } = require('./matcher.js');

function identityQuery(track, primaryOnly = false) {
  const artists = primaryOnly ? [track.primaryArtist] : (track.artists?.length ? track.artists : [track.primaryArtist]);
  return `${artists.filter(Boolean).join(', ')} - ${track.title}`.trim();
}

function searchStages(track) {
  return [
    ...(track.isrc ? [{ name: 'isrc-song', query: track.isrc, filter: 'songs' }] : []),
    { name: 'all-artists-song', query: identityQuery(track), filter: 'songs' },
    ...((track.artists || []).filter(Boolean).length > 1
      ? [{ name: 'primary-artist-song', query: identityQuery(track, true), filter: 'songs' }]
      : []),
    { name: 'music-video', query: identityQuery(track), filter: 'videos' },
    { name: 'generic-video', query: identityQuery(track), filter: 'generic' }
  ];
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = candidate.videoId || candidate.id || candidate.url || candidate.sourceUrl;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function resolveSpotifySource(track, adapter) {
  const pool = [];
  let confident = null;
  for (const stage of searchStages(track)) {
    const results = await adapter.search(stage, track);
    pool.push(...results.map((candidate) => ({ ...candidate, searchStage: stage.name })));
    const candidates = dedupeCandidates(pool);
    const match = confidentMatch(track, candidates);
    if (match) {
      confident = match;
      const alternatives = rankCandidates(track, candidates)
        .map((result) => result.candidate)
        .filter((candidate) => candidate !== match.candidate && sameRecording(track, match.candidate, candidate))
        .slice(0, 2);
      const enriched = { ...match, alternatives };
      if (match.evidence.isrcMatch || alternatives.length || stage.filter === 'videos' || stage.filter === 'generic') return enriched;
    }
    // Once a confident song survived through the music-video search, do not
    // spend more time on broad generic search just to collect a fallback.
    if (confident && stage.filter === 'videos') return { ...confident, alternatives: [] };
  }
  return confident ? { ...confident, alternatives: [] } : confidentMatch(track, dedupeCandidates(pool));
}

module.exports = { dedupeCandidates, identityQuery, resolveSpotifySource, searchStages };
