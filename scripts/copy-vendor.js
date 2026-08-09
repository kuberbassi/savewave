'use strict';
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const vendor = path.join(root, 'public', 'vendor');
fs.mkdirSync(vendor, { recursive: true });
for (const [source, target] of [
  ['node_modules/react/umd/react.production.min.js', 'react.production.min.js'],
  ['node_modules/react-dom/umd/react-dom.production.min.js', 'react-dom.production.min.js']
]) fs.copyFileSync(path.join(root, source), path.join(vendor, target));
