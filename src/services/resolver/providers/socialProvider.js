const { ytdlp } = require('../utils/ytDlpRuntime');
const { createNormalizedResponse } = require('../types/normalized');
const { sanitizeFilename } = require('../utils/sanitizer');
const { extractionOptions, normalizeExtractedMedia, providerError } = require('../utils/providerMedia');

function createSocialResolver({ platform, label, defaultCreator, forceAudio = false }) {
  return async function resolveSocial(url, requestedMode = 'video') {
    const mode = forceAudio ? 'audio' : requestedMode;
    try {
      const raw = await ytdlp(url, extractionOptions());
      const media = normalizeExtractedMedia(raw, mode);
      const info = media.info;
      const title = info.title || info.description || `${label} Media`;
      const creator = info.uploader || info.artist || info.channel || defaultCreator;
      const countLabel = media.itemCount > 1 ? ` • ${media.itemCount} items detected` : '';

      return createNormalizedResponse({
        success: true,
        platform,
        type: media.type,
        title,
        creator,
        thumbnail: info.thumbnail || (media.type === 'image' ? media.directUrl : null),
        duration: info.duration || null,
        filename: sanitizeFilename(title, media.extension),
        qualityLabel: `${media.type === 'image' ? 'Original image' : 'Best compatible quality'}${countLabel}`,
        download: { directUrl: media.directUrl || url, mode: media.extension }
      });
    } catch (error) {
      throw providerError(label, error);
    }
  };
}

module.exports = { createSocialResolver };
