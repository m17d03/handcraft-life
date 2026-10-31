import './style.css';
import { isDebugEnabled } from './debug/fps';
import { installDebugOverlay } from './debug/overlay';

if (isDebugEnabled(window.location.search)) {
  installDebugOverlay();
}

function hasWebGL2(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

const webgl = document.querySelector<HTMLElement>('#webgl-status');
if (webgl) {
  const ok = hasWebGL2();
  webgl.textContent = ok ? 'WebGL 2 verfügbar ✓' : 'WebGL 2 nicht verfügbar ✗';
  webgl.dataset['ok'] = String(ok);
}

const build = document.querySelector<HTMLElement>('#build-info');
if (build) build.textContent = `Build ${__BUILD_TIME__}`;
