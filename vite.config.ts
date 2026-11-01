import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// base wird im Pages-Workflow per --base=/handcraft-life/ gesetzt.
export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'),
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // Multi-Page: Startseite + Engine-Spikes (Ticket 005), je Engine eigener Chunk.
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        'spike-babylon': resolve(import.meta.dirname, 'spikes/babylon/index.html'),
        'spike-playcanvas': resolve(import.meta.dirname, 'spikes/playcanvas/index.html'),
        'spike-three': resolve(import.meta.dirname, 'spikes/three/index.html'),
      },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
