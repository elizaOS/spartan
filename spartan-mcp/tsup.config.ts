import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  platform: 'node',
  target: 'node20',
  minify: false,
  splitting: false,
  treeshake: true,
  shims: true,
  banner: {
    js: '#!/usr/bin/env node'
  }
});

