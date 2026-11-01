---
id: 017
titel: Schiefes Brettende in 3D erkennbar, Speichern direkt nach einer Aktion beim Verlassen sicher
agent: engine-engineer
meilenstein: Phase 1 – Vertical Slice 0.1
status: open
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
- [ ] N3: In der Werkbankansicht ist das schiefe Ende ohne Nahansicht erkennbar (z. B. Anschlagwinkel-Kontur, Lichtspalt,
      Schatten oder Markierung am Ende) – Screenshot-Vergleich sauberes/schiefes Ende in der Bezugsende-Phase
- [ ] F7: Verlassen (pagehide/visibilitychange hidden) 0 ms nach einer Aktion verliert den Stand nicht mehr – z. B. laufenden
      Schreibvorgang nicht abwarten, sondern den neuesten Stand in derselben Transaktion bzw. sofort in eigener Transaktion
      schreiben; Generationsregel aus Ticket 009 bleibt erhalten (älterer Stand überschreibt nie neueren). Test im Browser
      (Chromium) und Unit-Test
- [ ] Budgets unverändert (Draw Calls < 80); `npm run check` + E2E grün

## Protokoll
