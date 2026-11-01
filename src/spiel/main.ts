/**
 * Vorläufiger Einstieg der Spielseite /spiel/ (Ticket 010; 013 verdrahtet Eingabe, HUD und Logik).
 * Zeigt die Werkstatt, bindet Debug-Overlay und Messung ein und stellt im Debug-Modus
 * `window.__view` (WerkstattView + Zustand) bereit.
 */
import '../style.css';
import { isDebugEnabled } from '../debug/fps';
import { installDebugOverlay } from '../debug/overlay';
import { installierePerf, PerfMonitor, perfGewuenscht } from '../perf/monitor';
import { leseAufloesungsParameter } from '../render/aufloesung';
import type { WerkstattViewDebug } from '../render/view-api';
import { erzeugeWerkstattView, hatWebGL2, SZENEN_ID } from '../render/werkstatt-view';

declare global {
  interface Window {
    __view?: WerkstattViewDebug;
  }
}

async function start(): Promise<void> {
  const suche = window.location.search;
  const debug = isDebugEnabled(suche) || import.meta.env.DEV;
  const body = document.body;
  body.dataset['state'] = 'loading';
  if (isDebugEnabled(suche)) installDebugOverlay();

  const status = document.querySelector<HTMLElement>('#spiel-status');
  const canvas = document.querySelector<HTMLCanvasElement>('#scene');
  if (!canvas) throw new Error('Canvas #scene fehlt');
  const melde = (text: string, fehler = false): void => {
    if (!status) return;
    status.textContent = text;
    status.classList.toggle('fehler', fehler);
    status.hidden = text === '';
  };

  if (!hatWebGL2()) {
    melde('WebGL 2 nicht verfügbar – das Spiel braucht WebGL 2.', true);
    body.dataset['state'] = 'no-webgl2';
    return;
  }

  // Messung VOR dem WebGL-Kontext installieren (GL-Zählhülle)
  const perf: PerfMonitor | null = perfGewuenscht(suche, import.meta.env.DEV)
    ? installierePerf({ engine: 'three', engineVersion: '', scene: SZENEN_ID, aa: 'none', msaaSamples: 0 })
    : null;
  perf?.beobachteCanvas(canvas);

  melde('Werkstatt wird aufgebaut …');
  try {
    const view = await erzeugeWerkstattView(canvas, {
      perf,
      aufloesung: leseAufloesungsParameter(suche),
      assetBasis: import.meta.env.BASE_URL,
      beiAssetFehler: (e) => { console.warn('Assets nicht geladen, Platzhalter aktiv:', e); },
      beiBereit: () => {
        melde('');
        body.dataset['state'] = 'ready';
        perf?.spielbar();
      },
    });
    if (debug) window.__view = view;
  } catch (err) {
    melde(`Fehler beim Aufbau: ${err instanceof Error ? err.message : String(err)}`, true);
    body.dataset['state'] = 'error';
    throw err;
  }
}

void start();
