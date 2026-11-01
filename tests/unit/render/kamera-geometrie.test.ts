import { describe, expect, it } from 'vitest';
import { aufloesungsGrenzen, DynamischeAufloesung, leseAufloesungsParameter } from '../../../src/render/aufloesung';
import { dielenBoden, dreiecke, fasenQuader, windungPasst } from '../../../src/render/geometrie';
import { erzeugeHolzTexturen } from '../../../src/render/holztextur';
import { arbeitsPose, IchKamera, Kamerafahrt, NEIGUNG_GRENZE } from '../../../src/render/ich-kamera';
import { forwardFromYawPitch, projectToScreen, winkelDiff } from '../../../src/render/mathe';
import { ARBEITSANSICHT, BEGEHBAR, BRETT, BRETT_OBEN_Y, KAMERA, WERKBANK_GRUNDFLAECHE } from '../../../src/render/werkstatt-layout';

describe('Ich-Kamera', () => {
  it('geht vorwärts in Blickrichtung und begrenzt die Neigung', () => {
    const k = new IchKamera({ position: [0, 1.65, 1], yaw: 0, pitch: 0 }, 1.65, BEGEHBAR);
    k.gehen(0.1, 1, 0);
    expect(k.z).toBeLessThan(1);
    expect(k.x).toBeCloseTo(0, 9);
    k.umsehen(0, -100000);
    expect(k.pitch).toBeCloseTo(NEIGUNG_GRENZE, 9);
  });

  it('läuft nicht in die Werkbank', () => {
    const k = new IchKamera({ position: [0, 1.65, -1.0], yaw: 0, pitch: 0 }, 1.65, BEGEHBAR);
    for (let i = 0; i < 50; i++) k.gehen(0.1, 1, 0);
    expect(k.z).toBeGreaterThanOrEqual(WERKBANK_GRUNDFLAECHE.maxZ + 0.3 - 1e-9);
  });

  it('ignoriert NaN-Eingaben', () => {
    const k = new IchKamera(KAMERA.start, KAMERA.augenhoehe, BEGEHBAR);
    k.gehen(0.016, Number.NaN, 0);
    expect(Number.isFinite(k.x) && Number.isFinite(k.z)).toBe(true);
  });
});

describe('Arbeitsansicht und Kamerafahrt', () => {
  it('Fahrt dauert höchstens 600 ms (Abnahme) und endet genau auf dem Ziel', () => {
    expect(ARBEITSANSICHT.fahrtMs).toBeLessThanOrEqual(600);
    const f = new Kamerafahrt(ARBEITSANSICHT.fahrtMs);
    const von = { eye: [0, 1.65, 0] as const, yaw: 3, pitch: 0 };
    const nach = { eye: [1, 1.2, -1] as const, yaw: -3, pitch: -0.9 };
    f.starte(von, nach, 1000);
    const mitte = f.pose(1000 + ARBEITSANSICHT.fahrtMs / 2);
    expect(mitte?.eye[0]).toBeCloseTo(0.5, 6);
    // Gieren auf kürzestem Weg (über ±π), nicht über 0
    expect(Math.abs(winkelDiff(mitte?.yaw ?? 0, Math.PI))).toBeLessThan(0.3);
    expect(f.pose(1000 + ARBEITSANSICHT.fahrtMs)).toEqual(nach);
    expect(f.aktiv).toBe(false);
    expect(f.pose(5000)).toBeNull();
  });

  it('Arbeitspose zeigt das ganze Brett (Enden im Bild, iPhone 15 quer)', () => {
    const aspect = 852 / 393;
    const ziel = [BRETT.x, BRETT_OBEN_Y, BRETT.z] as const;
    const pose = arbeitsPose(ziel, 2, aspect, KAMERA.fovY, ARBEITSANSICHT);
    const proj = { eye: pose.eye, forward: forwardFromYawPitch(pose.yaw, pose.pitch), fovY: KAMERA.fovY, breite: 852, hoehe: 393 };
    for (const x of [BRETT.x - 1, BRETT.x + 1]) {
      const p = projectToScreen(proj, [x, BRETT_OBEN_Y, BRETT.z]);
      expect(p).not.toBeNull();
      expect(p?.x ?? -1).toBeGreaterThanOrEqual(0);
      expect(p?.x ?? 9999).toBeLessThanOrEqual(852);
    }
    const mitte = projectToScreen(proj, ziel);
    expect(mitte?.x).toBeCloseTo(426, 3);
    expect(mitte?.y).toBeCloseTo(196.5, 3);
  });
});

describe('Fasenquader', () => {
  const m = fasenQuader({ groesse: [2, 0.018, 0.14], fase: 0.0008 });

  it('hat 44 Dreiecke, alle nach aussen gewunden', () => {
    expect(dreiecke(m)).toBe(44);
    for (let t = 0; t < dreiecke(m); t++) expect(windungPasst(m, t)).toBe(true);
  });

  it('hält die Aussenmasse exakt ein', () => {
    let maxX = 0;
    let maxY = 0;
    for (let i = 0; i < m.positionen.length; i += 3) {
      maxX = Math.max(maxX, Math.abs(m.positionen[i] ?? 0));
      maxY = Math.max(maxY, Math.abs(m.positionen[i + 1] ?? 0));
    }
    expect(maxX).toBeCloseTo(1, 6);
    expect(maxY).toBeCloseTo(0.009, 6);
  });

  it('dunkelt Stirnholz (Flächen quer zur Faser) ab', () => {
    let dunkel = 0;
    for (let i = 0; i < m.farben.length; i += 3) if ((m.farben[i] ?? 1) < 1) dunkel++;
    expect(dunkel).toBe(8); // zwei Stirnflächen × 4 Ecken
  });

  it('Dielenboden: 2 Dreiecke je Diele, nach oben', () => {
    const b = dielenBoden(6, 5, 14, 0.004);
    expect(dreiecke(b)).toBe(28);
    for (let t = 0; t < dreiecke(b); t++) expect(windungPasst(b, t)).toBe(true);
  });
});

describe('Holztextur', () => {
  it('liefert drei RGBA-Karten mit plausiblen Werten (Fichte hell, Rauheit 0,6–0,8)', () => {
    const t = erzeugeHolzTexturen(32);
    expect(t.albedo.length).toBe(32 * 32 * 4);
    let r = 0;
    let rau = 0;
    for (let i = 0; i < 32 * 32; i++) {
      r += t.albedo[i * 4] ?? 0;
      rau += t.orm[i * 4 + 1] ?? 0;
    }
    expect(r / 1024).toBeGreaterThan(170);
    expect(rau / 1024 / 255).toBeGreaterThan(0.55);
    expect(rau / 1024 / 255).toBeLessThan(0.85);
  });
});

describe('Auflösung', () => {
  it('Pixeldichte höchstens 2, auch auf 3×-Displays', () => {
    expect(aufloesungsGrenzen(3)).toEqual({ min: 1.2, max: 2 });
    expect(aufloesungsGrenzen(1).max).toBe(1);
    expect(leseAufloesungsParameter('?dpr=3').pixeldichteDeckel).toBe(2);
    expect(leseAufloesungsParameter('').dynamisch).toBe(true);
    expect(leseAufloesungsParameter('?dyn=0').dynamisch).toBe(false);
  });

  it('dynamische Auflösung senkt bei langen Frames bis min und hebt bei kurzen wieder', () => {
    const d = new DynamischeAufloesung(1.2, 2, 33.3, 10);
    for (let i = 0; i < 100; i++) d.messe(60);
    expect(d.faktor).toBe(1.2);
    for (let i = 0; i < 100; i++) d.messe(10);
    expect(d.faktor).toBe(2);
    expect(d.messe(5000)).toBe(false); // Hintergrund-Pause zählt nicht
  });
});
