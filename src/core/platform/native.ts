import { invoke } from '@tauri-apps/api/core';
import type { MediaEngine } from './types';
import type { DownloadJob, DownloadProgress, DownloadRequest, EngineStatus, MediaMode, PlatformCapabilities, PlatformType, ReleaseInfo, ResolvedMedia } from '../media/types';
import { detectSource } from '../sources/detectSource';
import { confidentMatch, type MatchCandidate, type TrackIdentity } from '../spotify/score';
export class NativeMediaEngine implements MediaEngine {
  constructor(private platform: Exclude<PlatformType, 'web'>) {}
  getPlatform() { return this.platform; }
  getCapabilities() { return invoke<PlatformCapabilities>('get_capabilities'); }
  getEngineStatus() { return invoke<EngineStatus>('get_engine_status'); }
  getReleaseInfo() { return invoke<ReleaseInfo>('get_release_info'); }
  async resolveMedia(url: string, mode: MediaMode = 'video') {
    if (detectSource(url) !== 'spotify') return invoke<ResolvedMedia>('resolve_media', { request: { url, mode } });
    const track = await invoke<TrackIdentity & { thumbnail?: string }>('get_spotify_metadata', { url });
    const candidates = await invoke<Array<MatchCandidate & { sourceUrl: string }>>('search_spotify_candidates', { title: track.title, artist: track.primaryArtist });
    const match = confidentMatch(track, candidates);
    if (!match) throw { code: 'MATCH_CONFIDENCE_LOW' };
    const source = match.candidate as MatchCandidate & { sourceUrl: string };
    return { success: true, platform: 'spotify', title: track.title, creator: track.artists.join(', '), thumbnail: track.thumbnail, duration: track.duration, type: 'audio', qualityLabel: 'Verified high-confidence match', sourceUrl: source.sourceUrl } satisfies ResolvedMedia;
  }
  downloadMedia(request: DownloadRequest) { return invoke<DownloadJob>('download_media', { request }); }
  cancelDownload(jobId: string) { return invoke<void>('cancel_download', { jobId }); }
  getDownloadProgress(jobId: string) { return invoke<DownloadProgress>('get_download_progress', { jobId }); }
}
