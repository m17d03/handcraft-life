/**
 * Three.js-Umsetzung der WerkstattView (Ticket 010): Renderer, Render-Schleife, Ich-Kamera,
 * Arbeitsansicht, Picking, dynamische Auflösung, Wiederherstellung nach Kontextverlust.
 * Picking und Koordinaten rechnen engine-frei (mathe.ts) mit derselben Kamera wie das Bild.
 */
import * as THREE from 'three';
import type { PerfMelder } from '../perf/perf-snapshot';
import { ladeWerkstattAssets, type WerkstattAssets } from './assets';
import { aufloesungsGrenzen, DynamischeAufloesung, istSoftwareRenderer, type AufloesungsParameter } from './aufloesung';
import { bildschirmNachBrettMm, brettMmNachBildschirm, type BrettLage } from './brett-koordinaten';
import { erzeugeHolzTexturen, type HolzTexturen } from './holztextur';
import { arbeitsPose, IchKamera, Kamerafahrt, type KameraPose } from './ich-kamera';
import { add, clamp, forwardFromYawPitch, projectToScreen, screenRay, type Projektion } from './mathe';
import { pickNaechstes } from './picking';
import type { WerkstattViewDebug, WerkstattViewZustand } from './view-api';
import { WerkstattSzene, type EndRisse, type EndWinkel, type SaegeZustand } from './werkstatt-szene';
import { ARBEITSANSICHT, BEGEHBAR, BRETT, BRETT_OBEN_Y, KAMERA } from './werkstatt-layout';

export const SZENEN_ID = 'werkstatt';

export interface WerkstattOptionen {
  /** Messung (nur im Debug-/Perf-Modus) */
  readonly perf?: PerfMelder | null;
  readonly aufloesung?: AufloesungsParameter;
  /** Kantenlänge der Holztextur (Standard 1024) */
  readonly holzTexturGroesse?: number;
  /** Erster Frame ist gezeichnet. */
  readonly beiBereit?: () => void;
  /**
   * Wurzelpfad, unter dem `assets/` und `basis/` ausgeliefert werden (Vite `BASE_URL`). Ohne Angabe
   * werden keine Modelle geladen (Platzhalter aus Ticket 010).
   */
  readonly assetBasis?: string;
  /** Dauer der Kamerafahrt (ms); Standard ARBEITSANSICHT.fahrtMs. Tests (`?test=1`) setzen 0. */
  readonly kamerafahrtMs?: number;
  /** Ladefehler der Assets (Szene läuft mit Platzhaltern weiter). */
  readonly beiAssetFehler?: (fehler: unknown) => void;
  /**
   * GL-Renderer-Name des Geräts (vor dem Erzeugen ermittelt). Software-Rendering → Pixeldichte 1, kein MSAA.
   * Ohne Angabe ermittelt `erzeugeWerkstattView` ihn selbst.
   */
  readonly glRenderer?: string;
}

const endlich = (v: number, ersatz = 0): number => (Number.isFinite(v) ? v : ersatz);

class WerkstattViewThree implements WerkstattViewDebug {
  private readonly renderer: THREE.WebGLRenderer;
  /** Wird in `starten()` aufgebaut (vor der ersten Nutzung durch den Aufrufer). */
  private szene!: WerkstattSzene;
  private holz: HolzTexturen | null = null;
  private assets: WerkstattAssets | null = null;
  private risse: EndRisse = { a: null, b: null };
  private winkel: EndWinkel = { a: 0, b: 0 };
  private readonly anisotropie: number;
  private readonly kamera: THREE.PerspectiveCamera;
  private readonly ich: IchKamera;
  private readonly fahrt: Kamerafahrt;
  private readonly dyn: DynamischeAufloesung | null;
  private readonly maxDichte: number;
  private readonly perf: PerfMelder | null;
  private readonly beobachter: ResizeObserver | null;
  private pose: KameraPose;
  private arbeit = false;
  private arbeitsZiel: KameraPose | null = null;
  private vor = 0;
  private seit = 0;
  private blickDx = 0;
  private blickDy = 0;
  private lage: BrettLage = { laengeMm: BRETT.standardLaengeMm, bezugsende: null, schnittIstMm: null };
  private markierungMm: number | null = null;
  private massbandMm: number | null = null;
  private saege: SaegeZustand | null = null;
  private hervor: string | null = null;
  private cssW = 1;
  private cssH = 1;
  private letzteZeit: number | null = null;
  private frames = 0;
  private bereit = false;
  private verloren = false;
  private feedbackOffen = false;
  private beendet = false;
  private assetFehler: string | null = null;
  private readonly frameAbstaende: number[] = [];
  private readonly renderDauern: number[] = [];
  private readonly schleifenFehler: string[] = [];
  private readonly glRenderer: string;
  /** Software-Rendering erkannt: Pixeldichte 1, kein MSAA */
  private readonly software: boolean;
  private readonly komprimiert: string[];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly opt: WerkstattOptionen,
  ) {
    this.perf = opt.perf ?? null;
    this.fahrt = new Kamerafahrt(opt.kamerafahrtMs ?? ARBEITSANSICHT.fahrtMs);
    this.software = istSoftwareRenderer(opt.glRenderer ?? '');
    const r = new THREE.WebGLRenderer({ canvas, antialias: !this.software && (opt.aufloesung?.msaa ?? true), alpha: false, stencil: false, powerPreference: 'high-performance' });
    this.renderer = r;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.78;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    // Schatten nur neu zeichnen, wenn sich etwas auf der Werkbank bewegt (Kamera ändert die Sonne nicht)
    r.shadowMap.autoUpdate = false;
    r.shadowMap.needsUpdate = true;

    const deckel = opt.aufloesung?.pixeldichteDeckel;
    const grenzen = aufloesungsGrenzen(window.devicePixelRatio, this.software ? Math.min(1, deckel ?? 1) : deckel);
    this.maxDichte = grenzen.max;
    this.dyn = (opt.aufloesung?.dynamisch ?? true) ? new DynamischeAufloesung(grenzen.min, grenzen.max) : null;

    this.anisotropie = Math.min(4, r.capabilities.getMaxAnisotropy());
    this.kamera = new THREE.PerspectiveCamera((KAMERA.fovY * 180) / Math.PI, 1, KAMERA.near, KAMERA.far);
    this.ich = new IchKamera(KAMERA.start, KAMERA.augenhoehe, BEGEHBAR);
    this.pose = this.ich.pose;

    canvas.addEventListener('webglcontextlost', this.beiVerlust);
    canvas.addEventListener('webglcontextrestored', this.beiWiederherstellung);
    window.addEventListener('resize', this.groesseAnpassen);
    this.beobachter = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(this.groesseAnpassen);
    this.beobachter?.observe(canvas);
    this.groesseAnpassen();

    const gl = r.getContext();
    this.glRenderer = glRendererName(gl);
    this.komprimiert = (gl.getSupportedExtensions() ?? []).filter((e) => /compressed|compression/i.test(e));
    const samples = Number(gl.getParameter(gl.SAMPLES)) || 0;
    this.perf?.setzeMeta({ engine: 'three', engineVersion: THREE.REVISION, scene: SZENEN_ID, aa: samples > 0 ? 'msaa' : 'none', msaaSamples: samples });
  }

  /** Prozedurale Holztextur (nur für Platzhalter/Rückfall; kostet beim ersten Aufruf CPU-Zeit). */
  private holzTexturen(): HolzTexturen | null {
    if (this.assets) return null;
    this.holz ??= erzeugeHolzTexturen(this.opt.holzTexturGroesse ?? 1024);
    return this.holz;
  }

  /** Lädt die Assets (falls `assetBasis` gesetzt), baut die Szene darauf auf und startet die Schleife. */
  async starten(): Promise<void> {
    if (this.opt.assetBasis !== undefined) {
      try {
        this.assets = await ladeWerkstattAssets(this.renderer, this.opt.assetBasis);
      } catch (e) {
        this.assets = null;
        this.assetFehler = e instanceof Error ? e.message : String(e);
        console.warn(`Werkstatt-Assets nicht geladen, Platzhalter aktiv: ${this.assetFehler}`);
        this.opt.beiAssetFehler?.(e);
      }
    }
    this.szene = new WerkstattSzene(this.holzTexturen(), this.anisotropie, this.assets);
    this.szene.umgebungErzeugen(this.renderer);
    this.anwenden(true);
    // Shader vorab übersetzen (parallel, wo der Browser es kann): sonst hängen die ersten Frames mehrere Sekunden
    // (ohne GPU gemessen 3–5 s je Hänger, Ticket 018) – besser vor „bereit“ als mitten im Spiel.
    try {
      await this.renderer.compileAsync(this.szene.szene, this.kamera);
    } catch (e) {
      console.warn(`Shader-Vorübersetzung fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!this.beendet) this.renderer.setAnimationLoop(this.frame);
  }

  // ------------------------------------------------------------------ Schleife

  /**
   * Ein Fehler in einem Frame darf die Schleife nicht beenden (three fordert den nächsten Frame erst nach
   * dem Rückruf an): melden (einmal je Meldung), merken, weiterzeichnen.
   */
  private readonly frame = (jetzt: number): void => {
    try {
      this.frameZeichnen(jetzt);
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      if (!this.schleifenFehler.includes(text)) {
        if (this.schleifenFehler.length < 5) this.schleifenFehler.push(text);
        console.error(`Render-Schleife: ${text}`);
      }
    }
  };

  private frameZeichnen(jetzt: number): void {
    this.perf?.frameBeginn(jetzt);
    const dt = this.letzteZeit === null ? 0 : jetzt - this.letzteZeit;
    this.letzteZeit = jetzt;

    if (!this.arbeit && !this.fahrt.aktiv) {
      this.ich.umsehen(this.blickDx, this.blickDy);
      this.ich.gehen(dt / 1000, this.vor, this.seit);
    }
    this.blickDx = 0;
    this.blickDy = 0;
    const gefahren = this.fahrt.pose(jetzt);
    this.pose = gefahren ?? (this.arbeit && this.arbeitsZiel ? this.arbeitsZiel : this.ich.pose);
    const e = this.pose.eye;
    this.kamera.position.set(e[0], e[1], e[2]);
    const ziel = add(e, forwardFromYawPitch(this.pose.yaw, this.pose.pitch));
    this.kamera.lookAt(ziel[0], ziel[1], ziel[2]);

    if (this.dyn?.messe(dt)) this.groesseAnpassen();

    let gezeichnet = false;
    if (!this.verloren && !this.renderer.getContext().isContextLost()) {
      const t0 = performance.now();
      this.renderer.render(this.szene.szene, this.kamera);
      merke(this.renderDauern, performance.now() - t0);
      if (dt > 0) merke(this.frameAbstaende, dt);
      gezeichnet = true;
      this.frames++;
    }
    this.perf?.frameEnde();
    if (gezeichnet && this.feedbackOffen) {
      this.feedbackOffen = false;
      this.perf?.feedbackGezeichnet();
    }
    if (gezeichnet && !this.bereit) {
      this.bereit = true;
      this.opt.beiBereit?.();
    }
  }

  private readonly groesseAnpassen = (): void => {
    if (this.beendet) return;
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    this.cssW = w;
    this.cssH = h;
    const dichte = Math.min(this.dyn ? this.dyn.faktor : this.maxDichte, this.maxDichte);
    this.renderer.setPixelRatio(dichte);
    this.renderer.setSize(w, h, false);
    this.kamera.aspect = w / h;
    this.kamera.updateProjectionMatrix();
    if (this.arbeit) {
      this.arbeitsZiel = this.berechneArbeitsPose();
    }
  };

  private readonly beiVerlust = (): void => {
    this.verloren = true;
  };

  private readonly beiWiederherstellung = (): void => {
    this.verloren = false;
    // Alle GPU-Objekte des alten Kontexts sind weg. Die alten Three-Objekte tragen noch Dispose-Hörer der
    // alten Renderer-Module (dispose() würde fremde GL-Objekte löschen → Warnungen). Darum die Szene
    // ohne dispose verwerfen und aus dem gespeicherten Zustand neu aufbauen (Holztextur wird wiederverwendet).
    this.szene = new WerkstattSzene(this.holzTexturen(), this.anisotropie, this.assets);
    this.szene.umgebungErzeugen(this.renderer);
    this.anwenden(true);
  };

  /**
   * Zustand → Szene (sofort, damit pick/Projektion direkt nach einem Aufruf stimmen).
   * `schatten`: nur wenn sich schattenwerfende Geometrie bewegt, wird die Shadow-Map neu gezeichnet.
   */
  private anwenden(schatten: boolean): void {
    this.szene.aktualisiere({
      lage: this.lage,
      markierungMm: this.markierungMm,
      massbandMm: this.massbandMm,
      saege: this.saege,
      hervorgehoben: this.hervor,
      risse: this.risse,
      winkel: this.winkel,
    });
    if (schatten) this.renderer.shadowMap.needsUpdate = true;
    this.feedbackOffen = true;
  }

  private berechneArbeitsPose(): KameraPose {
    return arbeitsPose([BRETT.x, BRETT_OBEN_Y, BRETT.z], this.lage.laengeMm / 1000, this.cssW / this.cssH, KAMERA.fovY, ARBEITSANSICHT);
  }

  private projektion(): Projektion {
    return {
      eye: this.pose.eye,
      forward: forwardFromYawPitch(this.pose.yaw, this.pose.pitch),
      fovY: KAMERA.fovY,
      breite: this.cssW,
      hoehe: this.cssH,
    };
  }

  // ------------------------------------------------------------------ View-API

  bewegen(vorwaerts: number, seitwaerts: number): void {
    this.vor = clamp(endlich(vorwaerts), -1, 1);
    this.seit = clamp(endlich(seitwaerts), -1, 1);
  }

  umschauen(dxPx: number, dyPx: number): void {
    this.blickDx += endlich(dxPx);
    this.blickDy += endlich(dyPx);
  }

  pick(xCss: number, yCss: number): string | null {
    if (!Number.isFinite(xCss) || !Number.isFinite(yCss)) return null;
    return pickNaechstes(screenRay(this.projektion(), xCss, yCss), this.szene.pickZiele(this.lage));
  }

  arbeitsansicht(an: boolean): void {
    if (an === this.arbeit) return;
    this.arbeit = an;
    if (an) this.arbeitsZiel = this.berechneArbeitsPose();
    const ziel = an && this.arbeitsZiel ? this.arbeitsZiel : this.ich.pose;
    this.fahrt.starte(this.pose, ziel, performance.now());
  }

  brettZeigen(laengeMm: number, bezugsende: 'a' | 'b' | null): void {
    const l = endlich(laengeMm, BRETT.standardLaengeMm);
    this.lage = { laengeMm: clamp(l, 10, 4000), bezugsende, schnittIstMm: null };
    if (this.arbeit) this.arbeitsZiel = this.berechneArbeitsPose();
    this.anwenden(true);
  }

  markierungZeigen(mm: number | null): void {
    this.markierungMm = mm === null || !Number.isFinite(mm) ? null : clamp(mm, 0, this.lage.laengeMm);
    this.anwenden(false);
  }

  massbandZeigen(mm: number | null): void {
    this.massbandMm = mm === null || !Number.isFinite(mm) ? null : clamp(mm, 0, this.lage.laengeMm);
    this.anwenden(true);
  }

  saegeZeigen(zustand: { versatzMm: number; tiefe01: number; driftGrad: number } | null): void {
    this.saege =
      zustand === null
        ? null
        : { versatzMm: clamp(endlich(zustand.versatzMm), -50, 50), tiefe01: clamp(endlich(zustand.tiefe01), 0, 1), driftGrad: clamp(endlich(zustand.driftGrad), -30, 30) };
    this.anwenden(true);
  }

  schnittErgebnisZeigen(laengeIstMm: number | null): void {
    const ist = laengeIstMm === null || !Number.isFinite(laengeIstMm) ? null : clamp(laengeIstMm, 1, this.lage.laengeMm);
    this.lage = { ...this.lage, schnittIstMm: ist };
    this.anwenden(true);
  }

  endwinkelZeigen(winkel: { a: number; b: number }): void {
    const w = (v: number): number => (Number.isFinite(v) ? clamp(v, -10, 10) : 0);
    this.winkel = { a: w(winkel.a), b: w(winkel.b) };
    this.anwenden(true);
  }

  endrisseZeigen(risse: { a: number | null; b: number | null }): void {
    const wert = (v: number | null): number | null => (v === null || !Number.isFinite(v) || v <= 0 ? null : clamp(v, 1, 4000));
    this.risse = { a: wert(risse.a), b: wert(risse.b) };
    this.anwenden(false);
  }

  hervorheben(id: string | null): void {
    this.hervor = id;
    this.anwenden(false);
  }

  weltNachBildschirm(mmAufBrett: number): { x: number; y: number } | null {
    if (!Number.isFinite(mmAufBrett)) return null;
    return brettMmNachBildschirm(this.projektion(), this.lage, mmAufBrett);
  }

  bildschirmNachBrettMm(xCss: number, yCss: number): number | null {
    if (!Number.isFinite(xCss) || !Number.isFinite(yCss)) return null;
    return bildschirmNachBrettMm(this.projektion(), this.lage, xCss, yCss);
  }

  dispose(): void {
    if (this.beendet) return;
    this.beendet = true;
    this.renderer.setAnimationLoop(null);
    this.canvas.removeEventListener('webglcontextlost', this.beiVerlust);
    this.canvas.removeEventListener('webglcontextrestored', this.beiWiederherstellung);
    window.removeEventListener('resize', this.groesseAnpassen);
    this.beobachter?.disconnect();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- dispose() vor dem Ende von starten()
    this.szene?.dispose();
    this.renderer.dispose();
  }

  // ------------------------------------------------------------------ Debug-Ergänzungen

  zustand(): WerkstattViewZustand {
    const p = this.pose;
    return {
      bereit: this.bereit,
      arbeitsansicht: this.arbeit,
      fahrt: this.fahrt.aktiv,
      kamera: { x: p.eye[0], y: p.eye[1], z: p.eye[2], yaw: p.yaw, pitch: p.pitch },
      brett: { laengeMm: this.lage.laengeMm, bezugsende: this.lage.bezugsende, schnittIstMm: this.lage.schnittIstMm },
      hervorgehoben: this.hervor,
      leuchtend: this.szene.leuchtendeMaterialien(),
      frames: this.frames,
      kontextVerloren: this.verloren,
      assets: this.szene.mitAssets ? 'modelle' : 'platzhalter',
      risse: { ...this.risse },
      winkel: { ...this.winkel },
      diagnose: {
        glRenderer: this.glRenderer,
        software: this.software,
        komprimiert: [...this.komprimiert],
        assetLadeMs: this.assets?.info.ladeMs ?? null,
        assetFehler: this.assetFehler,
        ktx2: this.assets ? { ...this.assets.info.ktx2 } : null,
        texturFormat: this.assets?.info.texturFormat ?? null,
        pixeldichte: this.renderer.getPixelRatio(),
        frameAbstandMs: [...this.frameAbstaende],
        renderMs: [...this.renderDauern],
        schleifenFehler: [...this.schleifenFehler],
      },
    };
  }

  bildschirmpunktVon(id: string): { x: number; y: number } | null {
    const m = this.szene.objektMitte(id, this.lage);
    return m ? projectToScreen(this.projektion(), m) : null;
  }
}

const DIAGNOSE_FRAMES = 12;

/** Ringpuffer der letzten Frames (gerundet auf ms). */
function merke(liste: number[], wert: number): void {
  liste.push(Math.round(wert));
  if (liste.length > DIAGNOSE_FRAMES) liste.shift();
}

/** GPU-Name (unmaskiert, falls erlaubt) – „llvmpipe“/„SwiftShader“ = Software-Rendering. */
function glRendererName(gl: WebGLRenderingContext | WebGL2RenderingContext): string {
  try {
    const name = String(gl.getParameter(gl.RENDERER));
    // Firefox/Chromium liefern den Namen direkt; WebKit maskiert ihn („WebKit WebGL“)
    if (!/webgl/i.test(name)) return name;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : name;
  } catch {
    return 'unbekannt';
  }
}

/** GL-Renderer-Name über einen kurzlebigen Probe-Kontext (vor dem eigentlichen Renderer, wegen MSAA). */
function probeRenderer(): string {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return '';
    const name = glRendererName(gl);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch {
    return '';
  }
}

/** true, wenn der Browser WebGL 2 anbietet (Pflicht-Renderpfad). */
export function hatWebGL2(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

/**
 * Erzeugt die Werkstatt auf `canvas` und startet die Render-Schleife. Asynchron, damit der Aufrufer
 * vorher einen Ladehinweis zeichnen kann (und 013 hier GLB-Assets laden kann).
 */
export async function erzeugeWerkstattView(canvas: HTMLCanvasElement, opt: WerkstattOptionen = {}): Promise<WerkstattViewDebug> {
  await new Promise<void>((r) => requestAnimationFrame(() => { r(); }));
  const view = new WerkstattViewThree(canvas, { ...opt, glRenderer: opt.glRenderer ?? probeRenderer() });
  await view.starten();
  return view;
}
