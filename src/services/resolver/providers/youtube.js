/**
 * YouTube Resolver Provider Adapter
 */

const { ytdlp } = require('../utils/ytDlpRuntime');
const { createNormalizedResponse } = require('../types/normalized');
const { sanitizeFilename } = require('../utils/sanitizer');
const { selectAutomaticQuality } = require('../quality/autoQuality');
const { extractionOptions } = require('../utils/providerMedia');

async function resolveYouTube(url, mode = 'video') {
  let info = null;

  try {
    info = await ytdlp(url, {
      ...extractionOptions(),
      noPlaylist: true,
      preferFreeFormats: true
    });
  } catch (err) {
    const detail = String(err && (err.stderr || err.message) || '');
    if (process.env.NODE_ENV === 'development') {
      const summary = detail.split(/\r?\n/).filter(Boolean).slice(-3).join(' | ').slice(0, 900);
      console.error(`[YouTube resolver] ${summary || 'yt-dlp failed without diagnostic output'}`);
    }
    if (/confirm you(?:'|’)?re not a bot|not a bot/i.test(detail)) {
      throw new Error('YouTube temporarily blocked this server from resolving public media. Please try again later.');
    }
    if (/private|sign in|login|members-only|age.?restricted/i.test(detail)) {
      throw new Error('YouTube cannot download private, login-gated, or age-restricted media. Try a public video instead.');
    }
    if (/enoent|not found|permission denied/i.test(detail)) {
      throw new Error('The YouTube extraction engine is unavailable on this deployment.');
    }
    throw new Error('YouTube could not resolve this public video right now. Please retry shortly.');
  }

  const quality = selectAutomaticQuality(info, mode);
  const title = info.title || 'YouTube Video';
  const creator = info.uploader || info.channel || 'YouTube';
  const filename = sanitizeFilename(title, quality.extension);

  // Extract direct media stream URL from matched format or top-level info
  let directStreamUrl = null;
  if (quality.selectedFormat && quality.selectedFormat.url) {
    directStreamUrl = quality.selectedFormat.url;
  } else if (info.url) {
    directStreamUrl = info.url;
  } else if (info.formats && info.formats.length > 0) {
    const valid = info.formats.find(f => f.url);
    if (valid) directStreamUrl = valid.url;
  }
  if (!directStreamUrl) throw new Error('YouTube did not return a downloadable media stream.');

  return createNormalizedResponse({
    success: true,
    platform: 'youtube',
    type: mode === 'audio' ? 'audio' : 'video',
    title,
    creator,
    thumbnail: info.thumbnail || (info.thumbnails && info.thumbnails.length ? info.thumbnails[info.thumbnails.length - 1].url : null),
    duration: info.duration || null,
    filename,
    qualityLabel: quality.qualityLabel || 'Best available quality',
    download: {
      directUrl: directStreamUrl,
      formatId: quality.formatId,
      mode: mode === 'audio' ? 'mp3' : 'mp4'
    }
  });
}

module.exports = { resolveYouTube };
