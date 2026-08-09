const { extractionOptions, flattenEntries, normalizeExtractedMedia, selectDirectFormat } = require('../../src/services/resolver/utils/providerMedia');
const { extractArtistFromHtml, parseTrackId } = require('../../src/services/resolver/smartMatch/spotifyMetadata');

describe('Provider media normalization', () => {
  it('enables the Node challenge runtime required by current YouTube extraction', () => {
    expect(extractionOptions()).toMatchObject({
      jsRuntimes: 'node',
      remoteComponents: 'ejs:github'
    });
    expect(extractionOptions()).not.toHaveProperty('noCheckCertificate');
  });
  it('flattens story and carousel playlists', () => {
    expect(flattenEntries({ entries: [{ id: '1', url: 'a' }, { entries: [{ id: '2', url: 'b' }] }] }).map((item) => item.id)).toEqual(['1', '2']);
  });

  it('selects the highest compatible progressive video', () => {
    const selected = selectDirectFormat({ formats: [
      { url: '720', height: 720, vcodec: 'h264', acodec: 'aac' },
      { url: '1080-video-only', height: 1080, vcodec: 'h264', acodec: 'none' },
      { url: '1080', height: 1080, vcodec: 'h264', acodec: 'aac' }
    ] });
    expect(selected.url).toBe('1080');
  });

  it('selects the highest bitrate audio stream', () => {
    const selected = selectDirectFormat({ formats: [
      { url: 'low', acodec: 'aac', abr: 64 },
      { url: 'high', acodec: 'opus', abr: 160 }
    ] }, 'audio');
    expect(selected.url).toBe('high');
  });

  it('preserves image extensions', () => {
    const media = normalizeExtractedMedia({ title: 'Post', ext: 'webp', url: 'https://cdn.example/post.webp?x=1' });
    expect(media).toMatchObject({ extension: 'webp', type: 'image' });
  });

  it('extracts only valid Spotify track IDs', () => {
    expect(parseTrackId('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=test')).toBe('4uLU6hMCjMI75M1A2tKUQC');
    expect(parseTrackId('https://open.spotify.com/playlist/abc')).toBeNull();
  });

  it('extracts an artist from public Spotify page metadata', () => {
    const html = '<title>Never Gonna Give You Up - song and lyrics by Rick Astley | Spotify</title>';
    expect(extractArtistFromHtml(html)).toBe('Rick Astley');
  });
});
