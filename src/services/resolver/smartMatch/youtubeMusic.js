'use strict';

const YTM_HOME = 'https://music.youtube.com/';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36';
const { durationSeconds, parseYouTubeMusicResults } = require('../../../core/spotify/youtubeMusic-runtime.js');
const SEARCH_PARAMS = Object.freeze({
  songs: 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D',
  videos: 'EgWKAQIQAWoKEAkQChAFEAMQBA%3D%3D'
});
let bootstrapCache = null;

async function fetchWithTimeout(url, options = {}, timeout = 8000) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(timeout) });
}

async function bootstrap(force = false) {
  if (bootstrapCache && !force) return bootstrapCache;
  const response = await fetchWithTimeout(YTM_HOME, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9' } });
  if (!response.ok) throw new Error('YouTube Music search is unavailable.');
  const html = (await response.text()).replace(/\\"/g, '"');
  const apiKey = (html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || [])[1];
  const clientVersion = (html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/) || [])[1];
  if (!apiKey || !clientVersion) throw new Error('YouTube Music did not expose a search session.');
  bootstrapCache = { apiKey, clientVersion };
  return bootstrapCache;
}

async function requestSearch(query, filter, fresh = false) {
  const session = await bootstrap(fresh);
  const response = await fetchWithTimeout(`https://music.youtube.com/youtubei/v1/search?key=${encodeURIComponent(session.apiKey)}&prettyPrint=false`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9', Origin: YTM_HOME },
    body: JSON.stringify({ context: { client: { clientName: 'WEB_REMIX', clientVersion: session.clientVersion, hl: 'en' } }, query, params: SEARCH_PARAMS[filter] })
  });
  if (!response.ok) throw new Error('YouTube Music search failed.');
  return response.json();
}

async function searchYouTubeMusic(query, filter) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const candidates = parseYouTubeMusicResults(await requestSearch(query, filter, attempt > 0), filter);
      if (candidates.length || attempt === 1) return candidates;
    } catch (error) {
      bootstrapCache = null;
      if (attempt === 1) throw error;
    }
  }
  return [];
}

module.exports = { durationSeconds, parseYouTubeMusicResults, searchYouTubeMusic, SEARCH_PARAMS };
