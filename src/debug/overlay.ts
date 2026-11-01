import { FpsMeter } from './fps';

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

/**
 * Kleines Debug-Overlay für das iPhone: fps, schlechtester Frame, Fehler.
 * Wird nur mit ?debug=1 eingebunden.
 */
export function installDebugOverlay(root: HTMLElement = document.body): HTMLElement {
  const box = document.createElement('div');
  box.id = 'debug-overlay';
  box.setAttribute('role', 'status');
  const stats = document.createElement('div');
  stats.className = 'debug-stats';
  const info2 = document.createElement('div');
  info2.className = 'debug-zusatz';
  info2.style.whiteSpace = 'pre-line';
  zusatzEl = info2;
  zusatzZeichnen();
  const errors = document.createElement('ol');
  errors.className = 'debug-errors';
  box.append(stats, info2, errors);
  root.append(box);

  const meter = new FpsMeter();
  const info = (): string =>
    `${String(window.innerWidth)}×${String(window.innerHeight)} @${String(window.devicePixelRatio)}x`;
  let lastRender = 0;

  const loop = (now: number): void => {
    meter.tick(now);
    if (now - lastRender > 250) {
      lastRender = now;
      stats.textContent = `fps ${meter.fps.toFixed(0)} · max ${meter.worstFrameMs.toFixed(0)} ms · ${info()}`;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const addError = (text: string): void => {
    const item = document.createElement('li');
    item.textContent = text;
    errors.append(item);
    while (errors.children.length > MAX_ERRORS) errors.firstElementChild?.remove();
    box.classList.add('has-errors');
  };

  // capture: true, damit auch Ladefehler von Ressourcen (Bilder, Skripte) ankommen.
  window.addEventListener(
    'error',
    (event: Event) => {
      if (!(event instanceof ErrorEvent)) {
        const target = event.target;
        const src = target instanceof HTMLImageElement || target instanceof HTMLScriptElement ? target.src : '';
        addError(`Ladefehler: ${src.split('/').pop() ?? 'Ressource'}`);
        return;
      }
      const where = event.filename ? ` (${event.filename.split('/').pop() ?? ''}:${String(event.lineno)})` : '';
      addError(`${event.message}${where}`);
    },
    true,
  );
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason: unknown = event.reason;
    addError(`Promise: ${reason instanceof Error ? reason.message : String(reason)}`);
  });

  return box;
}
