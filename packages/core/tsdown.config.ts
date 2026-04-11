import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: { 'index.browser': 'src/index.ts' },
    format: ['esm'],
    platform: 'browser',
    outDir: 'dist',
    clean: false,
    dts: false,
    minify: true,
    sourcemap: true,
  },
  {
    entry: { 'index': 'src/index.ts' },
    format: ['iife'],
    globalName: 'Umpire',
    platform: 'browser',
    outDir: 'dist',
    clean: false,
    dts: false,
    minify: true,
    sourcemap: true,
  },
])
