---
id: 017
titel: Schiefes Brettende in 3D erkennbar, Speichern direkt nach einer Aktion beim Verlassen sicher
agent: engine-engineer
meilenstein: Phase 1 – Vertical Slice 0.1
status: done
reifegrad: Implementiert
blocked_by: [013]
branch: ticket/017-schraege-speichern
---

## Ziel
Der Spieler erkennt das schiefe Ende schon in der Werkbankansicht, und ein Verlassen der App unmittelbar nach einer
Aktion verliert keinen Fortschritt.

## Kontext
QA-Nachprüfung Ticket 013: N3 (Schräge ≈ 5 px, in der Perspektive kaum sichtbar), F7 (Verlassen 0–300 ms nach
„Anreissen“ → Markierung verloren; Ursache: neuer Schreibvorgang startet hinter einem laufenden, iOS beendet die Seite).

## Scope
- Darf ändern: `src/render/**`, `src/core/save/**`, `tests/unit/save/**`, `tests/unit/render/**`, `tests/e2e/render.spec.ts`,
  `tests/e2e/vertical-slice.spec.ts`
- Darf nicht ändern: `src/ui/`, `src/spiel/`, `src/debug/` (gleichzeitig Ticket 016), Regeln in `src/core` ausser `save/`

## Abnahmekriterien
- [x] N3: In der Werkbankansicht ist das schiefe Ende ohne Nahansicht erkennbar (z. B. Anschlagwinkel-Kontur, Lichtspalt,
      Schatten oder Markierung am Ende) – Screenshot-Vergleich sauberes/schiefes Ende in der Bezugsende-Phase
- [x] F7: Verlassen (pagehide/visibilitychange hidden) 0 ms nach einer Aktion verliert den Stand nicht mehr – z. B. laufenden
      Schreibvorgang nicht abwarten, sondern den neuesten Stand in derselben Transaktion bzw. sofort in eigener Transaktion
      schreiben; Generationsregel aus Ticket 009 bleibt erhalten (älterer Stand überschreibt nie neueren). Test im Browser
      (Chromium) und Unit-Test
- [x] Kamera-Rahmung (Befund aus Ticket 016): Bei 734×343 und 852×393 mit Notch liegt das rechte Brettende in der 20-pt-Randzone
      und ist dort nicht antippbar → Arbeitsansicht so rahmen, dass beide Brettenden bei allen Grössen ausserhalb Randzone + Safe Area liegen
- [x] Budgets unverändert (Draw Calls < 80); `npm run check` + E2E grün

## Protokoll
- engine-engineer (nach API-Limit fortgesetzt, auf main 018/019 neu aufgesetzt): Anschlagwinkel mit Lichtspalt an beiden Enden in der
  Bezugsende-Phase (Mindestgrösse in Bildschirm-px); Speichertransaktion setzt alle Anfragen synchron ab + tx.commit();
  Arbeitsansicht rahmt in Pixeln (beide Enden ausserhalb Safe Area + 20 pt + 14 pt Reserve).
- QA Runde 1: NACHARBEIT – Navigation weg 0–100 ms verlor Stand (8/12); Lichtspalt bei 667 pt schwach. Behoben (ff431c9).
- QA Nachprüfung: ABNAHME EMPFOHLEN – 36/36 Verlassen-Fälle, Fuzz 3000 Folgen ohne Verstoss an `aktuell`, N3 bei allen Grössen
  sichtbar, sauberes Ende nie leuchtend. Teständerung „zu neuer Spielstand“ sachlich nötig, keine Abschwächung.
  Auflagen → Ticket 020: Rotation der Sicherungen nach Abbruch (4–5 statt 3) und bei zwei Tabs (6, doppelte Laufnummern).
- WebKit-CI grün: 42215967402 (459e727), 42250891071 (ff431c9). Budgets: 23 Draw Calls (Bezugsende), 9 159 Dreiecke, 114,7 MB Textur.
