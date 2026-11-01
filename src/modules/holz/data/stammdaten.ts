/**
 * Stammdaten des Holz-Moduls (Vertical Slice 0.1), holz-brett-zuschnitt §4/§7 und core-loop §5.
 * Zahlen mit [H] sind Startwerte und werden nach dem iPhone-Playtest justiert.
 */
import type { ModulDaten } from '../../../core/modul';
import { PROZESS_MESSEN, PROZESS_TRENNEN } from '../../../core/prozesse';
import type { AuftragVorlage, MaterialDef, ProduktDef, WerkzeugDef } from '../../../core/typen';

export const MERKMAL_ENDRISS = 'holz.merkmal.endriss';
export const MERKMAL_AST = 'holz.merkmal.ast';
export const MERKMAL_AUSRISS = 'holz.merkmal.ausriss';
export const TEXT_AUSRISS = 'holz.text.ausriss';

export const FICHTE_BRETT: MaterialDef = {
  id: 'holz.material.fichte-brett-2000',
  klasse: 'holz',
  profil: 'brett',
  masse_mm: { l: 2000, b: 140, d: 18 },
  preis: 12,
  werte: {
    /** Wahrscheinlichkeit je Brett: ein Ende hat einen Endriss. */
    endriss_p: 0.5,
    endriss_min_mm: 20,
    endriss_max_mm: 80,
    /** Wahrscheinlichkeit je Brett: ein Ast in der Fläche. */
    ast_p: 0.3,
    /** Unbearbeitetes Werksende: Bezugsfehler −2…+2 mm. */
    ende_fehler_max_mm: 2,
    ende_gut_max_mm: 0.3,
    ende_schlecht_min_mm: 1,
  },
};

export const FUCHSSCHWANZ: WerkzeugDef = {
  id: 'holz.werkzeug.fuchsschwanz',
  prozesse: [PROZESS_TRENNEN],
  materialKlassen: ['holz'],
  werte: {
    fuge_mm: 1.6,
    werkzeugfaktor: 1.0,
    drift_grad_pro_zug: 0.35, // [H]
    zuege_gesamt: 8, // [H]
    lenkbare_zuege: 3, // [H]
    tempo_grenze: 1.0, // [H] Tempo-Skala der Eingabe 0..2
    stuetz_faktor: 1.3,
    versatz_max_mm: 3,
  },
  preis: 0,
};

export const REGALBRETT: ProduktDef = {
  id: 'holz.produkt.regalbrett',
  schritte: [PROZESS_MESSEN, PROZESS_TRENNEN],
  bewertung: {
    kriterien: [
      { messwert: 'delta_l_mm', punkte: 40, voll_bis: 0.5, null_ab: 5, ursache: 'holz.text.laenge-ungenau' },
      { messwert: 'delta_winkel_grad', punkte: 30, voll_bis: 0.3, null_ab: 3, ursache: 'kern.text.schief-gesaegt' },
      // P_Kante: 20 sauber · 10 kleiner Ausriss (1) · 0 grosser Ausriss (2) = lineare Rampe 0..2
      { messwert: 'ausriss', punkte: 20, voll_bis: 0, null_ab: 2, ursache: TEXT_AUSRISS },
    ],
    feste: [{ merkmal: MERKMAL_AST, punkte: 10, abzug: 5 }],
    ausschuss_wenn: [MERKMAL_ENDRISS],
    ausschuss_wenn_messwert: [{ messwert: 'abweichung_l_mm', kleinerGleich: -5, ursache: 'kern.text.zu-kurz' }],
    toleranz_kappt_auf: 'C',
  },
  verwendungen: ['verkauf', 'werkstatt-slot'],
  xp_basis: 4, // [H] ≈ 7 XP je Schnitt bei Q 70 → Level 2 nach ca. 7 Schnitten
  skillBereich: 'holz.skill.holzhandwerk',
};

export const AUFTRAG_REGALBRETT: AuftragVorlage = {
  id: 'holz.auftrag.regalbrett',
  produktId: REGALBRETT.id,
  materialId: FICHTE_BRETT.id,
  soll: { laenge_mm: [300, 900] },
  raster: { laenge_mm: 50 },
  start: { laenge_mm: 600 },
  toleranz: { delta_l_mm: 1 },
  // Lernkurve „geführt“ (holz-brett-zuschnitt §5): Auftrag 1–2 mit ± 2 mm (Director-Freigabe Ticket 013, QA F3)
  einstieg: { auftraege: 2, toleranz: { delta_l_mm: 2 } },
  basispreis: { material_faktor: 1.5, je_schritt: 4 },
};

export const holzDaten: ModulDaten = {
  materialien: [FICHTE_BRETT],
  werkzeuge: [FUCHSSCHWANZ],
  produkte: [REGALBRETT],
  auftraege: [AUFTRAG_REGALBRETT],
  texte: {
    [MERKMAL_ENDRISS]: 'Endriss im Werkstück – Ausschuss. Vom anderen Ende messen!',
    [MERKMAL_AST]: 'Ast im Werkstück (nur optisch)',
    [MERKMAL_AUSRISS]: 'Ausriss an der Unterkante',
    [TEXT_AUSRISS]: 'Zu schnell am Ende: Unterkante ausgerissen',
    'holz.text.laenge-ungenau': 'Länge ungenau: {wert} mm',
  },
};
