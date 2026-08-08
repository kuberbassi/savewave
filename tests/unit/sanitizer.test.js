const { sanitizeFilename } = require('../../src/services/resolver/utils/sanitizer');

describe('Filename Sanitizer', () => {
  it('should remove unsafe characters', () => {
    expect(sanitizeFilename('my/test:file?.mp4', 'mp4')).toBe('my_test_file_.mp4');
  });

  it('should append missing extension', () => {
    expect(sanitizeFilename('my_video', 'mp4')).toBe('my_video.mp4');
  });

  it('should fallback for empty strings', () => {
    expect(sanitizeFilename('', 'mp3')).toBe('media_file.mp3');
  });
});
