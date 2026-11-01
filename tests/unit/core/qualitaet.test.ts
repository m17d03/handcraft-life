import { describe, expect, it } from 'vitest';
import { bewerten, mindestens, preisfaktor, rampe, stufeAusQ } from '../../../src/core/qualitaet';
import type { InhaltsId, Ursache } from '../../../src/core/typen';
import { REGALBRETT } from '../../../src/modules/holz/data/stammdaten';

const AST = 'holz.merkmal.ast';
const ENDRISS = 'holz.merkmal.endriss';

function q(
  messwerte: Record<string, number>,
  merkmale: InhaltsId[] = [],
  ursachen: Ursache[] = [],
  toleranz: Record<string, number> = { delta_l_mm: 1 },
) {
  return bewerten(REGALBRETT.bewertung, { messwerte, merkmale: new Set(merkmale), toleranz, ursachen, auftragId: 'af_1' });
}

describe('Qualitätsformel – Rechenbeispiele holz-brett-zuschnitt §4.2', () => {
  it('Profi: ΔL 0,4 · Δα 0,3° · sauber · ok → Q 100, A', () => {
    const r = q({ delta_l_mm: 0.4, delta_winkel_grad: 0.3, ausriss: 0 });
    expect(r.q).toBe(100);
    expect(r.stufe).toBe('A');
  });

  it('Gut, Blatt auf Linie: ΔL 0,8 · Δα 0,5° · sauber · ok → Q 95, A', () => {
    const r = q({ delta_l_mm: 0.8, delta_winkel_grad: 0.5, ausriss: 0 });
    expect(r.q).toBe(95);
    expect(r.stufe).toBe('A');
  });

  it('Anfänger: ΔL 2,5 · Δα 1,5° · kleiner Ausriss · ok → Q 59, C (Toleranz verletzt)', () => {
    const r = q({ delta_l_mm: 2.5, delta_winkel_grad: 1.5, ausriss: 1 });
    expect(r.q).toBe(59);
    expect(r.stufe).toBe('C');
  });

  it('Hastig, schief: ΔL 1,0 · Δα 3,0° · grosser Ausriss · Ast → Q 41, D', () => {
    const r = q({ delta_l_mm: 1.0, delta_winkel_grad: 3.0, ausriss: 2 }, [AST]);
    expect(r.q).toBe(41);
    expect(r.stufe).toBe('D');
  });
});

describe('Qualität – Sonderregeln', () => {
  it('Toleranz verletzt kappt eine A-Arbeit auf C, Q bleibt', () => {
    const r = q({ delta_l_mm: 1.2, delta_winkel_grad: 0, ausriss: 0 }, [], [
      { id: 'kern.text.blatt-auf-linie', messwert: 'delta_l_mm', wert: -1.2 },
    ]);
    expect(r.q).toBe(94);
    expect(r.stufe).toBe('C');
    expect(r.hauptursache).toBe('kern.text.blatt-auf-linie');
    expect(r.hauptursacheWert).toBe(-1.2);
  });

  it('Toleranz genau eingehalten (ΔL = 1,0) kappt nicht', () => {
    expect(q({ delta_l_mm: 1.0, delta_winkel_grad: 0, ausriss: 0 }).stufe).toBe('A');
  });

  it('Toleranzkappung verbessert eine schlechtere Stufe nicht', () => {
    expect(q({ delta_l_mm: 3, delta_winkel_grad: 2, ausriss: 2 }).stufe).toBe('D'); // Q 39
  });

  it('Toleranz verletzt ohne Prozess-Ursache → Ursache des Kriteriums', () => {
    const r = q({ delta_l_mm: 2, delta_winkel_grad: 0, ausriss: 0 });
    expect(r.hauptursache).toBe('holz.text.laenge-ungenau');
    expect(r.hauptursacheWert).toBe(2);
  });

  it('Endriss im Werkstück → Ausschuss trotz Q 100', () => {
    const r = q({ delta_l_mm: 0, delta_winkel_grad: 0, ausriss: 0 }, [ENDRISS]);
    expect(r.q).toBe(100);
    expect(r.stufe).toBe('ausschuss');
    expect(r.hauptursache).toBe(ENDRISS);
  });

  it('Untermass ≥ 5 mm → Ausschuss für diesen Auftrag', () => {
    const r = q({ delta_l_mm: 5, abweichung_l_mm: -5, delta_winkel_grad: 0, ausriss: 0 });
    expect(r.stufe).toBe('ausschuss');
    expect(r.hauptursache).toBe('kern.text.zu-kurz');
    expect(q({ delta_l_mm: 5, abweichung_l_mm: 5, delta_winkel_grad: 0, ausriss: 0 }).stufe).toBe('C');
  });

  it('Q < 35 → Ausschuss', () => {
    const r = q({ delta_l_mm: 5, delta_winkel_grad: 3, ausriss: 2 }, [AST]);
    expect(r.q).toBe(5);
    expect(r.stufe).toBe('ausschuss');
  });

  it('Hauptursache: grösster Punktverlust, genaueste Prozess-Ursache zuerst', () => {
    const r = q({ delta_l_mm: 0, delta_winkel_grad: 2, ausriss: 0 }, [], [
      { id: 'kern.text.schief-gesaegt', messwert: 'delta_winkel_grad', wert: -2 },
    ]);
    expect(r.hauptursache).toBe('kern.text.schief-gesaegt');
    expect(r.hauptursacheWert).toBe(-2);
  });

  it('Hauptursache Ast, wenn nur der Ast Punkte kostet; sonst „sauber“', () => {
    expect(q({ delta_l_mm: 0, delta_winkel_grad: 0, ausriss: 0 }, [AST]).hauptursache).toBe(AST);
    expect(q({ delta_l_mm: 0, delta_winkel_grad: 0, ausriss: 0 }).hauptursache).toBe('kern.text.sauber');
  });

  it('Punkte je Kriterium werden ausgewiesen', () => {
    const r = q({ delta_l_mm: 2.5, delta_winkel_grad: 1.5, ausriss: 1 });
    expect(r.punkte).toEqual({ delta_l_mm: 22.22, delta_winkel_grad: 16.67, ausriss: 10, [AST]: 10 });
  });
});

describe('Stufen und Preisfaktoren', () => {
  it('Schwellen 90/75/55/35', () => {
    expect([90, 89, 75, 74, 55, 54, 35, 34].map(stufeAusQ)).toEqual(['A', 'B', 'B', 'C', 'C', 'D', 'D', 'ausschuss']);
  });
  it('Preisfaktor A 1,3 · B 1,0 · C 0,7 · D 0,4 · Ausschuss 0', () => {
    expect((['A', 'B', 'C', 'D', 'ausschuss'] as const).map(preisfaktor)).toEqual([1.3, 1.0, 0.7, 0.4, 0]);
  });
  it('mindestens() vergleicht Stufen', () => {
    expect(mindestens('A', 'B')).toBe(true);
    expect(mindestens('C', 'B')).toBe(false);
    expect(mindestens('ausschuss', 'D')).toBe(false);
  });
  it('rampe(): voll bis, null ab, linear dazwischen', () => {
    expect(rampe(40, 0.5, 0.5, 5)).toBe(40);
    expect(rampe(40, 5, 0.5, 5)).toBe(0);
    expect(rampe(40, 9, 0.5, 5)).toBe(0);
    expect(rampe(40, 2.75, 0.5, 5)).toBeCloseTo(20);
  });
});
