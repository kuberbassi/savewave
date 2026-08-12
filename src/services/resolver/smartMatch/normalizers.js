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
    .replace(/\s*[\[(]\s*from\s+["“][^"”]+["”]\s*[\])]\s*$/gi, ' ')
    .replace(/\s*\(\s*with\s+[^)]+\)\s*$/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function editDistance(first, second) {
  const a = String(first || '');
  const b = String(second || '');
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const previous = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = previous;
    }
  }
  return row[b.length];
}

function equivalentToken(first, second) {
  if (first === second) return true;
  const longest = Math.max(first.length, second.length);
  if (longest < 4) return false;
  return editDistance(first, second) <= (longest >= 9 ? 2 : 1);
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
  'clean',
  '3d',
  '16d',
  'vocals only',
  'female version',
  'male version',
  'arabic version',
  'tamil version',
  'telugu version'
];

function extractVersionMarkers(text) {
  if (!text) return [];
  const norm = ` ${normalizeString(text)} `;
  const found = [];
  for (const marker of VERSION_MARKERS) {
    if (norm.includes(` ${normalizeString(marker)} `)) {
      found.push(marker);
    }
  }
  return found;
}

module.exports = {
  normalizeString,
  normalizeTitle,
  stripCatalogQualifiers,
  equivalentToken,
  normalizeArtist,
  normalizeAlbum,
  stripFeaturedArtists,
  extractVersionMarkers,
  VERSION_MARKERS
};
