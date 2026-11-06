import type { Page } from '@playwright/test';
import type {} from '../../src/perf/perf-snapshot';
import type { WerkstattViewDebug } from '../../src/render/view-api';

declare global {
  interface Window {
    __view?: WerkstattViewDebug;
  }
}

// Ticket 018: Diagnose für WebKit in CI (lokal nicht verfügbar). Landet in Fehlermeldungen und – in CI – als
// öffentliche Annotation am Check-Run (GitHub-Workflow-Befehl auf stdout), damit ein einziger Lauf die Ursache zeigt.

/** Momentaufnahme von Seite, View und Messung; `zeitreiheMs` > 0 tastet zusätzlich Frames/Draw Calls ab. */
export async function diagnose(page: Page, zeitreiheMs = 0): Promise<Record<string, unknown>> {
  try {
    return await page.evaluate(async (dauer) => {
      const probe = (): number[] => {
        const p = window.__perf?.();
        const z = window.__view?.zustand();
        return [Math.round(performance.now()), z?.frames ?? -1, p?.drawCalls ?? -1, p?.triangles ?? -1];
      };
      const reihe: number[][] = [];
      for (let t = 0; t < dauer; t += 500) {
        reihe.push(probe());
        await new Promise((r) => setTimeout(r, 500));
      }
      const z = window.__view?.zustand();
      const p = window.__perf?.();
      return {
        ua: navigator.userAgent,
        plattform: navigator.platform,
        dpr: window.devicePixelRatio,
        fenster: [window.innerWidth, window.innerHeight],
        state: document.body.dataset['state'] ?? null,
        status: document.querySelector('#spiel-status')?.textContent ?? null,
        overlay: document.querySelector('#debug-overlay')?.textContent ?? null,
        view: z ? { bereit: z.bereit, frames: z.frames, kontextVerloren: z.kontextVerloren, assets: z.assets, fahrt: z.fahrt, ...z.diagnose } : null,
        perf: p
          ? {
              fps: p.fps,
              frames: p.frames,
              p50: p.frameTimeMsP50,
              max: p.frameTimeMsMax,
              drawCalls: p.drawCalls,
              triangles: p.triangles,
              ttff: p.timeToFirstFrameMs,
              spielbar: p.timeToPlayableMs,
              render: [p.renderWidth, p.renderHeight],
              aa: p.aa,
              msaa: p.msaaSamples,
              texMB: p.textureMemoryMB,
              fehler: p.errorCount,
              kontextVerluste: p.contextLostCount,
            }
          : null,
        reihe: reihe.length > 0 ? ['t,frames,drawCalls,triangles', ...reihe.map((r) => r.join(','))] : undefined,
      };
    }, zeitreiheMs);
  } catch (e) {
    return { diagnoseFehler: e instanceof Error ? e.message : String(e) };
  }
}

/** Schreibt eine Diagnose-Zeile; in GitHub Actions als Annotation (öffentlich über die Check-Run-API lesbar). */
export function notiz(titel: string, daten: unknown, art: 'notice' | 'warning' = 'notice'): void {
  const text = JSON.stringify(daten);
  if (process.env['GITHUB_ACTIONS'] === 'true') {
    const esc = (s: string): string => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
    const t = esc(titel).replace(/:/g, '%3A').replace(/,/g, '%2C');
    console.log(`::${art} title=${t}::${esc(text)}`);
  } else {
    console.log(`[diagnose] ${titel}: ${text}`);
  }
}
