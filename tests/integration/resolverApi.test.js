const request = require('supertest');
const app = require('../../server');

describe('Web application routes', () => {
  it('serves the Savewave frontend', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.text).toContain('Savewave');
    expect(response.text).toContain('landing.js');
    expect(response.text).not.toContain('core.js');
  });

  it.each(['/api/resolve', '/api/prepare-download', '/api/stream'])('never performs cloud extraction at %s', async (route) => {
    const response = await request(app).post(route).send({ url: 'https://youtube.com/watch?v=test', mode: 'video' });
    expect(response.status).toBe(410);
    expect(response.body.error).toContain('runs locally');
  });

  it('returns JSON for malformed API request bodies', async () => {
    const response = await request(app)
      .post('/api/resolve')
      .set('Content-Type', 'application/json')
      .send('{invalid');
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Malformed JSON request.');
  });
});
