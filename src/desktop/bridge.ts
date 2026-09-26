import type {
  DownloadJob,
  DownloadProgress,
  DownloadRequest,
  EngineStatus,
  MediaMode,
  PlatformCapabilities,
  ReleaseInfo,
  ResolvedMedia,
} from '../core/media/types';

export const DESKTOP_CHANNELS = {
  capabilities: 'savewave:capabilities',
  engineStatus: 'savewave:engine-status',
  releaseInfo: 'savewave:release-info',
  resolveMedia: 'savewave:resolve-media',
  downloadMedia: 'savewave:download-media',
  cancelDownload: 'savewave:cancel-download',
  downloadProgress: 'savewave:download-progress',
  openExternal: 'savewave:open-external',
} as const;

export interface DesktopBridge {
  getCapabilities(): Promise<PlatformCapabilities>;
  getEngineStatus(): Promise<EngineStatus>;
  getReleaseInfo(): Promise<ReleaseInfo | null>;
  resolveMedia(url: string, mode?: MediaMode): Promise<ResolvedMedia>;
  downloadMedia(request: DownloadRequest): Promise<DownloadJob>;
  cancelDownload(jobId: string): Promise<void>;
  getDownloadProgress(jobId: string): Promise<DownloadProgress>;
  openExternal(url: string): Promise<void>;
}
