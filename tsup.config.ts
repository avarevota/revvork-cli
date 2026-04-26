import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  target: 'node20',
  outExtension: () => ({ js: '.cjs' }),
  banner: { js: '#!/usr/bin/env node' },
  clean: true,
  minify: false,
  shims: true,
});
