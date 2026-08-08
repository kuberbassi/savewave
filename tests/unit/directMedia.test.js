const { resolveDirectMedia } = require('../../src/services/resolver/providers/directMedia');
const dns = require('dns').promises;

describe('Direct media export metadata', () => {
  beforeEach(() => vi.spyOn(dns, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }]));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses the MIME type for image URLs without file extensions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/png' }
    }));
    const result = await resolveDirectMedia('https://cdn.example.com/media?id=1');
    expect(result.type).toBe('image');
    expect(result.filename).toMatch(/\.png$/);
    expect(result.download.mode).toBe('png');
  });

  it('exports detected audio with an audio extension', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'audio/mpeg' }
    }));
    const result = await resolveDirectMedia('https://cdn.example.com/stream');
    expect(result.type).toBe('audio');
    expect(result.filename).toMatch(/\.mp3$/);
    expect(result.download.mode).toBe('mp3');
  });

  it('falls back to a ranged GET when HEAD is rejected', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 405, headers: { get: () => null } })
      .mockResolvedValueOnce({ ok: true, status: 206, headers: { get: () => 'video/mp4' }, body: { cancel: vi.fn() } }));
    const result = await resolveDirectMedia('https://cdn.example.com/video');
    expect(result.type).toBe('video');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
