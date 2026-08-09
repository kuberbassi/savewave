const [, , socketUrl, expression] = process.argv;

if (!socketUrl || !expression) {
  throw new Error('Usage: node scripts/inspect-android-webview.mjs <websocket-url> <expression>');
}

const socket = new WebSocket(socketUrl);
socket.addEventListener('open', () => {
  socket.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: { expression, awaitPromise: true, returnByValue: true },
  }));
});
socket.addEventListener('message', ({ data }) => {
  console.log(data);
  socket.close();
});
