'use strict';

process.on('uncaughtException', (error) => {
  console.error(`Release preparation stopped: ${error.message}`);
  process.exitCode = 1;
});

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);
const pending = new Map();
const pkg = JSON.parse(read('package.json'));
const [major, minor, patch] = pkg.version.split('.').map(Number);
if (![major, minor, patch].every(Number.isSafeInteger) || patch >= 999) throw new Error('Cannot calculate next patch version.');
const next = process.argv.slice(2).find((argument) => argument !== '--check') || `${major}.${minor}.${patch + 1}`;
if (!/^\d+\.\d+\.\d+$/.test(next)) throw new Error('Usage: node scripts/prepare-release.js [MAJOR.MINOR.PATCH] [--check]');
const checkOnly = process.argv.includes('--check');
const nextParts = next.split('.').map(Number);
const versionCode = nextParts[0] * 1_000_000 + nextParts[1] * 1_000 + nextParts[2];
if (!Number.isSafeInteger(versionCode) || versionCode <= major * 1_000_000 + minor * 1_000 + patch) throw new Error('Android versionCode must increase.');

const changelog = read('CHANGELOG.md');
if (new RegExp(`^## v${next.replaceAll('.', '\\.')}\\b`, 'm').test(changelog)) throw new Error(`CHANGELOG.md already contains v${next}.`);
const section = changelog.match(/^## Unreleased(?: - ([^\r\n]+))?\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/m);
if (!section || !/^\s*[-*] \S/m.test(section[2])) throw new Error('Write at least one bullet under "## Unreleased" in CHANGELOG.md first.');
const summary = (section[1] || section[2].match(/^\s*[-*] (.+)$/m)?.[1] || '').trim();
if (!summary) throw new Error('The Unreleased entry needs a summary.');
if (checkOnly) {
  console.log(`Ready to prepare v${next}: ${summary}`);
  process.exit(0);
}

function replace(file, pattern, replacement) {
  const original = pending.get(file) || read(file);
  if (!pattern.test(original)) throw new Error(`Expected version marker missing in ${file}`);
  pending.set(file, original.replace(pattern, replacement));
}

replace('CHANGELOG.md', /^## Unreleased(?: - [^\r\n]+)?/m, `## v${next} - ${summary}`);
for (const file of ['package.json', 'package-lock.json']) {
  const data = JSON.parse(read(file));
  data.version = next;
  if (file === 'package-lock.json') data.packages[''].version = next;
  pending.set(file, `${JSON.stringify(data, null, 2)}\n`);
}
replace('android/app/build.gradle', /versionCode \d+/, `versionCode ${versionCode}`);
replace('android/app/build.gradle', /versionName "\d+\.\d+\.\d+"/, `versionName "${next}"`);
replace('android/app/src/main/java/com/kuberbassi/savewave/SavewaveMediaPlugin.java', /APP_VERSION = "\d+\.\d+\.\d+"/, `APP_VERSION = "${next}"`);
replace('src/desktop/main.ts', /CURRENT_VERSION = '\d+\.\d+\.\d+'/, `CURRENT_VERSION = '${next}'`);
replace('src/core/platform/web.ts', /version: '\d+\.\d+\.\d+'/, `version: '${next}'`);
replace('public/config.js', /version: '\d+\.\d+\.\d+'/, `version: '${next}'`);
const manifest = JSON.parse(read('public/client-version.json'));
manifest.version = next;
manifest.downloadUrl = `https://github.com/kuberbassi/savewave/releases/tag/v${next}`;
manifest.windowsDownloadUrl = `https://github.com/kuberbassi/savewave/releases/download/v${next}/Savewave_${next}_x64-setup.exe`;
manifest.androidDownloadUrl = `https://github.com/kuberbassi/savewave/releases/download/v${next}/Savewave-android-arm64.apk`;
manifest.summary = summary;
pending.set('public/client-version.json', `${JSON.stringify(manifest, null, 2)}\n`);
for (const [file, content] of pending) write(file, content);
console.log(`Prepared v${next}. Run npm.cmd run build and npm.cmd run check before committing.`);
