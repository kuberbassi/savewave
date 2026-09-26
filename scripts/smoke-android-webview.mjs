// Evaluate an expression inside a running Android WebView via an adb-forwarded DevTools port.
// Usage: node scripts/smoke-android-webview.mjs "Promise.resolve(1 + 1)"
let expression = process.argv[2];
if (expression === '--resolve') {
  expression = `(async () => {
    const engine = SavewaveCore.createMediaEngine();
    return await engine.resolveMedia(${JSON.stringify(process.argv[3])}, ${JSON.stringify(process.argv[4] ?? 'video')});
  })()`;
}
if (expression === '--download') {
  expression = `(async () => {
    const engine = SavewaveCore.createMediaEngine();
    const url = ${JSON.stringify(process.argv[3])};
    const mode = ${JSON.stringify(process.argv[4] ?? 'video')};
    const media = await engine.resolveMedia(url, mode);
    return await SavewaveCore.runDownload({ engine, media, originalUrl: url, mode, pollIntervalMs: 500 });
  })()`;
}
if (!expression) throw new Error('Pass a JavaScript expression to evaluate.');

const port = Number(process.env.SAVEWAVE_CDP_PORT || 9222);
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = targets.find((target) => target.type === 'page' &&
  (target.url === 'https://localhost/' || target.url.includes('/app.asar/public/native.html')));
if (!page) throw new Error(`Savewave WebView is not available on port ${port}.`);

const socket = new WebSocket(page.webSocketDebuggerUrl);
const timeout = setTimeout(() => {
  socket.close();
  throw new Error('WebView evaluation timed out.');
}, 180_000);

socket.addEventListener('open', () => {
  socket.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: { expression, awaitPromise: true, returnByValue: true },
  }));
});
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id !== 1) return;
  clearTimeout(timeout);
  socket.close();
  if (message.error || message.result?.exceptionDetails) {
    console.error(JSON.stringify(message.error ?? message.result.exceptionDetails));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(message.result?.result?.value ?? null));
  }
});
socket.addEventListener('error', (error) => {
  clearTimeout(timeout);
  console.error(error);
  process.exitCode = 1;
});
