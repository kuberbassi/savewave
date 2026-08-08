const MEDIA_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4a', 'mp3', 'aac', 'wav', 'flac', 'ogg', 'jpg', 'jpeg', 'png', 'webp', 'gif']);
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

function extractionOptions() {
  return {
    dumpSingleJson: true,
    noWarnings: true,
    noCheckCertificate: true,
    playlistEnd: 20
  };
}

function flattenEntries(info) {
  if (!info) return [];
  const entries = Array.isArray(info.entries) ? info.entries.filter(Boolean) : [];
  return entries.length ? entries.flatMap(flattenEntries) : [info];
}

function isImageMedia(info) {
  const ext = String(info && info.ext || '').toLowerCase();
  const mediaUrl = String(info && info.url || '').split('?')[0].toLowerCase();
  return IMAGE_EXTENSIONS.has(ext) || [...IMAGE_EXTENSIONS].some((item) => mediaUrl.endsWith(`.${item}`));
}

function selectDirectFormat(info, mode = 'video') {
  if (!info) return null;
  const formats = Array.isArray(info.formats) ? info.formats.filter((format) => format && format.url) : [];

  if (mode === 'audio') {
    const audio = formats.filter((format) => format.acodec && format.acodec !== 'none');
    audio.sort((a, b) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0));
    return audio[0] || (info.url ? info : null) || formats[0] || null;
  }

  const progressive = formats.filter((format) => format.vcodec && format.vcodec !== 'none' && format.acodec && format.acodec !== 'none');
  progressive.sort((a, b) => (b.height || 0) - (a.height || 0) || (b.tbr || 0) - (a.tbr || 0));
  if (progressive[0]) return progressive[0];

  const video = formats.filter((format) => format.vcodec && format.vcodec !== 'none');
  video.sort((a, b) => (b.height || 0) - (a.height || 0) || (b.tbr || 0) - (a.tbr || 0));
  return video[0] || (info.url ? info : null) || formats[0] || null;
}

function normalizeExtractedMedia(rawInfo, mode = 'video') {
  const entries = flattenEntries(rawInfo);
  const info = entries.find((entry) => entry.url || (Array.isArray(entry.formats) && entry.formats.some((format) => format.url)));
  if (!info) throw new Error('No downloadable media was found at this link.');

  const image = isImageMedia(info);
  const format = selectDirectFormat(info, image ? 'image' : mode);
  const ext = image
    ? (IMAGE_EXTENSIONS.has(String(info.ext).toLowerCase()) ? String(info.ext).toLowerCase() : 'jpg')
    : mode === 'audio' ? 'mp3' : (MEDIA_EXTENSIONS.has(String(format && format.ext).toLowerCase()) ? String(format.ext).toLowerCase() : 'mp4');

  return {
    info,
    directUrl: (format && format.url) || info.url || null,
    extension: ext,
    type: image ? 'image' : mode === 'audio' ? 'audio' : 'video',
    itemCount: entries.length
  };
}

function providerError(platform, error) {
  const message = String(error && (error.stderr || error.message) || '');
  if (/login|authentication|cookies|private|not available/i.test(message)) {
    return new Error(`${platform} cannot download private or login-gated media. Try a public post or Reel instead.`);
  }
  if (/unsupported url/i.test(message)) return new Error(`${platform} does not recognize this link format yet.`);
  return new Error(`Unable to resolve this ${platform} media right now.`);
}

module.exports = { extractionOptions, flattenEntries, normalizeExtractedMedia, providerError, selectDirectFormat };
