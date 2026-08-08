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
  return normalizeString(title);
}

function normalizeArtist(artist) {
  if (!artist) return '';
  let norm = artist
    .toLowerCase()
    .replace(/\b(feat|featuring|ft|with|x|&)\b\.?/gi, ' ')
    .replace(/[^\w\s\u00C0-\u024F\u4E00-\u9FFF\u3040-\u30FF]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return norm;
}

function normalizeAlbum(album) {
  return normalizeString(album);
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
  'tutorial'
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
  normalizeArtist,
  normalizeAlbum,
  extractVersionMarkers,
  VERSION_MARKERS
};
