import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'src/core/media/{contracts,download,errors,filename,quality,state}.ts',
        'src/core/sources/detectSource.ts',
        'src/core/spotify/{matcher,search-runtime}.js',
      ],
      thresholds: { lines: 75, functions: 75, statements: 75, branches: 65 },
    },
  },
});
