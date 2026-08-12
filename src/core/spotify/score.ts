import { canonicalTitle, normalize, versionMarkers } from './normalize';
export interface TrackIdentity { title: string; primaryArtist: string; artists: string[]; album?: string; duration?: number; isrc?: string; }
export interface MatchCandidate { title: string; artist?: string; uploader?: string; album?: string; duration?: number; isrc?: string; official?: boolean; }
function creditedArtists(track: TrackIdentity): string[] {
  return Array.from(new Set([track.primaryArtist, ...(track.artists || [])].map(normalize).filter(Boolean)));
}
function authoritativeOwner(track: TrackIdentity, candidate: MatchCandidate): boolean {
  const owner = normalize(candidate.uploader || '');
  return creditedArtists(track).some((artist) => owner === artist || owner === `${artist} topic` || owner === `${artist} vevo`);
}
function corroboratesSameRecording(track: TrackIdentity, first: MatchCandidate, second: MatchCandidate): boolean {
  const firstOwner = normalize(first.uploader || ''); const secondOwner = normalize(second.uploader || '');
  if (!firstOwner || !secondOwner || firstOwner === secondOwner) return false;
  if (!track.duration || !first.duration || !second.duration) return false;
  if (Math.abs(track.duration - first.duration) > 3 || Math.abs(track.duration - second.duration) > 3) return false;
  const artists = creditedArtists(track);
  const firstIdentity = normalize(`${first.title} ${first.artist || ''}`);
  const secondIdentity = normalize(`${second.title} ${second.artist || ''}`);
  const title = normalize(canonicalTitle(track.title));
  if (!normalize(canonicalTitle(first.title)).includes(title) || !normalize(canonicalTitle(second.title)).includes(title)) return false;
  const primary = artists[0];
  if (!primary || !firstIdentity.includes(primary) || !secondIdentity.includes(primary)) return false;
  const expectedVersions = versionMarkers(track.title);
  const firstVersions = versionMarkers(first.title).filter((marker) => !expectedVersions.includes(marker));
  const secondVersions = versionMarkers(second.title).filter((marker) => !expectedVersions.includes(marker));
  return firstVersions.length === 0 && secondVersions.length === 0;
}
export function scoreCandidate(track: TrackIdentity, candidate: MatchCandidate): number {
  if (track.isrc && candidate.isrc) return track.isrc === candidate.isrc ? 150 : -100;
  let score = 0; const title = normalize(canonicalTitle(track.title)); const candidateTitle = normalize(canonicalTitle(candidate.title)); const identity = normalize(`${candidate.title} ${candidate.artist || ''} ${candidate.uploader || ''}`);
  if (title === candidateTitle) score += 40; else if (candidateTitle.includes(title)) score += 28; else score -= 60;
  const primary = normalize(track.primaryArtist); if (primary && identity.includes(primary)) score += 40; else if (track.artists.some(artist => identity.includes(normalize(artist)))) score += 25; else score -= 70;
  if (track.duration && candidate.duration) { const difference = Math.abs(track.duration - candidate.duration); score += difference <= 2 ? 20 : difference <= 7 ? 10 : difference > 20 ? -70 : -30; }
  if (track.album && candidate.album && normalize(track.album) === normalize(candidate.album)) score += 8;
  if (authoritativeOwner(track, candidate)) score += 18;
  const artists = creditedArtists(track);
  if (artists.length > 1 && artists.every((artist) => identity.includes(artist))) score += 8;
  const expectedVersions = versionMarkers(track.title); if (versionMarkers(candidate.title).some(marker => !expectedVersions.includes(marker))) score -= 70;
  return score;
}
export function confidentMatch(track: TrackIdentity, candidates: MatchCandidate[]) {
  const ranked = candidates.map(candidate => ({ candidate, score: scoreCandidate(track, candidate) })).sort((a, b) => b.score - a.score);
  const best = ranked[0]; const runnerUp = ranked[1];
  if (!best || best.score < 80) return null;
  if (!runnerUp || best.score - runnerUp.score >= 5) return best;
  // An exact recording on an artist-owned or Topic channel is deterministic even
  // when a second official upload represents the same source recording.
  const exactTitle = normalize(canonicalTitle(best.candidate.title)) === normalize(canonicalTitle(track.title));
  const durationClose = !track.duration || !best.candidate.duration || Math.abs(track.duration - best.candidate.duration) <= 3;
  if (exactTitle && durationClose && authoritativeOwner(track, best.candidate)) return best;
  return corroboratesSameRecording(track, best.candidate, runnerUp.candidate) ? best : null;
}
