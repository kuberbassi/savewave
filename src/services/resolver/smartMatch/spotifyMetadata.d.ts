export interface SpotifyMetadata {
  trackId: string;
  title: string;
  artist: string;
  artists: string[];
  primaryArtist: string;
  album?: string;
  duration?: number;
  releaseDate?: string;
  releaseYear?: number;
  explicit?: boolean;
  isrc?: string;
  thumbnail?: string | null;
  previewUrl?: string | null;
  provenance: { embed: boolean; oembed: boolean; pageFallback: boolean };
}
export function getSpotifyMetadata(url: string): Promise<SpotifyMetadata>;
