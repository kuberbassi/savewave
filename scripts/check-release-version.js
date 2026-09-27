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

const lock = JSON.parse(read('package-lock.json'));
if (lock.version !== version || lock.packages?.['']?.version !== version) {
  failures.push('package-lock.json: root package versions differ');
}
requireMatch('android/app/build.gradle', new RegExp(`versionName "${escaped}"`), 'Android versionName differs');
requireMatch('android/app/build.gradle', new RegExp(`versionCode ${androidVersionCode}\\b`), 'Android versionCode differs');
requireMatch('android/app/src/main/java/com/kuberbassi/savewave/SavewaveMediaPlugin.java', new RegExp(`APP_VERSION = "${escaped}"`), 'Android plugin version differs');
requireMatch('src/desktop/main.ts', new RegExp(`CURRENT_VERSION = '${escaped}'`), 'desktop version differs');
requireMatch('public/config.js', new RegExp(`version: ['"]${escaped}['"]`), 'footer/config version differs');
requireMatch('src/core/platform/web.ts', new RegExp(`version: '${escaped}'`), 'web client version differs');
requireMatch('public/core.js', new RegExp(`version: "${escaped}"`), 'generated browser core is stale; run npm run build');
requireMatch('CHANGELOG.md', new RegExp(`^## v${escaped}\\b`, 'm'), 'current release entry is missing');

const manifest = JSON.parse(read('public/client-version.json'));
if (manifest.version !== version) failures.push('public/client-version.json: version differs');
const releaseRoot = 'https://github.com/kuberbassi/savewave/releases';
if (manifest.downloadUrl !== `${releaseRoot}/tag/v${version}`) failures.push('public/client-version.json: release page URL differs');
if (manifest.windowsDownloadUrl !== `${releaseRoot}/download/v${version}/Savewave_${version}_x64-setup.exe`) {
  failures.push('public/client-version.json: Windows installer URL differs');
}
if (manifest.androidDownloadUrl !== `${releaseRoot}/download/v${version}/Savewave-android-arm64.apk`) {
  failures.push('public/client-version.json: Android APK URL differs');
}

const desktopEngine = read('scripts/prepare-sidecars.js').match(/SAVEWAVE_YTDLP_VERSION \|\| '(\d{4}\.\d{2}\.\d{2})'/)?.[1];
if (!desktopEngine) failures.push('Desktop yt-dlp pin is missing');

if (failures.length) {
  console.error(`Release version drift detected for v${version}:`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Release metadata is synchronized at v${version} (Android versionCode ${androidVersionCode}).`);
