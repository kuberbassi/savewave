/**
 * Direct Media Provider Adapter
 * Validates Content-Type to ensure only media (video/*, audio/*, image/*) is downloaded.
 * Rejects documents, PDFs, HTML pages, and archives.
 */

const { createNormalizedResponse } = require('../types/normalized');
const { sanitizeFilename } = require('../utils/sanitizer');
const { safeFetch } = require('../utils/safeFetch');

async function resolveDirectMedia(url, hintExtension = 'mp4') {
  let contentType = '';
  let reachable = false;
  const requestTimeout = () => AbortSignal.timeout(10000);
  
  // Verify Content-Type header via HEAD or GET request
  try {
    const res = await safeFetch(url, { method: 'HEAD', signal: requestTimeout() });
    if (res.ok) {
      reachable = true;
      contentType = res.headers.get('content-type') || '';
    }
  } catch (e) {}

  if (!reachable) {
    try {
      const getRes = await safeFetch(url, { headers: { Range: 'bytes=0-1024' }, signal: requestTimeout() });
      if (getRes.ok) {
        reachable = true;
        contentType = getRes.headers.get('content-type') || '';
      }
      if (getRes.body) await getRes.body.cancel();
    } catch (e2) {}
  }

  if (!reachable) throw new Error('This media source is unavailable or did not respond.');

  const lowerCt = contentType.toLowerCase();
  
  // Reject non-media MIME types (PDF, ZIP, Word docs, HTML, JSON, plain text)
  if (
    lowerCt.includes('application/pdf') ||
    lowerCt.includes('application/zip') ||
    lowerCt.includes('application/msword') ||
    lowerCt.includes('officedocument') ||
    lowerCt.includes('text/html') ||
    lowerCt.includes('application/json')
  ) {
    throw new Error('Unsupported file type. Savewave only downloads media.');
  }

  // Derive media type
  let isAudio = lowerCt.startsWith('audio/') || ['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg'].includes(hintExtension);
  let isImage = lowerCt.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(hintExtension);
  let isVideo = lowerCt.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(hintExtension);

  if (!isAudio && !isImage && !isVideo && !lowerCt.startsWith('media/')) {
    // If Content-Type is vague, fall back to explicit media extension check
    if (!['mp4', 'mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'webm', 'mov', 'avi', 'jpg', 'jpeg', 'png', 'webp'].includes(hintExtension)) {
      throw new Error('Unsupported file type. Savewave only downloads media.');
    }
  }

  const mimeExtensions = {
    'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/wav': 'wav', 'audio/flac': 'flac', 'audio/ogg': 'ogg',
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'video/x-msvideo': 'avi'
  };
  const normalizedContentType = lowerCt.split(';')[0].trim();
  const detectedExtension = mimeExtensions[normalizedContentType];
  const ext = detectedExtension || (hintExtension === 'bin' ? (isAudio ? 'mp3' : isImage ? 'jpg' : 'mp4') : hintExtension);
  const rawTitle = url.split('/').pop().split('?')[0] || `media.${ext}`;
  const baseName = rawTitle.includes('.') ? rawTitle.replace(/\.[^/.]+$/, '') : rawTitle;
  const filename = sanitizeFilename(baseName, ext);

  return createNormalizedResponse({
    success: true,
    platform: 'direct',
    type: isAudio ? 'audio' : isImage ? 'image' : 'video',
    title: filename,
    creator: 'Direct Media',
    thumbnail: isImage ? url : null,
    duration: null,
    filename,
    qualityLabel: 'Original Quality',
    download: {
      directUrl: url,
      mode: isAudio ? 'mp3' : ext
    }
  });
}

module.exports = { resolveDirectMedia };
