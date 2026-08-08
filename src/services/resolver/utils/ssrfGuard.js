/**
  * SSRF Protection Utility for Savewave Backend
  * Validates target URLs to prevent server-side request forgery against private networks or internal services.
  */

const dns = require('dns').promises;
const net = require('net');

function isPrivateIp(ip) {
  if (!ip) return false;
  const normalized = ip.toLowerCase().split('%')[0];

  if (normalized.startsWith('::ffff:')) return isPrivateIp(normalized.slice(7));

  if (net.isIP(normalized) === 6) {
    return normalized === '::' || normalized === '::1' || normalized.startsWith('fc') ||
      normalized.startsWith('fd') || /^fe[89ab]/.test(normalized) || normalized.startsWith('ff');
  }

  if (net.isIP(normalized) !== 4) return false;
  const octets = normalized.split('.').map(Number);
  const [a, b] = octets;
  // IPv4 Private/Loopback/Link-Local/Multicast ranges
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19));
}

async function validateRemoteUrl(targetUrl) {
  const basic = validateUrl(targetUrl);
  if (!basic.valid) return basic;

  try {
    const addresses = await dns.lookup(basic.parsedUrl.hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
      return { valid: false, reason: 'The URL resolves to a restricted network address' };
    }
    return { ...basic, addresses };
  } catch {
    return { valid: false, reason: 'The URL hostname could not be resolved' };
  }
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
  validateRemoteUrl,
  isPrivateIp
};
