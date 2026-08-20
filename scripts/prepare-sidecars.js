'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const triples = {
  'win32-x64': 'x86_64-pc-windows-msvc', 'win32-arm64': 'aarch64-pc-windows-msvc',
  'darwin-x64': 'x86_64-apple-darwin', 'darwin-arm64': 'aarch64-apple-darwin',
  'linux-x64': 'x86_64-unknown-linux-gnu', 'linux-arm64': 'aarch64-unknown-linux-gnu'
};
const target = process.env.TAURI_ENV_TARGET_TRIPLE || triples[`${process.platform}-${process.arch}`];
if (!target) throw new Error(`Unsupported desktop sidecar target: ${process.platform}-${process.arch}`);

const directory = path.join(process.cwd(), 'src-tauri', 'binaries');
fs.mkdirSync(directory, { recursive: true });
const extension = process.platform === 'win32' ? '.exe' : '';
const ytDlp = require('yt-dlp-exec/src/constants').YOUTUBE_DL_PATH;
const ffmpeg = require('ffmpeg-static');
if (!ytDlp || !fs.existsSync(ytDlp)) throw new Error('Managed yt-dlp binary is unavailable. Run npm install.');
if (!ffmpeg || !fs.existsSync(ffmpeg)) throw new Error('Managed FFmpeg binary is unavailable. Run npm install.');

const ytDlpVersion = process.env.SAVEWAVE_YTDLP_VERSION || '2026.08.19';
const update = spawnSync(ytDlp, ['--update-to', `stable@${ytDlpVersion}`], { encoding: 'utf8' });
if (update.status !== 0) {
  throw new Error(`Could not prepare yt-dlp ${ytDlpVersion}: ${(update.stderr || update.stdout || '').trim()}`);
}
const installedVersion = spawnSync(ytDlp, ['--version'], { encoding: 'utf8' });
if (installedVersion.status !== 0 || installedVersion.stdout.trim() !== ytDlpVersion) {
  throw new Error(`Expected yt-dlp ${ytDlpVersion}, received ${installedVersion.stdout.trim() || 'unknown'}`);
}
console.log(`Verified yt-dlp ${ytDlpVersion}`);

for (const [name, source] of [['yt-dlp', ytDlp], ['ffmpeg', ffmpeg]]) {
  const destination = path.join(directory, `${name}-${target}${extension}`);
  fs.copyFileSync(source, destination);
  if (process.platform !== 'win32') fs.chmodSync(destination, 0o755);
  console.log(`Prepared ${path.basename(destination)}`);
}
