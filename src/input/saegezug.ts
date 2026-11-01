// Sägezug-Erkennung (Ticket 011) – reine Funktionen, kein DOM, keine Zeitquelle.
// Ein Zug = ein Hin + ein Her entlang der Führungsspur. Erkannt wird über den Weg
// (Richtungsumkehr mit Hysterese), nicht über Zeitgrenzen: ein langsamer Hauptthread
// macht Züge höchstens langsamer, aber nie ungültig.

export interface SaegePunkt {
  /** Koordinate entlang der Spur (px), z. B. clientY bei senkrechter Spur. */
  laengs: number;
  /** Koordinate quer zur Spur (px), z. B. clientX bei senkrechter Spur. */
  quer: number;
  /** Zeitstempel in ms (z. B. PointerEvent.timeStamp). */
  t: number;
}

export interface SaegezugOptionen {
  /** Quer-Koordinate der Spurmitte (px). */
  mitteQuer: number;
  /** Abstand Mitte → Spurrand (px); entspricht Seitenabweichung ±1. */
  halbeBreiteQuer: number;
  /** Mindesthub je Hälfte (px); kürzere Wackler zählen nicht. */
  minHubPx: number;
  /** Mindestweg, ab dem die Startrichtung feststeht (px). Eine Umkehr braucht zusätzlich
   *  mindestens `minHubPx` Rücklauf ab dem Extrem: Wackler unterhalb davon gehören zur laufenden
   *  Hälfte, so entstehen nie zwei gleichgerichtete Hälften (QA-Befund B1/B3). */
  umkehrPx: number;
  /** Wegtempo (px/ms), das als Tempo 1 gilt. */
  referenzTempoPxProMs: number;
}

export const SAEGEZUG_STANDARD: Omit<SaegezugOptionen, 'mitteQuer' | 'halbeBreiteQuer'> = {
  minHubPx: 30,
  umkehrPx: 12,
  referenzTempoPxProMs: 0.5, // ≈ 2 Züge/s mit 120 px Hub (Gerät: Daumengefühl prüfen)
};

export interface Saegezug {
  /** Mittlere Querlage des Daumens relativ zur Spurmitte, −1..1 (+ = rechts/unten). */
  seitenabweichung: number;
  /** Weg/Zeit relativ zum Referenztempo, 0..2. */
  tempo: number;
  /** Mittlerer Hub je Hälfte (px). */
  hubPx: number;
  dauerMs: number;
}

export interface SaegezugZustand {
  readonly aktiv: boolean;
  /** Richtung der laufenden Hälfte: −1, 0 (noch unbestimmt) oder 1. */
  readonly richtung: -1 | 0 | 1;
  readonly halbStart: number;
  readonly extrem: number;
  readonly extremT: number;
  /** Abgeschlossene, gültige Hälften im laufenden Zug (0 oder 1). */
  readonly haelften: number;
  readonly weg: number;
  readonly zugStartT: number;
  readonly querSumme: number;
  readonly querAnzahl: number;
}

export const SAEGEZUG_LEER: SaegezugZustand = {
  aktiv: false,
  richtung: 0,
  halbStart: 0,
  extrem: 0,
  extremT: 0,
  haelften: 0,
  weg: 0,
  zugStartT: 0,
  querSumme: 0,
  querAnzahl: 0,
};

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

export interface SaegeSchritt {
  zustand: SaegezugZustand;
  zug: Saegezug | null;
}

/** Daumen setzt auf der Spur auf. */
export function saegezugStart(p: SaegePunkt): SaegezugZustand {
  return {
    ...SAEGEZUG_LEER,
    aktiv: true,
    halbStart: p.laengs,
    extrem: p.laengs,
    extremT: p.t,
    zugStartT: p.t,
    querSumme: p.quer,
    querAnzahl: 1,
  };
}

function zugAus(z: SaegezugZustand, weg: number, endeT: number, opt: SaegezugOptionen): Saegezug {
  const dauerMs = Math.max(1, endeT - z.zugStartT);
  const querMittel = z.querAnzahl > 0 ? z.querSumme / z.querAnzahl : opt.mitteQuer;
  return {
    seitenabweichung: clamp((querMittel - opt.mitteQuer) / Math.max(1, opt.halbeBreiteQuer), -1, 1),
    tempo: clamp(weg / dauerMs / opt.referenzTempoPxProMs, 0, 2),
    hubPx: weg / 2,
    dauerMs,
  };
}

/** Daumen bewegt sich. Liefert einen Zug, sobald nach Hin + Her die nächste Umkehr erkannt wird. */
export function saegezugSchritt(z: SaegezugZustand, p: SaegePunkt, opt: SaegezugOptionen): SaegeSchritt {
  if (!z.aktiv) return { zustand: z, zug: null };
  const quer = { querSumme: z.querSumme + p.quer, querAnzahl: z.querAnzahl + 1 };

  if (z.richtung === 0) {
    const d = p.laengs - z.halbStart;
    if (Math.abs(d) < opt.umkehrPx) return { zustand: { ...z, ...quer }, zug: null };
    return { zustand: { ...z, ...quer, richtung: d > 0 ? 1 : -1, extrem: p.laengs, extremT: p.t }, zug: null };
  }

  const vorlauf = (p.laengs - z.extrem) * z.richtung;
  if (vorlauf >= 0) {
    return { zustand: { ...z, ...quer, extrem: p.laengs, extremT: p.t }, zug: null };
  }
  // Hysterese an die Hubgrösse gekoppelt: erst ein Rücklauf von ≥ minHubPx ist eine echte Umkehr.
  if (-vorlauf < Math.max(opt.umkehrPx, opt.minHubPx)) return { zustand: { ...z, ...quer }, zug: null };

  // Umkehr: die laufende Hälfte endet am Extrem.
  const hub = Math.abs(z.extrem - z.halbStart);
  const neueRichtung: -1 | 1 = z.richtung === 1 ? -1 : 1;
  const neueHaelfte = {
    richtung: neueRichtung,
    halbStart: z.extrem,
    extrem: p.laengs,
    extremT: p.t,
  };
  if (hub < opt.minHubPx) {
    // Nur möglich bei der ersten Hälfte nach dem Aufsetzen (kurzer Anlauf in Gegenrichtung):
    // verwerfen und den Zug neu beginnen, damit keine gleichgerichteten Hälften gepaart werden.
    return { zustand: { ...z, ...quer, ...neueHaelfte, haelften: 0, weg: 0, zugStartT: z.extremT }, zug: null };
  }
  const haelften = z.haelften + 1;
  const weg = z.weg + hub;
  if (haelften < 2) {
    return { zustand: { ...z, ...quer, ...neueHaelfte, haelften, weg }, zug: null };
  }
  const zug = zugAus(z, weg, z.extremT, opt);
  return {
    zustand: {
      ...z,
      ...neueHaelfte,
      haelften: 0,
      weg: 0,
      zugStartT: z.extremT,
      querSumme: p.quer,
      querAnzahl: 1,
    },
    zug,
  };
}

/** Daumen hebt ab. Ein Hin + (genügend langes) Her zählt auch ohne weitere Umkehr. */
export function saegezugEnde(z: SaegezugZustand, p: SaegePunkt, opt: SaegezugOptionen): SaegeSchritt {
  const nach = saegezugSchritt(z, p, opt);
  const s = nach.zustand;
  let zug = nach.zug;
  if (!zug && s.aktiv && s.haelften === 1 && s.richtung !== 0) {
    const hub = Math.abs(s.extrem - s.halbStart);
    if (hub >= opt.minHubPx) zug = zugAus(s, s.weg + hub, s.extremT, opt);
  }
  return { zustand: SAEGEZUG_LEER, zug };
}

/** Bequemlichkeit (Tests, Auswertung): ganze Wischbahn → erkannte Züge. */
export function erkenneSaegezuege(punkte: readonly SaegePunkt[], opt: SaegezugOptionen): Saegezug[] {
  const [erster, ...rest] = punkte;
  if (!erster) return [];
  const letzter = rest.pop();
  let z = saegezugStart(erster);
  const zuege: Saegezug[] = [];
  for (const p of rest) {
    const s = saegezugSchritt(z, p, opt);
    z = s.zustand;
    if (s.zug) zuege.push(s.zug);
  }
  if (letzter) {
    const s = saegezugEnde(z, letzter, opt);
    if (s.zug) zuege.push(s.zug);
  }
  return zuege;
}
