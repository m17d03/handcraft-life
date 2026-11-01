/**
 * Fassade des Vertical Slice: alle Spielhandlungen als reine Funktion
 *   ausfuehren(katalog, zustand, aktion) → { zustand, ereignisse, grund? }
 *
 * Zustandsautomat Zuschnitt: bezugsende → messen → anreissen → ansetzen → saegen (n Züge) → ergebnis.
 * Ungültige Aktionen werfen nicht: sie liefern den unveränderten Zustand (gleiche Referenz) und einen Grund.
 * Der Eingabezustand wird nie verändert.
 */
import { auftragErzeugen, SOLL_LAENGE } from './auftraege';
import type { Katalog } from './modul';
import {
  datenwert,
  driftNachZug,
  messen,
  PROZESS_MESSEN,
  PROZESS_TRENNEN,
  tempoGrenze,
  trennen,
  type Zug,
} from './prozesse';
import { bewerten, mindestens } from './qualitaet';
import type { EndeId, InhaltsId, MaterialDef, Qualitaet, Werkstueck, WerkzeugDef } from './typen';
import { erloesVerbuchen, verkaufspreis } from './wirtschaft';
import { merkmalIds, werkstueckErzeugen } from './werkstueck';
import { zufallsquelle } from './zufall';
import type { Phase, Spielzustand, ZuschnittZustand } from './zustand';

export type Aktion =
  | { art: 'auftragAnnehmen'; auftragId: string }
  | { art: 'materialKaufen'; materialId: InhaltsId }
  | { art: 'zuschnittBeginnen'; werkstueckId: string }
  | { art: 'bezugsendeWaehlen'; ende: EndeId }
  | { art: 'markierungSetzen'; mm: number }
  | { art: 'anreissen' }
  | { art: 'blattVersatzSetzen'; mm: number }
  | { art: 'stuetzen'; an: boolean }
  | { art: 'saegezug'; seitenabweichung: number; tempo: number }
  | { art: 'abliefern' }
  | { art: 'weiter' }
  | { art: 'abbrechen' };

export type Grund =
  | 'falsche-phase'
  | 'arbeit-laeuft'
  | 'keine-arbeit'
  | 'kein-auftrag'
  | 'auftrag-unbekannt'
  | 'auftrag-nicht-angeboten'
  | 'auftrag-schon-angenommen'
  | 'werkstueck-unbekannt'
  | 'material-unbekannt'
  | 'kein-werkzeug'
  | 'geld-reicht-nicht'
  | 'ungueltiger-wert'
  | 'ausschuss';

export type Ereignis =
  | { art: 'auftragAngenommen'; auftragId: string }
  | { art: 'auftragAngeboten'; auftragId: string; soll: Record<string, number>; basispreis: number }
  | { art: 'gekauft'; werkstueckId: string; preis: number; aufAnschreiben: boolean }
  | { art: 'phase'; phase: Phase | null }
  | { art: 'markierung'; mm: number }
  | { art: 'angerissen'; mm: number }
  | { art: 'blattVersatz'; mm: number }
  | { art: 'stuetzen'; an: boolean }
  | { art: 'zug'; nr: number; von: number; driftGrad: number; tiefe01: number; tempoOk: boolean }
  | { art: 'getrennt'; teilId: string; restId: string | null; laengeIstMm: number }
  | { art: 'bewertet'; qualitaet: Qualitaet; preis: number }
  | { art: 'xp'; bereich: InhaltsId; xp: number; gesamt: number }
  | { art: 'abgeliefert'; auftragId: string; erloes: number; getilgt: number };

export interface AktionsErgebnis {
  zustand: Spielzustand;
  ereignisse: Ereignis[];
  grund?: Grund;
}

const ohneWirkung = (zustand: Spielzustand, grund: Grund): AktionsErgebnis => ({ zustand, ereignisse: [], grund });

// ---------------------------------------------------------------- Abfragen

export function angenommenerAuftrag(z: Spielzustand): Spielzustand['auftraege'][number] | undefined {
  return z.auftraege.find((a) => a.status === 'angenommen');
}

export function werkstueckImLager(z: Spielzustand, id: string): Werkstueck | undefined {
  return z.inventar.werkstuecke.find((w) => w.id === id);
}

/** Besitzt der Spieler ein Werkzeug für `prozess` und diese Materialklasse? */
export function werkzeugFuer(
  katalog: Katalog,
  z: Spielzustand,
  prozess: InhaltsId,
  material: MaterialDef,
): WerkzeugDef | undefined {
  for (const besitz of z.inventar.werkzeuge) {
    const w = katalog.werkzeuge[besitz.werkzeugId];
    if (w?.prozesse.includes(prozess) === true && w.materialKlassen.includes(material.klasse)) return w;
  }
  return undefined;
}

/**
 * Kein Softlock: Anschreiben ist erlaubt, wenn kein Stück im Lager für den aktuellen Bedarf reicht
 * (Soll des angenommenen bzw. angebotenen Auftrags + 2 mm, holz-brett-zuschnitt §4.3).
 */
export function hatBrauchbaresMaterial(z: Spielzustand): boolean {
  const auftrag = angenommenerAuftrag(z) ?? z.auftraege.find((a) => a.status === 'angeboten');
  const bedarf = (auftrag?.soll[SOLL_LAENGE] ?? 0) + 2;
  return z.inventar.werkstuecke.some((w) => w.masse_mm.l >= bedarf);
}

// ---------------------------------------------------------------- Ausführung

function neueId(z: Spielzustand, praefix: string): string {
  const id = `${praefix}_${String(z.naechsteNr)}`;
  z.naechsteNr += 1;
  return id;
}

function mitArbeit(
  zustand: Spielzustand,
  erlaubt: readonly Phase[],
  f: (z: Spielzustand, a: ZuschnittZustand) => AktionsErgebnis,
): AktionsErgebnis {
  const a = zustand.arbeit;
  if (a === null) return ohneWirkung(zustand, 'keine-arbeit');
  if (!erlaubt.includes(a.phase)) return ohneWirkung(zustand, 'falsche-phase');
  const z = structuredClone(zustand);
  if (z.arbeit === null) return ohneWirkung(zustand, 'keine-arbeit');
  return f(z, z.arbeit);
}

export function ausfuehren(katalog: Katalog, zustand: Spielzustand, aktion: Aktion): AktionsErgebnis {
  switch (aktion.art) {
    case 'auftragAnnehmen': {
      const auftrag = zustand.auftraege.find((a) => a.id === aktion.auftragId);
      if (auftrag === undefined) return ohneWirkung(zustand, 'auftrag-unbekannt');
      if (auftrag.status !== 'angeboten') return ohneWirkung(zustand, 'auftrag-nicht-angeboten');
      if (angenommenerAuftrag(zustand) !== undefined) return ohneWirkung(zustand, 'auftrag-schon-angenommen');
      const z = structuredClone(zustand);
      const ziel = z.auftraege.find((a) => a.id === aktion.auftragId);
      if (ziel !== undefined) ziel.status = 'angenommen';
      return { zustand: z, ereignisse: [{ art: 'auftragAngenommen', auftragId: aktion.auftragId }] };
    }

    case 'materialKaufen': {
      const material = katalog.materialien[aktion.materialId];
      if (material === undefined) return ohneWirkung(zustand, 'material-unbekannt');
      const bezahlbar = zustand.inventar.geld >= material.preis;
      if (!bezahlbar && hatBrauchbaresMaterial(zustand)) return ohneWirkung(zustand, 'geld-reicht-nicht');
      const z = structuredClone(zustand);
      const rng = zufallsquelle(z.zufallSaat);
      const ws = werkstueckErzeugen(material, neueId(z, 'ws'), rng.zufall, katalog.erzeugung);
      z.zufallSaat = rng.saat();
      if (bezahlbar) z.inventar.geld -= material.preis;
      else z.inventar.schulden += material.preis;
      z.inventar.werkstuecke.push(ws);
      return {
        zustand: z,
        ereignisse: [{ art: 'gekauft', werkstueckId: ws.id, preis: material.preis, aufAnschreiben: !bezahlbar }],
      };
    }

    case 'zuschnittBeginnen': {
      if (zustand.arbeit !== null) return ohneWirkung(zustand, 'arbeit-laeuft');
      const auftrag = angenommenerAuftrag(zustand);
      if (auftrag === undefined) return ohneWirkung(zustand, 'kein-auftrag');
      const ws = werkstueckImLager(zustand, aktion.werkstueckId);
      if (ws === undefined) return ohneWirkung(zustand, 'werkstueck-unbekannt');
      const material = katalog.materialien[ws.materialId];
      if (material === undefined) return ohneWirkung(zustand, 'material-unbekannt');
      const saege = werkzeugFuer(katalog, zustand, PROZESS_TRENNEN, material);
      const messzeug = werkzeugFuer(katalog, zustand, PROZESS_MESSEN, material);
      if (saege === undefined || messzeug === undefined) return ohneWirkung(zustand, 'kein-werkzeug');
      const z = structuredClone(zustand);
      z.arbeit = {
        phase: 'bezugsende',
        werkstueckId: ws.id,
        auftragId: auftrag.id,
        werkzeugId: saege.id,
        messzeugId: messzeug.id,
        bezugsende: null,
        markierung_mm: null,
        blattversatz_mm: 0,
        stuetzen: false,
        zuege: [],
        drift_grad: 0,
        ergebnis: null,
      };
      return { zustand: z, ereignisse: [{ art: 'phase', phase: 'bezugsende' }] };
    }

    case 'bezugsendeWaehlen':
      // Neu wählen ist bis zum Anreissen erlaubt; die Markierung wird dann verworfen.
      return mitArbeit(zustand, ['bezugsende', 'messen', 'anreissen'], (z, a) => {
        a.bezugsende = aktion.ende;
        a.markierung_mm = null;
        a.phase = 'messen';
        return { zustand: z, ereignisse: [{ art: 'phase', phase: 'messen' }] };
      });

    case 'markierungSetzen':
      return mitArbeit(zustand, ['messen', 'anreissen'], (z, a) => {
        if (!Number.isFinite(aktion.mm)) return ohneWirkung(zustand, 'ungueltiger-wert');
        const ws = werkstueckImLager(z, a.werkstueckId);
        const messzeug = katalog.werkzeuge[a.messzeugId];
        if (ws === undefined || messzeug === undefined) return ohneWirkung(zustand, 'werkstueck-unbekannt');
        a.markierung_mm = messen(ws, aktion.mm, messzeug);
        const ereignisse: Ereignis[] = [{ art: 'markierung', mm: a.markierung_mm }];
        if (a.phase === 'messen') {
          a.phase = 'anreissen';
          ereignisse.push({ art: 'phase', phase: 'anreissen' });
        }
        return { zustand: z, ereignisse };
      });

    case 'anreissen':
      return mitArbeit(zustand, ['anreissen'], (z, a) => {
        a.phase = 'ansetzen';
        return {
          zustand: z,
          ereignisse: [
            { art: 'angerissen', mm: a.markierung_mm ?? 0 },
            { art: 'phase', phase: 'ansetzen' },
          ],
        };
      });

    case 'blattVersatzSetzen':
      return mitArbeit(zustand, ['ansetzen'], (z, a) => {
        const saege = katalog.werkzeuge[a.werkzeugId];
        if (!Number.isFinite(aktion.mm) || saege === undefined) return ohneWirkung(zustand, 'ungueltiger-wert');
        const max = datenwert(saege.werte, 'versatz_max_mm', saege.id);
        a.blattversatz_mm = Math.round(Math.min(Math.max(aktion.mm, -max), max) * 100) / 100;
        return { zustand: z, ereignisse: [{ art: 'blattVersatz', mm: a.blattversatz_mm }] };
      });

    case 'stuetzen':
      return mitArbeit(zustand, ['ansetzen', 'saegen'], (z, a) => {
        a.stuetzen = aktion.an;
        return { zustand: z, ereignisse: [{ art: 'stuetzen', an: aktion.an }] };
      });

    case 'saegezug':
      return mitArbeit(zustand, ['ansetzen', 'saegen'], (z, a) =>
        saegezug(katalog, zustand, z, a, { seitenabweichung: aktion.seitenabweichung, tempo: aktion.tempo }),
      );

    case 'abliefern':
      return mitArbeit(zustand, ['ergebnis'], (z, a) => {
        const e = a.ergebnis;
        if (e === null) return ohneWirkung(zustand, 'falsche-phase');
        if (e.qualitaet.stufe === 'ausschuss') return ohneWirkung(zustand, 'ausschuss');
        const auftrag = z.auftraege.find((x) => x.id === a.auftragId);
        if (auftrag === undefined) return ohneWirkung(zustand, 'auftrag-unbekannt');
        const { inventar, getilgt } = erloesVerbuchen(z.inventar, e.preis);
        z.inventar = { ...inventar, werkstuecke: inventar.werkstuecke.filter((w) => w.id !== e.teilId) };
        auftrag.status = 'abgeliefert';
        auftrag.werkstueckId = e.teilId;
        z.arbeit = null;
        z.tutorial += 1;
        zaehlen(z, 'kern.zaehler.auftraege-abgeliefert');
        const ereignisse: Ereignis[] = [
          { art: 'abgeliefert', auftragId: auftrag.id, erloes: e.preis, getilgt },
          { art: 'phase', phase: null },
        ];
        const vorlage = katalog.auftragVorlagen[auftrag.vorlageId];
        if (vorlage !== undefined) {
          const rng = zufallsquelle(z.zufallSaat);
          const neu = auftragErzeugen(katalog, vorlage, neueId(z, 'af'), rng.zufall, false);
          z.zufallSaat = rng.saat();
          z.auftraege.push(neu);
          ereignisse.push({ art: 'auftragAngeboten', auftragId: neu.id, soll: neu.soll, basispreis: neu.basispreis });
        }
        return { zustand: z, ereignisse };
      });

    case 'weiter':
      return mitArbeit(zustand, ['ergebnis'], (z) => {
        z.arbeit = null;
        return { zustand: z, ereignisse: [{ art: 'phase', phase: null }] };
      });

    case 'abbrechen':
      // Vor dem letzten Zug: Brett bleibt ungeschnitten.
      return mitArbeit(zustand, ['bezugsende', 'messen', 'anreissen', 'ansetzen', 'saegen'], (z) => {
        z.arbeit = null;
        return { zustand: z, ereignisse: [{ art: 'phase', phase: null }] };
      });
  }
}

function zaehlen(z: Spielzustand, id: InhaltsId): void {
  z.zaehler[id] = (z.zaehler[id] ?? 0) + 1;
}

function saegezug(
  katalog: Katalog,
  original: Spielzustand,
  z: Spielzustand,
  a: ZuschnittZustand,
  zug: Zug,
): AktionsErgebnis {
  if (!Number.isFinite(zug.seitenabweichung) || !Number.isFinite(zug.tempo) || zug.tempo < 0) {
    return ohneWirkung(original, 'ungueltiger-wert');
  }
  const saege = katalog.werkzeuge[a.werkzeugId];
  if (saege === undefined) return ohneWirkung(original, 'kein-werkzeug');
  const gesamt = datenwert(saege.werte, 'zuege_gesamt', saege.id);
  const normiert: Zug = { seitenabweichung: Math.min(Math.max(zug.seitenabweichung, -1), 1), tempo: zug.tempo };
  const ereignisse: Ereignis[] = [];
  if (a.phase === 'ansetzen') {
    a.phase = 'saegen';
    ereignisse.push({ art: 'phase', phase: 'saegen' });
  }
  a.drift_grad = driftNachZug(a.drift_grad, a.zuege.length, normiert, saege);
  a.zuege.push(normiert);
  ereignisse.push({
    art: 'zug',
    nr: a.zuege.length,
    von: gesamt,
    driftGrad: a.drift_grad,
    tiefe01: Math.min(a.zuege.length / gesamt, 1),
    tempoOk: normiert.tempo <= tempoGrenze(saege, a.stuetzen),
  });
  if (a.zuege.length < gesamt) return { zustand: z, ereignisse };
  return schnittAbschliessen(katalog, original, z, a, saege, ereignisse);
}

function schnittAbschliessen(
  katalog: Katalog,
  original: Spielzustand,
  z: Spielzustand,
  a: ZuschnittZustand,
  saege: WerkzeugDef,
  ereignisse: Ereignis[],
): AktionsErgebnis {
  const ws = werkstueckImLager(z, a.werkstueckId);
  const auftrag = z.auftraege.find((x) => x.id === a.auftragId);
  const material = ws === undefined ? undefined : katalog.materialien[ws.materialId];
  const vorlage = auftrag === undefined ? undefined : katalog.auftragVorlagen[auftrag.vorlageId];
  const produkt = vorlage === undefined ? undefined : katalog.produkte[vorlage.produktId];
  if (ws === undefined || auftrag === undefined || material === undefined || produkt === undefined) {
    return ohneWirkung(original, 'werkstueck-unbekannt');
  }
  if (a.bezugsende === null || a.markierung_mm === null) return ohneWirkung(original, 'falsche-phase');

  const rng = zufallsquelle(z.zufallSaat);
  const teilId = neueId(z, 'ws');
  const restId = neueId(z, 'ws');
  const soll = auftrag.soll[SOLL_LAENGE];
  const schnitt = trennen(
    { werkstueck: ws, material, werkzeug: saege, mod: (_id, basis) => basis, zufall: rng.zufall, regeln: katalog.regeln },
    {
      bezugsende: a.bezugsende,
      markierung_mm: a.markierung_mm,
      blattversatz_mm: a.blattversatz_mm,
      zuege: a.zuege,
      stuetzen: a.stuetzen,
      teilId,
      restId,
      ...(soll === undefined ? {} : { soll_mm: soll }),
    },
  );
  z.zufallSaat = rng.saat();

  const [teil, ...rest] = schnitt.werkstuecke;
  if (teil === undefined) return ohneWirkung(original, 'werkstueck-unbekannt');
  const qualitaet = bewerten(produkt.bewertung, {
    messwerte: schnitt.messwerte,
    merkmale: merkmalIds(teil),
    toleranz: auftrag.toleranz,
    ursachen: schnitt.ursachen,
    auftragId: auftrag.id,
  });
  teil.qualitaet = qualitaet;
  // Ausschuss kann nicht abgeliefert werden und wird zum Reststück (holz-brett-zuschnitt §4.2).
  if (qualitaet.stufe === 'ausschuss') teil.herkunft = 'rest';
  const preis = verkaufspreis(auftrag.basispreis, qualitaet.stufe);

  const index = z.inventar.werkstuecke.findIndex((w) => w.id === ws.id);
  z.inventar.werkstuecke.splice(index, 1, ...schnitt.werkstuecke);
  for (const id of schnitt.zaehler) zaehlen(z, id);
  if (mindestens(qualitaet.stufe, 'B')) zaehlen(z, 'kern.zaehler.schnitt-stufe-b');

  // XP pro Arbeitsschritt = Basis-XP × (0,5 + Q/200), core-loop §4.
  const xp = Math.round(produkt.xp_basis * produkt.schritte.length * (0.5 + qualitaet.q / 200));
  const skill = z.skills[produkt.skillBereich] ?? { xp: 0, knoten: [] };
  skill.xp += xp;
  z.skills[produkt.skillBereich] = skill;

  const restStueck = rest[0];
  a.phase = 'ergebnis';
  a.ergebnis = {
    teilId: teil.id,
    restId: restStueck?.id ?? null,
    laenge_ist_mm: teil.masse_mm.l,
    qualitaet,
    preis,
    messwerte: schnitt.messwerte,
  };
  ereignisse.push(
    { art: 'getrennt', teilId: teil.id, restId: restStueck?.id ?? null, laengeIstMm: teil.masse_mm.l },
    { art: 'bewertet', qualitaet, preis },
    { art: 'xp', bereich: produkt.skillBereich, xp, gesamt: skill.xp },
    { art: 'phase', phase: 'ergebnis' },
  );
  return { zustand: z, ereignisse };
}
