import { MediaEngineError } from './errors';
import type { DownloadJob, DownloadProgress, DownloadRequest, DownloadState, EngineStatus, MediaMode, MediaSource, PlatformCapabilities, ReleaseInfo, ResolvedMedia, SourceCapability } from './types';

const MODES = new Set<MediaMode>(['video', 'audio']);
const SOURCES = new Set<MediaSource>(['youtube', 'instagram', 'facebook', 'threads', 'twitter', 'soundcloud', 'spotify', 'direct', 'unknown']);
const STATES = new Set<DownloadState>(['idle', 'detecting', 'resolving', 'resolved', 'downloading', 'processing', 'completed', 'cancelled', 'error']);
const JOB_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new MediaEngineError('PROCESSING_FAILED');
  return value as Record<string, unknown>;
}

function boundedString(value: unknown, maximum: number, required = true): string | undefined {
  if (value === undefined || value === null) {
    if (required) throw new MediaEngineError('PROCESSING_FAILED');
    return undefined;
  }
  if (typeof value !== 'string' || value.length > maximum || (required && !value.trim())) throw new MediaEngineError('PROCESSING_FAILED');
  return value;
}

export function parseRemoteUrl(value: unknown, required = true): string | undefined {
  const text = boundedString(value, 4096, required);
  if (!text) return text;
  try {
    const parsed = new URL(text);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocol');
    return parsed.toString();
  } catch {
    throw new MediaEngineError('INVALID_URL');
  }
}

export function parseMediaMode(value: unknown, fallback?: MediaMode): MediaMode {
  if (value === undefined && fallback) return fallback;
  if (!MODES.has(value as MediaMode)) throw new MediaEngineError('PROCESSING_FAILED');
  return value as MediaMode;
}

export function parseJobId(value: unknown): string {
  const jobId = boundedString(value, 128) as string;
  if (!JOB_ID.test(jobId)) throw new MediaEngineError('PROCESSING_FAILED');
  return jobId;
}

export function parseDownloadRequest(value: unknown): DownloadRequest {
  const input = record(value);
  return {
    url: parseRemoteUrl(input.url) as string,
    mode: parseMediaMode(input.mode),
    title: boundedString(input.title, 240, false),
    source: input.source === undefined ? undefined : (() => {
      if (!SOURCES.has(input.source as MediaSource)) throw new MediaEngineError('PROCESSING_FAILED');
      return input.source as MediaSource;
    })(),
  };
}

export function parseDownloadJob(value: unknown): DownloadJob {
  const input = record(value);
  const state = input.state as DownloadState;
  if (!STATES.has(state)) throw new MediaEngineError('PROCESSING_FAILED');
  return { jobId: parseJobId(input.jobId), state };
}

export function parseDownloadProgress(value: unknown): DownloadProgress {
  const input = record(value);
  const base = parseDownloadJob(input);
  const number = (field: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) => {
    const candidate = input[field];
    if (candidate === undefined || candidate === null) return undefined;
    if (typeof candidate !== 'number' || !Number.isFinite(candidate) || candidate < minimum || candidate > maximum) {
      throw new MediaEngineError('PROCESSING_FAILED');
    }
    return candidate;
  };
  return {
    ...base,
    percent: number('percent', 0, 100),
    downloadedBytes: number('downloadedBytes'),
    totalBytes: number('totalBytes'),
    speed: number('speed'),
    eta: number('eta'),
    filename: boundedString(input.filename, 260, false),
    filenames: input.filenames === undefined ? undefined : (() => {
      if (!Array.isArray(input.filenames) || input.filenames.length < 1 || input.filenames.length > 20) throw new MediaEngineError('PROCESSING_FAILED');
      return input.filenames.map((filename) => boundedString(filename, 260) as string);
    })(),
    errorCode: boundedString(input.errorCode, 64, false),
    errorMessage: boundedString(input.errorMessage, 500, false),
  };
}

export function parseEngineStatus(value: unknown): EngineStatus {
  const input = record(value);
  if (typeof input.available !== 'boolean') throw new MediaEngineError('PROCESSING_FAILED');
  for (const flag of ['initializing', 'updateAvailable']) {
    if (input[flag] !== undefined && typeof input[flag] !== 'boolean') throw new MediaEngineError('PROCESSING_FAILED');
  }
  return {
    available: input.available,
    initializing: input.initializing as boolean | undefined,
    version: boundedString(input.version, 64) as string,
    engineVersion: boundedString(input.engineVersion, 128, false),
    ffmpegVersion: boundedString(input.ffmpegVersion, 256, false),
    updateAvailable: input.updateAvailable as boolean | undefined,
    error: boundedString(input.error, 256, false),
  };
}

export function parseCapabilities(value: unknown): PlatformCapabilities {
  const input = record(value);
  if (!['web', 'desktop', 'android'].includes(String(input.platform))) throw new MediaEngineError('PROCESSING_FAILED');
  const rawSources = record(input.sources);
  const sources = {} as PlatformCapabilities['sources'];
  for (const source of SOURCES) {
    const raw = record(rawSources[source]);
    const capability: SourceCapability = {};
    for (const field of ['video', 'audio', 'media', 'smartMatch'] as const) {
      if (raw[field] !== undefined && typeof raw[field] !== 'boolean') throw new MediaEngineError('PROCESSING_FAILED');
      if (raw[field] === true) capability[field] = true;
    }
    sources[source] = capability;
  }
  return { platform: input.platform as PlatformCapabilities['platform'], sources };
}

export function parseReleaseInfo(value: unknown): ReleaseInfo | null {
  if (value === null || value === undefined) return null;
  const input = record(value);
  if (Object.keys(input).length === 0) return null;
  if (Object.keys(input).length === 0) return null;
  if (typeof input.updateAvailable !== 'boolean') throw new MediaEngineError('PROCESSING_FAILED');
  return {
    version: boundedString(input.version, 64) as string,
    downloadUrl: parseRemoteUrl(input.downloadUrl) as string,
    windowsDownloadUrl: parseRemoteUrl(input.windowsDownloadUrl, false),
    androidDownloadUrl: parseRemoteUrl(input.androidDownloadUrl, false),
    releaseUrl: parseRemoteUrl(input.releaseUrl) as string,
    changelogUrl: parseRemoteUrl(input.changelogUrl) as string,
    summary: boundedString(input.summary, 2000) as string,
    updateAvailable: input.updateAvailable,
  };
}

export function parseResolvedMedia(value: unknown): ResolvedMedia {
  const input = record(value);
  if (input.success !== true || !SOURCES.has(input.platform as MediaSource)) throw new MediaEngineError('PROCESSING_FAILED');
  const type = input.type;
  if (type !== 'image' && !MODES.has(type as MediaMode)) throw new MediaEngineError('PROCESSING_FAILED');
  const selectionRequired = input.selectionRequired === true;
  const options = input.matchOptions === undefined || (Array.isArray(input.matchOptions) && input.matchOptions.length === 0 && !selectionRequired) ? undefined : (() => {
    if (!Array.isArray(input.matchOptions) || input.matchOptions.length < 1 || input.matchOptions.length > 2) throw new MediaEngineError('PROCESSING_FAILED');
    return input.matchOptions.map((raw) => {
      const option = record(raw);
      const score = option.score;
      if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100) throw new MediaEngineError('PROCESSING_FAILED');
      const duration = option.duration;
      if (duration !== undefined && (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0)) throw new MediaEngineError('PROCESSING_FAILED');
      return {
        sourceUrl: parseRemoteUrl(option.sourceUrl) as string,
        title: boundedString(option.title, 500) as string,
        creator: boundedString(option.creator, 500) as string,
        duration: duration as number | undefined,
        score,
      };
    });
  })();
  if (selectionRequired && !options) throw new MediaEngineError('PROCESSING_FAILED');
  const sourceUrl = selectionRequired && !input.sourceUrl ? '' : parseRemoteUrl(input.sourceUrl) as string;
  const fallbackSourceUrls = input.fallbackSourceUrls === undefined ? undefined : (() => {
    if (!Array.isArray(input.fallbackSourceUrls) || input.fallbackSourceUrls.length > 5) throw new MediaEngineError('PROCESSING_FAILED');
    return input.fallbackSourceUrls.map((url) => parseRemoteUrl(url) as string);
  })();
  const duration = input.duration;
  if (duration !== undefined && duration !== null && (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0)) throw new MediaEngineError('PROCESSING_FAILED');
  return {
    success: true,
    platform: input.platform as MediaSource,
    title: boundedString(input.title, 500) as string,
    creator: boundedString(input.creator, 500) as string,
    thumbnail: input.thumbnail === null ? null : parseRemoteUrl(input.thumbnail, false),
    duration: duration as number | null | undefined,
    type: type as ResolvedMedia['type'],
    qualityLabel: boundedString(input.qualityLabel, 200) as string,
    sourceUrl,
    fallbackSourceUrls,
    selectionRequired: selectionRequired || undefined,
    matchOptions: options,
  };
}
