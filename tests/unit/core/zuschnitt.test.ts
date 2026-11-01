import { describe, expect, it } from 'vitest';
import { ausfuehren, hatBrauchbaresMaterial, type Aktion } from '../../../src/core/zuschnitt';
import { nachNeuladen, neuerSpielzustand, type Spielzustand } from '../../../src/core/zustand';
import { bereit, folge, katalog, sauberesBrett, zuege, zuschnitt } from './hilfen';

const BRETT = 'holz.material.fichte-brett-2000';

function abgelehnt(z: Spielzustand, aktion: Aktion) {
  const vorher = JSON.stringify(z);
  const r = ausfuehren(katalog, z, aktion);
  expect(r.zustand).toBe(z);
  expect(r.ereignisse).toEqual([]);
  expect(JSON.stringify(z)).toBe(vorher);
  return r.grund;
}

describe('Neuer Spielstand', () => {
  it('Startgeld 40 G, Grundwerkzeuge, erster Auftrag Regalbrett 600 mm ± 2 mm (Einstieg) zu 14 G', () => {
    const z = neuerSpielzustand(katalog, 1);
    expect(z.inventar.geld).toBe(40);
    expect(z.inventar.schulden).toBe(0);
    expect(z.inventar.werkzeuge.map((w) => w.werkzeugId).sort()).toEqual(['holz.werkzeug.fuchsschwanz', 'kern.werkzeug.massband']);
    expect(z.auftraege).toEqual([
      {
        id: 'af_1',
        vorlageId: 'holz.auftrag.regalbrett',
        soll: { laenge_mm: 600 },
        toleranz: { delta_l_mm: 2 },
        basispreis: 14,
        kundeId: 'laufkunde',
        status: 'angeboten',
      },
    ]);
    expect(z.arbeit).toBeNull();
  });
});

describe('Zustandsautomat Zuschnitt', () => {
  it('voller Durchlauf bezugsende → messen → anreissen → ansetzen → saegen → ergebnis', () => {
    let z = bereit();
    const phasen: (string | null)[] = [];
    const schritte: Aktion[] = [
      { art: 'zuschnittBeginnen', werkstueckId: 'ws_test' },
      { art: 'bezugsendeWaehlen', ende: 'a' },
      { art: 'markierungSetzen', mm: 600 },
      { art: 'anreissen' },
      { art: 'blattVersatzSetzen', mm: 0.8 },
      ...zuege(8),
    ];
    for (const s of schritte) {
      const r = ausfuehren(katalog, z, s);
      expect(r.grund).toBeUndefined();
      for (const e of r.ereignisse) if (e.art === 'phase') phasen.push(e.phase);
      z = r.zustand;
    }
    expect(phasen).toEqual(['bezugsende', 'messen', 'anreissen', 'ansetzen', 'saegen', 'ergebnis']);
    const e = z.arbeit?.ergebnis;
    expect(e?.laenge_ist_mm).toBe(600);
    expect(e?.qualitaet.q).toBe(100);
    expect(e?.qualitaet.stufe).toBe('A');
    expect(e?.preis).toBe(18);
  });

  it('Sägezüge liefern Fortschritt, Drift und Tempo-Rückmeldung', () => {
    const z = folge(bereit(), [
      { art: 'zuschnittBeginnen', werkstueckId: 'ws_test' },
      { art: 'bezugsendeWaehlen', ende: 'a' },
      { art: 'markierungSetzen', mm: 600 },
      { art: 'anreissen' },
    ]).zustand;
    const r = ausfuehren(katalog, z, { art: 'saegezug', seitenabweichung: 1, tempo: 1.2 });
    expect(r.ereignisse).toContainEqual({ art: 'zug', nr: 1, von: 8, driftGrad: 0.35, tiefe01: 0.125, tempoOk: false });
    const gestuetzt = folge(z, [{ art: 'stuetzen', an: true }, { art: 'saegezug', seitenabweichung: 0, tempo: 1.2 }]);
    expect(gestuetzt.ereignisse.at(-1)).toMatchObject({ art: 'zug', tempoOk: true });
  });

  it('ungültige Übergänge werfen nicht und liefern unveränderten Zustand + Grund', () => {
    const z = bereit();
    expect(abgelehnt(z, { art: 'anreissen' })).toBe('keine-arbeit');
    expect(abgelehnt(z, { art: 'abliefern' })).toBe('keine-arbeit');
    expect(abgelehnt(z, { art: 'zuschnittBeginnen', werkstueckId: 'gibt-es-nicht' })).toBe('werkstueck-unbekannt');

    const begonnen = folge(z, [{ art: 'zuschnittBeginnen', werkstueckId: 'ws_test' }]).zustand;
    expect(abgelehnt(begonnen, { art: 'zuschnittBeginnen', werkstueckId: 'ws_test' })).toBe('arbeit-laeuft');
    expect(abgelehnt(begonnen, { art: 'markierungSetzen', mm: 600 })).toBe('falsche-phase');
    expect(abgelehnt(begonnen, { art: 'saegezug', seitenabweichung: 0, tempo: 1 })).toBe('falsche-phase');
    expect(abgelehnt(begonnen, { art: 'weiter' })).toBe('falsche-phase');

    const messen = folge(begonnen, [{ art: 'bezugsendeWaehlen', ende: 'b' }]).zustand;
    expect(abgelehnt(messen, { art: 'anreissen' })).toBe('falsche-phase');
    expect(abgelehnt(messen, { art: 'markierungSetzen', mm: Number.NaN })).toBe('ungueltige-aktion');
    expect(abgelehnt(messen, { art: 'blattVersatzSetzen', mm: 0 })).toBe('falsche-phase');

    const ansetzen = folge(messen, [{ art: 'markierungSetzen', mm: 600 }, { art: 'anreissen' }]).zustand;
    expect(abgelehnt(ansetzen, { art: 'saegezug', seitenabweichung: 0, tempo: -1 })).toBe('ungueltige-aktion');
    expect(abgelehnt(ansetzen, { art: 'saegezug', seitenabweichung: Number.NaN, tempo: 1 })).toBe('ungueltige-aktion');
    expect(abgelehnt(ansetzen, { art: 'blattVersatzSetzen', mm: Number.POSITIVE_INFINITY })).toBe('ungueltige-aktion');
    expect(abgelehnt(ansetzen, { art: 'bezugsendeWaehlen', ende: 'a' })).toBe('falsche-phase');
    expect(abgelehnt(ansetzen, { art: 'abliefern' })).toBe('falsche-phase');

    const ergebnis = zuschnitt(bereit()).zustand;
    expect(abgelehnt(ergebnis, { art: 'saegezug', seitenabweichung: 0, tempo: 1 })).toBe('falsche-phase');
    expect(abgelehnt(ergebnis, { art: 'abbrechen' })).toBe('falsche-phase');
  });

  it('Zuschnitt ohne angenommenen Auftrag oder ohne Werkzeug ist nicht möglich', () => {
    const ohneAuftrag = neuerSpielzustand(katalog, 1);
    ohneAuftrag.inventar.werkstuecke.push(sauberesBrett());
    expect(abgelehnt(ohneAuftrag, { art: 'zuschnittBeginnen', werkstueckId: 'ws_test' })).toBe('kein-auftrag');

    const ohneSaege = bereit();
    ohneSaege.inventar.werkzeuge = ohneSaege.inventar.werkzeuge.filter((w) => w.werkzeugId !== 'holz.werkzeug.fuchsschwanz');
    expect(abgelehnt(ohneSaege, { art: 'zuschnittBeginnen', werkstueckId: 'ws_test' })).toBe('kein-werkzeug');

    const fremd = bereit(sauberesBrett('ws_test', { materialId: 'metall.material.unbekannt' }));
    expect(abgelehnt(fremd, { art: 'zuschnittBeginnen', werkstueckId: 'ws_test' })).toBe('material-unbekannt');
  });

  it('Bezugsende neu wählen verwirft die Markierung; Markierung ist bis zum Anreissen änderbar', () => {
    const z = folge(bereit(), [
      { art: 'zuschnittBeginnen', werkstueckId: 'ws_test' },
      { art: 'bezugsendeWaehlen', ende: 'a' },
      { art: 'markierungSetzen', mm: 500 },
      { art: 'markierungSetzen', mm: 600.3 },
    ]);
    expect(z.zustand.arbeit?.markierung_mm).toBe(600.5);
    expect(z.zustand.arbeit?.phase).toBe('anreissen');
    const neu = folge(z.zustand, [{ art: 'bezugsendeWaehlen', ende: 'b' }]).zustand;
    expect(neu.arbeit?.markierung_mm).toBeNull();
    expect(neu.arbeit?.bezugsende).toBe('b');
    expect(neu.arbeit?.phase).toBe('messen');
  });

  it('Blattversatz wird auf ± 3 mm begrenzt', () => {
    const z = folge(bereit(), [
      { art: 'zuschnittBeginnen', werkstueckId: 'ws_test' },
      { art: 'bezugsendeWaehlen', ende: 'a' },
      { art: 'markierungSetzen', mm: 600 },
      { art: 'anreissen' },
      { art: 'blattVersatzSetzen', mm: 7 },
    ]);
    expect(z.zustand.arbeit?.blattversatz_mm).toBe(3);
    expect(folge(z.zustand, [{ art: 'blattVersatzSetzen', mm: -9 }]).zustand.arbeit?.blattversatz_mm).toBe(-3);
  });

  it('Abbrechen vor dem letzten Zug lässt das Brett ungeschnitten', () => {
    const z = folge(bereit(), [
      { art: 'zuschnittBeginnen', werkstueckId: 'ws_test' },
      { art: 'bezugsendeWaehlen', ende: 'a' },
      { art: 'markierungSetzen', mm: 600 },
      { art: 'anreissen' },
      ...zuege(7),
      { art: 'abbrechen' },
    ]).zustand;
    expect(z.arbeit).toBeNull();
    expect(z.inventar.werkstuecke.map((w) => w.id)).toEqual(['ws_test']);
  });

  it('Eingabezustand wird nie verändert', () => {
    const z = bereit();
    const vorher = JSON.stringify(z);
    zuschnitt(z);
    expect(JSON.stringify(z)).toBe(vorher);
  });
});

describe('Ergebnis, Ausschuss, Abliefern', () => {
  it('Schnitt ersetzt das Brett durch Teil + Reststück und zählt XP', () => {
    const r = zuschnitt(bereit(), { versatz: 0 });
    const z = r.zustand;
    expect(z.inventar.werkstuecke.map((w) => [w.herkunft, w.masse_mm.l])).toEqual([
      ['schnitt', 599.2],
      ['rest', 1399.2],
    ]);
    const teil = z.inventar.werkstuecke[0];
    expect(teil?.qualitaet).toMatchObject({ stufe: 'A', q: 97, hauptursache: 'kern.text.blatt-auf-linie', auftragId: 'af_1' });
    expect(z.zaehler).toEqual({ 'kern.zaehler.schnitte': 1, 'kern.zaehler.schnitt-stufe-b': 1 });
    // XP = 4 × 2 Schritte × (0,5 + 97/200) = 7,88 → 8
    expect(z.skills['holz.skill.holzhandwerk']).toEqual({ xp: 8, knoten: [] });
    expect(r.ereignisse.map((e) => e.art)).toEqual(['zug', 'getrennt', 'bewertet', 'xp', 'phase']);
  });

  it('Abliefern: Geld = runden(Basispreis × Preisfaktor), neuer Auftrag, Reststück bleibt', () => {
    const fertig = zuschnitt(bereit()).zustand;
    const r = folge(fertig, [{ art: 'abliefern' }]);
    const z = r.zustand;
    expect(z.inventar.geld).toBe(40 + 18);
    expect(z.inventar.werkstuecke.map((w) => w.herkunft)).toEqual(['rest']);
    expect(z.auftraege[0]).toMatchObject({ status: 'abgeliefert', werkstueckId: fertig.arbeit?.ergebnis?.teilId });
    const neu = z.auftraege[1];
    expect(neu?.status).toBe('angeboten');
    expect(neu?.soll['laenge_mm']).toBeGreaterThanOrEqual(300);
    expect(neu?.soll['laenge_mm']).toBeLessThanOrEqual(900);
    expect((neu?.soll['laenge_mm'] ?? 1) % 50).toBe(0);
    expect(z.arbeit).toBeNull();
    expect(z.tutorial).toBe(1);
    expect(z.zaehler['kern.zaehler.auftraege-abgeliefert']).toBe(1);
    expect(r.ereignisse[0]).toEqual({ art: 'abgeliefert', auftragId: 'af_1', erloes: 18, getilgt: 0 });
  });

  it('Preis je Stufe: A 18 · B 14 · C 10 · D 6 G bei Basispreis 14', () => {
    // B: 2,45° schief (Q 76); C: 2 mm zu kurz (Toleranz); D: 3 mm zu kurz + 1,05° schief + grosser Ausriss (Q 49)
    const schief = [...zuege(7, 1), ...zuege(1)];
    expect(zuschnitt(bereit(), { zuege: schief }).zustand.arbeit?.ergebnis).toMatchObject({ preis: 14, qualitaet: { stufe: 'B' } });
    // Toleranz nach dem Einstieg (± 1 mm)
    const normal = bereit();
    const a0 = normal.auftraege[0];
    if (a0) a0.toleranz = { delta_l_mm: 1 };
    expect(zuschnitt(normal, { mm: 598 }).zustand.arbeit?.ergebnis).toMatchObject({ preis: 10, qualitaet: { stufe: 'C' } });
    // Einstieg (± 2 mm): 2 mm zu kurz wird nicht gekappt
    expect(zuschnitt(bereit(), { mm: 598 }).zustand.arbeit?.ergebnis?.qualitaet.stufe).not.toBe('C');
    const hastig = [...zuege(3, 1), ...zuege(3), ...zuege(2, 0, 2)];
    expect(zuschnitt(bereit(), { mm: 597, zuege: hastig }).zustand.arbeit?.ergebnis).toMatchObject({
      preis: 6,
      qualitaet: { stufe: 'D' },
    });
  });

  it('Endriss am Bezugsende → Ausschuss: Abliefern unmöglich, Stück wird Reststück', () => {
    const brett = sauberesBrett('ws_test', {
      enden: { a: { winkel_grad: 0, merkmale: [{ id: 'holz.merkmal.endriss', laenge_mm: 40 }] }, b: { winkel_grad: 0, merkmale: [] } },
    });
    const z = zuschnitt(bereit(brett), { ende: 'a' }).zustand;
    expect(z.arbeit?.ergebnis?.qualitaet.stufe).toBe('ausschuss');
    expect(z.arbeit?.ergebnis?.preis).toBe(0);
    expect(abgelehnt(z, { art: 'abliefern' })).toBe('ausschuss');
    const weiter = folge(z, [{ art: 'weiter' }]).zustand;
    expect(weiter.arbeit).toBeNull();
    expect(weiter.inventar.werkstuecke.every((w) => w.herkunft === 'rest')).toBe(true);
    expect(weiter.auftraege[0]?.status).toBe('angenommen');
    // Vom anderen Ende gemessen: Endriss bleibt im Rest → einwandfrei
    expect(zuschnitt(bereit(brett), { ende: 'b' }).zustand.arbeit?.ergebnis?.qualitaet.stufe).toBe('A');
  });
});

describe('QA-Nacharbeit Runde 1', () => {
  it('B1: Reststück 650 mm, Endriss 80 mm am Gegenende → Teil ist Ausschuss', () => {
    const rest = sauberesBrett('ws_test', {
      masse_mm: { l: 650, b: 140, d: 18 },
      enden: { a: { winkel_grad: 0, merkmale: [] }, b: { winkel_grad: 0, merkmale: [{ id: 'holz.merkmal.endriss', laenge_mm: 80 }] } },
      herkunft: 'rest',
    });
    const e = zuschnitt(bereit(rest), { ende: 'a', mm: 600, versatz: 0.8 }).zustand.arbeit?.ergebnis;
    expect(e?.laenge_ist_mm).toBe(600);
    expect(e?.qualitaet.stufe).toBe('ausschuss');
    expect(e?.qualitaet.hauptursache).toBe('holz.merkmal.endriss');
  });

  it('B3: Aktionen mit ungültigen Laufzeitwerten werden abgelehnt', () => {
    const z = folge(bereit(), [{ art: 'zuschnittBeginnen', werkstueckId: 'ws_test' }]).zustand;
    const kaputt = (x: unknown) => abgelehnt(z, x as Aktion);
    expect(kaputt({ art: 'bezugsendeWaehlen', ende: 'c' })).toBe('ungueltige-aktion');
    expect(kaputt({ art: 'gibtEsNicht' })).toBe('ungueltige-aktion');
    expect(kaputt(null)).toBe('ungueltige-aktion');
    expect(kaputt({ art: 'markierungSetzen', mm: '600' })).toBe('ungueltige-aktion');
    expect(kaputt({ art: 'stuetzen', an: 1 })).toBe('ungueltige-aktion');
    expect(kaputt({ art: 'saegezug', seitenabweichung: 0 })).toBe('ungueltige-aktion');
    expect(kaputt({ art: 'zuschnittBeginnen' })).toBe('ungueltige-aktion');
    expect(kaputt({ art: 'auftragAnnehmen', auftragId: 3 })).toBe('ungueltige-aktion');
    expect(kaputt({ art: 'materialKaufen' })).toBe('ungueltige-aktion');
  });

  it('B3: beschädigter Spielstand (Bezugsende "c") wirft beim letzten Zug nicht', () => {
    const z = zuschnitt(bereit(), { zuege: zuege(7) }).zustand;
    const kaputt = JSON.parse(JSON.stringify(z).replace('"bezugsende":"a"', '"bezugsende":"c"')) as Spielzustand;
    expect(abgelehnt(kaputt, { art: 'saegezug', seitenabweichung: 0, tempo: 1 })).toBe('falsche-phase');
  });

  it('B5: Markierung muss ≥ 10 mm von beiden Enden liegen', () => {
    const z = folge(bereit(), [
      { art: 'zuschnittBeginnen', werkstueckId: 'ws_test' },
      { art: 'bezugsendeWaehlen', ende: 'a' },
    ]).zustand;
    expect(abgelehnt(z, { art: 'markierungSetzen', mm: 0 })).toBe('markierung-ausserhalb');
    expect(abgelehnt(z, { art: 'markierungSetzen', mm: 9.5 })).toBe('markierung-ausserhalb');
    expect(abgelehnt(z, { art: 'markierungSetzen', mm: 1990.5 })).toBe('markierung-ausserhalb');
    expect(folge(z, [{ art: 'markierungSetzen', mm: 10 }]).zustand.arbeit?.markierung_mm).toBe(10);
    expect(folge(z, [{ art: 'markierungSetzen', mm: 1990 }]).zustand.arbeit?.markierung_mm).toBe(1990);
    // Kleinstes Teil: 10 mm, Versatz −3 → 10 − 3,8 = 6,2 mm > 0
    const kleinst = zuschnitt(bereit(), { mm: 10, versatz: -3 }).zustand.arbeit?.ergebnis;
    expect(kleinst?.laenge_ist_mm).toBe(6.2);
  });
});

describe('Wirtschaft: Kaufen und Anschreiben (kein Softlock)', () => {
  it('Material kaufen zieht 12 G ab und legt ein Rohbrett ins Lager', () => {
    const r = folge(neuerSpielzustand(katalog, 7), [{ art: 'materialKaufen', materialId: BRETT }]);
    expect(r.zustand.inventar.geld).toBe(28);
    expect(r.zustand.inventar.werkstuecke).toHaveLength(1);
    expect(r.zustand.inventar.werkstuecke[0]).toMatchObject({ materialId: BRETT, herkunft: 'roh', masse_mm: { l: 2000, b: 140, d: 18 } });
    expect(r.ereignisse).toEqual([{ art: 'gekauft', werkstueckId: 'ws_2', preis: 12, aufAnschreiben: false }]);
  });

  it('Geld < Preis und kein brauchbares Holz → Brett auf Anschreiben', () => {
    const z = neuerSpielzustand(katalog, 7);
    z.inventar.geld = 5;
    z.inventar.werkstuecke.push(sauberesBrett('kurz', { masse_mm: { l: 601, b: 140, d: 18 }, herkunft: 'rest' }));
    expect(hatBrauchbaresMaterial(z)).toBe(false);
    const r = folge(z, [{ art: 'materialKaufen', materialId: BRETT }]);
    expect(r.zustand.inventar.geld).toBe(5);
    expect(r.zustand.inventar.schulden).toBe(12);
    expect(r.ereignisse[0]).toMatchObject({ aufAnschreiben: true });
    // Jetzt ist brauchbares Holz da → kein zweites Brett auf Anschreiben
    expect(abgelehnt(r.zustand, { art: 'materialKaufen', materialId: BRETT })).toBe('geld-reicht-nicht');
  });

  it('Anschreiben wird vom nächsten Erlös abgezogen', () => {
    const z = bereit();
    z.inventar.geld = 0;
    z.inventar.schulden = 12;
    const r = folge(zuschnitt(z).zustand, [{ art: 'abliefern' }]);
    expect(r.zustand.inventar.schulden).toBe(0);
    expect(r.zustand.inventar.geld).toBe(6);
    expect(r.ereignisse[0]).toMatchObject({ erloes: 18, getilgt: 12 });
  });

  it('unbekanntes Material und unbekannter Auftrag werden abgelehnt', () => {
    const z = neuerSpielzustand(katalog, 7);
    expect(abgelehnt(z, { art: 'materialKaufen', materialId: 'holz.material.eiche' })).toBe('material-unbekannt');
    expect(abgelehnt(z, { art: 'auftragAnnehmen', auftragId: 'af_99' })).toBe('auftrag-unbekannt');
  });

  it('nur ein Auftrag gleichzeitig angenommen', () => {
    const z = neuerSpielzustand(katalog, 7);
    const r = folge(z, [{ art: 'auftragAnnehmen', auftragId: 'af_1' }]);
    expect(r.ereignisse).toEqual([{ art: 'auftragAngenommen', auftragId: 'af_1' }]);
    expect(abgelehnt(r.zustand, { art: 'auftragAnnehmen', auftragId: 'af_1' })).toBe('auftrag-nicht-angeboten');
    const erster = z.auftraege[0];
    if (erster === undefined) throw new Error('kein Auftrag');
    r.zustand.auftraege.push({ ...erster, id: 'af_9', status: 'angeboten' });
    expect(abgelehnt(r.zustand, { art: 'auftragAnnehmen', auftragId: 'af_9' })).toBe('auftrag-schon-angenommen');
  });
});

describe('Spielzustand: JSON, Determinismus, Neuladen', () => {
  const spiel = (saat: number): Spielzustand[] => {
    const zustaende: Spielzustand[] = [];
    let z = neuerSpielzustand(katalog, saat);
    const schritt = (a: Aktion): void => {
      z = ausfuehren(katalog, z, a).zustand;
      zustaende.push(z);
    };
    schritt({ art: 'auftragAnnehmen', auftragId: 'af_1' });
    schritt({ art: 'materialKaufen', materialId: BRETT });
    const id = z.inventar.werkstuecke[0]?.id ?? '';
    const sauber = z.inventar.werkstuecke[0]?.enden.a.merkmale.length === 0 ? 'a' : 'b';
    for (const a of [
      { art: 'zuschnittBeginnen', werkstueckId: id },
      { art: 'bezugsendeWaehlen', ende: sauber },
      { art: 'markierungSetzen', mm: 600 },
      { art: 'anreissen' },
      { art: 'blattVersatzSetzen', mm: 0.8 },
      ...zuege(8, 0.2, 0.9),
      { art: 'abliefern' },
    ] as Aktion[]) {
      schritt(a);
    }
    return zustaende;
  };

  it('jeder Zwischenstand ist verlustfrei JSON-serialisierbar', () => {
    for (const z of spiel(123)) {
      expect(JSON.parse(JSON.stringify(z))).toEqual(z);
    }
  });

  it('gleiche Saat → gleicher Ablauf; andere Saat → anderes Brett', () => {
    expect(spiel(5)).toEqual(spiel(5));
    const brett = (s: number) => spiel(s)[1]?.inventar.werkstuecke[0];
    expect(brett(5)).not.toEqual(brett(6));
  });

  it('nach JSON-Rundlauf geht das Spiel identisch weiter', () => {
    const z = zuschnitt(bereit(), { zuege: zuege(7) }).zustand;
    const kopie = JSON.parse(JSON.stringify(z)) as Spielzustand;
    const a: Aktion = { art: 'saegezug', seitenabweichung: 0, tempo: 1 };
    expect(ausfuehren(katalog, kopie, a)).toEqual(ausfuehren(katalog, z, a));
  });

  it('Neuladen mitten im Sägen: Brett ungeschnitten, Markierung bleibt', () => {
    const z = zuschnitt(bereit(), { mm: 612.5, zuege: zuege(5, 1) }).zustand;
    const neu = nachNeuladen(z);
    expect(neu.arbeit).toMatchObject({ phase: 'ansetzen', markierung_mm: 612.5, zuege: [], drift_grad: 0 });
    expect(neu.inventar.werkstuecke.map((w) => w.id)).toEqual(['ws_test']);
    const fertig = zuschnitt(bereit()).zustand;
    expect(nachNeuladen(fertig)).toBe(fertig);
  });
});
