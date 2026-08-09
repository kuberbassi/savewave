import type { MediaSource } from '../media/types';
const directExtensions = /\.(mp4|webm|mp3|m4a|aac|ogg|wav|flac|jpg|jpeg|png|webp)(?:$|[?#])/i;
const isDomain = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);
export function normalizeUrl(value: string): URL | null {
  try { const parsed = new URL(String(value || '').trim()); return ['http:', 'https:'].includes(parsed.protocol) ? parsed : null; } catch { return null; }
}
export function detectSource(value: string): MediaSource {
  const url = normalizeUrl(value); if (!url) return 'unknown';
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'youtu.be' || isDomain(host, 'youtube.com')) return 'youtube';
  if (isDomain(host, 'instagram.com')) return 'instagram';
  if (isDomain(host, 'facebook.com') || host === 'fb.watch') return 'facebook';
  if (isDomain(host, 'threads.net')) return 'threads';
  if (isDomain(host, 'twitter.com') || host === 'x.com') return 'twitter';
  if (isDomain(host, 'soundcloud.com')) return 'soundcloud';
  if (host === 'open.spotify.com') return 'spotify';
  return directExtensions.test(url.pathname) ? 'direct' : 'unknown';
}
