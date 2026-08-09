export const ERROR_CODES = [
  'UNSUPPORTED_PLATFORM', 'UNSUPPORTED_SOURCE', 'INVALID_URL', 'SOURCE_UNAVAILABLE',
  'SOURCE_REJECTED', 'NO_MEDIA_FOUND', 'MATCH_CONFIDENCE_LOW', 'DOWNLOAD_FAILED',
  'PROCESSING_FAILED', 'PERMISSION_DENIED', 'SAVE_FAILED', 'ENGINE_UNAVAILABLE',
  'ENGINE_OUTDATED', 'CANCELLED'
] as const;
export type ErrorCode = typeof ERROR_CODES[number];

const messages: Record<ErrorCode, string> = {
  UNSUPPORTED_PLATFORM: 'This platform is unsupported.',
  UNSUPPORTED_SOURCE: 'This source is available in the Savewave app.',
  INVALID_URL: 'Unsupported media link.',
  SOURCE_UNAVAILABLE: 'This media is unavailable.',
  SOURCE_REJECTED: 'The source temporarily rejected this request.',
  NO_MEDIA_FOUND: 'No downloadable media was found.',
  MATCH_CONFIDENCE_LOW: 'Could not confidently match this Spotify track.',
  DOWNLOAD_FAILED: 'Download failed.',
  PROCESSING_FAILED: 'Media processing failed.',
  PERMISSION_DENIED: 'Storage permission was denied.',
  SAVE_FAILED: 'The file could not be saved.',
  ENGINE_UNAVAILABLE: 'The local media engine is unavailable.',
  ENGINE_OUTDATED: 'A Savewave update is required.',
  CANCELLED: 'Download cancelled.'
};

export class MediaEngineError extends Error {
  constructor(public code: ErrorCode, message = messages[code]) { super(message); this.name = 'MediaEngineError'; }
}
export function normalizeError(error: unknown): MediaEngineError {
  if (error instanceof MediaEngineError) return error;
  const candidate = error as { code?: string; error?: string; message?: string };
  const parts = typeof error === 'string'
    ? [error]
    : [candidate?.code, candidate?.error, candidate?.message, (() => { try { return JSON.stringify(error); } catch { return ''; } })()];
  const raw = parts.filter((value): value is string => typeof value === 'string').join(' ');
  const code = ERROR_CODES.find((value) => raw.includes(value)) || 'DOWNLOAD_FAILED';
  return new MediaEngineError(code, messages[code]);
}
