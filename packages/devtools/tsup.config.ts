import { defineConfig } from 'tsup'

const sharedExternal = [
  '@umpire/core',
  '@umpire/reads',
  'react',
  'react/jsx-runtime',
]

export default defineConfig([
  // Standalone bundle — Preact inlined. For users without Preact.
  {
    clean: true,
    dts: true,
    entry: {
      index: 'src/index.ts',
    },
    external: sharedExternal,
    format: ['esm'],
    noExternal: [/^preact/],
    sourcemap: true,
  },
  // Slim + React — Preact external. Built together so slim.js and react.js
  // share a chunk, keeping register() and mount() on the same registry singleton.
  {
    dts: true,
    entry: {
      slim: 'src/slim.ts',
      react: 'entrypoints/react.ts',
    },
    external: [
      ...sharedExternal,
      'preact',
      'preact/hooks',
      'preact/jsx-runtime',
    ],
    format: ['esm'],
    sourcemap: true,
  },
])
