import { MediaEngineError } from '../media/errors';
import { sanitizeFilename } from '../media/filename';
import { detectSource, normalizeUrl } from '../sources/detectSource';
import { capabilitiesFor } from './capabilities';
import type { MediaEngine } from './types';
import type { DownloadProgress, DownloadRequest, MediaMode, ResolvedMedia } from '../media/types';

export class WebMediaEngine implements MediaEngine {
  private jobs = new Map<string, DownloadProgress>();
  getPlatform() { return 'web' as const; }
  async getCapabilities() { return capabilitiesFor('web'); }
  async getEngineStatus() { return { available: true, version: '1.0.9' }; }
  async getReleaseInfo() { return null; }
  async resolveMedia(value: string, mode: MediaMode = 'video'): Promise<ResolvedMedia> {
    const url = normalizeUrl(value); if (!url) throw new MediaEngineError('INVALID_URL');
    if (detectSource(value) !== 'direct') throw new MediaEngineError('UNSUPPORTED_SOURCE');
    const title = decodeURIComponent(url.pathname.split('/').pop() || 'media').replace(/\.[^.]+$/, '');
    return { success: true, platform: 'direct', title: sanitizeFilename(title), creator: url.hostname, type: mode, qualityLabel: 'Original media', sourceUrl: url.href };
  }
  async downloadMedia(request: DownloadRequest) {
    await this.resolveMedia(request.url, request.mode);
    const jobId = crypto.randomUUID();
    const anchor = document.createElement('a'); anchor.href = request.url; anchor.download = ''; anchor.rel = 'noopener'; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    this.jobs.set(jobId, { jobId, state: 'completed', percent: 100 }); return { jobId, state: 'completed' as const };
  }
  async cancelDownload(jobId: string) { if (!this.jobs.has(jobId)) throw new MediaEngineError('DOWNLOAD_FAILED'); this.jobs.set(jobId, { jobId, state: 'cancelled' }); }
  async getDownloadProgress(jobId: string) { const job = this.jobs.get(jobId); if (!job) throw new MediaEngineError('DOWNLOAD_FAILED'); return job; }
}
