import { FpsMeter } from './fps';

const MAX_ERRORS = 5;

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
  const errors = document.createElement('ol');
  errors.className = 'debug-errors';
  box.append(stats, errors);
  root.append(box);

  const meter = new FpsMeter();
  const info = `${String(window.innerWidth)}×${String(window.innerHeight)} @${String(window.devicePixelRatio)}x`;
  let lastRender = 0;

  const loop = (now: number): void => {
    meter.tick(now);
    if (now - lastRender > 250) {
      lastRender = now;
      stats.textContent = `fps ${meter.fps.toFixed(0)} · max ${meter.worstFrameMs.toFixed(0)} ms · ${info}`;
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

  window.addEventListener('error', (event) => {
    const where = event.filename ? ` (${event.filename.split('/').pop() ?? ''}:${String(event.lineno)})` : '';
    addError(`${event.message}${where}`);
  });
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason: unknown = event.reason;
    addError(`Promise: ${reason instanceof Error ? reason.message : String(reason)}`);
  });

  return box;
}
