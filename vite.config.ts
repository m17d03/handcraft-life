import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// Basis-Transcoder für KTX2-Texturen (Ticket 012/013): liegt in three/examples/jsm/libs/basis/ und wird
// unter <base>basis/ ausgeliefert – ohne Kopie ins Repo (Version folgt automatisch dem gepinnten three).
const BASIS_QUELLE = resolve(import.meta.dirname, 'node_modules/three/examples/jsm/libs/basis');
const BASIS_DATEIEN = ['basis_transcoder.js', 'basis_transcoder.wasm'] as const;

function basisTranscoder(): Plugin {
  return {
    name: 'hcl-basis-transcoder',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pfad = (req.url ?? '').split('?')[0] ?? '';
        const datei = BASIS_DATEIEN.find((d) => pfad.endsWith(`/basis/${d}`));
        if (!datei) {
          next();
          return;
        }
        res.setHeader('Content-Type', datei.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        res.end(readFileSync(resolve(BASIS_QUELLE, datei)));
      });
    },
    generateBundle() {
      for (const datei of BASIS_DATEIEN) {
        this.emitFile({ type: 'asset', fileName: `basis/${datei}`, source: readFileSync(resolve(BASIS_QUELLE, datei)) });
      }
    },
  };
}

// base wird im Pages-Workflow per --base=/handcraft-life/ gesetzt.
export default defineConfig({
  plugins: [basisTranscoder()],
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'),
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // Multi-Page: Startseite, Spielseite (Ticket 010) + Engine-Spikes (Ticket 005), je Engine eigener Chunk.
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        spiel: resolve(import.meta.dirname, 'spiel/index.html'),
        'spike-babylon': resolve(import.meta.dirname, 'spikes/babylon/index.html'),
        'spike-playcanvas': resolve(import.meta.dirname, 'spikes/playcanvas/index.html'),
        'spike-three': resolve(import.meta.dirname, 'spikes/three/index.html'),
        'hud-demo': resolve(import.meta.dirname, 'hud-demo/index.html'),
      },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
