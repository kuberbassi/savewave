'use strict';

const fs = require('fs');
const path = require('path');

const source = path.join(process.cwd(), 'public');
const destination = path.join(process.cwd(), 'dist-capacitor');

fs.rmSync(destination, { recursive: true, force: true });
fs.cpSync(source, destination, { recursive: true });
fs.copyFileSync(path.join(source, 'native.html'), path.join(destination, 'index.html'));
for (const sourceOnlyFile of ['app.jsx', 'landing.jsx', 'native.html']) {
  fs.rmSync(path.join(destination, sourceOnlyFile), { force: true });
}
