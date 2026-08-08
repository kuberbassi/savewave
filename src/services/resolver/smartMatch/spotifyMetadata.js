const TRACK_ID_PATTERN = /open\.spotify\.com\/track\/([a-zA-Z0-9]{22})/;

function parseTrackId(url) {
  const match = String(url || '').match(TRACK_ID_PATTERN);
  return match ? match[1] : null;
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&ndash;|&mdash;/g, '-');
}

function extractArtistFromHtml(html) {
  const pageTitle = decodeHtml((html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1]);
  const descriptions = [...html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:description|description)["'][^>]+content=["']([^"']+)["']/gi)]
    .map((match) => decodeHtml(match[1]));
  const combined = [pageTitle, ...descriptions].join(' · ');
  const patterns = [
    /(?:song(?: and lyrics)?|track) by ([^|·]+?)(?:\s*[|·]|$)/i,
    /(?:listen to|stream) .+? by ([^|·]+?)(?:\s+(?:on spotify)|[|·]|$)/i,
    /.+?\s+-\s+([^|]+?)\s*\|\s*spotify/i
  ];
  for (const pattern of patterns) {
    const match = combined.match(pattern);
    if (match && match[1]) return match[1].trim();
  }
  return '';
}

async function getSpotifyMetadata(url) {
  if (!parseTrackId(url)) throw new Error('Paste an individual Spotify track link.');

  const [oembedResponse, pageResponse] = await Promise.all([
    fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`),
    fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 Savewave/1.0' } })
  ]);
  if (!oembedResponse.ok) throw new Error('Spotify metadata is unavailable right now.');
  const oembed = await oembedResponse.json();
  const html = pageResponse.ok ? await pageResponse.text() : '';
  const title = String(oembed.title || '').trim();
  const artist = extractArtistFromHtml(html);
  if (!title || !artist) throw new Error('Spotify did not expose enough public metadata for a safe match.');

  const artists = artist.split(/,|&|feat\.?|ft\.?/i).map((item) => item.trim()).filter(Boolean);
  return {
    title,
    artist,
    artists,
    primaryArtist: artists[0] || artist,
    album: '',
    duration: null,
    isrc: null,
    thumbnail: oembed.thumbnail_url || null
  };
}

module.exports = { decodeHtml, extractArtistFromHtml, getSpotifyMetadata, parseTrackId };
