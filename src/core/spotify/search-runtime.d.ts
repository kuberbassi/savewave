import type { CandidateEvaluation, MatchCandidate, TrackIdentity } from './matcher.js';
export interface SearchStage { name: string; query: string; filter: 'songs' | 'videos' | 'generic'; }
export interface MusicSearchAdapter { search(stage: SearchStage, track: TrackIdentity): Promise<MatchCandidate[]>; }
export function identityQuery(track: TrackIdentity, primaryOnly?: boolean): string;
export function searchStages(track: TrackIdentity): SearchStage[];
export function dedupeCandidates(candidates: MatchCandidate[]): MatchCandidate[];
export type ResolvedSpotifyMatch = CandidateEvaluation & { alternatives?: MatchCandidate[] };
export function resolveSpotifySource(track: TrackIdentity, adapter: MusicSearchAdapter): Promise<ResolvedSpotifyMatch | null>;
