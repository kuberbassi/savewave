const { detectSource } = require('../../src/services/resolver/detectSource');

describe('Source Detector', () => {
  it('rejects login-gated Instagram and Facebook Stories clearly', () => {
    expect(detectSource('https://www.instagram.com/stories/example/123').valid).toBe(false);
    expect(detectSource('https://www.facebook.com/stories/123').valid).toBe(false);
  });
  it('should detect YouTube URLs correctly', () => {
    const res = detectSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(res.valid).toBe(true);
    expect(res.platform).toBe('youtube');
  });

  it('should detect YouTube Shorts URLs correctly', () => {
    const res = detectSource('https://youtube.com/shorts/abcd12345');
    expect(res.valid).toBe(true);
    expect(res.platform).toBe('youtube');
    expect(res.type).toBe('shorts');
  });

  it('should detect Spotify URLs', () => {
    const res = detectSource('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
    expect(res.valid).toBe(true);
    expect(res.platform).toBe('spotify');
  });

  it('accepts public Reel-shaped URLs but rejects other Instagram paths', () => {
    const res = detectSource('https://www.instagram.com/reel/C3_ab123456/?utm_source=copy');
    expect(res).toMatchObject({ valid: true, platform: 'instagram', type: 'reel' });
    for (const url of ['https://www.instagram.com/p/C3_ab123456/', 'https://www.instagram.com/stories/user/123', 'https://www.instagram.com/reel/C3_ab123456/extra']) {
      expect(detectSource(url)).toMatchObject({ valid: false, platform: 'instagram' });
    }
  });

  it('rejects Facebook and Twitter/X URLs as unavailable', () => {
    expect(detectSource('https://www.facebook.com/watch?v=123').valid).toBe(false);
    const res = detectSource('https://x.com/user/status/123456789');
    expect(res.valid).toBe(false);
    expect(res.platform).toBe('twitter');
    expect(res.reason).toContain('not currently supported');
  });

  it('should accept direct MP4 media links', () => {
    const res = detectSource('https://example.com/media/video.mp4');
    expect(res.valid).toBe(true);
    expect(res.platform).toBe('direct');
  });

  it('should accept direct MP3 media links', () => {
    const res = detectSource('https://example.com/audio/song.mp3');
    expect(res.valid).toBe(true);
    expect(res.platform).toBe('direct');
  });

  it('should accept direct image links', () => {
    const res = detectSource('https://example.com/images/photo.jpg');
    expect(res.valid).toBe(true);
    expect(res.platform).toBe('direct');
  });

  it('should reject PDF document files', () => {
    const res = detectSource('https://example.com/document.pdf');
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('Unsupported file type');
  });

  it('should reject ZIP archive files', () => {
    const res = detectSource('https://example.com/archive.zip');
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('Unsupported file type');
  });
});
