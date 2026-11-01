import { describe, expect, it } from 'vitest';
import {
  bildschirmNachBrettMm,
  brettMmNachBildschirm,
  brettStuecke,
  mmNachWelt,
  strahlNachBrettMm,
  weltXNachMm,
  type BrettLage,
} from '../../../src/render/brett-koordinaten';
import { forwardFromYawPitch, grad, screenRay, type Projektion } from '../../../src/render/mathe';
import { pickNaechstes } from '../../../src/render/picking';
import { BRETT, BRETT_OBEN_Y, KAMERA, WERKBANK_AABB } from '../../../src/render/werkstatt-layout';

const lageA: BrettLage = { laengeMm: 2000, bezugsende: 'a', schnittIstMm: null };
const lageB: BrettLage = { laengeMm: 2000, bezugsende: 'b', schnittIstMm: null };

function startProjektion(breite = 852, hoehe = 393): Projektion {
  return {
    eye: KAMERA.start.position,
    forward: forwardFromYawPitch(KAMERA.start.yaw, KAMERA.start.pitch),
    fovY: KAMERA.fovY,
    breite,
    hoehe,
  };
}

describe('mm ↔ Welt', () => {
  it('Ende a liegt links (−x), mm wachsen nach +x', () => {
    const p0 = mmNachWelt(lageA, 0);
    const p1 = mmNachWelt(lageA, 1000);
    expect(p0[0]).toBeCloseTo(BRETT.x - 1, 9);
    expect(p1[0]).toBeCloseTo(BRETT.x, 9);
    expect(p0[1]).toBeCloseTo(BRETT_OBEN_Y, 9);
    expect(p0[2]).toBeCloseTo(BRETT.z, 9);
  });

  it('Ende b liegt rechts (+x), mm wachsen nach −x', () => {
    expect(mmNachWelt(lageB, 0)[0]).toBeCloseTo(BRETT.x + 1, 9);
    expect(mmNachWelt(lageB, 250)[0]).toBeCloseTo(BRETT.x + 0.75, 9);
  });

  it('Bezugsende null zählt wie Ende a', () => {
    const lageNull: BrettLage = { ...lageA, bezugsende: null };
    expect(mmNachWelt(lageNull, 600)).toEqual(mmNachWelt(lageA, 600));
  });

  it('weltXNachMm ist die Umkehrung (beide Enden, auch Bruchteile)', () => {
    for (const lage of [lageA, lageB, { laengeMm: 1234.5, bezugsende: 'b', schnittIstMm: null } as const]) {
      for (const mm of [0, 0.5, 599.5, 600, 1234.5]) {
        expect(weltXNachMm(lage, mmNachWelt(lage, mm)[0])).toBeCloseTo(mm, 6);
      }
    }
  });

  it('querMm verschiebt Richtung Spieler (+z)', () => {
    expect(mmNachWelt(lageA, 0, 70)[2]).toBeCloseTo(BRETT.z + 0.07, 9);
  });
});

describe('Brett und Reststück', () => {
  it('ungeschnitten: ein Stück mit voller Länge auf der Werkbank', () => {
    const st = brettStuecke(lageA);
    expect(st).toHaveLength(1);
    expect(st[0]?.id).toBe('brett');
    expect(st[0]?.laengeMm).toBeCloseTo(2000, 6);
    expect(st[0]?.box.max[1]).toBeCloseTo(BRETT_OBEN_Y, 9);
  });

  it('geschnitten: Brett bleibt am Bezugsende, Reststück = Länge − Ist − Fuge, nach hinten versetzt', () => {
    for (const lage of [lageA, lageB]) {
      const st = brettStuecke({ ...lage, schnittIstMm: 598.4 });
      const brett = st.find((s) => s.id === 'brett');
      const rest = st.find((s) => s.id === 'reststueck');
      expect(brett?.laengeMm).toBeCloseTo(598.4, 6);
      expect(rest?.laengeMm).toBeCloseTo(2000 - 598.4 - BRETT.fugeMm, 6);
      // Ende des Bretts am Bezugsende unverändert
      const x0 = mmNachWelt(lage, 0)[0];
      expect(Math.min(Math.abs((brett?.box.min[0] ?? 0) - x0), Math.abs((brett?.box.max[0] ?? 0) - x0))).toBeLessThan(1e-9);
      expect(rest?.mitte[2]).toBeCloseTo(BRETT.z + BRETT.restVersatzZ, 9);
    }
  });

  it('Schnitt ganz am Ende → kein Reststück', () => {
    expect(brettStuecke({ ...lageA, schnittIstMm: 1999.5 })).toHaveLength(1);
  });
});

describe('Bildschirm ↔ Brett-mm (ohne WebGL)', () => {
  it('Rundweg mm → Bildschirm → mm ist genau (Startkamera, iPhone 15 quer)', () => {
    const proj = startProjektion();
    for (const lage of [lageA, lageB]) {
      for (const mm of [100, 600, 1000, 1500.5]) {
        const p = brettMmNachBildschirm(proj, lage, mm);
        expect(p).not.toBeNull();
        if (!p) continue;
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(852);
        expect(bildschirmNachBrettMm(proj, lage, p.x, p.y)).toBeCloseTo(mm, 3);
      }
    }
  });

  it('Punkt neben dem Brett → null; knapp daneben (Toleranz) → begrenzt', () => {
    const lage = lageA;
    const weit = { origin: [0, 2, BRETT.z + 0.5] as const, dir: [0, -1, 0] as const };
    expect(strahlNachBrettMm(lage, weit)).toBeNull();
    const knappLinks = { origin: [BRETT.x - 1.01, 2, BRETT.z] as const, dir: [0, -1, 0] as const };
    expect(strahlNachBrettMm(lage, knappLinks)).toBe(0);
    const nachOben = { origin: [0, 2, BRETT.z] as const, dir: [0, 1, 0] as const };
    expect(strahlNachBrettMm(lage, nachOben)).toBeNull();
  });

  it('Projektion hinter der Kamera → null', () => {
    const proj: Projektion = { eye: [0, 1.6, 0], forward: [0, 0, 1], fovY: grad(50), breite: 800, hoehe: 400 };
    expect(brettMmNachBildschirm(proj, lageA, 1000)).toBeNull();
  });
});

describe('Picking', () => {
  it('Brett-Mitte → brett (Brett liegt auf der Werkbank und gewinnt)', () => {
    const proj = startProjektion();
    const p = brettMmNachBildschirm(proj, lageA, 1000);
    if (!p) throw new Error('Brett nicht im Bild');
    const ziele = [...brettStuecke(lageA).map((s) => ({ id: s.id, box: s.box })), { id: 'werkbank', box: WERKBANK_AABB }];
    expect(pickNaechstes(screenRay(proj, p.x, p.y), ziele)).toBe('brett');
  });

  it('Werkbank neben dem Brett → werkbank, Himmel/Wand → null', () => {
    const ziele = [...brettStuecke(lageA).map((s) => ({ id: s.id, box: s.box })), { id: 'werkbank', box: WERKBANK_AABB }];
    const aufBank = { origin: [0, 2, -2.2] as const, dir: [0, -1, 0] as const };
    expect(pickNaechstes(aufBank, ziele)).toBe('werkbank');
    const insLeere = { origin: [0, 2, 0] as const, dir: [0, 1, 0] as const };
    expect(pickNaechstes(insLeere, ziele)).toBeNull();
  });
});
