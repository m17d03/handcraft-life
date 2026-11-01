/**
 * Kleine prozedurale Texturen für die Werkstatt (Three.js): Holz (aus holztextur.ts), Massband-Skala
 * (Canvas, mm-genau) und ein weiches Rechteck für Kontaktschatten/Lichtfleck. Keine externen Assets.
 */
import * as THREE from 'three';
import type { HolzTexturen } from './holztextur';

export interface HolzMaps {
  readonly albedo: THREE.DataTexture;
  readonly orm: THREE.DataTexture;
  readonly normal: THREE.DataTexture;
}

export function holzMaps(t: HolzTexturen, anisotropie: number): HolzMaps {
  const tex = (daten: Uint8Array, srgb: boolean): THREE.DataTexture => {
    const d = new THREE.DataTexture(daten, t.groesse, t.groesse, THREE.RGBAFormat, THREE.UnsignedByteType);
    d.wrapS = THREE.RepeatWrapping;
    d.wrapT = THREE.RepeatWrapping;
    d.generateMipmaps = true;
    d.minFilter = THREE.LinearMipmapLinearFilter;
    d.magFilter = THREE.LinearFilter;
    d.anisotropy = anisotropie;
    d.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    d.needsUpdate = true;
    return d;
  };
  return { albedo: tex(t.albedo, true), orm: tex(t.orm, false), normal: tex(t.normal, false) };
}

/** Länge der Massband-Skala in der Textur (mm) und Pixel pro mm. */
export const MASSBAND_TEXTUR_MM = 2048;
const PX_PRO_MM = 2;

/**
 * Massband-Skala: gelbes Band, Striche je mm (kurz), 5 mm (mittel), 10 mm (lang, mit cm-Zahl),
 * 100 mm rot hervorgehoben. u = 0 ist der Haken (0 mm).
 */
export function massbandTextur(anisotropie: number): THREE.CanvasTexture {
  const w = MASSBAND_TEXTUR_MM * PX_PRO_MM;
  const h = 64;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = '#f2cf6b';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e2b952';
    g.fillRect(0, 0, w, 3);
    g.fillRect(0, h - 3, w, 3);
    g.fillStyle = '#1b1712';
    for (let mm = 0; mm <= MASSBAND_TEXTUR_MM; mm++) {
      const x = mm * PX_PRO_MM;
      const lang = mm % 10 === 0 ? 22 : mm % 5 === 0 ? 15 : 9;
      g.fillRect(x, 0, 1, lang);
    }
    g.textBaseline = 'alphabetic';
    for (let cm = 1; cm * 10 <= MASSBAND_TEXTUR_MM; cm++) {
      const x = cm * 10 * PX_PRO_MM;
      const voll = cm % 10 === 0;
      g.fillStyle = voll ? '#b3261e' : '#1b1712';
      g.font = `${voll ? '700 ' : '600 '}${voll ? '26' : '20'}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
      g.fillText(String(cm), x + 2, h - 10);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = anisotropie;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/** Weiches Rechteck (Alpha), Rand `weich` (0..0,5 der Kantenlänge) – für Kontaktschatten und Lichtfleck. */
export function weichesRechteck(groesse = 64, weich = 0.35): THREE.DataTexture {
  const d = new Uint8Array(groesse * groesse * 4);
  const kante = (t: number): number => {
    const x = Math.min(t, 1 - t) / weich;
    const s = Math.min(1, Math.max(0, x));
    return s * s * (3 - 2 * s);
  };
  for (let y = 0; y < groesse; y++) {
    for (let x = 0; x < groesse; x++) {
      const a = kante((x + 0.5) / groesse) * kante((y + 0.5) / groesse);
      const o = (y * groesse + x) * 4;
      const w = Math.round(a * 255);
      // alphaMap liest den G-Kanal → Wert in allen Kanälen
      d[o] = w;
      d[o + 1] = w;
      d[o + 2] = w;
      d[o + 3] = w;
    }
  }
  const t = new THREE.DataTexture(d, groesse, groesse, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}
