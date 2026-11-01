/**
 * Einstieg der Spielseite /spiel/ – Vertical Slice 0.1 (Ticket 013).
 * Lädt parallel Werkstatt (Three.js + Assets aus 012) und Spielstand (IndexedDB), legt das HUD darüber und
 * übergibt alles an die Spielsteuerung. Im Debug-Modus: `window.__view`, `window.__spiel`, Overlay mit
 * fps, Fehlern und Speicherstatus.
 */
import '../style.css';
import { neuerSpielzustand } from '../core/zustand';
import { IndexedDbAblage, Spielstand, type LadeAusgang } from '../core/save';
import { isDebugEnabled } from '../debug/fps';
import { installDebugOverlay, setzeDebugZeile } from '../debug/overlay';
import { standardKatalog } from '../modules';
import { installierePerf, PerfMonitor, perfGewuenscht } from '../perf/monitor';
import { leseAufloesungsParameter } from '../render/aufloesung';
import type { WerkstattViewDebug } from '../render/view-api';
import { erzeugeWerkstattView, hatWebGL2, SZENEN_ID } from '../render/werkstatt-view';
import { erstelleHud } from '../ui/hud';
import { Spiel, type SpielDebug } from './spiel';

declare global {
  interface Window {
    __view?: WerkstattViewDebug;
    __spiel?: SpielDebug;
  }
}

/** Version im Spielstand (Hülle `spielVersion`). */
export const SPIEL_VERSION = '0.1.0';

async function start(): Promise<void> {
  const suche = window.location.search;
  const params = new URLSearchParams(suche);
  const debugUrl = isDebugEnabled(suche);
  const debug = debugUrl || import.meta.env.DEV;
  const body = document.body;
  body.dataset['state'] = 'loading';
  if (debugUrl) installDebugOverlay();

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

  // Spielregeln und Spielstand: Laden beginnt sofort, parallel zum Aufbau der Werkstatt.
  const katalog = standardKatalog();
  if (katalog.fehler.length > 0) setzeDebugZeile('module', `Modulfehler: ${katalog.fehler.map((f) => `${f.modul}: ${f.grund}`).join('; ')}`);
  const spielstand = new Spielstand({ ablage: new IndexedDbAblage(), module: katalog.module, spielVersion: SPIEL_VERSION });
  const laden: Promise<LadeAusgang> = spielstand.laden();

  // Messung VOR dem WebGL-Kontext installieren (GL-Zählhülle)
  const perf: PerfMonitor | null = perfGewuenscht(suche, import.meta.env.DEV)
    ? installierePerf({ engine: 'three', engineVersion: '', scene: SZENEN_ID, aa: 'none', msaaSamples: 0 })
    : null;
  perf?.beobachteCanvas(canvas);

  melde('Werkstatt wird aufgebaut …');
  let view: WerkstattViewDebug;
  let ersterFrame = false;
  let spielBereit = false;
  const bereitPruefen = (): void => {
    if (!ersterFrame || !spielBereit || body.dataset['state'] === 'ready') return;
    melde('');
    body.dataset['state'] = 'ready';
    perf?.spielbar();
  };
  try {
    view = await erzeugeWerkstattView(canvas, {
      perf,
      aufloesung: leseAufloesungsParameter(suche),
      assetBasis: import.meta.env.BASE_URL,
      // ?test=1 (nur mit Debug): Kamerafahrten ohne Dauer – verkürzt E2E-Wartezeiten, nicht den Ablauf (QA F9)
      ...(debug && params.has('test') ? { kamerafahrtMs: 0 } : {}),
      beiAssetFehler: (e) => {
        // Spiel bleibt spielbar (Platzhalter-Modelle); sichtbar im Debug-Overlay
        setzeDebugZeile('assets', `Assets nicht geladen: ${e instanceof Error ? e.message : String(e)}`);
      },
      beiBereit: () => {
        ersterFrame = true;
        bereitPruefen();
      },
    });
    if (debug) window.__view = view;
  } catch (err) {
    melde(`Fehler beim Aufbau: ${err instanceof Error ? err.message : String(err)}`, true);
    body.dataset['state'] = 'error';
    throw err;
  }

  const ausgang = await laden;
  // Saat: im Debug-Modus per ?saat=… festlegbar (reproduzierbare Tests), sonst zufällig
  const saatParam = debug ? Number(params.get('saat')) : Number.NaN;
  const saat = Number.isFinite(saatParam) && params.has('saat') ? saatParam : Math.floor(Math.random() * 2 ** 32);
  const zustand = ausgang.art === 'geladen' ? ausgang.zustand : neuerSpielzustand(katalog, saat);

  let spiel: Spiel | null = null;
  const hud = erstelleHud(body, {
    emit: (b) => spiel?.befehl(b),
    canvas,
    safeAreaSimulieren: params.has('notch'),
  });
  spiel = new Spiel({
    katalog,
    view,
    hud,
    spielstand,
    zustand,
    ladeAusgang: ausgang,
    ...(debugUrl ? { debugZeile: setzeDebugZeile } : {}),
  });
  if (debug) window.__spiel = spiel;
  // Speicher-Persistenz (ADR 0003): versuchen, Ergebnis im Debug-Overlay (Spielstand.status().dauerhaft)
  void spielstand.persist().then((e) => {
    setzeDebugZeile('persist', `persist(): ${e}`);
  });
  spielBereit = true;
  bereitPruefen();
}

void start();
