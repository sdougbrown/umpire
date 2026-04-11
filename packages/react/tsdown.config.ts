import { defineConfig } from 'tsdown'

export default defineConfig([
  // Externalized ESM — user provides React + core
  {
    entry: { 'index.browser': 'src/index.ts' },
    format: ['esm'],
    platform: 'browser',
    deps: { neverBundle: ['react', '@umpire/core'] },
    outDir: 'dist',
    clean: false,
    dts: false,
    minify: true,
    sourcemap: true,
  },
  // Externalized IIFE — user provides React + core via script tags
  {
    entry: { 'index': 'src/index.ts' },
    format: ['iife'],
    globalName: 'UmpireReact',
    platform: 'browser',
    deps: { neverBundle: ['react', '@umpire/core'] },
    outputOptions: {
      globals: { react: 'React', '@umpire/core': 'Umpire' },
    },
    outDir: 'dist',
    clean: false,
    dts: false,
    minify: true,
    sourcemap: true,
  },
  // Bundled convenience build — core inlined, only React external
  // Fewer script tags for CodePen / quick demos
  {
    entry: { 'umpire-react.bundle': 'src/index.ts' },
    format: ['iife'],
    globalName: 'UmpireReact',
    platform: 'browser',
    deps: {
      neverBundle: ['react'],
      alwaysBundle: ['@umpire/core'],
    },
    outputOptions: {
      globals: { react: 'React' },
    },
    outDir: 'dist',
    clean: false,
    dts: false,
    minify: true,
    sourcemap: true,
  },
])
