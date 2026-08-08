const express = require('express');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const ytdlp = require('yt-dlp-exec');

const { resolveMedia } = require('./src/services/resolver/resolveMedia');
const { validateUrl, validateRemoteUrl } = require('./src/services/resolver/utils/ssrfGuard');
const { safeFetch } = require('./src/services/resolver/utils/safeFetch');
const { detectSource } = require('./src/services/resolver/detectSource');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const apiWindows = new Map();
let activeStreams = 0;

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
  });
  next();
});
app.use(express.json({ limit: '8kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', (req, res, next) => {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const current = apiWindows.get(key);
  const windowState = !current || now >= current.resetAt
    ? { count: 1, resetAt: now + 60_000 }
    : { count: current.count + 1, resetAt: current.resetAt };
  apiWindows.set(key, windowState);

  res.setHeader('RateLimit-Limit', '30');
  res.setHeader('RateLimit-Remaining', String(Math.max(0, 30 - windowState.count)));
  res.setHeader('RateLimit-Reset', String(Math.ceil(windowState.resetAt / 1000)));
  if (windowState.count > 30) return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });

  if (apiWindows.size > 1000) {
    for (const [storedKey, value] of apiWindows) if (now >= value.resetAt) apiWindows.delete(storedKey);
  }
  next();
});

// Unified Resolver API Endpoint
app.post('/api/resolve', async (req, res) => {
  const { url, mode = 'video' } = req.body;

  const ssrf = validateUrl(url);
  if (!ssrf.valid) {
    return res.status(400).json({ error: ssrf.reason });
  }

  try {
    const remote = await validateRemoteUrl(url);
    if (!remote.valid) return res.status(400).json({ error: remote.reason });
    const normalized = await resolveMedia(url, mode);
    return res.json(normalized);
  } catch (err) {
    return res.status(422).json({ error: err.message || 'Unable to resolve this media' });
  }
});

// Validate and resolve the final target before opening the browser download.
app.post('/api/prepare-download', async (req, res) => {
  const { url, mode = 'mp4', title = 'media' } = req.body || {};
  const guard = validateUrl(url);
  if (!guard.valid) return res.status(400).json({ error: guard.reason });

  const isAudio = mode === 'mp3' || mode === 'audio';
  const resolverMode = isAudio ? 'audio' : 'video';
  try {
    const remote = await validateRemoteUrl(url);
    if (!remote.valid) return res.status(400).json({ error: remote.reason });
    const resolved = await resolveMedia(url, resolverMode);
    const finalUrl = resolved && resolved.download && resolved.download.directUrl || url;
    const finalGuard = validateUrl(finalUrl);
    if (!finalGuard.valid) return res.status(422).json({ error: 'The resolved media target is not safe to download.' });

    const resolvedMode = resolved && resolved.download && resolved.download.mode || mode;
    const cleanTitle = String(title || resolved.title || 'media').replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'media';
    const allowedModes = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'mp4', 'webm', 'mov']);
    const requestedMode = String(resolvedMode || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const extension = isAudio ? 'mp3' : (allowedModes.has(requestedMode) ? requestedMode : 'mp4');
    const params = new URLSearchParams({ url: finalUrl, mode: extension, title: cleanTitle });

    return res.json({
      ready: true,
      filename: `${cleanTitle}.${extension}`,
      downloadUrl: `/api/stream?${params.toString()}`
    });
  } catch (error) {
    return res.status(422).json({ error: error.message || 'Unable to prepare this download.' });
  }
});

// Stateless Media Stream Proxy
app.get('/api/stream', async (req, res) => {
  const { url, mode, title } = req.query;

  const ssrf = validateUrl(url);
  if (!ssrf.valid) {
    return res.status(400).send('Invalid or restricted URL');
  }
  if (activeStreams >= 4) return res.status(503).send('The downloader is busy. Please try again shortly.');
  activeStreams += 1;
  let streamReleased = false;
  const releaseStream = () => {
    if (streamReleased) return;
    streamReleased = true;
    activeStreams = Math.max(0, activeStreams - 1);
  };
  res.once('finish', releaseStream);
  res.once('close', releaseStream);

  const isAudio = mode === 'mp3' || mode === 'audio';
  const resolverMode = isAudio ? 'audio' : 'video';
  const cleanTitle = (title || 'media').replace(/[^a-zA-Z0-9_\- ]/g, '');
  const allowedExtensions = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'mp4', 'webm', 'mov']);
  const requestedExtension = String(mode || '').toLowerCase();
  const ext = isAudio ? 'mp3' : (allowedExtensions.has(requestedExtension) ? requestedExtension : 'mp4');
  const filename = `${cleanTitle}.${ext}`;
  const source = detectSource(url);

  const contentTypeMap = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    wav: 'audio/wav',
    flac: 'audio/flac',
    ogg: 'audio/ogg',
    mp4: 'video/mp4',
    webm: 'video/webm'
  };

  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.setHeader('Content-Type', contentTypeMap[ext] || (isAudio ? 'audio/mpeg' : 'video/mp4'));
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Proxy or pipe stream directly to enforce attachment disposition headers
  try {
    if (url.startsWith('http')) {
      const remote = await validateRemoteUrl(url);
      if (!remote.valid) return res.status(400).send('Invalid or restricted URL');
      const resolved = await resolveMedia(url, resolverMode);
      const targetUrl = (resolved && resolved.download && resolved.download.directUrl) ? resolved.download.directUrl : null;
      
      if (targetUrl && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
        const fetchStream = await safeFetch(targetUrl, { signal: AbortSignal.timeout(30000) });
        if (fetchStream.ok && fetchStream.body) {
          const upstreamType = (fetchStream.headers.get('content-type') || '').toLowerCase();
          if (upstreamType.includes('text/html') || upstreamType.includes('application/json')) {
            await fetchStream.body.cancel();
            return res.status(502).send('The resolved source did not return downloadable media.');
          }
          const upstreamLength = fetchStream.headers.get('content-length');
          if (upstreamLength && /^\d+$/.test(upstreamLength)) res.setHeader('Content-Length', upstreamLength);
          const { Readable } = require('stream');
          const nodeStream = Readable.fromWeb(fetchStream.body);
          return nodeStream.pipe(res);
        }
      }
    }
  } catch (e) {
    if (source.platform === 'direct' || source.platform === 'spotify') {
      return res.status(502).send('The resolved media source could not be reached safely.');
    }
  }

  let flags = ['-o', '-', '--no-warnings', '--no-colors', '--socket-timeout', '15', '--retries', '2'];
  if (isAudio) {
    flags.push('-f', 'bestaudio/best');
  } else {
    flags.push('-f', 'best[ext=mp4]/best');
  }
  flags.push(url);

  const ytdlpBinary = (ytdlp && ytdlp.constants && ytdlp.constants.YTDLP_PATH) ? ytdlp.constants.YTDLP_PATH : 'yt-dlp';
  
  let proc;
  try {
    proc = spawn(ytdlpBinary, flags, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    return res.status(500).send('Stream extraction binary failed');
  }

  proc.stdout.pipe(res);

  proc.on('error', () => {
    if (!res.headersSent) {
      res.status(500).send('Media stream extraction error');
    }
  });

  proc.on('close', (code) => {
    if (code && !res.writableEnded) res.destroy(new Error('Media extraction ended unexpectedly.'));
  });

  proc.stderr.on('data', () => {});

  req.on('close', () => {
    try {
      if (proc) proc.kill();
    } catch (e) {}
  });
});

app.use((error, req, res, next) => {
  if (!error) return next();
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
  if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ error: 'Malformed JSON request.' });
  return next(error);
});

// Custom 404 Error Handler
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`🚀 Savewave Stateless Resolver running at http://localhost:${PORT}`);
  });
}

module.exports = app;
