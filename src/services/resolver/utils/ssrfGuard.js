/**
  * SSRF Protection Utility for Savewave Backend
  * Validates target URLs to prevent server-side request forgery against private networks or internal services.
  */

function isPrivateIp(ip) {
  if (!ip) return false;
  // IPv4 Private/Loopback/Link-Local/Multicast ranges
  if (
    ip === '127.0.0.1' ||
    ip === '0.0.0.0' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('169.254.') ||
    (ip.startsWith('172.') && (parseInt(ip.split('.')[1], 10) >= 16 && parseInt(ip.split('.')[1], 10) <= 31))
  ) {
    return true;
  }

  // IPv6 Loopback/Local
  if (ip === '::1' || ip === 'fe80::' || ip.startsWith('fd')) {
    return true;
  }

  return false;
}

function validateUrl(targetUrl) {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return { valid: false, reason: 'Invalid or missing URL string' };
  }

  const trimmed = targetUrl.trim();

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (err) {
    return { valid: false, reason: 'Malformed URL structure' };
  }

  // Enforce HTTP / HTTPS protocol only
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: `Unsupported protocol: ${parsed.protocol}` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost and private hostnames
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    isPrivateIp(hostname)
  ) {
    return { valid: false, reason: 'Access to private or local network resources is restricted' };
  }

  return { valid: true, parsedUrl: parsed };
}

module.exports = {
  validateUrl,
  isPrivateIp
};
