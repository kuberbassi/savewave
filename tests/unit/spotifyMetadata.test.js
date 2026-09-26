const { extractEmbedMetadata, getSpotifyMetadata, validateSpotifyMetadata } = require('../../src/services/resolver/smartMatch/spotifyMetadata');

const entity = {
  type: 'track',
  title: 'Never Gonna Give You Up',
  artists: [{ name: 'Rick Astley' }],
  duration: 213573,
  isPlayable: true,
  isExplicit: false,
  releaseDate: { isoString: '1987-11-12T00:00:00Z' },
  audioPreview: { url: 'https://p.scdn.co/preview.mp3' },
  visualIdentity: {
    image: [
      { url: 'https://i.scdn.co/small.jpg', maxWidth: 64, maxHeight: 64 },
      { url: 'https://i.scdn.co/large.jpg', maxWidth: 640, maxHeight: 640 }
    ]
  }
};

function embedHtml(track = entity) {
  const payload = { props: { pageProps: { state: { data: { entity: track } } } } };
  return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script>`;
}

describe('Spotify public metadata', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('extracts exact artists, duration, release and artwork from the public embed', () => {
    expect(extractEmbedMetadata(embedHtml())).toMatchObject({
      title: 'Never Gonna Give You Up',
      artist: 'Rick Astley',
      artists: ['Rick Astley'],
      duration: 214,
      releaseDate: '1987-11-12T00:00:00Z',
      thumbnail: 'https://i.scdn.co/large.jpg',
      previewUrl: 'https://p.scdn.co/preview.mp3'
    });
  });

  it('combines embed metadata with oEmbed without credentials', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ title: entity.title, thumbnail_url: 'fallback.jpg' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(embedHtml(), { status: 200 })));

    const metadata = await getSpotifyMetadata('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
    expect(metadata.primaryArtist).toBe('Rick Astley');
    expect(metadata.duration).toBe(214);
    expect(metadata.thumbnail).toBe('https://i.scdn.co/large.jpg');
    expect(metadata.explicit).toBe(false);
    expect(metadata.releaseYear).toBe(1987);
    expect(metadata.provenance).toEqual({ embed: true, oembed: true, pageFallback: false });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('keeps missing explicit state unknown instead of treating it as clean', () => {
    const metadata = extractEmbedMetadata(embedHtml({ ...entity, isExplicit: undefined }));
    expect(metadata.explicit).toBeUndefined();
  });

  it('validates and bounds identity metadata before matching', () => {
    expect(() => validateSpotifyMetadata({ title: 'x'.repeat(301), artists: ['Artist'], primaryArtist: 'Artist' }, 'id')).toThrow('enough public metadata');
    expect(validateSpotifyMetadata({ title: 'Song', artists: ['Artist', 'Artist'], primaryArtist: 'Artist', duration: 2, thumbnail: 'file:///secret' }, 'id'))
      .toMatchObject({ artists: ['Artist'], duration: undefined, thumbnail: null });
  });

  it('falls back to valid embed metadata when oEmbed returns malformed JSON', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('{broken', { status: 200 }))
      .mockResolvedValueOnce(new Response(embedHtml(), { status: 200 })));
    await expect(getSpotifyMetadata('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT'))
      .resolves.toMatchObject({ title: entity.title, primaryArtist: 'Rick Astley' });
  });

  it('rejects tracks reported as unavailable in the current region', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ title: entity.title }), { status: 200 }))
      .mockResolvedValueOnce(new Response(embedHtml({ ...entity, isPlayable: false }), { status: 200 })));
    await expect(getSpotifyMetadata('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT'))
      .rejects.toThrow('not publicly playable');
  });
});
