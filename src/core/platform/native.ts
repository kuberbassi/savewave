import { invoke } from '@tauri-apps/api/core';
import type { MediaEngine } from './types';
import type { DownloadJob, DownloadProgress, DownloadRequest, EngineStatus, MediaMode, PlatformCapabilities, PlatformType, ReleaseInfo, ResolvedMedia } from '../media/types';
import { detectSource } from '../sources/detectSource';
import { resolveSpotifySource, type SearchStage } from '../spotify/search';
import { parseYouTubeMusicResults } from '../spotify/youtubeMusic';
import type { MatchCandidate, TrackIdentity } from '../spotify/score';
export class NativeMediaEngine implements MediaEngine {
  constructor(private platform: Exclude<PlatformType, 'web'>) {}
  getPlatform() { return this.platform; }
  getCapabilities() { return invoke<PlatformCapabilities>('get_capabilities'); }
  getEngineStatus() { return invoke<EngineStatus>('get_engine_status'); }
  getReleaseInfo() { return invoke<ReleaseInfo>('get_release_info'); }
  async resolveMedia(url: string, mode: MediaMode = 'video') {
    if (detectSource(url) !== 'spotify') return invoke<ResolvedMedia>('resolve_media', { request: { url, mode } });
    const track = await invoke<TrackIdentity & { thumbnail?: string }>('get_spotify_metadata', { url });
    const match = await resolveSpotifySource(track, { search: async (stage: SearchStage) => {
      if (stage.filter === 'generic') return invoke<Array<MatchCandidate & { sourceUrl: string }>>('search_spotify_candidates', { query: stage.query });
      try {
        const payload = await invoke<unknown>('search_youtube_music', { query: stage.query, filter: stage.filter });
        return parseYouTubeMusicResults(payload, stage.filter);
      } catch { return []; }
    } });
    if (!match) throw { code: 'MATCH_CONFIDENCE_LOW' };
    const source = match.candidate as MatchCandidate & { sourceUrl?: string };
    const sourceUrl = source.sourceUrl || source.url;
    if (!sourceUrl) throw { code: 'MATCH_CONFIDENCE_LOW' };
    const fallbackSourceUrls = (match.alternatives || []).map((candidate) => candidate.sourceUrl || candidate.url).filter((value): value is string => Boolean(value) && value !== sourceUrl);
    return { success: true, platform: 'spotify', title: track.title, creator: track.artists.join(', '), thumbnail: track.thumbnail, duration: track.duration, type: 'audio', qualityLabel: 'Verified high-confidence match', sourceUrl, fallbackSourceUrls } satisfies ResolvedMedia;
  }
  downloadMedia(request: DownloadRequest) { return invoke<DownloadJob>('download_media', { request }); }
  cancelDownload(jobId: string) { return invoke<void>('cancel_download', { jobId }); }
  getDownloadProgress(jobId: string) { return invoke<DownloadProgress>('get_download_progress', { jobId }); }
}
