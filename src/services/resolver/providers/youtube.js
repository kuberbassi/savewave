/**
 * YouTube Resolver Provider Adapter
 */

const ytdlp = require('yt-dlp-exec');
const { createNormalizedResponse } = require('../types/normalized');
const { sanitizeFilename } = require('../utils/sanitizer');
const { selectAutomaticQuality } = require('../quality/autoQuality');

async function resolveYouTube(url, mode = 'video') {
  let info = null;

  // Try yt-dlp binary first (Works on Node.js servers, local dev, Docker)
  try {
    info = await ytdlp(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificate: true,
      preferFreeFormats: true
    });
  } catch (err) {
    // Fallback: If running on serverless Vercel without Python 3 / yt-dlp binary
    try {
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if (oembedRes.ok) {
        const oembed = await oembedRes.json();
        const videoIdMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/)|youtu\.be\/)([^#\&\?]{11})/);
        const videoId = videoIdMatch ? videoIdMatch[1] : null;
        const title = oembed.title || 'YouTube Video';
        const filename = sanitizeFilename(title, mode === 'audio' ? 'mp3' : 'mp4');

        return createNormalizedResponse({
          success: true,
          platform: 'youtube',
          type: mode === 'audio' ? 'audio' : 'video',
          title,
          creator: oembed.author_name || 'YouTube',
          thumbnail: oembed.thumbnail_url || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null),
          duration: null,
          filename,
          qualityLabel: 'Best available quality',
          download: {
            directUrl: videoId ? `https://y2mate.is/watch?v=${videoId}` : url,
            mode: mode === 'audio' ? 'mp3' : 'mp4'
          }
        });
      }
    } catch (fallbackErr) {}

    throw new Error('Serverless Python runtime required for full YouTube extraction. Try on local server or non-serverless host.');
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
