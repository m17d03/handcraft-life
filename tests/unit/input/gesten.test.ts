import { describe, expect, it } from 'vitest';
import {
  KEINE_SAFE_AREA,
  aufRaster,
  istOhneBewegung,
  rasterDelta,
  stickWert,
  zoneFuer,
} from '../../../src/input/gesten';

describe('Zonen (Erkunden)', () => {
  const notch = { links: 59, rechts: 59, oben: 0, unten: 21 };
  it('linke Hälfte = Stick, rechte = Umschauen', () => {
    expect(zoneFuer(200, 852, KEINE_SAFE_AREA)).toBe('links');
    expect(zoneFuer(600, 852, KEINE_SAFE_AREA)).toBe('rechts');
  });
  it('20 pt Randzone zusätzlich zur Safe Area gehören Safari', () => {
    expect(zoneFuer(19, 852, KEINE_SAFE_AREA)).toBe('rand');
    expect(zoneFuer(21, 852, KEINE_SAFE_AREA)).toBe('links');
    expect(zoneFuer(852 - 19, 852, KEINE_SAFE_AREA)).toBe('rand');
    expect(zoneFuer(70, 852, notch)).toBe('rand');
    expect(zoneFuer(80, 852, notch)).toBe('links');
    expect(zoneFuer(852 - 70, 852, notch)).toBe('rand');
  });
});

describe('Stick', () => {
  it('oben = vorwärts, rechts = seitwärts +', () => {
    expect(stickWert(0, -25)).toMatchObject({ vorwaerts: 0.5, seitwaerts: 0 });
    expect(stickWert(25, 0)).toMatchObject({ vorwaerts: 0, seitwaerts: 0.5 });
  });
  it('begrenzt auf den Radius (Betrag ≤ 1)', () => {
    const s = stickWert(300, 400);
    expect(Math.hypot(s.vorwaerts, s.seitwaerts)).toBeCloseTo(1, 2);
    expect(s.seitwaerts).toBeCloseTo(0.6, 2);
    expect(s.vorwaerts).toBeCloseTo(-0.8, 2);
    expect(Math.hypot(s.knopfX, s.knopfY)).toBeCloseTo(50);
  });
  it('kein −0', () => {
    expect(Object.is(stickWert(0, 0).vorwaerts, -0)).toBe(false);
  });
});

describe('Tippen über Weg statt Zeit', () => {
  it('≤ 10 pt Bewegung gilt als Tippen/Halten', () => {
    expect(istOhneBewegung(6, 8)).toBe(true);
    expect(istOhneBewegung(8, 8)).toBe(false);
  });
});

describe('Raster', () => {
  it('rundet auf 0,5 mm ohne Fliesskomma-Reste', () => {
    expect(aufRaster(450.26, 0.5)).toBe(450.5);
    expect(aufRaster(0.1 + 0.2, 0.1)).toBe(0.3);
    expect(Object.is(aufRaster(-0.1, 0.5), -0)).toBe(false);
  });
  it('Deltas summieren sich exakt zur Fingerposition', () => {
    const pxProMm = 0.62;
    let gemeldet = 0;
    let summe = 0;
    for (const px of [1, 3, 7, 7, 20, 279, 140]) {
      const d = rasterDelta(px, pxProMm, gemeldet, 0.5);
      gemeldet = aufRaster(gemeldet + d, 0.5);
      summe += d;
      expect(Math.abs(d * 2 - Math.round(d * 2))).toBeLessThan(1e-9);
    }
    expect(summe).toBeCloseTo(aufRaster(140 / pxProMm, 0.5), 6);
  });
});
