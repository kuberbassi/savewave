/**
 * String & Metadata Normalizer for Spotify Smart Match
 */

function normalizeString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accent markers only
    .replace(/['’`]/g, '') // normalize apostrophes
    .replace(/[-_–—]/g, ' ') // normalize hyphens/dashes
    .replace(/[^\w\s\u00C0-\u024F\u4E00-\u9FFF\u3040-\u30FF]/gi, ' ') // preserve word chars + CJK unicode
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim();
}

function normalizeTitle(title) {
  return normalizeString(stripCatalogQualifiers(title));
}

function stripCatalogQualifiers(title) {
  return String(title || '')
    .replace(/\s*-\s*from\s+["“][^"”]+["”]\s*$/gi, ' ')
    .replace(/\s*\(\s*from\s+["“][^"”]+["”]\s*\)\s*$/gi, ' ')
    .replace(/\s*\(\s*with\s+[^)]+\)\s*$/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeArtist(artist) {
  if (!artist) return '';
  let norm = artist
    .toLowerCase()
    // Common display-name homoglyphs used by independent artists.
    .replace(/β/g, 'b')
    .replace(/δ/g, 'a')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(feat|featuring|ft|with|x|&)\b\.?/gi, ' ')
    .replace(/[^\w\s\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u4E00-\u9FFF\u3040-\u30FF]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return norm;
}

function normalizeAlbum(album) {
  return normalizeString(album);
}

function stripFeaturedArtists(title) {
  return String(title || '')
    .replace(/[\[(]\s*(?:feat(?:uring)?|ft)\.?\s+[^\])]+[\])]/gi, ' ')
    .replace(/\s+(?:feat(?:uring)?|ft)\.?\s+.+$/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const VERSION_MARKERS = [
  'remix',
  'live',
  'slowed',
  'sped up',
  'nightcore',
  '8d',
  'cover',
  'karaoke',
  'instrumental',
  'edit',
  'radio edit',
  'acoustic',
  'remastered',
  'lyrics',
  'reaction',
  'tutorial',
  'extended',
  'reverb',
  'bass boosted',
  'mashup',
  'parody',
  'demo',
  'clean'
];

function extractVersionMarkers(text) {
  if (!text) return [];
  const norm = text.toLowerCase();
  const found = [];
  for (const marker of VERSION_MARKERS) {
    if (norm.includes(marker)) {
      found.push(marker);
    }
  }
  return found;
}

module.exports = {
  normalizeString,
  normalizeTitle,
  stripCatalogQualifiers,
  normalizeArtist,
  normalizeAlbum,
  stripFeaturedArtists,
  extractVersionMarkers,
  VERSION_MARKERS
};
