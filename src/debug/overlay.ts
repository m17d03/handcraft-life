import { FpsMeter } from './fps';
import './overlay.css';

const MAX_ERRORS = 5;

/** Zusatzzeilen (z. B. Speicherstatus, Ticket 013), auch vor dem Einbinden des Overlays setzbar. */
const zusatz = new Map<string, string>();
let zusatzEl: HTMLElement | null = null;

function zusatzZeichnen(): void {
  if (zusatzEl) zusatzEl.textContent = [...zusatz.values()].join('\n');
}

/** Setzt eine benannte Zeile im Debug-Overlay (null entfernt sie). Ohne Overlay nur gemerkt. */
export function setzeDebugZeile(schluessel: string, text: string | null): void {
  if (text === null) zusatz.delete(schluessel);
  else zusatz.set(schluessel, text);
  zusatzZeichnen();
}

// ---------- Fehler: ab Seitenstart gesammelt, damit sie auch beim späteren Einschalten sichtbar sind (Ticket 016)
const fehler: string[] = [];
let fehlerEl: HTMLOListElement | null = null;
let fehlerBox: HTMLElement | null = null;
let sammeltFehler = false;

function fehlerZeichnen(): void {
  if (!fehlerEl) return;
  fehlerEl.replaceChildren(
    ...fehler.map((t) => {
      const li = document.createElement('li');
      li.textContent = t;
      return li;
    }),
  );
  fehlerBox?.classList.toggle('has-errors', fehler.length > 0);
}

function fehlerMerken(text: string): void {
  fehler.push(text);
  while (fehler.length > MAX_ERRORS) fehler.shift();
  fehlerZeichnen();
}

/** Registriert die Fehler-Listener (einmalig, billig). Läuft auch ohne sichtbares Overlay. */
export function fehlerSammeln(): void {
  if (sammeltFehler) return;
  sammeltFehler = true;
  // capture: true, damit auch Ladefehler von Ressourcen (Bilder, Skripte) ankommen.
  window.addEventListener(
    'error',
    (event: Event) => {
      if (!(event instanceof ErrorEvent)) {
        const target = event.target;
        const src = target instanceof HTMLImageElement || target instanceof HTMLScriptElement ? target.src : '';
        fehlerMerken(`Ladefehler: ${src.split('/').pop() ?? 'Ressource'}`);
        return;
      }
      const where = event.filename ? ` (${event.filename.split('/').pop() ?? ''}:${String(event.lineno)})` : '';
      fehlerMerken(`${event.message}${where}`);
    },
    true,
  );
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason: unknown = event.reason;
    fehlerMerken(`Promise: ${reason instanceof Error ? reason.message : String(reason)}`);
  });
}

export interface DebugOverlayOptionen {
  /**
   * Spielseite (Ticket 016): klein, links mittig, unter der HUD-Ebene und ohne Berührungen – verdeckt nie
   * eine Taste. Ohne: Startseiten-Darstellung oben links.
   */
  kompakt?: boolean;
}

let overlay: { box: HTMLElement; sichtbar: (an: boolean) => void } | null = null;

/**
 * Kleines Debug-Overlay für das iPhone: fps, schlechtester Frame, Speicher, Fehler.
 * Eingebunden mit ?debug=1 oder über den Debug-Schalter (5× auf die Geldanzeige).
 */
export function installDebugOverlay(root: HTMLElement = document.body, opt: DebugOverlayOptionen = {}): HTMLElement {
  if (overlay) {
    overlay.sichtbar(true);
    return overlay.box;
  }
  fehlerSammeln();
  const box = document.createElement('div');
  box.id = 'debug-overlay';
  box.setAttribute('role', 'status');
  if (opt.kompakt) box.classList.add('debug-kompakt');
  const stats = document.createElement('div');
  stats.className = 'debug-stats';
  const info2 = document.createElement('div');
  info2.className = 'debug-zusatz';
  info2.style.whiteSpace = 'pre-line';
  zusatzEl = info2;
  zusatzZeichnen();
  const errors = document.createElement('ol');
  errors.className = 'debug-errors';
  fehlerEl = errors;
  fehlerBox = box;
  fehlerZeichnen();
  box.append(stats, info2, errors);
  root.append(box);

  const meter = new FpsMeter();
  const info = (): string =>
    `${String(window.innerWidth)}×${String(window.innerHeight)} @${String(window.devicePixelRatio)}x`;
  let lastRender = 0;
  let raf = 0;

  const loop = (now: number): void => {
    meter.tick(now);
    if (now - lastRender > 250) {
      lastRender = now;
      stats.textContent = `fps ${meter.fps.toFixed(0)} · max ${meter.worstFrameMs.toFixed(0)} ms · ${info()}`;
    }
    raf = requestAnimationFrame(loop);
  };
  const sichtbar = (an: boolean): void => {
    box.hidden = !an;
    cancelAnimationFrame(raf);
    raf = 0;
    if (an) {
      // Nach dem Einschalten neu messen: die Pause soll nicht als Ruckler zählen
      meter.reset();
      lastRender = 0;
      stats.textContent = `fps – · ${info()}`;
      raf = requestAnimationFrame(loop);
    }
  };
  overlay = { box, sichtbar };
  sichtbar(true);
  return box;
}

/** Schaltet das Overlay sichtbar/unsichtbar (bindet es beim ersten Einschalten ein). Ausgeblendet misst es nichts. */
export function debugOverlaySchalten(an: boolean, root: HTMLElement = document.body, opt: DebugOverlayOptionen = {}): void {
  if (an) installDebugOverlay(root, opt);
  else overlay?.sichtbar(false);
}

/** true, wenn das Overlay eingebunden und sichtbar ist. */
export function debugOverlaySichtbar(): boolean {
  return overlay !== null && !overlay.box.hidden;
}
