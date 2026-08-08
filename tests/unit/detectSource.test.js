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

  it('should detect Instagram URLs', () => {
    const res = detectSource('https://www.instagram.com/reel/C3_ab123456');
    expect(res.valid).toBe(true);
    expect(res.platform).toBe('instagram');
  });

  it('should detect Twitter/X URLs', () => {
    const res = detectSource('https://x.com/user/status/123456789');
    expect(res.valid).toBe(true);
    expect(res.platform).toBe('twitter');
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
