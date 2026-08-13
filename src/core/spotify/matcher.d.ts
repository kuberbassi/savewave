export interface TrackIdentity { title: string; primaryArtist: string; artists: string[]; album?: string; duration?: number; isrc?: string; explicit?: boolean; }
export interface MatchCandidate { videoId?: string; id?: string; url?: string; sourceUrl?: string; resultType?: 'song' | 'video' | 'generic-video'; title: string; artists?: string[]; artist?: string; author?: string; uploader?: string; album?: string; duration?: number; isrc?: string; explicit?: boolean; verified?: boolean; official?: boolean; searchStage?: string; }
export interface CandidateEvaluation { candidate: MatchCandidate; score: number; confidence: 'very-high' | 'high' | 'low'; accepted: boolean; rejectionReasons: string[]; evidence: { title: number; artist: number; duration: number | null; album: number | null; isrcMatch: boolean; durationDiff: number | null; }; }
export function canonicalTitle(value: string, creditedArtists?: string[]): string;
export function normalize(value: string): string;
export function versionMarkers(value: string): string[];
export function textSimilarity(first: string, second: string): number;
export function durationSimilarity(expected?: number, actual?: number): number | null;
export function evaluateCandidate(track: TrackIdentity, candidate: MatchCandidate): CandidateEvaluation;
export function rankCandidates(track: TrackIdentity, candidates: MatchCandidate[]): Array<CandidateEvaluation & { index: number }>;
export function sameRecording(track: TrackIdentity, first: MatchCandidate, second: MatchCandidate): boolean;
export function confidentMatch(track: TrackIdentity, candidates: MatchCandidate[]): CandidateEvaluation | null;
export function scoreCandidate(track: TrackIdentity, candidate: MatchCandidate): number;
