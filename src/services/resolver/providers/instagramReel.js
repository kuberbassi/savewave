const fs = require('fs');
const { ytdlp } = require('../utils/ytDlpRuntime');
const { createNormalizedResponse } = require('../types/normalized');
const { extractionOptions, normalizeExtractedMedia } = require('../utils/providerMedia');

function getInstagramCookiesPath() {
  const custom = process.env.SAVEWAVE_INSTAGRAM_COOKIES;
  if (custom && fs.existsSync(custom)) return custom;
  return null;
}

async function resolveInstagramReel(url, mode = 'video') {
  const cookiesPath = getInstagramCookiesPath();
  const options = { ...extractionOptions(), noPlaylist: true, playlistEnd: 1 };
  if (cookiesPath) {
    options.cookies = cookiesPath;
  }
  try {
    const raw = await ytdlp(url, options);
    const media = normalizeExtractedMedia(raw, mode);
    if (media.type === 'image') throw new Error('NO_MEDIA_FOUND');
    return createNormalizedResponse({
      platform: 'instagram',
      type: mode === 'audio' ? 'audio' : 'video',
      title: media.info.title || 'Instagram Reel',
      creator: media.info.uploader || media.info.channel || 'Instagram',
      thumbnail: media.info.thumbnail || null,
      duration: media.info.duration || null,
      qualityLabel: 'Best available public Reel',
      download: { directUrl: media.directUrl || url }
    });
  } catch (error) {
    const detail = String(error?.stderr || error?.message || error).toLowerCase();
    // If a saved cookie was used but expired or rejected, remove it so subsequent calls re-prompt cleanly
    if (cookiesPath && (/login required|log in|sign in|cookies|empty media response|forbidden|403/.test(detail))) {
      try { fs.unlinkSync(cookiesPath); } catch { /* ignore unlink error */ }
    }
    if (/empty media response/.test(detail)) throw new Error('AUTH_REQUIRED');
    if (/login required|log in|sign in|cookies/.test(detail)) throw new Error('AUTH_REQUIRED');
    if (/429|too many requests|rate.?limit/.test(detail)) throw new Error('RATE_LIMITED');
    if (/403|forbidden/.test(detail)) throw new Error('AUTH_REQUIRED');
    if (/private|private account|private post/.test(detail)) throw new Error('SOURCE_FORBIDDEN');
    if (/404|not found/.test(detail)) throw new Error('SOURCE_NOT_FOUND');
    if (/no video formats found|no downloadable media|no_media_found/.test(detail)) throw new Error('NO_MEDIA_FOUND');
    throw new Error('EXTRACTOR_FAILED');
  }
}

module.exports = { resolveInstagramReel };
