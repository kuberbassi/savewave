const request = require('supertest');
const dns = require('dns').promises;
const app = require('../../server');

describe('Resolver API Routes', () => {
  beforeEach(() => vi.spyOn(dns, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }]));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it('rejects unsafe download preparation targets', async () => {
    const res = await request(app)
      .post('/api/prepare-download')
      .send({ url: 'http://127.0.0.1/private', mode: 'mp4', title: 'test' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });
  it('should reject malformed or SSRF target URLs', async () => {
    const res = await request(app)
      .post('/api/resolve')
      .send({ url: 'http://localhost:3000' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('private or local network');
  });

  it('returns JSON for malformed request bodies', async () => {
    const res = await request(app)
      .post('/api/resolve')
      .set('Content-Type', 'application/json')
      .send('{invalid');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Malformed JSON request.');
  });

  it('should accept direct MP4 media links', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'video/mp4' }
    }));
    const res = await request(app)
      .post('/api/resolve')
      .send({ url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.type).toBe('video');
  });

  it('streams a prepared direct-media response with download headers', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, headers: { get: () => 'image/png' } })
      .mockResolvedValueOnce(new Response(new Uint8Array([137, 80, 78, 71]), {
        status: 200,
        headers: { 'content-type': 'image/png', 'content-length': '4' }
      })));
    const res = await request(app)
      .get('/api/stream')
      .query({ url: 'https://cdn.example.com/image.png', mode: 'png', title: 'preview' });
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('preview.png');
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.body.length).toBe(4);
  });

  it('should reject PDF documents as unsupported non-media files', async () => {
    const res = await request(app)
      .post('/api/resolve')
      .send({ url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' });
    expect(res.status).toBe(422);
    expect(res.body.error).toContain('Unsupported file type');
  });

  it('should reject ZIP archives as unsupported non-media files', async () => {
    const res = await request(app)
      .post('/api/resolve')
      .send({ url: 'https://example.com/file.zip' });
    expect(res.status).toBe(422);
    expect(res.body.error).toContain('Unsupported file type');
  });
});
