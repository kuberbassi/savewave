import type { MatchCandidate } from '../../../core/spotify/score';
export function searchYouTubeMusic(query: string, filter: 'songs' | 'videos'): Promise<MatchCandidate[]>;
