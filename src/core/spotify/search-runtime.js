'use strict';

const { confidentMatch, rankCandidates, sameRecording } = require('./matcher.js');
const MAX_STAGE_CANDIDATES = 50;
const MAX_TOTAL_CANDIDATES = 120;

function identityQuery(track, primaryOnly = false) {
  const artists = primaryOnly ? [track.primaryArtist] : (track.artists?.length ? track.artists : [track.primaryArtist]);
  return `${artists.filter(Boolean).join(', ')} - ${track.title}`.trim();
}

function searchStages(track) {
  const catalogEvidence = [track.album, track.releaseYear].filter(Boolean).join(' ');
  return [
    ...(track.isrc ? [{ name: 'isrc-song', query: track.isrc, filter: 'songs' }] : []),
    { name: 'all-artists-song', query: identityQuery(track), filter: 'songs' },
    ...((track.artists || []).filter(Boolean).length > 1
      ? [{ name: 'primary-artist-song', query: identityQuery(track, true), filter: 'songs' }]
      : []),
    ...(catalogEvidence
      ? [{ name: 'catalog-evidence-song', query: `${identityQuery(track, true)} ${catalogEvidence}`.trim(), filter: 'songs' }]
      : []),
    { name: 'title-first-song', query: `${track.title} ${track.primaryArtist}`.trim(), filter: 'songs' },
    { name: 'title-only-song', query: track.title, filter: 'songs' },
    { name: 'music-video', query: identityQuery(track), filter: 'videos' },
    { name: 'official-audio-generic', query: `${track.title} ${track.primaryArtist} official audio`.trim(), filter: 'generic' },
    { name: 'generic-video', query: identityQuery(track), filter: 'generic' },
    { name: 'title-first-generic', query: `${track.title} ${track.primaryArtist}`.trim(), filter: 'generic' }
  ];
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    if (!candidate || typeof candidate !== 'object' || typeof candidate.title !== 'string' ||
        !candidate.title.trim() || candidate.title.length > 300) return false;
    const key = candidate.videoId || candidate.id || candidate.url || candidate.sourceUrl;
    if (typeof key !== 'string' || !key || key.length > 2_048 || seen.has(key)) return false;
    if (candidate.duration !== undefined && (!Number.isFinite(candidate.duration) || candidate.duration < 1 || candidate.duration > 7_200)) return false;
    seen.add(key);
    return true;
  });
}

async function resolveSpotifyDecision(track, adapter) {
  const pool = [];
  let confident = null;
  for (const stage of searchStages(track)) {
    const response = await adapter.search(stage, track);
    const results = Array.isArray(response) ? response.slice(0, MAX_STAGE_CANDIDATES) : [];
    pool.push(...dedupeCandidates(results).map((candidate) => ({ ...candidate, searchStage: stage.name })));
    if (pool.length > MAX_TOTAL_CANDIDATES) pool.splice(0, pool.length - MAX_TOTAL_CANDIDATES);
    const candidates = dedupeCandidates(pool);
    const match = confidentMatch(track, candidates);
    if (match) {
      confident = match;
      const alternatives = rankCandidates(track, candidates)
        .map((result) => result.candidate)
        .filter((candidate) => candidate !== match.candidate && sameRecording(track, match.candidate, candidate))
        .slice(0, 2);
      const enriched = { ...match, alternatives };
      if (match.evidence.isrcMatch || alternatives.length || stage.filter === 'videos' || stage.filter === 'generic') return { status: 'matched', match: enriched };
    }
    // Once a confident song survived through the music-video search, do not
    // spend more time on broad generic search just to collect a fallback.
    if (confident && stage.filter === 'videos') return { status: 'matched', match: { ...confident, alternatives: [] } };
  }
  if (confident) return { status: 'matched', match: { ...confident, alternatives: [] } };
  const finalCandidates = dedupeCandidates(pool);
  const finalMatch = confidentMatch(track, finalCandidates);
  if (finalMatch) return { status: 'matched', match: finalMatch };
  const plausible = rankCandidates(track, finalCandidates).filter((result) => result.score >= 80).slice(0, 2);
  if (plausible.length === 2 && plausible[0].score - plausible[1].score < 3) return { status: 'ambiguous', candidates: plausible };
  return { status: 'rejected', candidates: plausible };
}

async function resolveSpotifySource(track, adapter) {
  const decision = await resolveSpotifyDecision(track, adapter);
  return decision.status === 'matched' ? decision.match : null;
}

module.exports = { dedupeCandidates, identityQuery, resolveSpotifyDecision, resolveSpotifySource, searchStages, MAX_STAGE_CANDIDATES, MAX_TOTAL_CANDIDATES };
