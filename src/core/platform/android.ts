import { invoke } from '@tauri-apps/api/core';
import type { MediaEngine } from './types';
import type { DownloadJob, DownloadProgress, DownloadRequest, EngineStatus, MediaMode, PlatformCapabilities, ReleaseInfo, ResolvedMedia } from '../media/types';
const command = <T>(name: string, payload: Record<string, unknown> = {}) => invoke<T>(`plugin:savewave-media|${name}`, payload);
const CURRENT_VERSION = '1.0.8';
const RELEASE_MANIFEST = 'https://raw.githubusercontent.com/kuberbassi/savewave/main/public/client-version.json';
const TRUSTED_RELEASE_HOSTS = new Set(['github.com', 'raw.githubusercontent.com', 'savewave.kuberbassi.com']);

const isNewerVersion = (candidate: string, installed: string) => {
  const parse = (value: string) => value.replace(/^v/, '').split('.').map(Number);
  const next = parse(candidate);
  const current = parse(installed);
  if (next.some(Number.isNaN) || current.some(Number.isNaN)) return false;
  for (let index = 0; index < Math.max(next.length, current.length); index += 1) {
    const difference = (next[index] || 0) - (current[index] || 0);
    if (difference !== 0) return difference > 0;
  }
  return false;
};

export class AndroidMediaEngine implements MediaEngine {
  getPlatform() { return 'android' as const; }
  getCapabilities() { return command<PlatformCapabilities>('getCapabilities'); }
  getEngineStatus() { return command<EngineStatus>('getEngineStatus'); }
  async getReleaseInfo(): Promise<ReleaseInfo | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(RELEASE_MANIFEST, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) return null;
      const release = await response.json() as Omit<ReleaseInfo, 'updateAvailable'>;
      if (!release.androidDownloadUrl) return null;
      const urls = [release.androidDownloadUrl, release.releaseUrl, release.changelogUrl].map((value) => new URL(value));
      if (urls.some((url) => url.protocol !== 'https:' || !TRUSTED_RELEASE_HOSTS.has(url.hostname))) return null;
      return {
        ...release,
        downloadUrl: release.androidDownloadUrl,
        updateAvailable: isNewerVersion(release.version, CURRENT_VERSION)
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
  resolveMedia(url: string, mode: MediaMode = 'video') { return command<ResolvedMedia>('resolveMedia', { request: { url, mode } }); }
  downloadMedia(request: DownloadRequest) { return command<DownloadJob>('downloadMedia', { request }); }
  cancelDownload(jobId: string) { return command<void>('cancelDownload', { jobId }); }
  getDownloadProgress(jobId: string) { return command<DownloadProgress>('getDownloadProgress', { jobId }); }
}
