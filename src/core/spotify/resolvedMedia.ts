import type { ResolvedMedia } from '../media/types';
import type { MatchCandidate, TrackIdentity } from './score';
import type { SpotifyDecision } from './search';

type SpotifyTrack = TrackIdentity & { thumbnail?: string | null };
const candidateUrl = (candidate: MatchCandidate) => candidate.sourceUrl || candidate.url;
const candidateCreator = (candidate: MatchCandidate) =>
  candidate.artists?.filter(Boolean).join(', ') || candidate.artist || candidate.uploader || 'YouTube source';

export function spotifyResolvedMedia(track: SpotifyTrack, decision: SpotifyDecision): ResolvedMedia {
  const base = {
    success: true as const,
    platform: 'spotify' as const,
    title: track.title,
    creator: track.artists.join(', '),
    thumbnail: track.thumbnail,
    duration: track.duration,
    type: 'audio' as const,
  };
  if (decision.status === 'matched') {
    const sourceUrl = candidateUrl(decision.match.candidate);
    if (!sourceUrl) throw { code: 'MATCH_CONFIDENCE_LOW' };
    const fallbackSourceUrls = (decision.match.alternatives || []).map(candidateUrl)
      .filter((value): value is string => Boolean(value) && value !== sourceUrl);
    return { ...base, qualityLabel: 'Verified high-confidence match', sourceUrl, fallbackSourceUrls };
  }
  if (decision.status === 'ambiguous') {
    const matchOptions = decision.candidates.map(({ candidate, score }) => ({
      sourceUrl: candidateUrl(candidate), title: candidate.title, creator: candidateCreator(candidate),
      duration: candidate.duration, score,
    })).filter((option): option is typeof option & { sourceUrl: string } => Boolean(option.sourceUrl));
    if (matchOptions.length === 2) {
      return { ...base, qualityLabel: 'Your choice required', sourceUrl: '', selectionRequired: true, matchOptions };
    }
  }
  throw { code: 'MATCH_CONFIDENCE_LOW' };
}
