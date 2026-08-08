const express = require('express');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const ytdlp = require('yt-dlp-exec');

const { resolveMedia } = require('./src/services/resolver/resolveMedia');
const { validateUrl } = require('./src/services/resolver/utils/ssrfGuard');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Unified Resolver API Endpoint
app.post('/api/resolve', async (req, res) => {
  const { url, mode = 'video' } = req.body;

  const ssrf = validateUrl(url);
  if (!ssrf.valid) {
    return res.status(400).json({ error: ssrf.reason });
  }

  try {
    const normalized = await resolveMedia(url, mode);
    return res.json(normalized);
  } catch (err) {
    return res.status(422).json({ error: err.message || 'Unable to resolve this media' });
  }
});

// Stateless Media Stream Proxy
app.get('/api/stream', async (req, res) => {
  const { url, mode, title } = req.query;

  const ssrf = validateUrl(url);
  if (!ssrf.valid) {
    return res.status(400).send('Invalid or restricted URL');
  }

  const isAudio = mode === 'mp3' || mode === 'audio';
  const cleanTitle = (title || 'media').replace(/[^a-zA-Z0-9_\- ]/g, '');
  const ext = isAudio ? 'mp3' : (mode && mode !== 'video' ? mode : 'mp4');
  const filename = `${cleanTitle}.${ext}`;

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

  // Proxy or pipe stream directly to enforce attachment disposition headers
  try {
    if (url.startsWith('http')) {
      const resolved = await resolveMedia(url, mode);
      const targetUrl = (resolved && resolved.download && resolved.download.directUrl) ? resolved.download.directUrl : null;
      
      if (targetUrl && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
        const fetchStream = await fetch(targetUrl);
        if (fetchStream.ok && fetchStream.body) {
          const { Readable } = require('stream');
          const nodeStream = Readable.fromWeb(fetchStream.body);
          return nodeStream.pipe(res);
        }
      }
    }
  } catch (e) {}

  let flags = ['-o', '-', '--no-warnings', '--no-colors'];
  if (isAudio) {
    flags.push('-f', 'bestaudio/best');
  } else {
    flags.push('-f', 'best[ext=mp4]/best');
  }
  flags.push(url);

  const ytdlpBinary = (ytdlp && ytdlp.constants && ytdlp.constants.YTDLP_PATH) ? ytdlp.constants.YTDLP_PATH : 'yt-dlp';
  
  let proc;
  try {
    proc = spawn(ytdlpBinary, flags);
  } catch (err) {
    return res.status(500).send('Stream extraction binary failed');
  }

  proc.stdout.pipe(res);

  proc.on('error', () => {
    if (!res.headersSent) {
      res.status(500).send('Media stream extraction error');
    }
  });

  proc.stderr.on('data', () => {});

  req.on('close', () => {
    try {
      if (proc) proc.kill();
    } catch (e) {}
  });
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
