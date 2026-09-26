'use strict';

const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');

const generated = [
  'public/app.js', 'public/landing.js', 'public/core.js', 'public/dist.css',
  'public/vendor/react.production.min.js', 'public/vendor/react-dom.production.min.js'
];
const digest = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const before = new Map(generated.map((file) => [file, digest(file)]));
const result = process.platform === 'win32'
  ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm.cmd run build'], { stdio: 'inherit' })
  : spawnSync('npm', ['run', 'build'], { stdio: 'inherit' });
if (result.error) {
  console.error(`Could not run the production build: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status || 1);
const stale = generated.filter((file) => digest(file) !== before.get(file));
if (stale.length) {
  console.error(`Generated files were stale before the build:\n${stale.map((file) => `- ${file}`).join('\n')}`);
  console.error('Commit the regenerated files and rerun the check.');
  process.exit(1);
}
console.log('Generated browser assets are current.');
