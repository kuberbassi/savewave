import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { detectSource } from '../core/sources/detectSource';

const executeFile = promisify(execFile);
const MAX_ITEMS = 20;
const IMAGE_HOST = /(^|\.)(?:fbcdn\.net|cdninstagram\.com)$/i;
const X_IMAGE_HOST = 'pbs.twimg.com';

export interface SocialImages { title: string; creator: string; images: string[]; }

function trustedImage(value: string, source: 'instagram' | 'twitter'): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      (source === 'twitter' ? url.hostname === X_IMAGE_HOST : IMAGE_HOST.test(url.hostname));
  } catch { return false; }
}

function instagramImages(info: Record<string, unknown>): string[] {
  type ExtractedEntry = { formats?: unknown[]; thumbnails?: Array<{ url?: string; width?: number; height?: number }> };
  const entries = (Array.isArray(info.entries) ? info.entries : [info]) as ExtractedEntry[];
  if (entries.some((entry) => entry?.formats?.length)) return [];
  return entries.slice(0, MAX_ITEMS).map((entry) => {
    const thumbnails = Array.isArray(entry?.thumbnails) ? entry.thumbnails : [];
    const ranked = thumbnails.filter((item) => typeof item?.url === 'string' && trustedImage(item.url, 'instagram'))
      .sort((left, right) => ((right.width || 0) * (right.height || 0)) - ((left.width || 0) * (left.height || 0)));
    return ranked[0]?.url;
  }).filter((url): url is string => Boolean(url));
}

function decodeHtml(value: string): string {
  return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

async function xImages(url: string): Promise<string[]> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Savewave/1.0)' },
    signal: AbortSignal.timeout(12_000), redirect: 'error',
  });
  if (!response.ok || Number(response.headers.get('content-length') || 0) > 3_000_000) return [];
  const html = await response.text();
  if (html.length > 3_000_000) return [];
  const urls = [...html.matchAll(/https:\/\/pbs\.twimg\.com\/media\/[A-Za-z0-9_-]+\?format=(?:jpe?g|png|webp)(?:&amp;|&)name=(?:small|medium|large|orig)/g)]
    .map((match) => decodeHtml(match[0]));
  const byId = new Map<string, string>();
  for (const image of urls) {
    if (!trustedImage(image, 'twitter')) continue;
    const id = new URL(image).pathname;
    const current = byId.get(id);
    if (!current || /name=large|name=orig/.test(image)) byId.set(id, image);
  }
  return [...byId.values()].slice(0, 4);
}

export async function resolveSocialImages(url: string, binary: string): Promise<SocialImages | null> {
  const source = detectSource(url);
  if (source !== 'instagram' && source !== 'twitter') return null;
  const { stdout } = await executeFile(binary, [
    '--ignore-no-formats', '--dump-single-json', '--skip-download', '--no-warnings',
    '--playlist-end', String(MAX_ITEMS), url,
  ], { timeout: 35_000, maxBuffer: 12 * 1024 * 1024, windowsHide: true });
  const info = JSON.parse(stdout) as Record<string, unknown>;
  const images = source === 'instagram' ? instagramImages(info) :
    (Array.isArray(info.formats) && info.formats.length ? [] : await xImages(url));
  if (!images.length) return null;
  return {
    title: typeof info.title === 'string' ? info.title : `${source} post`,
    creator: typeof info.uploader === 'string' ? info.uploader : source,
    images,
  };
}

export function imageExtension(value: string): string {
  const url = new URL(value);
  const format = url.searchParams.get('format') || /\.(jpg|jpeg|png|webp)$/i.exec(url.pathname)?.[1] || 'jpg';
  return /^(jpg|jpeg|png|webp)$/i.test(format) ? format.toLowerCase().replace('jpeg', 'jpg') : 'jpg';
}

export function isTrustedSocialImage(value: string): boolean {
  return trustedImage(value, 'instagram') || trustedImage(value, 'twitter');
}
