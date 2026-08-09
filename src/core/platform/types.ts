import type { DownloadJob, DownloadProgress, DownloadRequest, EngineStatus, MediaMode, PlatformCapabilities, PlatformType, ReleaseInfo, ResolvedMedia } from '../media/types';
export interface MediaEngine {
  getPlatform(): PlatformType;
  getCapabilities(): Promise<PlatformCapabilities>;
  getEngineStatus(): Promise<EngineStatus>;
  getReleaseInfo(): Promise<ReleaseInfo | null>;
  resolveMedia(url: string, mode?: MediaMode): Promise<ResolvedMedia>;
  downloadMedia(request: DownloadRequest): Promise<DownloadJob>;
  cancelDownload(jobId: string): Promise<void>;
  getDownloadProgress(jobId: string): Promise<DownloadProgress>;
}
