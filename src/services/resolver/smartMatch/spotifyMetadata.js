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
  const source = String(html || '');
  const pageTitle = decodeHtml((source.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1]);
  const descriptions = [...source.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:description|description)["'][^>]+content=["']([^"']+)["']/gi)]
    .map((match) => decodeHtml(match[1]));
  const structured = [...source.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => decodeHtml(match[1]));
  const combined = [pageTitle, ...descriptions, ...structured].join(' · ');
  const patterns = [
    /(?:song(?: and lyrics)?|track) by ([^|·]+?)(?:\s*[|·]|$)/i,
    /(?:song|track)\s*[·-]\s*([^·"|}]+?)(?:\s*[·"|}]|$)/i,
    /(?:listen to|stream) .+? by ([^|·]+?)(?:\s+(?:on spotify)|[|·]|$)/i,
    /.+?\s+-\s+([^|]+?)\s*\|\s*spotify/i
  ];
  for (const pattern of patterns) {
    const match = combined.match(pattern);
    if (match && match[1]) return match[1].trim();
  }
  return '';
}

function extractEmbedMetadata(html) {
  const source = String(html || '');
  const match = source.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;

  try {
    const payload = JSON.parse(decodeHtml(match[1]));
    const entity = payload?.props?.pageProps?.state?.data?.entity;
    if (!entity || entity.type !== 'track') return null;
    const artists = Array.isArray(entity.artists)
      ? entity.artists.map((artist) => String(artist?.name || '').trim()).filter(Boolean)
      : [];
    const images = entity?.visualIdentity?.image || [];
    const thumbnail = images.reduce((best, image) => {
      const size = Number(image?.maxWidth || 0) * Number(image?.maxHeight || 0);
      return size > best.size && image?.url ? { size, url: image.url } : best;
    }, { size: 0, url: null }).url;

    return {
      title: String(entity.title || entity.name || '').trim(),
      artist: artists.join(', '),
      artists,
      primaryArtist: artists[0] || '',
      album: String(entity?.album?.name || entity?.album?.title || '').trim(),
      duration: Number.isFinite(entity.duration) ? Math.round(entity.duration / 1000) : null,
      releaseDate: entity?.releaseDate?.isoString || null,
      explicit: Boolean(entity.isExplicit),
      playable: entity.isPlayable !== false,
      thumbnail,
      previewUrl: entity?.audioPreview?.url || null
    };
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(8000) });
}

async function getSpotifyMetadata(url) {
  const trackId = parseTrackId(url);
  if (!trackId) throw new Error('Paste an individual Spotify track link.');

  const embedUrl = `https://open.spotify.com/embed/track/${trackId}`;
  const [oembedResult, embedResult] = await Promise.allSettled([
    fetchWithTimeout(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`),
    fetchWithTimeout(embedUrl, { headers: { 'User-Agent': 'Mozilla/5.0 Savewave/1.0' } })
  ]);

  const oembedResponse = oembedResult.status === 'fulfilled' ? oembedResult.value : null;
  const embedResponse = embedResult.status === 'fulfilled' ? embedResult.value : null;
  const oembed = oembedResponse?.ok ? await oembedResponse.json() : {};
  const embed = embedResponse?.ok ? extractEmbedMetadata(await embedResponse.text()) : null;

  let fallbackArtist = '';
  if (!embed?.artist) {
    try {
      const pageResponse = await fetchWithTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0 Savewave/1.0' } });
      if (pageResponse.ok) fallbackArtist = extractArtistFromHtml(await pageResponse.text());
    } catch {}
  }

  const title = String(embed?.title || oembed.title || '').trim();
  const artist = String(embed?.artist || fallbackArtist || '').trim();
  const artists = embed?.artists?.length
    ? embed.artists
    : artist.split(/,|&|feat\.?|ft\.?/i).map((item) => item.trim()).filter(Boolean);
  if (!title || !artist) throw new Error('Spotify did not expose enough public metadata for a safe match.');
  if (embed && !embed.playable) throw new Error('This Spotify track is not publicly playable in the current region.');

  return {
    title,
    artist,
    artists,
    primaryArtist: artists[0] || artist,
    album: embed?.album || '',
    duration: embed?.duration || null,
    releaseDate: embed?.releaseDate || null,
    explicit: embed?.explicit || false,
    isrc: null,
    thumbnail: embed?.thumbnail || oembed.thumbnail_url || null,
    previewUrl: embed?.previewUrl || null
  };
}

module.exports = { decodeHtml, extractArtistFromHtml, extractEmbedMetadata, getSpotifyMetadata, parseTrackId };
