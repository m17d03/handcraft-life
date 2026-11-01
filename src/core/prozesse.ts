/**
 * Materialunabhängige Kern-Prozesse `messen` und `trennen` (ADR 0002, modul-vertrag §4.3,
 * holz-brett-zuschnitt §4.1). Material- und Werkzeugwerte kommen nur als Daten herein; materialtypische
 * Fehlerbilder hängen die Module als `MaterialRegel` an.
 */
import type {
  EndeId,
  InhaltsId,
  Merkmal,
  ProzessErgebnis,
  ProzessKontext,
  Ursache,
  Werkstueck,
  WerkzeugDef,
} from './typen';
import { anderesEnde, bezugsfehler, runden3 } from './werkstueck';

export const PROZESS_MESSEN: InhaltsId = 'kern.prozess.messen';
export const PROZESS_TRENNEN: InhaltsId = 'kern.prozess.trennen';
export const PARAMETER_DRIFT: InhaltsId = 'kern.parameter.drift-pro-zug';

/** Liest einen Pflicht-Zahlenwert aus Stammdaten. Fehlt er, ist das ein Datenfehler (kein Spielerfehler). */
export function datenwert(werte: Record<string, number>, schluessel: string, quelle: InhaltsId): number {
  const w = werte[schluessel];
  if (w === undefined) throw new Error(`Stammdaten ${quelle}: Wert "${schluessel}" fehlt`);
  return w;
}

// ---------------------------------------------------------------- messen

/**
 * Markierung vom Bezugsende: auf das Raster des Messwerkzeugs gerundet und auf das Werkstück begrenzt.
 */
export function messen(ws: Werkstueck, wunsch_mm: number, messzeug: WerkzeugDef): number {
  const raster = datenwert(messzeug.werte, 'raster_mm', messzeug.id);
  const gerastert = Math.round(wunsch_mm / raster) * raster;
  return runden3(Math.min(Math.max(gerastert, 0), ws.masse_mm.l));
}

// ---------------------------------------------------------------- trennen

export interface Zug {
  /** Seitliche Abweichung des Daumens, normiert −1..+1. */
  seitenabweichung: number;
  /** Tempo des Zugs, 0..2 (1 = normal). */
  tempo: number;
}

export interface TrennenEingabe {
  bezugsende: EndeId;
  markierung_mm: number;
  /** Mitte des Blatts relativ zur Linie, + = Richtung Abfall. */
  blattversatz_mm: number;
  zuege: Zug[];
  stuetzen: boolean;
  /** Zielmass, nur für die Ursachen-Analyse. */
  soll_mm?: number;
  teilId: string;
  restId: string;
}

export interface TrennenDetail {
  driftVerlauf: number[];
}

function begrenzen(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max);
}

/**
 * Drift nach einem Zug (Grad). In den ersten `lenkbare_zuege` Zügen wirkt jede Daumenabweichung
 * (Gegenlenken baut Drift ab). Danach führt die Fuge: Abweichungen können die Drift nur noch vergrössern,
 * Gegenlenken bleibt wirkungslos (holz-brett-zuschnitt §4.1).
 */
export function driftNachZug(
  drift: number,
  zugIndex: number,
  zug: Zug,
  werkzeug: WerkzeugDef,
  mod: ProzessKontext['mod'] = (_id, basis) => basis,
): number {
  const proZug = mod(PARAMETER_DRIFT, datenwert(werkzeug.werte, 'drift_grad_pro_zug', werkzeug.id));
  const faktor = datenwert(werkzeug.werte, 'werkzeugfaktor', werkzeug.id);
  const lenkbar = datenwert(werkzeug.werte, 'lenkbare_zuege', werkzeug.id);
  const delta = begrenzen(zug.seitenabweichung, -1, 1) * proZug * faktor;
  if (zugIndex < lenkbar) return drift + delta;
  const verschlimmert = drift === 0 || Math.sign(delta) === Math.sign(drift);
  return verschlimmert ? drift + delta : drift;
}

/** Tempo-Grenzwert am Ende des Schnitts; "Abfall stützen" erhöht ihn um `stuetz_faktor`. */
export function tempoGrenze(werkzeug: WerkzeugDef, stuetzen: boolean): number {
  const grenze = datenwert(werkzeug.werte, 'tempo_grenze', werkzeug.id);
  return stuetzen ? grenze * datenwert(werkzeug.werte, 'stuetz_faktor', werkzeug.id) : grenze;
}

/** Positionsmerkmale in ein neues Teilstück [von, bis] (Koordinaten ab Ende a des Originals) übertragen. */
function merkmaleUebertragen(
  merkmale: readonly Merkmal[],
  von: number,
  bis: number,
  gespiegelt: boolean,
): Merkmal[] {
  const ergebnis: Merkmal[] = [];
  for (const m of merkmale) {
    if (m.pos_mm === undefined) {
      ergebnis.push({ ...m });
      continue;
    }
    if (m.pos_mm < von || m.pos_mm > bis) continue;
    const pos = gespiegelt ? bis - m.pos_mm : m.pos_mm - von;
    ergebnis.push({ ...m, pos_mm: runden3(pos) });
  }
  return ergebnis;
}

function blattUrsache(versatz: number, fuge: number): InhaltsId {
  if (versatz - fuge / 2 > 0) return 'kern.text.blatt-zu-weit-im-abfall';
  if (versatz < -fuge / 4) return 'kern.text.blatt-werkstueckseite';
  return 'kern.text.blatt-auf-linie';
}

/**
 * Querschnitt: Ist-Länge = Markierung + Blattversatz − Fuge/2 + Bezugsfehler (holz-brett-zuschnitt §4.1).
 * Liefert `[Teil, Rest?]`; das Teil beginnt am Bezugsende (sein Ende a), das Schnittende ist Ende b.
 */
export function trennen(ctx: ProzessKontext, e: TrennenEingabe): ProzessErgebnis<TrennenDetail> {
  const { werkstueck: ws, werkzeug } = ctx;
  const fuge = datenwert(werkzeug.werte, 'fuge_mm', werkzeug.id);
  const L = ws.masse_mm.l;
  const bezug = bezugsfehler(ws, e.bezugsende);
  const blattfehler = runden3(e.blattversatz_mm - fuge / 2);
  const ist = runden3(begrenzen(e.markierung_mm + blattfehler + bezug, 0, L));
  const restLaenge = runden3(L - ist - fuge);

  const driftVerlauf: number[] = [];
  let drift = 0;
  e.zuege.forEach((zug, i) => {
    drift = driftNachZug(drift, i, zug, werkzeug, ctx.mod);
    driftVerlauf.push(drift);
  });
  drift = runden3(drift);

  const letzte = e.zuege.slice(-2);
  const tempoEnde = letzte.reduce((max, z) => Math.max(max, z.tempo), 0);

  const vonA = e.bezugsende === 'a';
  const anderes = ws.enden[anderesEnde(e.bezugsende)];
  // Endmerkmale mit Ausdehnung (z. B. Endriss) positionsgenau verteilen: was über den Schnitt reicht,
  // liegt auch im anderen Stück (ab dessen Schnittende).
  const bezugsVerteilung = endmerkmaleVerteilen(ws.enden[e.bezugsende].merkmale, ist, ist + fuge);
  const gegenVerteilung = endmerkmaleVerteilen(anderes.merkmale, Math.max(restLaenge, 0), L - ist);
  const teil: Werkstueck = {
    id: e.teilId,
    materialId: ws.materialId,
    masse_mm: { ...ws.masse_mm, l: ist },
    enden: {
      a: { winkel_grad: ws.enden[e.bezugsende].winkel_grad, merkmale: bezugsVerteilung.bleibt },
      b: { winkel_grad: drift, merkmale: gegenVerteilung.durch },
    },
    merkmale: vonA ? merkmaleUebertragen(ws.merkmale, 0, ist, false) : merkmaleUebertragen(ws.merkmale, L - ist, L, true),
    herkunft: 'schnitt',
  };
  const werkstuecke: Werkstueck[] = [teil];
  if (restLaenge > 0) {
    werkstuecke.push({
      id: e.restId,
      materialId: ws.materialId,
      masse_mm: { ...ws.masse_mm, l: restLaenge },
      enden: {
        a: { winkel_grad: -drift, merkmale: bezugsVerteilung.durch },
        b: { winkel_grad: anderes.winkel_grad, merkmale: gegenVerteilung.bleibt },
      },
      merkmale: vonA
        ? merkmaleUebertragen(ws.merkmale, ist + fuge, L, false)
        : merkmaleUebertragen(ws.merkmale, 0, restLaenge, true),
      herkunft: 'rest',
    });
  }

  const messwerte: Record<string, number> = {
    laenge_ist_mm: ist,
    rest_mm: Math.max(restLaenge, 0),
    blattfehler_mm: blattfehler,
    bezugsfehler_mm: bezug,
    drift_grad: drift,
    delta_winkel_grad: Math.abs(drift),
    tempo_ende: tempoEnde,
    tempo_verhaeltnis: tempoEnde / tempoGrenze(werkzeug, e.stuetzen),
  };

  const ursachen: Ursache[] = [];
  const schwelle = 0.25;
  if (e.soll_mm !== undefined) {
    const abweichung = runden3(ist - e.soll_mm);
    messwerte['abweichung_l_mm'] = abweichung;
    messwerte['delta_l_mm'] = Math.abs(abweichung);
    const messfehler = runden3(e.markierung_mm - e.soll_mm);
    if (Math.abs(messfehler) >= schwelle) {
      ursachen.push({ id: 'kern.text.falsch-gemessen', messwert: 'delta_l_mm', wert: messfehler });
    }
  }
  if (Math.abs(blattfehler) >= schwelle) {
    ursachen.push({ id: blattUrsache(e.blattversatz_mm, fuge), messwert: 'delta_l_mm', wert: blattfehler });
  }
  if (Math.abs(bezug) >= schwelle) {
    ursachen.push({ id: 'kern.text.schiefes-bezugsende', messwert: 'delta_l_mm', wert: bezug });
  }
  if (drift !== 0) ursachen.push({ id: 'kern.text.schief-gesaegt', messwert: 'delta_winkel_grad', wert: drift });
  ursachen.sort((x, y) => Math.abs(y.wert) - Math.abs(x.wert));

  let ergebnis: ProzessErgebnis<unknown> = {
    werkstuecke,
    messwerte,
    ursachen,
    zaehler: ['kern.zaehler.schnitte'],
    detail: { driftVerlauf } satisfies TrennenDetail,
  };
  for (const regel of ctx.regeln) {
    if (regel.klasse === ctx.material.klasse && regel.prozess === PROZESS_TRENNEN) {
      ergebnis = regel.anwenden(ctx, ergebnis);
    }
  }
  return { ...ergebnis, detail: { driftVerlauf } };
}

/**
 * Merkmale eines Endes auf zwei Stücke verteilen. `stueck` = Länge des Stücks an diesem Ende,
 * `abstand` = Länge bis zum Beginn des anderen Stücks (Stück + Fuge). Merkmale ohne `laenge_mm`
 * bleiben am Ende; mit `laenge_mm` werden sie aufs Stück gekürzt und reichen ggf. ins andere Stück.
 */
export function endmerkmaleVerteilen(
  merkmale: readonly Merkmal[],
  stueck: number,
  abstand: number,
): { bleibt: Merkmal[]; durch: Merkmal[] } {
  const bleibt: Merkmal[] = [];
  const durch: Merkmal[] = [];
  for (const m of merkmale) {
    if (m.laenge_mm === undefined) {
      bleibt.push({ ...m });
      continue;
    }
    if (stueck > 0) bleibt.push({ ...m, laenge_mm: runden3(Math.min(m.laenge_mm, stueck)) });
    const rest = runden3(m.laenge_mm - abstand);
    if (rest > 0) durch.push({ ...m, laenge_mm: rest });
  }
  return { bleibt, durch };
}
