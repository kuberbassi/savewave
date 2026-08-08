const { Agent } = require('undici');
const { validateRemoteUrl } = require('./ssrfGuard');

const pinnedHosts = new Map();
const dispatcher = new Agent({
  connect: {
    lookup(hostname, options, callback) {
      const key = hostname.toLowerCase().replace(/\.$/, '');
      const pin = pinnedHosts.get(key);
      if (!pin || Date.now() >= pin.expiresAt) {
        return callback(new Error('Outbound hostname was not validated.'));
      }

      const candidates = options.family
        ? pin.addresses.filter(({ family }) => family === options.family)
        : pin.addresses;
      if (!candidates.length) return callback(new Error('No validated address matches the requested network family.'));
      if (options.all) return callback(null, candidates);
      return callback(null, candidates[0].address, candidates[0].family);
    }
  }
});

function pinValidatedHost(guard) {
  const key = guard.parsedUrl.hostname.toLowerCase().replace(/\.$/, '');
  pinnedHosts.set(key, { addresses: guard.addresses, expiresAt: Date.now() + 60_000 });
  if (pinnedHosts.size > 1000) {
    const now = Date.now();
    for (const [host, pin] of pinnedHosts) if (now >= pin.expiresAt) pinnedHosts.delete(host);
  }
}

async function safeFetch(input, options = {}) {
  let currentUrl = String(input);
  const maxRedirects = options.maxRedirects ?? 4;

  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    const guard = await validateRemoteUrl(currentUrl);
    if (!guard.valid) throw new Error(guard.reason);
    pinValidatedHost(guard);

    const response = await globalThis.fetch(guard.parsedUrl.href, {
      ...options,
      dispatcher,
      maxRedirects: undefined,
      redirect: 'manual',
      signal: options.signal || AbortSignal.timeout(15000)
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    if (!location) throw new Error('The media source returned an invalid redirect.');
    if (response.body) await response.body.cancel();
    currentUrl = new URL(location, guard.parsedUrl).href;
  }

  throw new Error('The media source redirected too many times.');
}

module.exports = { safeFetch };
