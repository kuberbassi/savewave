'use strict';

const fs = require('fs');
const path = require('path');

const version = process.argv[2];
if (!/^\d{4}\.\d{2}\.\d{2}$/.test(version || '')) {
  throw new Error('Usage: node scripts/update-ytdlp-version.js YYYY.MM.DD');
}

const root = path.resolve(__dirname, '..');
const targets = [
  {
    file: 'scripts/prepare-sidecars.js',
    pattern: /(SAVEWAVE_YTDLP_VERSION \|\| ')\d{4}\.\d{2}\.\d{2}(';)/,
  },
  {
    file: 'src-tauri/android/savewave-media/src/main/java/com/kuberbassi/savewave/media/SavewaveMediaPlugin.kt',
    pattern: /(MINIMUM_ENGINE_VERSION = ")\d{4}\.\d{2}\.\d{2}"/,
    suffix: '"',
  },
];

for (const target of targets) {
  const absolute = path.join(root, target.file);
  const current = fs.readFileSync(absolute, 'utf8');
  if (!target.pattern.test(current)) throw new Error(`Could not find the yt-dlp pin in ${target.file}`);
  const updated = current.replace(target.pattern, `$1${version}${target.suffix || '$2'}`);
  fs.writeFileSync(absolute, updated);
  console.log(`${target.file}: yt-dlp ${version}`);
}
