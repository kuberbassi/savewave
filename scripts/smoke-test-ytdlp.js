'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const binary = require('yt-dlp-exec/src/constants').YOUTUBE_DL_PATH;
const ffmpeg = require('ffmpeg-static');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'savewave-ytdlp-smoke-'));
const urls = process.env.SAVEWAVE_SMOKE_TEST_URL
  ? [process.env.SAVEWAVE_SMOKE_TEST_URL]
  : [
      'https://www.youtube.com/watch?v=jNQXAC9IVRw',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    ];

try {
  const diagnostics = [];
  for (const [index, url] of urls.entries()) {
    const attempt = path.join(directory, String(index));
    fs.mkdirSync(attempt);
    const result = spawnSync(binary, [
      '--no-playlist',
      '--force-ipv4',
      '--extractor-args', 'youtube:player_client=default,-android_sdkless',
      '--format', 'worstvideo[ext=mp4]+worstaudio[ext=m4a]/worstvideo+worstaudio',
      '--ffmpeg-location', ffmpeg,
      '--max-filesize', '20M',
      '--output', path.join(attempt, 'smoke.%(ext)s'),
      url,
    ], { encoding: 'utf8', timeout: 120_000 });

    const files = fs.readdirSync(attempt).filter((file) => !file.endsWith('.part'));
    const bytes = files.reduce((total, file) => total + fs.statSync(path.join(attempt, file)).size, 0);
    if (result.status === 0 && !result.error && bytes > 0) {
      console.log(`Real yt-dlp transfer passed (${bytes} bytes from test source ${index + 1}).`);
      process.exitCode = 0;
      return;
    }
    diagnostics.push((result.stderr || result.stdout || result.error?.message || 'no output').trim());
  }
  throw new Error(`All real yt-dlp transfer sources failed:\n${diagnostics.join('\n---\n')}`);
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
