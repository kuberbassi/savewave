/**
 * Normalized Response Data Builder for Savewave Resolvers
 * Hides raw yt-dlp extractor internal schemas from the frontend
 */

function createNormalizedResponse({
  success = true,
  platform = 'generic',
  type = 'video', // 'video' | 'audio' | 'file'
  title = 'Media Stream',
  creator = 'Savewave Engine',
  thumbnail = null,
  duration = null,
  filename = 'media.mp4',
  qualityLabel = 'Best available quality',
  isMatched = false,
  download = {}
}) {
  return {
    success: Boolean(success),
    platform,
    type,
    title,
    creator,
    thumbnail,
    duration,
    filename,
    qualityLabel,
    isMatched,
    download
  };
}

module.exports = { createNormalizedResponse };
