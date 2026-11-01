import { describe, expect, it } from 'vitest';
import { MASSBAND } from '../../../src/core/kern-modul';
import {
  datenwert,
  driftNachZug,
  messen,
  tempoGrenze,
  trennen,
  type TrennenEingabe,
  type Zug,
} from '../../../src/core/prozesse';
import type { Werkstueck } from '../../../src/core/typen';
import { bezugsfehler } from '../../../src/core/werkstueck';
import { FICHTE_BRETT, FUCHSSCHWANZ } from '../../../src/modules/holz/data/stammdaten';
import { katalog, sauberesBrett } from './hilfen';

const gerade = (n = 8, tempo = 1): Zug[] => Array.from({ length: n }, () => ({ seitenabweichung: 0, tempo }));

function schnitt(ws: Werkstueck, e: Partial<TrennenEingabe> = {}) {
  return trennen(
    { werkstueck: ws, material: FICHTE_BRETT, werkzeug: FUCHSSCHWANZ, mod: (_id, b) => b, zufall: () => 0.5, regeln: katalog.regeln },
    {
      bezugsende: 'a',
      markierung_mm: 600,
      blattversatz_mm: 0.8,
      zuege: gerade(),
      stuetzen: false,
      soll_mm: 600,
      teilId: 'teil',
      restId: 'rest',
      ...e,
    },
  );
}

describe('messen (kern.prozess.messen)', () => {
  const ws = sauberesBrett();
  it('rundet auf das Raster 0,5 mm des Massbands', () => {
    expect(messen(ws, 600.3, MASSBAND)).toBe(600.5);
    expect(messen(ws, 600.2, MASSBAND)).toBe(600);
    expect(messen(ws, 599.76, MASSBAND)).toBe(600);
  });
  it('begrenzt auf das Werkstück', () => {
    expect(messen(ws, -20, MASSBAND)).toBe(0);
    expect(messen(ws, 2500, MASSBAND)).toBe(2000);
  });
});

describe('trennen – Länge (Formel §4.1)', () => {
  it('Blatt bündig auf der Abfallseite (+0,8) → ± 0 mm', () => {
    const r = schnitt(sauberesBrett(), { blattversatz_mm: 0.8 });
    expect(r.messwerte['laenge_ist_mm']).toBe(600);
    expect(r.messwerte['delta_l_mm']).toBe(0);
    expect(r.ursachen).toEqual([]);
  });

  it('Blatt mittig auf der Linie (0) → −0,8 mm', () => {
    const r = schnitt(sauberesBrett(), { blattversatz_mm: 0 });
    expect(r.messwerte['laenge_ist_mm']).toBe(599.2);
    expect(r.messwerte['abweichung_l_mm']).toBe(-0.8);
    expect(r.ursachen[0]).toEqual({ id: 'kern.text.blatt-auf-linie', messwert: 'delta_l_mm', wert: -0.8 });
  });

  it('Blatt auf der Werkstückseite (−0,8) → −1,6 mm', () => {
    const r = schnitt(sauberesBrett(), { blattversatz_mm: -0.8 });
    expect(r.messwerte['laenge_ist_mm']).toBe(598.4);
    expect(r.ursachen[0]?.id).toBe('kern.text.blatt-werkstueckseite');
  });

  it('Blatt zu weit im Abfall → zu lang', () => {
    const r = schnitt(sauberesBrett(), { blattversatz_mm: 2 });
    expect(r.messwerte['laenge_ist_mm']).toBe(601.2);
    expect(r.ursachen[0]?.id).toBe('kern.text.blatt-zu-weit-im-abfall');
  });

  it('Falsch gemessen wird als Ursache erkannt', () => {
    const r = schnitt(sauberesBrett(), { markierung_mm: 603 });
    expect(r.ursachen[0]).toEqual({ id: 'kern.text.falsch-gemessen', messwert: 'delta_l_mm', wert: 3 });
  });

  it('Bezugsfehler am schiefen Werksende geht in die Länge ein (+2 mm)', () => {
    const winkel = (Math.atan(2 / 70) * 180) / Math.PI;
    const ws = sauberesBrett('x', { enden: { a: { winkel_grad: winkel, merkmale: [] }, b: { winkel_grad: 0, merkmale: [] } } });
    expect(bezugsfehler(ws, 'a')).toBe(2);
    expect(bezugsfehler(ws, 'b')).toBe(0);
    const r = schnitt(ws);
    expect(r.messwerte['laenge_ist_mm']).toBe(602);
    expect(r.ursachen[0]?.id).toBe('kern.text.schiefes-bezugsende');
    expect(schnitt(ws, { bezugsende: 'b' }).messwerte['laenge_ist_mm']).toBe(600);
  });

  it('ohne Soll keine Längen-Ursachen und kein delta_l_mm', () => {
    const r = trennen(
      { werkstueck: sauberesBrett(), material: FICHTE_BRETT, werkzeug: FUCHSSCHWANZ, mod: (_i, b) => b, zufall: () => 0, regeln: [] },
      { bezugsende: 'a', markierung_mm: 600, blattversatz_mm: 0, zuege: gerade(), stuetzen: false, teilId: 't', restId: 'r' },
    );
    expect(r.messwerte['delta_l_mm']).toBeUndefined();
    expect(r.ursachen.map((u) => u.id)).toEqual(['kern.text.blatt-auf-linie']);
  });
});

describe('trennen – Teil und Reststück', () => {
  it('Rest = Brett − Teil − Fuge, Schnittenden tragen die Drift', () => {
    const r = schnitt(sauberesBrett(), { zuege: [{ seitenabweichung: 1, tempo: 1 }, ...gerade(7)] });
    const [teil, rest] = r.werkstuecke;
    expect(teil?.masse_mm.l).toBe(600);
    expect(rest?.masse_mm.l).toBe(1398.4);
    expect(rest?.herkunft).toBe('rest');
    expect(teil?.herkunft).toBe('schnitt');
    expect(teil?.enden.b.winkel_grad).toBe(0.35);
    expect(rest?.enden.a.winkel_grad).toBe(-0.35);
    expect(r.messwerte['rest_mm']).toBe(1398.4);
  });

  it('kein Reststück, wenn bis ans Ende gemessen wird', () => {
    const r = schnitt(sauberesBrett(), { markierung_mm: 2000 });
    expect(r.werkstuecke).toHaveLength(1);
    expect(r.messwerte['rest_mm']).toBe(0);
  });

  it('Ast und Endriss wandern mit dem richtigen Stück (Bezug a und b)', () => {
    const ws = sauberesBrett('x', {
      merkmale: [{ id: 'holz.merkmal.ast', pos_mm: 1000 }, { id: 'holz.merkmal.ast', pos_mm: 1700 }, { id: 'kern.merkmal.ohne-pos' }],
      enden: { a: { winkel_grad: 0, merkmale: [{ id: 'holz.merkmal.endriss', wert: 50 }] }, b: { winkel_grad: 0, merkmale: [] } },
    });
    const vonA = schnitt(ws, { bezugsende: 'a' });
    expect(vonA.werkstuecke[0]?.enden.a.merkmale.map((m) => m.id)).toEqual(['holz.merkmal.endriss']);
    expect(vonA.werkstuecke[0]?.merkmale).toEqual([{ id: 'kern.merkmal.ohne-pos' }]);
    expect(vonA.werkstuecke[1]?.merkmale).toEqual([
      { id: 'holz.merkmal.ast', pos_mm: 398.4 },
      { id: 'holz.merkmal.ast', pos_mm: 1098.4 },
      { id: 'kern.merkmal.ohne-pos' },
    ]);

    const vonB = schnitt(ws, { bezugsende: 'b' });
    expect(vonB.werkstuecke[0]?.enden.a.merkmale).toEqual([]);
    expect(vonB.werkstuecke[0]?.merkmale).toEqual([{ id: 'holz.merkmal.ast', pos_mm: 300 }, { id: 'kern.merkmal.ohne-pos' }]);
    expect(vonB.werkstuecke[1]?.enden.b.merkmale.map((m) => m.id)).toEqual(['holz.merkmal.endriss']);
    expect(vonB.werkstuecke[1]?.merkmale).toEqual([{ id: 'holz.merkmal.ast', pos_mm: 398.4 }, { id: 'kern.merkmal.ohne-pos' }]);
  });
});

describe('trennen – Drift und Gegenlenken', () => {
  it('Drift pro Zug = Abweichung × 0,35° × Werkzeugfaktor', () => {
    expect(driftNachZug(0, 0, { seitenabweichung: 1, tempo: 1 }, FUCHSSCHWANZ)).toBeCloseTo(0.35);
    expect(driftNachZug(0, 0, { seitenabweichung: -0.5, tempo: 1 }, FUCHSSCHWANZ)).toBeCloseTo(-0.175);
    expect(driftNachZug(0, 0, { seitenabweichung: 5, tempo: 1 }, FUCHSSCHWANZ)).toBeCloseTo(0.35); // begrenzt
  });

  it('Gegenlenken in den ersten 3 Zügen baut Drift ab', () => {
    const r = schnitt(sauberesBrett(), {
      zuege: [{ seitenabweichung: 1, tempo: 1 }, { seitenabweichung: -1, tempo: 1 }, ...gerade(6)],
    });
    expect(r.messwerte['drift_grad']).toBe(0);
    expect(r.ursachen.some((u) => u.messwert === 'delta_winkel_grad')).toBe(false);
  });

  it('Gegenlenken ab Zug 4 ist wirkungslos', () => {
    const r = schnitt(sauberesBrett(), {
      zuege: [
        ...Array.from({ length: 3 }, () => ({ seitenabweichung: 1, tempo: 1 })),
        ...Array.from({ length: 5 }, () => ({ seitenabweichung: -1, tempo: 1 })),
      ],
    });
    expect(r.messwerte['drift_grad']).toBe(1.05);
    expect(r.messwerte['delta_winkel_grad']).toBe(1.05);
    expect(r.ursachen.find((u) => u.messwert === 'delta_winkel_grad')?.id).toBe('kern.text.schief-gesaegt');
  });

  it('Fehler ab Zug 4 verschlimmern die Drift weiterhin', () => {
    const zuege = [...gerade(3), ...Array.from({ length: 5 }, () => ({ seitenabweichung: -1, tempo: 1 }))];
    expect(schnitt(sauberesBrett(), { zuege }).messwerte['drift_grad']).toBe(-1.75);
    expect(driftNachZug(0.5, 5, { seitenabweichung: 1, tempo: 1 }, FUCHSSCHWANZ)).toBeCloseTo(0.85);
    expect(driftNachZug(0.5, 5, { seitenabweichung: -1, tempo: 1 }, FUCHSSCHWANZ)).toBe(0.5);
  });

  it('Skill-Modifikator wirkt auf die Drift pro Zug', () => {
    expect(driftNachZug(0, 0, { seitenabweichung: 1, tempo: 1 }, FUCHSSCHWANZ, (_id, b) => b * 0.85)).toBeCloseTo(0.2975);
  });
});

describe('trennen – Tempo am Ende (Ausriss, Regel holz)', () => {
  const mitEnde = (tempo: number): Zug[] => [...gerade(6, 2), { seitenabweichung: 0, tempo: 0.5 }, { seitenabweichung: 0, tempo }];

  it('Tempo ≤ Grenze → kein Ausriss; schnelle frühe Züge zählen nicht', () => {
    const r = schnitt(sauberesBrett(), { zuege: mitEnde(1) });
    expect(r.messwerte['ausriss']).toBe(0);
  });

  it('Tempo > Grenze → kleiner Ausriss; > 1,5 × Grenze → grosser Ausriss', () => {
    const klein = schnitt(sauberesBrett(), { zuege: mitEnde(1.2) });
    expect(klein.messwerte['ausriss']).toBe(1);
    expect(klein.werkstuecke[0]?.enden.b.merkmale).toEqual([{ id: 'holz.merkmal.ausriss', wert: 1 }]);
    expect(klein.ursachen.at(-1)).toEqual({ id: 'holz.text.ausriss', messwert: 'ausriss', wert: 1 });
    expect(schnitt(sauberesBrett(), { zuege: mitEnde(1.6) }).messwerte['ausriss']).toBe(2);
  });

  it('„Abfall stützen“ hebt die Grenze um × 1,3', () => {
    expect(tempoGrenze(FUCHSSCHWANZ, true)).toBeCloseTo(1.3);
    expect(schnitt(sauberesBrett(), { zuege: mitEnde(1.2), stuetzen: true }).messwerte['ausriss']).toBe(0);
    expect(schnitt(sauberesBrett(), { zuege: mitEnde(1.6), stuetzen: true }).messwerte['ausriss']).toBe(1);
  });

  it('Kern allein (ohne Holz-Regeln) kennt keinen Ausriss', () => {
    const r = trennen(
      { werkstueck: sauberesBrett(), material: FICHTE_BRETT, werkzeug: FUCHSSCHWANZ, mod: (_i, b) => b, zufall: () => 0, regeln: [] },
      { bezugsende: 'a', markierung_mm: 600, blattversatz_mm: 0.8, zuege: mitEnde(2), stuetzen: false, teilId: 't', restId: 'r' },
    );
    expect(r.messwerte['ausriss']).toBeUndefined();
    expect(r.messwerte['tempo_verhaeltnis']).toBe(2);
  });
});

describe('Stammdaten-Zugriff', () => {
  it('fehlender Pflichtwert ist ein Datenfehler', () => {
    expect(() => datenwert({}, 'fuge_mm', 'holz.werkzeug.x')).toThrow(/fuge_mm/);
    expect(datenwert({ fuge_mm: 1.6 }, 'fuge_mm', 'holz.werkzeug.x')).toBe(1.6);
  });
});
