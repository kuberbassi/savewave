'use strict';
const path = require('path');
require('esbuild').buildSync({
  entryPoints: [path.join(process.cwd(), 'src', 'core', 'index.ts')],
  outfile: path.join(process.cwd(), 'public', 'core.js'),
  bundle: true,
  format: 'iife',
  globalName: 'SavewaveCore'
});
