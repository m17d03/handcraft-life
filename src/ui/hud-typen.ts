// HUD-Schnittstelle (Ticket 011) ohne DOM/CSS-Abhängigkeit – für Spiel, Tests und Demo.

export type HudModus = 'erkunden' | 'werkbank-messen' | 'werkbank-ansetzen' | 'werkbank-saegen' | 'ergebnis';

export interface ErgebnisDaten {
  stufe: string;
  q: number;
  hauptursache: string;
  preis: number;
}

export interface BildschirmPos {
  xCss: number;
  yCss: number;
}

export interface Hud {
  readonly element: HTMLElement;
  modus(m: HudModus): void;
  auftragAnzeigen(text: string | null): void;
  messwertAnzeigen(mm: number | null): void;
  /** Lupe neben dem Bildpunkt (z. B. Massband-Ende); null = aus. Beim Ziehen folgt sie automatisch dem Daumen. */
  lupe(pos: BildschirmPos | null): void;
  saegeFortschritt(zug: number, von: number, tempoOk: boolean): void;
  ergebnisKarte(daten: ErgebnisDaten | null): void;
  geldAnzeigen(g: number): void;
  hinweis(text: string | null): void;
  // --- Ergänzungen (zusätzlich zur verbindlichen API) ---
  /** Kontext-Aktionstaste (88 pt) im Erkunden, z. B. {id:'werkbank', text:'Werkbank benutzen'}. */
  aktionstaste(taste: { id: string; text: string } | null): void;
  /** Massband-Griff an das projizierte Massband-Ende setzen; pxProMm = Bildmassstab am Brett. */
  massbandGriff(pos: (BildschirmPos & { pxProMm?: number }) | null): void;
  /** Aktueller Blattversatz laut Spiel (mm, + = Abfallseite) für Anzeige und Begrenzung ±3 mm. */
  blattVersatzAnzeigen(mm: number): void;
  dispose(): void;
}
