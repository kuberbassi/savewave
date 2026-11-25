import type { MediaEngine } from './types';
import type { DownloadRequest, MediaMode } from '../media/types';
import { isUnavailableSource, detectSource } from '../sources/detectSource';
import { MediaEngineError } from '../media/errors';
import {
  parseCapabilities,
  parseDownloadJob,
  parseDownloadProgress,
  parseDownloadRequest,
  parseEngineStatus,
  parseReleaseInfo,
  parseResolvedMedia,
} from '../media/contracts';

type TauriInvoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

declare global {
  interface Window {
    __TAURI__?: {
      core?: {
        invoke?: TauriInvoke;
      };
    };
  }
}

export function hasTauriRuntime(): boolean {
  return typeof window !== 'undefined' && typeof window.__TAURI__?.core?.invoke === 'function';
}

function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) throw new Error('TAURI_BRIDGE_UNAVAILABLE');
  return invoke<T>(cmd, args);
}

function rethrowTauriError(err: unknown): never {
  const raw = typeof err === 'string' ? err : err instanceof Error ? err.message : String(err);
  const sep = raw.indexOf(':');
  if (sep > 0) {
    const code = raw.slice(0, sep).trim();
    const msg = raw.slice(sep + 1).trim();
    if (/^[A-Z0-9_]+$/.test(code)) {
      throw new MediaEngineError(code as never, msg || undefined);
    }
  }
  throw err instanceof Error ? err : new Error(raw);
}

export class TauriMediaEngine implements MediaEngine {
  getPlatform() {
    return 'desktop' as const;
  }
  async getCapabilities() {
    return parseCapabilities(await invokeTauri('get_capabilities'));
  }
  async getEngineStatus() {
    return parseEngineStatus(await invokeTauri('get_engine_status'));
  }
  async getReleaseInfo() {
    return parseReleaseInfo(await invokeTauri('get_release_info'));
  }
  async resolveMedia(url: string, mode: MediaMode = 'video') {
    if (isUnavailableSource(detectSource(url), url)) {
      throw new MediaEngineError('UNSUPPORTED_SOURCE');
    }
    try {
      return parseResolvedMedia(await invokeTauri('resolve_media', { url, mode }));
    } catch (err) {
      rethrowTauriError(err);
    }
  }
  async downloadMedia(request: DownloadRequest) {
    const input = parseDownloadRequest(request);
    if (isUnavailableSource(detectSource(input.url), input.url)) {
      throw new MediaEngineError('UNSUPPORTED_SOURCE');
    }
    try {
      return parseDownloadJob(await invokeTauri('download_media', { request: input }));
    } catch (err) {
      rethrowTauriError(err);
    }
  }
  async cancelDownload(jobId: string) {
    await invokeTauri('cancel_download', { jobId });
  }
  async getDownloadProgress(jobId: string) {
    return parseDownloadProgress(await invokeTauri('get_download_progress', { jobId }));
  }
  async authenticateInstagram(): Promise<boolean> {
    return Boolean(await invokeTauri('authenticate_instagram'));
  }
  async openDownloadsFolder(): Promise<void> {
    await invokeTauri('open_downloads_folder');
  }
  async installWindowsUpdate(): Promise<boolean> {
    return Boolean(await invokeTauri('install_windows_update'));
  }
}
