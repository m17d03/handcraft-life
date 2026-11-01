import { describe, expect, it } from 'vitest';
import { bezugsfehler, werkstueckErzeugen } from '../../../src/core/werkstueck';
import { zufallsquelle } from '../../../src/core/zufall';
import { FICHTE_BRETT } from '../../../src/modules/holz/data/stammdaten';
import { ausrissStufe, rohbrettFehlerRegel } from '../../../src/modules/holz/logic/regeln';
import { holzModul, holzSpeicher } from '../../../src/modules/holz/module';

/** Zufall aus einer festen Liste. */
const liste = (werte: number[]) => {
  let i = 0;
  return () => werte[i++] ?? 0.99;
};

describe('Modul holz – Manifest', () => {
  it('ID-Präfixe nach ADR 0002 und Pflichtangaben', () => {
    const ids = Object.values(holzModul.provides).flat();
    expect(ids).toContain('holz.material.fichte-brett-2000');
    expect(ids.every((id) => id.startsWith('holz.'))).toBe(true);
    expect(holzModul.mechanics.length).toBeGreaterThan(0);
    expect(holzModul.requires.core).toBe('^0.1.0');
  });

  it('Speicherabschnitt: Schema 1, Defaults gültig, Fremdes ungültig', () => {
    expect(holzSpeicher.schemaVersion).toBe(1);
    expect(holzSpeicher.validate(holzSpeicher.defaults())).toBe(true);
    expect(holzSpeicher.validate(null)).toBe(false);
    expect(holzSpeicher.validate([])).toBe(false);
    expect(holzSpeicher.validate({ x: 1 })).toBe(false);
  });
});

describe('Regel Ausriss', () => {
  it('Stufen: ≤ 1 keiner, > 1 klein, > 1,5 gross', () => {
    expect([0, 1, 1.01, 1.5, 1.51, 3].map(ausrissStufe)).toEqual([0, 0, 1, 1, 2, 2]);
  });
});

describe('Regel Rohbrett-Fehler', () => {
  const basis = () =>
    werkstueckErzeugen(FICHTE_BRETT, 'ws_1', () => 0.5, []);

  it('Endriss am schiefen Werksende mit Länge 20–80 mm, Ast in der Fläche', () => {
    // basis(): zufall 0.5 → gutes Ende b, schiefes Ende a. endriss_p ja (0.1), Länge 20 + 60 × 0.5 = 50,
    // Ast ja (0.1), Position 100 + 1800 × 0.5
    const ws = rohbrettFehlerRegel.anwenden(basis(), FICHTE_BRETT, liste([0.1, 0.5, 0.1, 0.5]));
    expect(ws.enden.a.merkmale).toEqual([{ id: 'holz.merkmal.endriss', laenge_mm: 50 }]);
    expect(ws.enden.b.merkmale).toEqual([]);
    expect(ws.merkmale).toEqual([{ id: 'holz.merkmal.ast', pos_mm: 1000 }]);
  });

  it('ohne Treffer bleibt das Brett fehlerfrei; das Eingangsbrett wird nicht verändert', () => {
    const vorher = basis();
    const ws = rohbrettFehlerRegel.anwenden(vorher, FICHTE_BRETT, liste([0.9, 0.9]));
    expect(ws.enden.a.merkmale).toEqual([]);
    expect(ws.enden.b.merkmale).toEqual([]);
    expect(ws.merkmale).toEqual([]);
    const mitRiss = rohbrettFehlerRegel.anwenden(vorher, FICHTE_BRETT, liste([0.1, 0.5, 0.9]));
    expect(mitRiss.enden.a.merkmale).toHaveLength(1);
    expect(vorher.enden.a.merkmale).toEqual([]);
  });

  it('über viele Bretter: ca. 50 % Endriss, ca. 30 % Ast, Bezugsfehler −2…+2 mm', () => {
    const rng = zufallsquelle(2026);
    let risse = 0;
    let aeste = 0;
    for (let i = 0; i < 2000; i++) {
      const ws = werkstueckErzeugen(FICHTE_BRETT, `ws_${String(i)}`, rng.zufall, [rohbrettFehlerRegel]);
      if (ws.enden.a.merkmale.length + ws.enden.b.merkmale.length > 0) risse++;
      if (ws.merkmale.length > 0) aeste++;
      for (const ende of ['a', 'b'] as const) {
        expect(Math.abs(bezugsfehler(ws, ende))).toBeLessThanOrEqual(2);
      }
    }
    expect(risse / 2000).toBeGreaterThan(0.45);
    expect(risse / 2000).toBeLessThan(0.55);
    expect(aeste / 2000).toBeGreaterThan(0.26);
    expect(aeste / 2000).toBeLessThan(0.34);
  });

  it('Regeln anderer Materialklassen greifen nicht', () => {
    const metall = { ...FICHTE_BRETT, id: 'metall.material.x', klasse: 'metall' as const };
    const ws = werkstueckErzeugen(metall, 'ws_1', () => 0, [rohbrettFehlerRegel]);
    expect(ws.enden.a.merkmale).toEqual([]);
    expect(ws.merkmale).toEqual([]);
  });
});

describe('Rohbrett: ein sauberes, ein schiefes Ende (Director-Entscheid 2026-11-01)', () => {
  it('über 500 Seeds: ein Ende ≤ 0,3 mm, das andere 1–2 mm Bezugsfehler; Endriss nur am schiefen Ende', () => {
    for (let seed = 1; seed <= 500; seed++) {
      let x = seed * 9301 + 49297;
      const zufall = (): number => {
        x = (x * 9301 + 49297) % 233280;
        return x / 233280;
      };
      const ws = rohbrettFehlerRegel.anwenden(werkstueckErzeugen(FICHTE_BRETT, 'ws', zufall, []), FICHTE_BRETT, zufall);
      const fa = Math.abs(bezugsfehler(ws, 'a'));
      const fb = Math.abs(bezugsfehler(ws, 'b'));
      const [gut, schief] = fa <= fb ? [fa, fb] : [fb, fa];
      expect(gut).toBeLessThanOrEqual(0.3 + 1e-9);
      expect(schief).toBeGreaterThanOrEqual(1 - 1e-9);
      expect(schief).toBeLessThanOrEqual(2 + 1e-9);
      const gutesEnde = fa <= fb ? 'a' : 'b';
      expect(ws.enden[gutesEnde].merkmale).toEqual([]);
    }
  });
});
