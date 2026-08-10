const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const apiWindows = new Map();

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

const androidInstallers = {
  'Savewave-android-arm64.apk': 'https://github.com/kuberbassi/savewave/releases/latest/download/Savewave-android-arm64.apk'
};
app.get('/downloads/:filename', (req, res, next) => {
  const destination = androidInstallers[req.params.filename];
  if (!destination) return next();
  return res.redirect(307, destination);
});

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

// Media extraction intentionally never runs on Vercel. The browser uses the
// loopback-only Savewave Helper for resolve and download operations.
app.all(['/api/resolve', '/api/prepare-download', '/api/stream'], (_req, res) => {
  return res.status(410).json({
    error: 'Savewave Helper is required. Media extraction runs locally on your device.'
  });
});

app.use((error, req, res, next) => {
  if (!error) return next();
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
  if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ error: 'Malformed JSON request.' });
  return next(error);
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`Savewave web frontend running at http://localhost:${PORT}`));
}

module.exports = app;
