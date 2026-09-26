const TRACK_ID_PATTERN = /open\.spotify\.com\/track\/([a-zA-Z0-9]{22})/;
const MAX_METADATA_BYTES = 1_000_000;
const MAX_TEXT_LENGTH = 300;

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
      explicit: typeof entity.isExplicit === 'boolean' ? entity.isExplicit : undefined,
      playable: entity.isPlayable !== false,
      isrc: String(entity?.externalIds?.isrc || entity?.isrc || '').trim() || null,
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

async function boundedText(response) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_METADATA_BYTES) throw new Error('Spotify metadata response is too large.');
  const text = await response.text();
  if (text.length > MAX_METADATA_BYTES) throw new Error('Spotify metadata response is too large.');
  return text;
}

async function safeJson(response) {
  try { return JSON.parse(await boundedText(response)); }
  catch { return {}; }
}

function cleanText(value, limit = MAX_TEXT_LENGTH) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text && text.length <= limit ? text : '';
}

function safePublicUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password && parsed.href.length <= 2_048
      ? parsed.href : null;
  } catch { return null; }
}

function validateSpotifyMetadata(value, trackId) {
  const title = cleanText(value?.title);
  const artists = [...new Set((Array.isArray(value?.artists) ? value.artists : [])
    .map((artist) => cleanText(artist, 160)).filter(Boolean))].slice(0, 20);
  const primaryArtist = cleanText(value?.primaryArtist || artists[0], 160);
  if (!title || !primaryArtist || !artists.length) throw new Error('Spotify did not expose enough public metadata for a safe match.');
  const duration = Number(value?.duration);
  const validDuration = Number.isFinite(duration) && duration >= 10 && duration <= 7_200 ? Math.round(duration) : undefined;
  const releaseDate = cleanText(value?.releaseDate, 40) || undefined;
  const releaseYear = /^(19|20)\d{2}/.test(releaseDate || '') ? Number(releaseDate.slice(0, 4)) : undefined;
  const isrc = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/i.test(String(value?.isrc || '')) ? String(value.isrc).toUpperCase() : undefined;
  return {
    trackId,
    title,
    artist: artists.join(', '),
    artists,
    primaryArtist,
    album: cleanText(value?.album) || undefined,
    duration: validDuration,
    releaseDate,
    releaseYear,
    explicit: typeof value?.explicit === 'boolean' ? value.explicit : undefined,
    isrc,
    thumbnail: safePublicUrl(value?.thumbnail),
    previewUrl: safePublicUrl(value?.previewUrl),
    provenance: Object.freeze({ embed: Boolean(value?.provenance?.embed), oembed: Boolean(value?.provenance?.oembed), pageFallback: Boolean(value?.provenance?.pageFallback) })
  };
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
  const oembed = oembedResponse?.ok ? await safeJson(oembedResponse) : {};
  const embed = embedResponse?.ok ? extractEmbedMetadata(await boundedText(embedResponse)) : null;

  let fallbackArtist = '';
  if (!embed?.artist) {
    try {
      const pageResponse = await fetchWithTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0 Savewave/1.0' } });
      if (pageResponse.ok) fallbackArtist = extractArtistFromHtml(await boundedText(pageResponse));
    } catch {
      // The embed/oEmbed result remains authoritative when the public page fallback fails.
    }
  }

  const title = String(embed?.title || oembed.title || '').trim();
  const artist = String(embed?.artist || fallbackArtist || '').trim();
  const artists = embed?.artists?.length
    ? embed.artists
    : artist.split(/,|&|feat\.?|ft\.?/i).map((item) => item.trim()).filter(Boolean);
  if (!title || !artist) throw new Error('Spotify did not expose enough public metadata for a safe match.');
  if (embed && !embed.playable) throw new Error('This Spotify track is not publicly playable in the current region.');

  return validateSpotifyMetadata({
    title,
    artists,
    primaryArtist: artists[0] || artist,
    album: embed?.album || '',
    duration: embed?.duration,
    releaseDate: embed?.releaseDate,
    explicit: embed?.explicit,
    isrc: embed?.isrc,
    thumbnail: embed?.thumbnail || oembed.thumbnail_url || null,
    previewUrl: embed?.previewUrl || null,
    provenance: { embed: Boolean(embed), oembed: Boolean(oembedResponse?.ok), pageFallback: Boolean(fallbackArtist) }
  }, trackId);
}

module.exports = { boundedText, decodeHtml, extractArtistFromHtml, extractEmbedMetadata, getSpotifyMetadata, parseTrackId, validateSpotifyMetadata };
