export const ERROR_CODES = [
  'UNSUPPORTED_PLATFORM', 'UNSUPPORTED_SOURCE', 'INVALID_URL', 'SOURCE_UNAVAILABLE',
  'SOURCE_REJECTED', 'SOURCE_FORBIDDEN', 'SOURCE_NOT_FOUND', 'RATE_LIMITED',
  'NETWORK_FAILED', 'TIMEOUT', 'NO_MEDIA_FOUND', 'POST_IMAGES_UNSUPPORTED', 'MATCH_CONFIDENCE_LOW', 'DOWNLOAD_FAILED',
  'EXTRACTOR_FAILED', 'FFMPEG_FAILED', 'PROCESSING_FAILED', 'PERMISSION_DENIED',
  'SAVE_FAILED', 'STORAGE_FAILED', 'ENGINE_UNAVAILABLE', 'ENGINE_OUTDATED', 'CANCELLED'
] as const;
export type ErrorCode = typeof ERROR_CODES[number];

const messages: Record<ErrorCode, string> = {
  UNSUPPORTED_PLATFORM: 'This platform is unsupported.',
  UNSUPPORTED_SOURCE: 'This source is not currently supported by Savewave.',
  INVALID_URL: 'Unsupported media link.',
  SOURCE_UNAVAILABLE: 'This media is unavailable.',
  SOURCE_REJECTED: 'The source temporarily rejected this request.',
  SOURCE_FORBIDDEN: 'This source requires access Savewave does not have.',
  SOURCE_NOT_FOUND: 'This media no longer exists or is unavailable.',
  RATE_LIMITED: 'The source is busy. Please wait and try again.',
  NETWORK_FAILED: 'Could not reach the source. Check your connection.',
  TIMEOUT: 'The source took too long to respond.',
  NO_MEDIA_FOUND: 'No downloadable media was found.',
  POST_IMAGES_UNSUPPORTED: 'This photo post cannot be extracted by the current local engine.',
  MATCH_CONFIDENCE_LOW: 'Could not confidently match this Spotify track.',
  DOWNLOAD_FAILED: 'Download failed.',
  EXTRACTOR_FAILED: 'The media source changed and needs an engine update.',
  FFMPEG_FAILED: 'Media processing could not be completed.',
  PROCESSING_FAILED: 'Media processing failed.',
  PERMISSION_DENIED: 'Storage permission was denied.',
  SAVE_FAILED: 'The file could not be saved.',
  STORAGE_FAILED: 'The file could not be added to Downloads.',
  ENGINE_UNAVAILABLE: 'The local media engine is unavailable.',
  ENGINE_OUTDATED: 'A Savewave update is required.',
  CANCELLED: 'Download cancelled.'
};

export class MediaEngineError extends Error {
  constructor(public code: ErrorCode, message = messages[code]) { super(message); this.name = 'MediaEngineError'; }
}

export function messageForError(code: ErrorCode): string { return messages[code]; }

export function classifyErrorText(value: string): ErrorCode {
  const text = value.toLowerCase();
  if (/cancel(?:led|ed|ation)/.test(text)) return 'CANCELLED';
  if (/instagram/.test(text) && /no video formats found/.test(text)) return 'POST_IMAGES_UNSUPPORTED';
  if (/\b429\b|too many requests|rate.?limit/.test(text)) return 'RATE_LIMITED';
  if (/instagram sent an empty media response/.test(text)) return 'SOURCE_REJECTED';
  if (/\b403\b|forbidden|login required|log in|sign in|private (?:post|video|media|account)/.test(text)) return 'SOURCE_FORBIDDEN';
  if (/\b404\b|not found|removed|unavailable video/.test(text)) return 'SOURCE_NOT_FOUND';
  if (/no video formats found|requested format is not available/.test(text)) return 'NO_MEDIA_FOUND';
  if (/timed? out|timeout/.test(text)) return 'TIMEOUT';
  if (/ffmpeg|postprocess|merge.*fail/.test(text)) return 'FFMPEG_FAILED';
  if (/no space|disk full|mediastore|permission denied|access denied/.test(text)) return 'STORAGE_FAILED';
  if (/dns|name resolution|network is unreachable|connection (?:failed|refused|reset)|offline/.test(text)) return 'NETWORK_FAILED';
  if (/unsupported url|no suitable extractor|extractor error/.test(text)) return 'EXTRACTOR_FAILED';
  return 'DOWNLOAD_FAILED';
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
