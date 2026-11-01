import { describe, expect, it } from 'vitest';
import {
  SAEGEZUG_STANDARD,
  erkenneSaegezuege,
  saegezugEnde,
  saegezugSchritt,
  saegezugStart,
  type SaegePunkt,
  type SaegezugOptionen,
} from '../../../src/input/saegezug';

const OPT: SaegezugOptionen = { ...SAEGEZUG_STANDARD, mitteQuer: 100, halbeBreiteQuer: 50 };

/** Wischbahn: Hin- und Herbewegungen zwischen a und b, je Hälfte `n` Punkte, `msProPunkt` Abstand. */
function bahn(haelften: number, opts: { a?: number; b?: number; quer?: number | ((i: number) => number); n?: number; msProPunkt?: number } = {}): SaegePunkt[] {
  const { a = 100, b = 220, n = 10, msProPunkt = 20 } = opts;
  const quer = typeof opts.quer === 'function' ? opts.quer : (): number => (opts.quer as number | undefined) ?? 100;
  const punkte: SaegePunkt[] = [{ laengs: a, quer: quer(0), t: 0 }];
  let t = 0;
  let i = 0;
  for (let h = 0; h < haelften; h++) {
    const [von, nach] = h % 2 === 0 ? [a, b] : [b, a];
    for (let k = 1; k <= n; k++) {
      t += msProPunkt;
      i += 1;
      punkte.push({ laengs: von + ((nach - von) * k) / n, quer: quer(i), t });
    }
  }
  return punkte;
}

describe('Sägezug-Erkennung', () => {
  it('ein Hin + Her = ein Zug (Ende beim Abheben)', () => {
    const zuege = erkenneSaegezuege(bahn(2), OPT);
    expect(zuege).toHaveLength(1);
    expect(zuege[0]?.hubPx).toBeCloseTo(120);
  });

  it('nur Hin zählt nicht', () => {
    expect(erkenneSaegezuege(bahn(1), OPT)).toHaveLength(0);
  });

  it('Richtungsumkehr: 8 Hälften = 4 Züge, 7 Hälften = 3 Züge', () => {
    expect(erkenneSaegezuege(bahn(8), OPT)).toHaveLength(4);
    expect(erkenneSaegezuege(bahn(7), OPT)).toHaveLength(3);
  });

  it('Zug wird schon bei der nächsten Umkehr gemeldet, nicht erst beim Abheben', () => {
    const p = bahn(3);
    let z = saegezugStart(p[0] as SaegePunkt);
    const gemeldetBei: number[] = [];
    p.slice(1).forEach((pt, i) => {
      const s = saegezugSchritt(z, pt, OPT);
      z = s.zustand;
      if (s.zug) gemeldetBei.push(i + 1);
    });
    expect(gemeldetBei).toHaveLength(1);
    // Umkehr am Ende der 2. Hälfte (Punkt 20) wird erkannt, sobald der Rücklauf ≥ umkehrPx ist
    expect(gemeldetBei[0]).toBeGreaterThan(20);
    expect(gemeldetBei[0]).toBeLessThanOrEqual(22);
  });

  it('Zittern unterhalb der Hysterese ist keine Umkehr', () => {
    const p: SaegePunkt[] = [];
    let t = 0;
    for (let y = 100; y <= 220; y += 10) p.push({ laengs: y, quer: 100, t: (t += 20) });
    // Zittern ±4 px am oberen Ende
    p.push({ laengs: 216, quer: 100, t: (t += 20) }, { laengs: 220, quer: 100, t: (t += 20) }, { laengs: 216, quer: 100, t: (t += 20) });
    for (let y = 210; y >= 100; y -= 10) p.push({ laengs: y, quer: 100, t: (t += 20) });
    expect(erkenneSaegezuege(p, OPT)).toHaveLength(1);
  });

  it('zu kurzer Hub (< minHubPx) zählt nicht', () => {
    expect(erkenneSaegezuege(bahn(4, { a: 100, b: 120 }), OPT)).toHaveLength(0);
  });

  it('Tempo: Weg/Zeit relativ zur Referenz, begrenzt auf 0..2', () => {
    // 240 px in 400 ms = 0,6 px/ms → 1,2
    const normal = erkenneSaegezuege(bahn(2, { n: 10, msProPunkt: 20 }), OPT)[0];
    expect(normal?.tempo).toBeCloseTo(1.2, 2);
    // langsam: 240 px in 2000 ms → 0,24
    const langsam = erkenneSaegezuege(bahn(2, { n: 10, msProPunkt: 100 }), OPT)[0];
    expect(langsam?.tempo).toBeCloseTo(0.24, 2);
    // sehr schnell → 2 (Obergrenze)
    const schnell = erkenneSaegezuege(bahn(2, { n: 10, msProPunkt: 1 }), OPT)[0];
    expect(schnell?.tempo).toBe(2);
  });

  it('Tempo 0 Zeitdifferenz führt nicht zu Unendlich/NaN', () => {
    const zug = erkenneSaegezuege(bahn(2, { msProPunkt: 0 }), OPT)[0];
    expect(Number.isFinite(zug?.tempo)).toBe(true);
    expect(zug?.tempo).toBe(2);
  });

  it('Seitenabweichung: Mitte = 0, rechts +, links −, begrenzt auf ±1', () => {
    expect(erkenneSaegezuege(bahn(2, { quer: 100 }), OPT)[0]?.seitenabweichung).toBeCloseTo(0);
    expect(erkenneSaegezuege(bahn(2, { quer: 125 }), OPT)[0]?.seitenabweichung).toBeCloseTo(0.5);
    expect(erkenneSaegezuege(bahn(2, { quer: 80 }), OPT)[0]?.seitenabweichung).toBeCloseTo(-0.4);
    expect(erkenneSaegezuege(bahn(2, { quer: 400 }), OPT)[0]?.seitenabweichung).toBe(1);
    expect(erkenneSaegezuege(bahn(2, { quer: -400 }), OPT)[0]?.seitenabweichung).toBe(-1);
  });

  it('Seitenabweichung wird je Zug neu gemittelt (Gegenlenken wirkt im nächsten Zug)', () => {
    const zuege = erkenneSaegezuege(bahn(4, { quer: (i) => (i <= 20 ? 140 : 70) }), OPT);
    expect(zuege).toHaveLength(2);
    expect(zuege[0]?.seitenabweichung).toBeGreaterThan(0.6);
    expect(zuege[1]?.seitenabweichung).toBeLessThan(-0.4);
  });

  it('Startrichtung egal (erst runter, dann hoch)', () => {
    expect(erkenneSaegezuege(bahn(4, { a: 300, b: 150 }), OPT)).toHaveLength(2);
  });

  it('ohne Start (inaktiv) passiert nichts; Ende setzt zurück', () => {
    const ende = saegezugEnde(saegezugStart({ laengs: 0, quer: 0, t: 0 }), { laengs: 3, quer: 0, t: 10 }, OPT);
    expect(ende.zug).toBeNull();
    expect(ende.zustand.aktiv).toBe(false);
    expect(saegezugSchritt(ende.zustand, { laengs: 100, quer: 0, t: 20 }, OPT).zug).toBeNull();
    expect(erkenneSaegezuege([], OPT)).toEqual([]);
  });

  it('Zeit spielt für die Erkennung keine Rolle (langsamer Hauptthread)', () => {
    expect(erkenneSaegezuege(bahn(4, { msProPunkt: 400 }), OPT)).toHaveLength(2);
  });
});
