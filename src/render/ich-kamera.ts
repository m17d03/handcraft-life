/**
 * Ich-Kamera (ADR 0004, Konzept B): Gehen, Umsehen, Kollision mit Raum und Werkbank (aus
 * spikes/shared/player.ts) und die Kamerafahrt in die Arbeitsansicht. Reine Logik ohne DOM/Engine.
 */
import { clamp, forwardFromYawPitch, lerp, scale, smoothstep01, sub, winkelDiff, type Vec3 } from './mathe';

export interface KameraPose {
  readonly eye: Vec3;
  readonly yaw: number;
  readonly pitch: number;
}

export interface Begehbar {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly hindernisse: readonly { minX: number; maxX: number; minZ: number; maxZ: number }[];
}

export const GEHTEMPO = 1.4; // m/s
export const UMSEHEN_RAD_PRO_PX = 0.0045;
export const NEIGUNG_GRENZE = (80 * Math.PI) / 180;
export const SPIELER_RADIUS = 0.3;

export class IchKamera {
  x: number;
  z: number;
  yaw: number;
  pitch: number;

  constructor(
    start: { position: Vec3; yaw: number; pitch: number },
    readonly augenhoehe: number,
    private readonly raum: Begehbar,
  ) {
    this.x = start.position[0];
    this.z = start.position[2];
    this.yaw = start.yaw;
    this.pitch = start.pitch;
  }

  get pose(): KameraPose {
    return { eye: [this.x, this.augenhoehe, this.z], yaw: this.yaw, pitch: this.pitch };
  }

  umsehen(dxPx: number, dyPx: number): void {
    this.yaw -= dxPx * UMSEHEN_RAD_PRO_PX;
    this.pitch = clamp(this.pitch - dyPx * UMSEHEN_RAD_PRO_PX, -NEIGUNG_GRENZE, NEIGUNG_GRENZE);
  }

  /** vorwaerts/seitwaerts je −1..1 (Betrag über 1 wird begrenzt). */
  gehen(dtSekunden: number, vorwaerts: number, seitwaerts: number): void {
    const mag = Math.hypot(vorwaerts, seitwaerts);
    if (!Number.isFinite(mag) || mag < 1e-3) return;
    const k = Math.min(1, mag) / mag;
    const dt = clamp(dtSekunden, 0, 0.1); // Hänger nicht in Teleport umsetzen
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    this.x += (vorwaerts * fx + seitwaerts * rx) * k * GEHTEMPO * dt;
    this.z += (vorwaerts * fz + seitwaerts * rz) * k * GEHTEMPO * dt;
    this.kollision();
  }

  private kollision(): void {
    const r = SPIELER_RADIUS;
    const b = this.raum;
    this.x = clamp(this.x, b.minX + r, b.maxX - r);
    this.z = clamp(this.z, b.minZ + r, b.maxZ - r);
    for (const o of b.hindernisse) {
      const minX = o.minX - r;
      const maxX = o.maxX + r;
      const minZ = o.minZ - r;
      const maxZ = o.maxZ + r;
      if (this.x <= minX || this.x >= maxX || this.z <= minZ || this.z >= maxZ) continue;
      // auf kürzestem Weg hinausschieben
      const schuebe = [
        { d: this.x - minX, f: () => { this.x = minX; } },
        { d: maxX - this.x, f: () => { this.x = maxX; } },
        { d: this.z - minZ, f: () => { this.z = minZ; } },
        { d: maxZ - this.z, f: () => { this.z = maxZ; } },
      ].sort((p, q) => p.d - q.d);
      schuebe[0]?.f();
    }
  }
}

/**
 * Randzone in der Arbeitsansicht (Ticket 017, Befund 016): Bildschirmbreite und je Seite gesperrte Pixel
 * (Safe Area + Randzone gegen Safaris Rand-Wischgesten + Fingerreserve). Beide Brettenden müssen innerhalb
 * `[px, breitePx − px]` liegen, damit sie antippbar sind.
 */
export interface ArbeitsRand {
  readonly breitePx: number;
  readonly px: number;
  /** Tiefe des Bretts (m, Richtung z): die vordere Ecke liegt näher an der Kamera und erscheint weiter aussen. */
  readonly tiefeM: number;
  /** Was über das Ende hinaus sichtbar bleiben soll (m), z. B. der Anschlagwinkel. */
  readonly ueberstandM: number;
}

/**
 * Arbeitsansicht: Kamera blickt mit fester Neigung auf `ziel` und steht so weit weg, dass
 * `breiteM` (plus Rand) horizontal ins Bild passt. Mit `rand` (Ticket 017) wird in Pixeln gerahmt: der
 * Abstand ist der kleinste, bei dem alle Eckpunkte der Brettenden (vorn und hinten, inkl. Überstand)
 * ausserhalb der Randzone liegen – ohne `rand` wie bisher mit `randM`.
 */
export function arbeitsPose(
  ziel: Vec3,
  breiteM: number,
  seitenverhaeltnis: number,
  fovY: number,
  opt: { neigung: number; randM: number; minAbstand: number; maxAbstand: number },
  rand?: ArbeitsRand,
): KameraPose {
  const tanH = Math.tan(fovY / 2) * Math.max(0.1, seitenverhaeltnis);
  const f = forwardFromYawPitch(0, opt.neigung);
  let noetig = (breiteM / 2 + opt.randM) / tanH;
  if (rand !== undefined && rand.breitePx > 0) {
    // ndcX = X / (Tiefe · tanH) ≤ k  mit  k = 1 − 2·px/Breite;  Tiefe = Abstand + (p − ziel)·f
    const k = clamp(1 - (2 * Math.max(0, rand.px)) / rand.breitePx, 0.2, 1);
    const x = breiteM / 2 + Math.max(0, rand.ueberstandM);
    noetig = 0;
    for (const dz of [-rand.tiefeM / 2, rand.tiefeM / 2]) {
      const versatz = dz * f[2]; // Anteil der Ecke entlang der Blickrichtung (y = Brettoberseite = ziel)
      noetig = Math.max(noetig, x / (tanH * k) - versatz);
    }
  }
  const abstand = clamp(noetig, opt.minAbstand, opt.maxAbstand);
  return { eye: sub(ziel, scale(f, abstand)), yaw: 0, pitch: opt.neigung };
}

/** Weiche Kamerafahrt zwischen zwei Posen; Ende genau nach `dauerMs`. */
export class Kamerafahrt {
  private von: KameraPose | null = null;
  private nach: KameraPose | null = null;
  private startMs = 0;

  constructor(readonly dauerMs: number) {}

  get aktiv(): boolean {
    return this.nach !== null;
  }

  starte(von: KameraPose, nach: KameraPose, jetztMs: number): void {
    this.von = von;
    this.nach = nach;
    this.startMs = jetztMs;
  }

  /** Aktuelle Pose; nach dem Ende einmal die Zielpose, danach null (Fahrt beendet). */
  pose(jetztMs: number): KameraPose | null {
    const von = this.von;
    const nach = this.nach;
    if (!von || !nach) return null;
    const roh = this.dauerMs <= 0 ? 1 : (jetztMs - this.startMs) / this.dauerMs;
    if (roh >= 1) {
      this.von = null;
      this.nach = null;
      return nach;
    }
    const t = smoothstep01(roh);
    return {
      eye: [lerp(von.eye[0], nach.eye[0], t), lerp(von.eye[1], nach.eye[1], t), lerp(von.eye[2], nach.eye[2], t)],
      yaw: von.yaw + winkelDiff(von.yaw, nach.yaw) * t,
      pitch: lerp(von.pitch, nach.pitch, t),
    };
  }
}
