/**
 * Unified Media Resolver Engine Entry Point
 */

const { detectSource } = require('./detectSource');
const { resolveYouTube } = require('./providers/youtube');
const { resolveInstagramReel } = require('./providers/instagramReel');
const { resolveThreads } = require('./providers/threads');
const { resolveSoundCloud } = require('./providers/soundcloud');
const { resolveSpotifySmartMatch } = require('./smartMatch/spotifyMatcher');
const { resolveDirectMedia } = require('./providers/directMedia');

async function resolveMedia(url, mode = 'video') {
  const detection = detectSource(url);

  if (!detection.valid) {
    throw new Error(detection.reason || 'Unsupported file type. Savewave only downloads media.');
  }

  switch (detection.platform) {
    case 'youtube':
      return await resolveYouTube(url, mode);
    case 'instagram':
      return await resolveInstagramReel(url, mode);
    case 'threads':
      return await resolveThreads(url, mode);
    case 'soundcloud':
      return await resolveSoundCloud(url, mode);
    case 'spotify':
      return await resolveSpotifySmartMatch(url);
    case 'direct':
    default:
      return await resolveDirectMedia(url, detection.extension);
  }
}

module.exports = { resolveMedia, detectSource };
