import { describe, expect, it } from 'vitest';
import { ausfuehren, type Aktion } from '../../../src/core/zuschnitt';
import { neuerSpielzustand, nachNeuladen, type Spielzustand } from '../../../src/core/zustand';
import { standardKatalog } from '../../../src/modules';
import {
  auftragText,
  bedarfMm,
  endeAusMm,
  endrisse,
  ergebnisKarte,
  hudModusFuer,
  istGefuehrt,
  schrittHinweis,
  stueckWaehlen,
  STUFEN_TEXT,
} from '../../../src/spiel/ablauf';
import type { Werkstueck } from '../../../src/core/typen';

const katalog = standardKatalog();

function tun(z: Spielzustand, a: Aktion): Spielzustand {
  const r = ausfuehren(katalog, z, a);
  expect(r.grund).toBeUndefined();
  return r.zustand;
}

function brett(id: string, l: number, rissA?: number, rissB?: number): Werkstueck {
  const ende = (r?: number) => ({ winkel_grad: 0, merkmale: r ? [{ id: 'holz.merkmal.endriss', laenge_mm: r }] : [] });
  return { id, materialId: 'holz.material.fichte-brett-2000', masse_mm: { l, b: 140, d: 18 }, enden: { a: ende(rissA), b: ende(rissB) }, merkmale: [], herkunft: 'roh' };
}

/** Bis zum Ergebnis: annehmen, kaufen, Ende ohne Riss, messen 600, anreissen, +0,8 mm, 8 ruhige Züge. */
function durchgang(saat: number): Spielzustand {
  let z = neuerSpielzustand(katalog, saat);
  const auftrag = z.auftraege[0];
  if (!auftrag) throw new Error('kein Auftrag');
  z = tun(z, { art: 'auftragAnnehmen', auftragId: auftrag.id });
  z = tun(z, { art: 'materialKaufen', materialId: 'holz.material.fichte-brett-2000' });
  const ws = z.inventar.werkstuecke[0];
  if (!ws) throw new Error('kein Brett');
  z = tun(z, { art: 'zuschnittBeginnen', werkstueckId: ws.id });
  const r = endrisse(ws);
  z = tun(z, { art: 'bezugsendeWaehlen', ende: r.a !== null ? 'b' : 'a' });
  z = tun(z, { art: 'markierungSetzen', mm: 600 });
  z = tun(z, { art: 'anreissen' });
  z = tun(z, { art: 'blattVersatzSetzen', mm: 0.8 });
  for (let i = 0; i < 8; i++) z = tun(z, { art: 'saegezug', seitenabweichung: 0, tempo: 0.6 });
  return z;
}

describe('Ablauf Vertical Slice (Ticket 013)', () => {
  it('Stückwahl: kürzestes ausreichendes Stück zuerst (Reste verbrauchen), sonst kaufen', () => {
    const z = neuerSpielzustand(katalog, 1);
    expect(stueckWaehlen(z, 602)).toBeUndefined();
    z.inventar.werkstuecke = [brett('ws_1', 2000), brett('ws_2', 700), brett('ws_3', 601)];
    expect(stueckWaehlen(z, 602)?.id).toBe('ws_2');
    expect(stueckWaehlen(z, 1000)?.id).toBe('ws_1');
    expect(bedarfMm(z.auftraege[0])).toBe(602);
  });

  it('Endrisse je Ende, getipptes Ende aus der Position', () => {
    expect(endrisse(brett('x', 2000, 40))).toEqual({ a: 40, b: null });
    expect(endrisse(brett('x', 2000, undefined, 25))).toEqual({ a: null, b: 25 });
    expect(endrisse(undefined)).toEqual({ a: null, b: null });
    expect(endeAusMm(30, 2000)).toBe('a');
    expect(endeAusMm(1990, 2000)).toBe('b');
  });

  it('HUD-Modus je Phase; „Sägen ›“ getippt nur lokal – nach Neuladen wieder Ansetzen', () => {
    let z = durchgang(3);
    expect(hudModusFuer(z.arbeit, true, false)).toBe('ergebnis');
    expect(hudModusFuer(z.arbeit, false, false)).toBe('erkunden');
    z = neuerSpielzustand(katalog, 3);
    expect(hudModusFuer(null, true, false)).toBe('erkunden');
    const auftrag = z.auftraege[0];
    if (!auftrag) throw new Error();
    z = tun(z, { art: 'auftragAnnehmen', auftragId: auftrag.id });
    z = tun(z, { art: 'materialKaufen', materialId: 'holz.material.fichte-brett-2000' });
    z = tun(z, { art: 'zuschnittBeginnen', werkstueckId: z.inventar.werkstuecke[0]?.id ?? '' });
    expect(hudModusFuer(z.arbeit, true, false)).toBe('werkbank-messen');
    z = tun(z, { art: 'bezugsendeWaehlen', ende: 'a' });
    z = tun(z, { art: 'markierungSetzen', mm: 600 });
    z = tun(z, { art: 'anreissen' });
    expect(hudModusFuer(z.arbeit, true, false)).toBe('werkbank-ansetzen');
    expect(hudModusFuer(z.arbeit, true, true)).toBe('werkbank-saegen');
    z = tun(z, { art: 'saegezug', seitenabweichung: 0, tempo: 0.5 });
    expect(hudModusFuer(z.arbeit, true, false)).toBe('werkbank-saegen');
    expect(hudModusFuer(nachNeuladen(z).arbeit, true, false)).toBe('werkbank-ansetzen');
  });

  it('Geführte Hinweise: Schritt 1–6 im ersten Auftrag, Riss wird benannt; danach knapp', () => {
    let z = neuerSpielzustand(katalog, 5);
    expect(istGefuehrt(z)).toBe(true);
    expect(schrittHinweis(z, { anDerBank: false, massMm: 0, saegenFreigegeben: false, zielWerkbank: true })).toContain('An die Werkbank');
    const auftrag = z.auftraege[0];
    if (!auftrag) throw new Error();
    z = tun(z, { art: 'auftragAnnehmen', auftragId: auftrag.id });
    z = tun(z, { art: 'materialKaufen', materialId: 'holz.material.fichte-brett-2000' });
    z = tun(z, { art: 'zuschnittBeginnen', werkstueckId: z.inventar.werkstuecke[0]?.id ?? '' });
    const k = { anDerBank: true, massMm: 0, saegenFreigegeben: false };
    expect(schrittHinweis(z, { ...k, stueck: brett('x', 2000, 50) })).toContain('Am linken Ende ist ein Riss');
    expect(schrittHinweis(z, { ...k, stueck: brett('x', 2000) })).toContain('Schritt 1/6');
    z = tun(z, { art: 'bezugsendeWaehlen', ende: 'a' });
    expect(schrittHinweis(z, k)).toContain('Schritt 2/6');
    expect(schrittHinweis(z, { ...k, massMm: 600 })).toContain('Schritt 3/6');
    z = tun(z, { art: 'markierungSetzen', mm: 600 });
    z = tun(z, { art: 'anreissen' });
    expect(schrittHinweis(z, k)).toContain('Schritt 4/6');
    expect(schrittHinweis(z, { ...k, saegenFreigegeben: true })).toContain('Schritt 5/6');
    // nach zwei abgelieferten Aufträgen: keine Schritt-Anleitung mehr, Riss weiterhin benannt
    z.tutorial = 2;
    expect(istGefuehrt(z)).toBe(false);
    expect(schrittHinweis(z, k)).toBeNull();
    z.arbeit = z.arbeit ? { ...z.arbeit, phase: 'bezugsende' } : null;
    expect(schrittHinweis(z, { ...k, stueck: brett('x', 2000, undefined, 30) })).toBe('Riss am rechten Ende – Bezugsende antippen.');
  });

  it('Ergebniskarte entspricht dem Kern-Ergebnis (Stufe, Q, Ursache, Ist/Soll, Preis)', () => {
    const z = durchgang(11);
    const e = z.arbeit?.ergebnis;
    if (!e) throw new Error('kein Ergebnis');
    const karte = ergebnisKarte(katalog, z);
    expect(karte?.stufe).toBe(STUFEN_TEXT[e.qualitaet.stufe]);
    expect(karte?.q).toBe(e.qualitaet.q);
    expect(karte?.preis).toBe(e.preis);
    expect(karte?.hauptursache).toContain('(Soll 600)');
    expect(ergebnisKarte(katalog, neuerSpielzustand(katalog, 1))).toBeNull();
  });

  it('Auftragstext mit Soll, Toleranz und Lohn', () => {
    const z = neuerSpielzustand(katalog, 1);
    expect(auftragText(z.auftraege[0])).toMatch(/^Regalbrett 600 mm ± 1 · Lohn \d+ G$/);
    expect(auftragText(undefined)).toBeNull();
  });
});
