export type PlatformType = 'web' | 'desktop' | 'android';
export type MediaMode = 'video' | 'audio';
export type MediaSource = 'youtube' | 'instagram' | 'facebook' | 'threads' | 'twitter' | 'soundcloud' | 'spotify' | 'direct' | 'unknown';
export type DownloadState = 'idle' | 'detecting' | 'resolving' | 'resolved' | 'downloading' | 'processing' | 'completed' | 'cancelled' | 'error';

export interface ResolvedMedia {
  success: true;
  platform: MediaSource;
  title: string;
  creator: string;
  thumbnail?: string | null;
  duration?: number | null;
  type: MediaMode | 'image';
  qualityLabel: string;
  sourceUrl: string;
}

export interface DownloadRequest { url: string; mode: MediaMode; title?: string; }
export interface DownloadJob { jobId: string; state: DownloadState; }
export interface DownloadProgress {
  jobId: string;
  state: DownloadState;
  percent?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  speed?: number;
  eta?: number;
  filename?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface SourceCapability { video?: boolean; audio?: boolean; media?: boolean; smartMatch?: boolean; }
export interface PlatformCapabilities {
  platform: PlatformType;
  sources: Record<MediaSource, SourceCapability>;
}
export interface EngineStatus { available: boolean; initializing?: boolean; version: string; engineVersion?: string; ffmpegVersion?: string; updateAvailable?: boolean; }
export interface ReleaseInfo { version: string; downloadUrl: string; androidDownloadUrl?: string; releaseUrl: string; changelogUrl: string; summary: string; updateAvailable: boolean; }
