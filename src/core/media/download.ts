import { ERROR_CODES, MediaEngineError, normalizeError, type ErrorCode } from './errors';
import type { DownloadProgress, MediaMode, ResolvedMedia } from './types';
import type { MediaEngine } from '../platform/types';

const TERMINAL_STATES = new Set(['completed', 'cancelled', 'error']);
const RETRYABLE_CODES = new Set<ErrorCode>(['SOURCE_UNAVAILABLE', 'SOURCE_REJECTED', 'DOWNLOAD_FAILED']);

export interface DownloadRunOptions {
  engine: MediaEngine;
  media: ResolvedMedia;
  originalUrl: string;
  mode: MediaMode;
  signal?: AbortSignal;
  pollIntervalMs?: number;
  maximumPolls?: number;
  onProgress?: (progress: DownloadProgress) => void;
  onJobChange?: (jobId: string | null) => void;
}

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new MediaEngineError('CANCELLED'));
      return;
    }
    const timer = setTimeout(done, milliseconds);
    function done() { signal?.removeEventListener('abort', abort); resolve(); }
    function abort() { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(new MediaEngineError('CANCELLED')); }
    signal?.addEventListener('abort', abort, { once: true });
  });
}

export function withAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new MediaEngineError('CANCELLED'));
  return new Promise((resolve, reject) => {
    const abort = () => reject(new MediaEngineError('CANCELLED'));
    signal.addEventListener('abort', abort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

function terminalError(progress: DownloadProgress): MediaEngineError {
  if (progress.state === 'cancelled') return new MediaEngineError('CANCELLED');
  const code = ERROR_CODES.includes(progress.errorCode as ErrorCode) ? progress.errorCode as ErrorCode : 'DOWNLOAD_FAILED';
  return new MediaEngineError(code);
}

export async function runDownload(options: DownloadRunOptions): Promise<DownloadProgress> {
  const urls = [...new Set([options.media.sourceUrl || options.originalUrl, ...(options.media.fallbackSourceUrls || [])])]
    .filter(Boolean).slice(0, 3);
  if (!urls.length) throw new MediaEngineError('NO_MEDIA_FOUND');
  const pollInterval = Math.max(50, Math.min(options.pollIntervalMs ?? 750, 10_000));
  const maximumPolls = Math.max(1, Math.min(options.maximumPolls ?? 19_200, 20_000));

  let lastError: MediaEngineError | null = null;
  for (let index = 0; index < urls.length; index += 1) {
    let jobId: string | null = null;
    try {
      if (options.signal?.aborted) throw new MediaEngineError('CANCELLED');
      const job = await options.engine.downloadMedia({
        url: urls[index], mode: options.mode, title: options.media.title, source: options.media.platform,
      });
      jobId = job.jobId;
      options.onJobChange?.(jobId);
      for (let poll = 0; poll < maximumPolls; poll += 1) {
        if (options.signal?.aborted) throw new MediaEngineError('CANCELLED');
        const progress = await options.engine.getDownloadProgress(jobId);
        options.onProgress?.(progress);
        if (TERMINAL_STATES.has(progress.state)) {
          if (progress.state === 'completed') return progress;
          throw terminalError(progress);
        }
        await wait(pollInterval, options.signal);
      }
      throw new MediaEngineError('TIMEOUT');
    } catch (error) {
      const normalized = normalizeError(error);
      lastError = normalized;
      if (normalized.code === 'CANCELLED' && jobId) {
        try { await options.engine.cancelDownload(jobId); } catch { /* A terminal native job needs no cancellation. */ }
      }
      if (!RETRYABLE_CODES.has(normalized.code) || index === urls.length - 1) throw normalized;
    } finally {
      options.onJobChange?.(null);
    }
  }
  throw lastError || new MediaEngineError('DOWNLOAD_FAILED');
}
