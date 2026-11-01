// Endprüfung (Ticket 013, QA F1): Nahansicht eines Brettendes mit Anschlagwinkel. Zeigt den Spalt zwischen
// Winkel und Stirnkante in mm und ob das Ende rechtwinklig ist; gewählt wird erst nach Bestätigung.
// Reine Darstellung (DOM/SVG im HUD), keine Spielregeln: Werte liefert das Spiel.

export interface EndpruefungDaten {
  /** Bildschirmseite des Endes. */
  seite: 'links' | 'rechts';
  /** Spalt am Anschlagwinkel über die Brettbreite (mm, echt). */
  spaltMm: number;
  rechtwinklig: boolean;
  /** Endriss-Länge (mm) oder null. */
  rissMm: number | null;
}

export interface EndpruefungAktionen {
  beiWahl: () => void;
  beiAnderesEnde: () => void;
  beiZu: () => void;
}

const zahl = (v: number): string => v.toFixed(1).replace('.', ',');

/** Zeichnung: Draufsicht auf das Brettende, Anschlagwinkel an der Vorderkante, Spalt rot. Überzeichnet. */
function zeichnung(d: EndpruefungDaten): string {
  const W = 220;
  const H = 120;
  const oben = 22; // Hinterkante
  const unten = 98; // Vorderkante (Spieler)
  // Stirnkante: an der Vorderkante bei x0, an der Hinterkante um den Spalt versetzt (×8 überzeichnet, max 26 px)
  const versatz = Math.min(26, d.spaltMm * 8);
  const links = d.seite === 'links';
  const x0 = links ? 70 : W - 70;
  const richtung = links ? -1 : 1; // nach aussen
  const xHinten = x0 - richtung * versatz; // Stirn weicht zur Hinterkante hin zurück
  const brett = links
    ? `M${String(W)},${String(oben)} L${String(xHinten)},${String(oben)} L${String(x0)},${String(unten)} L${String(W)},${String(unten)} Z`
    : `M0,${String(oben)} L${String(xHinten)},${String(oben)} L${String(x0)},${String(unten)} L0,${String(unten)} Z`;
  // Anschlagwinkel: Zunge entlang der Stirn (senkrecht zur Vorderkante), Anschlag an der Vorderkante
  const zunge = links ? `M${String(x0 - 6)},6 L${String(x0)},6 L${String(x0)},${String(unten)} L${String(x0 - 6)},${String(unten)} Z` : `M${String(x0)},6 L${String(x0 + 6)},6 L${String(x0 + 6)},${String(unten)} L${String(x0)},${String(unten)} Z`;
  const anschlag = links
    ? `M${String(x0 - 6)},${String(unten)} L${String(x0 + 70)},${String(unten)} L${String(x0 + 70)},${String(unten + 14)} L${String(x0 - 6)},${String(unten + 14)} Z`
    : `M${String(x0 - 70)},${String(unten)} L${String(x0 + 6)},${String(unten)} L${String(x0 + 6)},${String(unten + 14)} L${String(x0 - 70)},${String(unten + 14)} Z`;
  // Spalt (Licht zwischen Zunge und Stirn), nur wenn die Stirn zurückweicht
  const spalt =
    versatz >= 1
      ? `<path d="M${String(x0)},${String(unten)} L${String(x0)},${String(oben)} L${String(xHinten)},${String(oben)} Z" fill="#ff8a7a" opacity="0.9"/>`
      : '';
  const riss =
    d.rissMm !== null
      ? `<path d="M${String(x0)},${String((oben + unten) / 2 - 4)} l${String(-richtung * 46)},3 l${String(richtung * 46)},3 Z" fill="#22160d"/>`
      : '';
  return `<svg viewBox="0 0 ${String(W)} ${String(H)}" width="${String(W)}" height="${String(H)}" aria-hidden="true">
    <path d="${brett}" fill="#e3c08d" stroke="#8e5d33" stroke-width="1.5"/>
    ${riss}${spalt}
    <path d="${zunge}" fill="#9aa6ab" stroke="#3a3f41"/>
    <path d="${anschlag}" fill="#5a3a24" stroke="#2a1a10"/>
  </svg>`;
}

/** Zeigt die Endprüfung im HUD (ersetzt eine offene). Rückgabe: Element (zum Entfernen). */
export function endpruefungZeigen(wurzel: HTMLElement, d: EndpruefungDaten, a: EndpruefungAktionen): HTMLElement {
  wurzel.querySelector('.hud-endpruefung')?.remove();
  const el = document.createElement('div');
  el.className = `hud-endpruefung ${d.rechtwinklig ? 'gut' : 'schief'}`;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Brettende prüfen');
  const ende = d.seite === 'links' ? 'Linkes Ende' : 'Rechtes Ende';
  const befund = d.rechtwinklig ? `rechtwinklig (Spalt ${zahl(d.spaltMm)} mm)` : `Spalt ${zahl(d.spaltMm)} mm – schief`;
  el.innerHTML = `
    <div class="hud-endpruefung-bild">${zeichnung(d)}</div>
    <div class="hud-endpruefung-text">
      <strong>${ende}: <span class="befund">${befund}</span></strong>
      ${d.rissMm !== null ? `<p class="riss">Endriss ${String(Math.round(d.rissMm))} mm – davon nicht messen.</p>` : ''}
      <p class="hinweis">${d.rechtwinklig ? 'Gutes Bezugsende.' : 'Vom schiefen Ende gemessen wird das Brett ungenau.'}</p>
      <div class="zeile">
        <button type="button" class="hud-primaer hud-endpruefung-wahl">Von hier messen</button>
        <button type="button" class="hud-endpruefung-anderes">Anderes Ende</button>
        <button type="button" class="hud-endpruefung-zu" aria-label="Schliessen">✕</button>
      </div>
    </div>`;
  const taste = (sel: string, f: () => void): void => {
    el.querySelector(sel)?.addEventListener('click', (e) => {
      e.stopPropagation();
      f();
    });
  };
  taste('.hud-endpruefung-wahl', a.beiWahl);
  taste('.hud-endpruefung-anderes', a.beiAnderesEnde);
  taste('.hud-endpruefung-zu', a.beiZu);
  // Berührungen auf dem Panel gehen nicht an die Spielfläche darunter
  for (const t of ['pointerdown', 'pointermove', 'pointerup']) el.addEventListener(t, (e) => { e.stopPropagation(); });
  wurzel.append(el);
  return el;
}

export function endpruefungSchliessen(wurzel: HTMLElement): void {
  wurzel.querySelector('.hud-endpruefung')?.remove();
}
