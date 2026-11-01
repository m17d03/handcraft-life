// Abstrakte Eingabebefehle (Ticket 011, Schnittstelle verbindlich).
// Die Eingabe kennt weder Engine noch Spielregeln: Sie meldet nur, was der Daumen getan hat.

export type Befehl =
  | { art: 'bewegen'; vorwaerts: number; seitwaerts: number } // pro Frame, -1..1
  | { art: 'umschauen'; dxPx: number; dyPx: number }
  | { art: 'tippen'; xCss: number; yCss: number }
  | { art: 'halten'; xCss: number; yCss: number } // ≥ 300 ms
  | { art: 'aktion'; id: string } // HUD-Taste, z. B. 'werkbank', 'zurueck', 'anreissen', 'weiter', 'abliefern'
  | { art: 'massband'; deltaMm: number }
  | { art: 'massbandSetzen'; xCss: number; yCss: number }
  | { art: 'blattVersatz'; deltaMm: number }
  | { art: 'sägezug'; seitenabweichung: number; tempo: number } // ein Hin+Her = ein Zug, Werte -1..1 bzw. 0..2
  | { art: 'stuetzen'; an: boolean };

export type BefehlsEmpfaenger = (befehl: Befehl) => void;

/** IDs der HUD-Tasten, die das HUD selbst ausgibt (das Spiel setzt weitere über `aktionstaste`). */
export const AKTIONEN = {
  zurueck: 'zurueck',
  anreissen: 'anreissen',
  weiter: 'weiter',
  abliefern: 'abliefern',
  neuesBrett: 'neuesBrett',
} as const;
