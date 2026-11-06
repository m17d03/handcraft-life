/** Ticket 017 (N3): Lichtspalt am Anschlagwinkel folgt der gezeichneten Schräge (endenScheren). */
import { describe, expect, it } from 'vitest';
import { endenScheren, ENDWINKEL_UEBERZEICHNUNG, LICHTSPALT_MIN_M, lichtspalt } from '../../../src/render/werkstatt-szene';

const L = 2;
const B = 0.14;
const k = (grad: number): number => Math.tan((grad * ENDWINKEL_UEBERZEICHNUNG * Math.PI) / 180);

/** Stirnlinie aus der echten Brettgeometrie: Eckpunkte nach endenScheren. */
function stirn(wLinks: number, wRechts: number): { links: [number, number][]; rechts: [number, number][] } {
  const ecken = new Float32Array([-L / 2, 0, -B / 2, -L / 2, 0, B / 2, L / 2, 0, -B / 2, L / 2, 0, B / 2]);
  endenScheren(ecken, wLinks, wRechts);
  return {
    links: [[ecken[0] ?? 0, -B / 2], [ecken[3] ?? 0, B / 2]],
    rechts: [[ecken[6] ?? 0, -B / 2], [ecken[9] ?? 0, B / 2]],
  };
}

describe('Lichtspalt', () => {
  it('rechtwinkliges Ende: kein Spalt, Zunge liegt an der Stirn', () => {
    const l = lichtspalt(L, B, -1, 0);
    expect(l.spaltM).toBeCloseTo(0, 9);
    expect(l.zungeX).toBeCloseTo(-L / 2, 9);
  });

  it('sauberes Ende (≤ 0,3 mm auf 70 mm) bleibt unter der Leuchtschwelle', () => {
    const w = (Math.atan(0.3 / 70) * 180) / Math.PI;
    expect(lichtspalt(L, B, 1, k(w)).spaltM).toBeLessThan(LICHTSPALT_MIN_M);
  });

  for (const [seite, grad] of [[-1, 1.2], [-1, -1.2], [1, 0.9], [1, -1.6]] as const) {
    it(`Seite ${String(seite)}, ${String(grad)}°: Zunge am vorstehenden Punkt, Spalt = Versatz der Stirn`, () => {
      const s = stirn(seite < 0 ? grad : 0, seite > 0 ? grad : 0);
      const punkte = seite < 0 ? s.links : s.rechts;
      const aussen = punkte.reduce((a, b) => (seite * b[0] > seite * a[0] ? b : a));
      const innen = punkte.find((p) => p !== aussen) ?? aussen;
      const l = lichtspalt(L, B, seite, k(grad));
      expect(l.zungeX).toBeCloseTo(aussen[0], 6);
      expect(l.zAnlage).toBeCloseTo(aussen[1], 9);
      expect(l.zOffen).toBeCloseTo(innen[1], 9);
      expect(l.spaltM).toBeCloseTo(Math.abs(aussen[0] - innen[0]), 6);
      // Schiefe Enden (1–2 mm auf halber Breite) leuchten sicher
      expect(l.spaltM).toBeGreaterThan(LICHTSPALT_MIN_M * 1.5);
    });
  }
});
