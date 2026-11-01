/**
 * Kern-Typen (materialunabhängig), nach `docs/design/modul-vertrag.md` §4 und ADR 0002.
 * Reines TypeScript ohne Engine und ohne DOM. Alles, was im Spielstand liegt, ist JSON-serialisierbar
 * (nur Zahlen, Strings, Booleans, null, Arrays und einfache Objekte).
 */

/** Modul-ID, z. B. `holz`. Format `[a-z][a-z0-9-]*`, nie umbenennen. */
export type ModulId = string;
/** Inhalts-ID `<modul>.<typ>.<name>`, z. B. `holz.werkzeug.fuchsschwanz`. Nie umbenennen, nie wiederverwenden. */
export type InhaltsId = string;

export type MaterialKlasse = 'holz' | 'metall' | 'kunststoff';
export type EndeId = 'a' | 'b';

export interface Masse {
  l: number;
  b: number;
  d: number;
}

/** Stammdaten: Material. `werte` trägt materialspezifische Zahlen (Prozesse lesen nur die Klasse). */
export interface MaterialDef {
  id: InhaltsId;
  klasse: MaterialKlasse;
  profil: 'brett' | 'flach' | 'winkel' | 'rohr' | 'druckteil';
  masse_mm: Masse;
  preis: number;
  werte: Record<string, number>;
}

/**
 * Merkmal an einem Werkstück oder Ende, z. B. Ast (`pos_mm` ab Ende a) oder Endriss am Ende
 * (`laenge_mm` = Ausdehnung vom Ende ins Stück; wird beim Trennen positionsgenau verteilt).
 */
export interface Merkmal {
  id: InhaltsId;
  pos_mm?: number;
  laenge_mm?: number;
  wert?: number;
}

/**
 * Ende eines Werkstücks entlang der Längsachse. `winkel_grad` = Abweichung vom rechten Winkel
 * (Vorzeichen: + = Kante, an der der Massband-Haken greift, steht vor → Teil wird länger).
 */
export interface Ende {
  winkel_grad: number;
  merkmale: Merkmal[];
}

export type Stufe = 'A' | 'B' | 'C' | 'D' | 'ausschuss';

export interface Qualitaet {
  q: number;
  stufe: Stufe;
  punkte: Record<string, number>;
  hauptursache: InhaltsId;
  /** Begleitwert zur Hauptursache (z. B. −0,8 mm), für die Ergebniskarte. */
  hauptursacheWert: number;
  /** Auftrag, für den bewertet wurde. */
  auftragId: string;
}

/** Spielstand: ein konkretes Stück Material im Lager. */
export interface Werkstueck {
  /** Instanz-ID, z. B. `ws_3`. */
  id: string;
  materialId: InhaltsId;
  masse_mm: Masse;
  enden: { a: Ende; b: Ende };
  merkmale: Merkmal[];
  herkunft: 'roh' | 'rest' | 'schnitt';
  qualitaet?: Qualitaet;
}

/** Stammdaten: Werkzeug. `werte` z. B. fuge_mm, werkzeugfaktor, zuege_gesamt, lenkbare_zuege, tempo_grenze. */
export interface WerkzeugDef {
  id: InhaltsId;
  prozesse: InhaltsId[];
  materialKlassen: MaterialKlasse[];
  werte: Record<string, number>;
  preis: number;
}

export interface WerkzeugBesitz {
  werkzeugId: InhaltsId;
}

/** Lineare Rampe: volle Punkte bis `voll_bis`, null ab `null_ab`. */
export interface Kriterium {
  messwert: string;
  punkte: number;
  voll_bis: number;
  null_ab: number;
  /** Ursache, falls dieses Kriterium die meisten Punkte kostet und der Prozess keine genauere liefert. */
  ursache: InhaltsId;
}

/** Datengetriebene Qualitätsbewertung pro Produkt (modul-vertrag §4.4). */
export interface Bewertung {
  kriterien: Kriterium[];
  /** Merkmal im Teil → `punkte − abzug`, sonst volle `punkte`. */
  feste: { merkmal: InhaltsId; punkte: number; abzug: number }[];
  /** Merkmal im Teil → Ausschuss, unabhängig von Q. */
  ausschuss_wenn: InhaltsId[];
  /** Messwert ≤ Grenze → Ausschuss (z. B. Untermass ≥ 5 mm). */
  ausschuss_wenn_messwert?: { messwert: string; kleinerGleich: number; ursache: InhaltsId }[];
  /** Auftragstoleranz verletzt → höchstens diese Stufe. */
  toleranz_kappt_auf?: Stufe;
}

export type Verwendung = 'verkauf' | 'werkstatt-slot' | 'bauteil' | 'ausruestung';

export interface ProduktDef {
  id: InhaltsId;
  schritte: InhaltsId[];
  bewertung: Bewertung;
  verwendungen: Verwendung[];
  /** Basis-XP je abgeschlossenem Arbeitsschritt (core-loop §4). */
  xp_basis: number;
  /** Skill-Bereich, dem die XP gutgeschrieben werden. */
  skillBereich: InhaltsId;
}

/** Stammdaten: Auftragsvorlage. Soll-Bereich wird in `raster`-Schritten gewürfelt. */
export interface AuftragVorlage {
  id: InhaltsId;
  produktId: InhaltsId;
  materialId: InhaltsId;
  soll: Record<string, [min: number, max: number]>;
  raster: Record<string, number>;
  /** Soll des allerersten Auftrags (Einstieg, z. B. 600 mm). */
  start: Record<string, number>;
  /** Schlüssel = Messwert (z. B. `delta_l_mm`), Wert = erlaubte Abweichung. */
  toleranz: Record<string, number>;
  basispreis: { material_faktor: number; je_schritt: number };
}

/** Spielstand: konkreter Auftrag. */
export interface Auftrag {
  id: string;
  vorlageId: InhaltsId;
  soll: Record<string, number>;
  toleranz: Record<string, number>;
  basispreis: number;
  kundeId: string;
  status: 'angeboten' | 'angenommen' | 'abgeliefert' | 'abgelehnt';
  werkstueckId?: string;
}

/** Kern-Inventar (modul-vertrag §4.5). */
export interface Inventar {
  geld: number;
  /** Anschreiben beim Händler; wird vom nächsten Erlös abgezogen. */
  schulden: number;
  werkstuecke: Werkstueck[];
  gegenstaende: { itemId: InhaltsId; anzahl: number }[];
  werkzeuge: WerkzeugBesitz[];
}

/** Ursache mit Bezug zu einem Messwert; `wert` = Beitrag (z. B. mm), wichtigste zuerst. */
export interface Ursache {
  id: InhaltsId;
  messwert: string;
  wert: number;
}

/** Zufallsquelle 0 ≤ x < 1, gesät (deterministisch). */
export type Zufall = () => number;

export interface ProzessKontext {
  werkstueck: Werkstueck;
  material: MaterialDef;
  werkzeug: WerkzeugDef;
  /** Skill-Modifikatoren; im Slice Identität. */
  mod: (parameterId: InhaltsId, basis: number) => number;
  zufall: Zufall;
  regeln: MaterialRegel[];
}

export interface ProzessErgebnis<Detail> {
  werkstuecke: Werkstueck[];
  messwerte: Record<string, number>;
  ursachen: Ursache[];
  zaehler: InhaltsId[];
  detail: Detail;
}

/** Kleine materialtypische Regel eines Moduls, angewandt nach einem Kern-Prozess. */
export interface MaterialRegel {
  klasse: MaterialKlasse;
  prozess: InhaltsId;
  anwenden(ctx: ProzessKontext, e: ProzessErgebnis<unknown>): ProzessErgebnis<unknown>;
}

/** Regel eines Moduls beim Erzeugen eines neuen Werkstücks (z. B. Endriss, Ast würfeln). */
export interface ErzeugungsRegel {
  klasse: MaterialKlasse;
  anwenden(ws: Werkstueck, material: MaterialDef, zufall: Zufall): Werkstueck;
}
