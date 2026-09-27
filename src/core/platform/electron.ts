import type { MediaEngine } from './types';
import type { DownloadRequest, MediaMode } from '../media/types';
import { isUnavailableSource, detectSource } from '../sources/detectSource';
import { MediaEngineError } from '../media/errors';
import { parseCapabilities, parseDownloadJob, parseDownloadProgress, parseDownloadRequest, parseEngineStatus, parseReleaseInfo, parseResolvedMedia } from '../media/contracts';

function desktopBridge() {
  const bridge = window.savewaveDesktop;
  if (!bridge) throw new Error('DESKTOP_BRIDGE_UNAVAILABLE');
  return bridge;
}

export class ElectronMediaEngine implements MediaEngine {
  getPlatform() { return 'desktop' as const; }
  async getCapabilities() { return parseCapabilities(await desktopBridge().getCapabilities()); }
  async getEngineStatus() { return parseEngineStatus(await desktopBridge().getEngineStatus()); }
  async getReleaseInfo() { return parseReleaseInfo(await desktopBridge().getReleaseInfo()); }
  async resolveMedia(url: string, mode: MediaMode = 'video') {
    if (isUnavailableSource(detectSource(url), url)) throw new MediaEngineError('UNSUPPORTED_SOURCE');
    return parseResolvedMedia(await desktopBridge().resolveMedia(url, mode));
  }
  async downloadMedia(request: DownloadRequest) {
    const input = parseDownloadRequest(request);
    if (isUnavailableSource(detectSource(input.url), input.url)) throw new MediaEngineError('UNSUPPORTED_SOURCE');
    return parseDownloadJob(await desktopBridge().downloadMedia(input));
  }
  cancelDownload(jobId: string) { return desktopBridge().cancelDownload(jobId); }
  async getDownloadProgress(jobId: string) { return parseDownloadProgress(await desktopBridge().getDownloadProgress(jobId)); }
}
