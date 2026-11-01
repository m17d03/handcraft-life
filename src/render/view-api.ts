/**
 * Schmale Schnittstelle zwischen Eingabe/Spiellogik und Darstellung (Ticket 010, verbindlich).
 * Die Spiellogik kennt nur diese Typen, nie `three`.
 *
 * Konventionen:
 * - Alle Längen auf dem Brett in mm, gemessen vom Bezugsende entlang der Brettmitte
 *   (`docs/design/holz-brett-zuschnitt.md` §4). Bezugsende `null` = Ende 'a'.
 * - Bildschirmkoordinaten in CSS-Pixeln relativ zur linken oberen Ecke des Canvas.
 * - `bewegen` gilt bis zum nächsten Aufruf (Eingabe meldet 0 beim Loslassen); `umschauen` summiert
 *   bis zum nächsten Frame.
 */
export interface WerkstattView {
  bewegen(vorwaerts: number, seitwaerts: number): void; // -1..1, pro Frame vom Input
  umschauen(dxPx: number, dyPx: number): void;
  pick(xCss: number, yCss: number): string | null; // ID des getroffenen Objekts (z. B. 'werkbank', 'brett')
  arbeitsansicht(an: boolean): void; // Kamerafahrt ≤ 600 ms zur Werkbank / zurück
  brettZeigen(laengeMm: number, bezugsende: 'a' | 'b' | null): void;
  markierungZeigen(mm: number | null): void; // Bleistiftstrich
  massbandZeigen(mm: number | null): void; // ausgezogenes Massband bis mm
  saegeZeigen(zustand: { versatzMm: number; tiefe01: number; driftGrad: number } | null): void;
  schnittErgebnisZeigen(laengeIstMm: number | null): void; // Brett getrennt, Reststück daneben
  hervorheben(id: string | null): void;
  weltNachBildschirm(mmAufBrett: number): { x: number; y: number } | null; // für HUD-Lupe
  bildschirmNachBrettMm(xCss: number, yCss: number): number | null; // Wischen auf dem Brett → mm
  dispose(): void;
}

/** Stabile Objekt-IDs, die `pick` liefert und `hervorheben` versteht (013 ersetzt nur die Modelle). */
export const OBJEKT_IDS = ['werkbank', 'brett', 'reststueck', 'saege', 'massband', 'bleistift'] as const;
export type ObjektId = (typeof OBJEKT_IDS)[number];

/** Zusätzlicher Lesezugriff für Tests und Debug (`window.__view`), ändert keine View-API-Signatur. */
export interface WerkstattViewZustand {
  bereit: boolean;
  arbeitsansicht: boolean;
  /** true, solange die Kamerafahrt läuft */
  fahrt: boolean;
  kamera: { x: number; y: number; z: number; yaw: number; pitch: number };
  brett: { laengeMm: number; bezugsende: 'a' | 'b' | null; schnittIstMm: number | null };
  hervorgehoben: string | null;
  /** Materialnamen, die durch `hervorheben` leuchten (Präfix = Objekt-ID) */
  leuchtend: string[];
  /** gerenderte Frames seit Start (zählt nur Frames mit gültigem WebGL-Kontext) */
  frames: number;
  kontextVerloren: boolean;
  /** Ticket 013: 'modelle' = GLB/KTX2 aus Ticket 012 eingebaut, 'platzhalter' = Ladefehler, Primitive. */
  assets: 'modelle' | 'platzhalter';
  /** Angezeigte Endrisse (mm ab Ende a bzw. b). */
  risse: { a: number | null; b: number | null };
}

/**
 * Ergänzung Ticket 013 (zusätzlich zur verbindlichen View-API, ändert keine Signatur): Endrisse am
 * Brettende sichtbar machen (holz-brett-zuschnitt §3 „Brett prüfen“). Länge in mm ab dem Ende, null = keiner.
 */
export interface WerkstattViewZusatz {
  endrisseZeigen(risse: { a: number | null; b: number | null }): void;
}

export interface WerkstattViewDebug extends WerkstattView, WerkstattViewZusatz {
  zustand(): WerkstattViewZustand;
  /** Bildschirmpunkt (CSS-px) der Mitte eines Objekts oder null, wenn nicht sichtbar. */
  bildschirmpunktVon(id: string): { x: number; y: number } | null;
}
