import { invoke } from '@tauri-apps/api/core';
import type { MediaEngine } from './types';
import type { DownloadJob, DownloadProgress, DownloadRequest, EngineStatus, MediaMode, PlatformCapabilities, ReleaseInfo, ResolvedMedia } from '../media/types';
import { detectSource } from '../sources/detectSource';
import { resolveSpotifySource, type SearchStage } from '../spotify/search';
import { parseYouTubeMusicResults } from '../spotify/youtubeMusic';
import type { MatchCandidate, TrackIdentity } from '../spotify/score';
const command = <T>(name: string, payload: Record<string, unknown> = {}) => invoke<T>(`plugin:savewave-media|${name}`, payload);
const CURRENT_VERSION = '1.0.9';
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
  async resolveMedia(url: string, mode: MediaMode = 'video') {
    if (detectSource(url) !== 'spotify') return command<ResolvedMedia>('resolveMedia', { request: { url, mode } });
    const track = await command<TrackIdentity & { thumbnail?: string }>('getSpotifyMetadata', { url });
    console.info('[Savewave SmartMatch] Spotify metadata ready', { title: track.title, artists: track.artists, duration: track.duration });
    const match = await resolveSpotifySource(track, { search: async (stage: SearchStage) => {
      if (stage.filter === 'generic') {
        const results = (await command<{ results: MatchCandidate[] }>('searchSpotifyCandidates', { query: stage.query })).results;
        console.info('[Savewave SmartMatch] Search stage complete', { stage: stage.name, candidates: results.length });
        return results;
      }
      try {
        const response = await command<{ payload: unknown }>('searchYoutubeMusic', { query: stage.query, filter: stage.filter });
        const results = parseYouTubeMusicResults(response.payload, stage.filter);
        console.info('[Savewave SmartMatch] Search stage complete', { stage: stage.name, candidates: results.length });
        return results;
      } catch (error) {
        console.warn('[Savewave SmartMatch] YouTube Music stage failed', { stage: stage.name, error: String(error) });
        return [];
      }
    } });
    const sourceUrl = match?.candidate.sourceUrl || match?.candidate.url;
    console.info('[Savewave SmartMatch] Match decision', { matched: Boolean(match), videoId: match?.candidate.videoId, score: match?.score });
    if (!match || !sourceUrl) throw { code: 'MATCH_CONFIDENCE_LOW' };
    const fallbackSourceUrls = (match.alternatives || []).map((candidate) => candidate.sourceUrl || candidate.url).filter((value): value is string => Boolean(value) && value !== sourceUrl);
    return { success: true, platform: 'spotify', title: track.title, creator: track.artists.join(', '), thumbnail: track.thumbnail, duration: track.duration, type: 'audio', qualityLabel: 'Verified high-confidence match', sourceUrl, fallbackSourceUrls } satisfies ResolvedMedia;
  }
  downloadMedia(request: DownloadRequest) { return command<DownloadJob>('downloadMedia', { request }); }
  cancelDownload(jobId: string) { return command<void>('cancelDownload', { jobId }); }
  getDownloadProgress(jobId: string) { return command<DownloadProgress>('getDownloadProgress', { jobId }); }
}
