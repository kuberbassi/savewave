const request = require('supertest');
const app = require('../../server');

describe('Resolver API Routes', () => {
  it('should reject malformed or SSRF target URLs', async () => {
    const res = await request(app)
      .post('/api/resolve')
      .send({ url: 'http://localhost:3000' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('private or local network');
  });

  it('should accept direct MP4 media links', async () => {
    const res = await request(app)
      .post('/api/resolve')
      .send({ url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.type).toBe('video');
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
