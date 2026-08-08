const { validateUrl, isPrivateIp } = require('../../src/services/resolver/utils/ssrfGuard');

describe('SSRF Protection Guard', () => {
  it('should allow valid public HTTP/HTTPS URLs', () => {
    expect(validateUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ').valid).toBe(true);
    expect(validateUrl('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT').valid).toBe(true);
  });

  it('should reject local/private IP hostnames', () => {
    expect(validateUrl('http://localhost:3000').valid).toBe(false);
    expect(validateUrl('http://127.0.0.1/secret').valid).toBe(false);
    expect(validateUrl('http://192.168.1.1/admin').valid).toBe(false);
    expect(validateUrl('http://10.0.0.1').valid).toBe(false);
    expect(validateUrl('http://169.254.169.254/latest/meta-data').valid).toBe(false);
  });

  it('should reject non-HTTP protocols', () => {
    expect(validateUrl('file:///etc/passwd').valid).toBe(false);
    expect(validateUrl('gopher://localhost').valid).toBe(false);
  });

  it('should detect private IPs correctly', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('192.168.0.1')).toBe(true);
    expect(isPrivateIp('8.8.8.8')).toBe(false);
  });
});
