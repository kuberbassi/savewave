import { registerPlugin } from '@capacitor/core';
import type { MediaEngine } from './types';
import type {
  DownloadJob,
  DownloadProgress,
  DownloadRequest,
  EngineStatus,
  MediaMode,
  PlatformCapabilities,
  ReleaseInfo,
  ResolvedMedia,
} from '../media/types';
import { createDownloadPolicy, type DownloadPolicy } from '../media/quality';
import { parseCapabilities, parseDownloadJob, parseDownloadProgress, parseDownloadRequest, parseEngineStatus, parseReleaseInfo, parseResolvedMedia } from '../media/contracts';
import { canonicalMediaUrl, detectSource, isUnavailableSource } from '../sources/detectSource';
import { MediaEngineError } from '../media/errors';
import { resolveSpotifyDecision, type SearchStage } from '../spotify/search';
import type { MatchCandidate, TrackIdentity } from '../spotify/score';
import { spotifyResolvedMedia } from '../spotify/resolvedMedia';
import { parseYouTubeMusicResults } from '../spotify/youtubeMusic';

type NativeDownloadRequest = DownloadRequest & { policy: DownloadPolicy };

interface SavewaveMediaPlugin {
  getCapabilities(): Promise<PlatformCapabilities>;
  getEngineStatus(): Promise<EngineStatus>;
  getReleaseInfo(): Promise<ReleaseInfo | null>;
  resolveMedia(options: { url: string; mode: MediaMode }): Promise<ResolvedMedia>;
  downloadMedia(request: NativeDownloadRequest): Promise<DownloadJob>;
  cancelDownload(options: { jobId: string }): Promise<void>;
  getDownloadProgress(options: { jobId: string }): Promise<DownloadProgress>;
  getSpotifyMetadata(options: { url: string }): Promise<TrackIdentity & { thumbnail?: string }>;
  searchCandidates(options: { query: string }): Promise<{ results: MatchCandidate[] }>;
  searchYoutubeMusic(options: { query: string; filter: 'songs' | 'videos' }): Promise<{ payload: unknown }>;
}

const mediaPlugin = registerPlugin<SavewaveMediaPlugin>('SavewaveMedia');

export class CapacitorMediaEngine implements MediaEngine {
  getPlatform() { return 'android' as const; }
  async getCapabilities() { return parseCapabilities(await mediaPlugin.getCapabilities()); }
  async getEngineStatus() { return parseEngineStatus(await mediaPlugin.getEngineStatus()); }
  async getReleaseInfo() { return parseReleaseInfo(await mediaPlugin.getReleaseInfo()); }
  async resolveMedia(url: string, mode: MediaMode = 'video') {
    if (isUnavailableSource(detectSource(url))) throw new MediaEngineError('UNSUPPORTED_SOURCE');
    if (detectSource(url) !== 'spotify') return parseResolvedMedia(await mediaPlugin.resolveMedia({ url: canonicalMediaUrl(url), mode }));
    const track = await mediaPlugin.getSpotifyMetadata({ url });
    const decision = await resolveSpotifyDecision(track, { search: async (stage: SearchStage) => {
      if (stage.filter === 'generic') return (await mediaPlugin.searchCandidates({ query: stage.query })).results;
      try {
        const response = await mediaPlugin.searchYoutubeMusic({ query: stage.query, filter: stage.filter });
        return parseYouTubeMusicResults(response.payload, stage.filter);
      }
      catch { return []; }
    } });
    return parseResolvedMedia(spotifyResolvedMedia(track, decision));
  }
  async downloadMedia(request: DownloadRequest) {
    const input = parseDownloadRequest(request);
    if (isUnavailableSource(detectSource(input.url))) throw new MediaEngineError('UNSUPPORTED_SOURCE');
    return parseDownloadJob(await mediaPlugin.downloadMedia({ ...input, url: canonicalMediaUrl(input.url), policy: createDownloadPolicy(input.mode, detectSource(input.url)) }));
  }
  cancelDownload(jobId: string) { return mediaPlugin.cancelDownload({ jobId }); }
  async getDownloadProgress(jobId: string) { return parseDownloadProgress(await mediaPlugin.getDownloadProgress({ jobId })); }
}
