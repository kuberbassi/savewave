'use strict';

function textOf(value) {
  if (!value) return '';
  if (typeof value.simpleText === 'string') return value.simpleText;
  return (value.runs || []).map((run) => run.text || '').join('').trim();
}

function durationSeconds(value) {
  const parts = String(value || '').trim().split(':').map(Number);
  if (!parts.length || parts.some((part) => !Number.isFinite(part))) return undefined;
  return parts.reduce((seconds, part) => seconds * 60 + part, 0);
}

function collectRenderers(value, output = []) {
  if (!value || typeof value !== 'object') return output;
  if (value.musicResponsiveListItemRenderer) output.push(value.musicResponsiveListItemRenderer);
  for (const child of Object.values(value)) collectRenderers(child, output);
  return output;
}

function subtitleGroups(runs) {
  const groups = [[]];
  for (const run of runs) {
    const value = String(run?.text || '');
    if (value.trim() === '•') groups.push([]);
    else if (value) groups[groups.length - 1].push(value);
  }
  return groups.map((group) => group.join('').trim()).filter(Boolean);
}

function parseRenderer(renderer, resultType) {
  const columns = (renderer?.flexColumns || []).map((column) => column?.musicResponsiveListItemFlexColumnRenderer?.text).filter(Boolean);
  const titleRuns = columns[0]?.runs || [];
  const videoId = renderer?.playlistItemData?.videoId
    || renderer?.navigationEndpoint?.watchEndpoint?.videoId
    || titleRuns.find((run) => run?.navigationEndpoint?.watchEndpoint?.videoId)?.navigationEndpoint?.watchEndpoint?.videoId;
  const title = textOf(columns[0]);
  const runs = columns.slice(1).flatMap((column) => column.runs || []);
  const artistRuns = runs.filter((run) => {
    const id = run?.navigationEndpoint?.browseEndpoint?.browseId || '';
    const type = run?.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType || '';
    return id.startsWith('UC') || type.includes('ARTIST');
  });
  const albumRun = runs.find((run) => {
    const id = run?.navigationEndpoint?.browseEndpoint?.browseId || '';
    const type = run?.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType || '';
    return id.startsWith('MPRE') || type.includes('ALBUM');
  });
  const durationRun = runs.map((run) => run.text).find((text) => /^\d{1,2}:\d{2}(?::\d{2})?$/.test(text || ''));
  const groups = subtitleGroups(runs);
  const artists = artistRuns.map((run) => run.text?.trim()).filter(Boolean);
  if (!artists.length && groups[0] && !/^\d[\d,.]*\s*(?:plays|views)?$/iu.test(groups[0])) artists.push(groups[0]);
  if (!videoId || !title || !artists.length) return null;
  const badges = JSON.stringify(renderer.badges || []);
  const fallbackAlbum = resultType === 'song' ? groups.find((group, index) => index > 0 && group !== durationRun) : undefined;
  return { videoId, url: `https://www.youtube.com/watch?v=${videoId}`, resultType, title, artists, artist: artists[0], album: albumRun?.text?.trim() || fallbackAlbum, duration: durationSeconds(durationRun), explicit: badges.includes('MUSIC_EXPLICIT_BADGE') ? true : undefined, verified: resultType === 'song' };
}

function parseYouTubeMusicResults(payload, filter) {
  const type = filter === 'songs' ? 'song' : 'video';
  const seen = new Set();
  return collectRenderers(payload).map((renderer) => parseRenderer(renderer, type)).filter((candidate) => {
    if (!candidate || seen.has(candidate.videoId)) return false;
    seen.add(candidate.videoId);
    return true;
  }).slice(0, 20);
}

module.exports = { durationSeconds, parseYouTubeMusicResults };
