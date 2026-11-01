/**
 * Gemeinsamer Rahmen der drei Spike-Seiten: Parameter, Debug-Overlay, Messung, HUD, Steuerung,
 * Kamera und Balken-Interaktion. Die Engine steckt nur im Adapter (spikes/<engine>/main.ts) –
 * so bleibt alles ausser dem Rendern identisch und der Vergleich fair.
 */
import '../../src/style.css';
import './spike.css';
import { installDebugOverlay } from '../../src/debug/overlay';
import type {} from './debug-api';
import { BeamInteraction } from './interaction';
import { projectToScreen, screenRay, type Vec3 } from './math';
import { DynamicResolution, parseSpikeParams, type SpikeParams } from './params';
import { exposePerf, installGlHooks, PerfMonitor, type AaMode } from './perf';
import { FirstPersonController } from './player';
import { BEAM_AABB, BEAM_CENTER, BENCH_FOOTPRINT, CAMERA, ROOM } from './scene-spec';
import { TouchControls } from './controls';
import { generateWoodTextures, type WoodTextures } from './textures';

export interface SceneContext {
  readonly textures: WoodTextures;
  readonly params: SpikeParams;
  readonly pixelRatio: number;
  readonly cssWidth: number;
  readonly cssHeight: number;
}

export interface EngineAdapter {
  readonly engine: 'babylon' | 'playcanvas' | 'three';
  readonly version: string;
  /** Szene aufbauen; liefert das tatsächlich verwendete AA-Verfahren. */
  init(canvas: HTMLCanvasElement, ctx: SceneContext): Promise<{ aa: AaMode; msaaSamples: number; note?: string }>;
  resize(cssWidth: number, cssHeight: number, pixelRatio: number): void;
  setCamera(eye: Vec3, forward: Vec3, fovY: number): void;
  setBeamHighlight(on: boolean): void;
  setCutLine(x: number | null): void;
  /** Render-Schleife der Engine starten; onFrame wird vor jedem Rendern aufgerufen. */
  start(onFrame: (nowMs: number) => void): void;
}

const SCENE_ID = 'spike-werkstatt';
const ENGINES = ['babylon', 'playcanvas', 'three'] as const;

function hasWebGL2(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export async function runSpike(adapter: EngineAdapter): Promise<void> {
  const params = parseSpikeParams(window.location.search);
  document.body.classList.add('spike');
  document.body.dataset['state'] = 'loading';
  if (params.debug) installDebugOverlay();

  const perfActive = params.perf || import.meta.env.DEV;
  if (perfActive) installGlHooks();
  const monitor = perfActive
    ? new PerfMonitor({ engine: adapter.engine, engineVersion: adapter.version, scene: SCENE_ID, aa: 'none', msaaSamples: 0 })
    : null;
  if (monitor) exposePerf(monitor);

  // ---- DOM
  const stage = h('div', 'stage');
  const canvas = h('canvas', 'scene');
  canvas.id = 'scene';
  const touch = h('div', 'touch');
  touch.dataset['touch'] = 'scene';
  const hud = h('div', 'hud');
  const crosshair = h('div', 'crosshair');
  const top = h('div', 'hud-top');
  const title = h('div', 'hud-title', `${adapter.engine} ${adapter.version}`);
  const nav = h('nav', 'hud-nav');
  const back = h('a', 'hud-btn', '‹ Start');
  back.href = '../../';
  nav.append(back);
  for (const e of ENGINES) {
    if (e === adapter.engine) continue;
    const a = h('a', 'hud-btn', e);
    a.href = `../${e}/${window.location.search}`;
    nav.append(a);
  }
  top.append(title, nav);
  const status = h('div', 'hud-status', 'Lädt …');
  status.setAttribute('role', 'status');
  const hint = h('div', 'hud-hint', 'Links: gehen · rechts: umsehen · Balken antippen');
  const stats = h('div', 'hud-stats');
  const portrait = h('div', 'portrait-hint', 'Am besten quer halten');
  hud.append(crosshair, top, status, hint, portrait);
  if (params.debug) hud.append(stats);
  stage.append(canvas, touch, hud);
  document.body.append(stage);

  const fail = (msg: string): void => {
    status.textContent = msg;
    status.classList.add('error');
    document.body.dataset['state'] = 'error';
  };

  if (!hasWebGL2()) {
    fail('WebGL 2 nicht verfügbar – dieser Spike braucht WebGL 2.');
    document.body.dataset['state'] = 'no-webgl2';
    return;
  }

  // ---- Auflösung
  const cssSize = (): { w: number; h: number } => ({ w: Math.max(1, stage.clientWidth), h: Math.max(1, stage.clientHeight) });
  const cappedDpr = (): number => Math.min(window.devicePixelRatio || 1, params.dprCap);
  const dyn = params.dynamicResolution ? new DynamicResolution(Math.min(1.5, cappedDpr()), cappedDpr()) : null;
  const pixelRatio = (): number => (dyn ? Math.min(dyn.ratio, cappedDpr()) : cappedDpr());

  // ---- Laden
  status.textContent = 'Erzeuge Holztextur …';
  await new Promise((r) => requestAnimationFrame(r));
  const textures = generateWoodTextures(params.textureSize);
  status.textContent = 'Baue Szene …';
  monitor?.attachCanvas(canvas);
  const size0 = cssSize();
  let aaInfo: { aa: AaMode; msaaSamples: number; note?: string };
  try {
    aaInfo = await adapter.init(canvas, { textures, params, pixelRatio: pixelRatio(), cssWidth: size0.w, cssHeight: size0.h });
  } catch (err) {
    fail(`Fehler beim Aufbau: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
  monitor?.setMeta({ aa: aaInfo.aa, msaaSamples: aaInfo.msaaSamples });
  title.textContent = `${adapter.engine} ${adapter.version} · ${aaInfo.aa}${aaInfo.msaaSamples > 0 ? `×${String(aaInfo.msaaSamples)}` : ''} · dpr≤${String(params.dprCap)}${dyn ? ' dyn' : ''}`;
  if (aaInfo.note) hint.textContent = aaInfo.note;

  const doResize = (): void => {
    const s = cssSize();
    adapter.resize(s.w, s.h, pixelRatio());
  };
  window.addEventListener('resize', doResize);
  window.visualViewport?.addEventListener('resize', doResize);
  doResize();

  // ---- Spielzustand (nur Spike)
  const player = new FirstPersonController(CAMERA.start, CAMERA.eyeHeight, {
    minX: -ROOM.width / 2,
    maxX: ROOM.width / 2,
    minZ: -ROOM.depth / 2,
    maxZ: ROOM.depth / 2,
    obstacles: [BENCH_FOOTPRINT],
  });
  const beam = new BeamInteraction(BEAM_AABB);
  const rayAt = (x: number, y: number) => {
    const s = cssSize();
    return screenRay(player.eye, player.forward, CAMERA.fovY, s.w, s.h, x, y);
  };
  const controls = new TouchControls(touch, hud, {
    beginCut: (x, y) => beam.beginCut(rayAt(x, y)),
    moveCut: (x, y) => { beam.moveCut(rayAt(x, y)); },
    endCut: () => { beam.endCut(); },
    tap: (x, y, ts) => {
      if (beam.tap(rayAt(x, y))) monitor?.noteInput(ts);
    },
  });

  let ready = false;
  window.__spike = {
    state: () => ({ ready, selected: beam.selected, cutMm: beam.cutMm, yaw: player.yaw, pitch: player.pitch }),
    beamScreenPoint: (u = 0.5) => {
      const s = cssSize();
      const p: Vec3 = [BEAM_AABB.min[0] + (BEAM_AABB.max[0] - BEAM_AABB.min[0]) * u, BEAM_AABB.max[1] - 0.01, BEAM_CENTER[2] + 0.04];
      return projectToScreen(player.eye, player.forward, CAMERA.fovY, s.w, s.h, p);
    },
  };

  // ---- Schleife
  let lastNow: number | null = null;
  let shownSelected = false;
  let shownCut: number | null = null;
  let lastHud = 0;
  const t0 = performance.now();
  adapter.start((now) => {
    const dt = lastNow === null ? 0 : now - lastNow;
    lastNow = now;
    if (params.autoCamera) {
      const t = (now - t0) / 1000;
      player.yaw = CAMERA.start.yaw + 0.45 * Math.sin(t * 0.6);
      player.pitch = CAMERA.start.pitch + 0.1 * Math.sin(t * 0.9);
      player.x = CAMERA.start.position[0] + 0.4 * Math.sin(t * 0.3);
    } else {
      player.update(dt / 1000, controls.consume());
    }
    adapter.setCamera(player.eye, player.forward, CAMERA.fovY);

    if (beam.selected !== shownSelected || beam.cutX !== shownCut) {
      if (beam.selected !== shownSelected) {
        adapter.setBeamHighlight(beam.selected);
        monitor?.noteFeedbackFrame();
      }
      if (beam.cutX !== shownCut) adapter.setCutLine(beam.cutX);
      shownSelected = beam.selected;
      shownCut = beam.cutX;
      status.textContent =
        beam.cutMm !== null
          ? `Schnitt bei ${String(beam.cutMm)} mm vom linken Ende${beam.selected ? '' : ' (Balken nicht ausgewählt)'}`
          : beam.selected
            ? 'Balken ausgewählt – auf dem Balken wischen: Schnittlinie'
            : 'Balken antippen';
      status.classList.toggle('active', beam.selected);
    }

    if (dyn && dt > 0 && dyn.sample(dt)) doResize();

    if (monitor && params.debug && now - lastHud > 500) {
      lastHud = now;
      const f = monitor.frame;
      const r = canvas.width / Math.max(1, canvas.clientWidth);
      stats.textContent = `dc ${String(f.drawCalls)} · tri ${String(f.triangles)} · ${r.toFixed(2)}x · ${aaInfo.aa}`;
    }
    if (!ready) {
      ready = true;
      status.textContent = 'Balken antippen';
      document.body.dataset['state'] = 'ready';
      monitor?.markPlayable();
    }
  });
}
