const RESERVED = /[<>:"/\\|?*\u0000-\u001f]/g;
const WINDOWS_DEVICE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
export function sanitizeFilename(value: string, fallback = 'media'): string {
  const clean = String(value || '').normalize('NFC').replace(RESERVED, '').replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '').slice(0, 140);
  if (!clean) return fallback;
  return WINDOWS_DEVICE.test(clean) ? `_${clean}` : clean;
}
export function mediaFilename(creator: string, title: string, extension: string): string {
  return `${sanitizeFilename(`${creator} - ${title}`)}.${extension.replace(/[^a-z0-9]/gi, '').toLowerCase()}`;
}
