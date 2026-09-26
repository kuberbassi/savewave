'use strict';

const path = require('path');
const { buildSync } = require('esbuild');

buildSync({
  entryPoints: {
    main: path.join(process.cwd(), 'src', 'desktop', 'main.ts'),
    preload: path.join(process.cwd(), 'src', 'desktop', 'preload.ts'),
  },
  outdir: path.join(process.cwd(), 'dist-electron'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  sourcemap: true,
  external: ['electron'],
});
