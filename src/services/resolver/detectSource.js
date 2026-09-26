/**
 * Source Detector for Savewave Platform Adapters
 */

const { validateUrl } = require('./utils/ssrfGuard');

function detectSource(url) {
  const guard = validateUrl(url);
  if (!guard.valid) {
    return { valid: false, reason: guard.reason, platform: 'unknown' };
  }

  const parsed = guard.parsedUrl;
  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();
  const isDomain = (domain) => host === domain || host.endsWith(`.${domain}`);

  // 1. YouTube
  if (isDomain('youtube.com') || isDomain('youtu.be')) {
    const isShorts = pathname.includes('/shorts/');
    return { valid: true, platform: 'youtube', type: isShorts ? 'shorts' : 'video', parsed };
  }

  // 2. Spotify
  if (isDomain('spotify.com')) {
    if (!pathname.startsWith('/track/')) return { valid: false, reason: 'Paste an individual Spotify track link.', platform: 'spotify' };
    return { valid: true, platform: 'spotify', type: 'spotify_metadata', parsed };
  }

  const unavailableSource = 'This source is not currently supported by Savewave.';

  // 3. Instagram
  if (isDomain('instagram.com')) {
    return { valid: false, reason: unavailableSource, platform: 'instagram' };
  }

  // 4. Facebook
  if (isDomain('facebook.com') || isDomain('fb.watch')) {
    return { valid: false, reason: unavailableSource, platform: 'facebook' };
  }

  // 5. Threads
  if (isDomain('threads.net')) {
    return { valid: true, platform: 'threads', type: 'post_media', parsed };
  }

  // 6. X / Twitter
  if (isDomain('x.com') || isDomain('twitter.com')) {
    return { valid: false, reason: unavailableSource, platform: 'twitter' };
  }

  // 7. SoundCloud
  if (isDomain('soundcloud.com')) {
    return { valid: true, platform: 'soundcloud', type: 'audio', parsed };
  }

  // Reject explicit non-media document file extensions immediately
  if (pathname.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|tar|gz|7z|txt|csv|json|html|htm)$/i)) {
    return { valid: false, reason: 'Unsupported file type. Savewave only downloads media.', platform: 'unknown' };
  }

  // Direct Media URL
  if (pathname.match(/\.(mp3|mp4|webm|m4a|aac|wav|flac|ogg|mov|avi|mkv|jpg|jpeg|png|webp|gif)$/i)) {
    const ext = pathname.split('.').pop().toLowerCase();
    return { valid: true, platform: 'direct', type: 'media', extension: ext, parsed };
  }

  // Generic Media URL (Fallback to DirectMedia provider to verify Content-Type)
  return { valid: true, platform: 'direct', type: 'media', parsed };
}

module.exports = { detectSource };
