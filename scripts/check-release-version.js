'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const version = JSON.parse(read('package.json')).version;
const escaped = version.replaceAll('.', '\\.');
const [major, minor, patch] = version.split('.').map(Number);
const androidVersionCode = major * 1_000_000 + minor * 1_000 + patch;
const failures = [];

function requireMatch(file, pattern, description) {
  if (!pattern.test(read(file))) failures.push(`${file}: ${description}`);
}

requireMatch('package-lock.json', new RegExp(`"version": "${escaped}"`), 'root version differs');
requireMatch('src-tauri/Cargo.toml', new RegExp(`^version = "${escaped}"$`, 'm'), 'package version differs');
requireMatch('src-tauri/Cargo.lock', new RegExp(`name = "savewave"\\r?\\nversion = "${escaped}"`), 'Savewave package version differs');
requireMatch('src-tauri/tauri.conf.json', new RegExp(`"version": "${escaped}"`), 'application version differs');
requireMatch('src-tauri/gen/android/app/tauri.properties', new RegExp(`^tauri\\.android\\.versionName=${escaped}$`, 'm'), 'Android versionName differs');
requireMatch('src-tauri/gen/android/app/tauri.properties', new RegExp(`^tauri\\.android\\.versionCode=${androidVersionCode}$`, 'm'), 'Android versionCode differs');
requireMatch('src-tauri/android/savewave-media/src/main/java/com/kuberbassi/savewave/media/SavewaveMediaPlugin.kt', new RegExp(`put\\("version", "${escaped}"\\)`), 'Android plugin version differs');
requireMatch('public/config.js', new RegExp(`version: ['"]${escaped}['"]`), 'footer/config version differs');
requireMatch('src/core/platform/android.ts', new RegExp(`CURRENT_VERSION = '${escaped}'`), 'Android client version differs');
requireMatch('src/core/platform/web.ts', new RegExp(`version: '${escaped}'`), 'web client version differs');
requireMatch('public/core.js', new RegExp(`CURRENT_VERSION = "${escaped}"`), 'generated browser core is stale; run npm run build');
requireMatch('CHANGELOG.md', new RegExp(`^## v${escaped}\\b`, 'm'), 'current release entry is missing');

const manifest = JSON.parse(read('public/client-version.json'));
if (manifest.version !== version) failures.push('public/client-version.json: version differs');
for (const key of ['downloadUrl', 'androidDownloadUrl']) {
  const value = manifest[key];
  if (typeof value !== 'string' || !value.includes(`v${version}`)) {
    failures.push(`public/client-version.json: ${key} does not target v${version}`);
  }
}
if (typeof manifest.windowsDownloadUrl !== 'string' || !manifest.windowsDownloadUrl.includes(`Savewave_${version}_`)) {
  failures.push(`public/client-version.json: windowsDownloadUrl does not name v${version}`);
}

const desktopEngine = read('scripts/prepare-sidecars.js').match(/SAVEWAVE_YTDLP_VERSION \|\| '(\d{4}\.\d{2}\.\d{2})'/)?.[1];
const androidEngine = read('src-tauri/android/savewave-media/src/main/java/com/kuberbassi/savewave/media/SavewaveMediaPlugin.kt')
  .match(/MINIMUM_ENGINE_VERSION = "(\d{4}\.\d{2}\.\d{2})"/)?.[1];
if (!desktopEngine || desktopEngine !== androidEngine) {
  failures.push(`yt-dlp pins differ (desktop ${desktopEngine || 'missing'}, Android ${androidEngine || 'missing'})`);
}

if (failures.length) {
  console.error(`Release version drift detected for v${version}:`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Release metadata is synchronized at v${version} (Android versionCode ${androidVersionCode}).`);
