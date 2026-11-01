---
id: 016
titel: Feinschliff UI – Nahansicht und Hinweise auf kleinen iPhones, Debug-Anzeige in der Home-App
agent: mobile-ux
meilenstein: Phase 1 – Vertical Slice 0.1
status: open
reifegrad: Implementiert
blocked_by: [013]
branch: ticket/016-feinschliff-ui
---

## Ziel
Die Nahansicht am Brettende und die Hinweise sind auf allen iPhones im Querformat vollständig lesbar, und die
fps-/Fehleranzeige lässt sich auch in der Home-Bildschirm-App einschalten.

## Kontext
QA-Nachprüfung Ticket 013 (Protokoll in docs/tickets/013-vertical-slice-integration.md), Playtest
docs/playtests/2026-11-01-phase1.md (fps nicht sichtbar, weil Start vom Home-Bildschirm ohne ?debug=1).

## Scope
- Darf ändern: `src/ui/**`, `src/debug/**`, `src/spiel/main.ts` und `src/spiel/spiel.ts` (nur Verdrahtung des Debug-Schalters
  und Layout-Aufrufe), `tests/e2e/hud.spec.ts`, `tests/e2e/feinschliff-ui.spec.ts`, `tests/unit/ui/**`
- Darf nicht ändern: `src/render/`, `src/core/`, `src/modules/`, Projektdokumente

## Abnahmekriterien
- [ ] N1: Tasten der Nahansicht („Von hier messen“, „Anderes Ende“, ✕) ohne Abschneiden/Überlauf bei 667×375, 734×343,
      852×393, 932×430; Touch-Ziele ≥ 44 pt, Abstände ≥ 8 pt
- [ ] N2: Riss-Warnung und alle Hinweise vollständig lesbar (Umbruch statt „…“) bei denselben Grössen
- [ ] N4: Kopfzeile der Nahansicht nie vom Hinweisbalken verdeckt, auch bei 932×300 und 667×300 (Safari-Leisten)
- [ ] Debug-Schalter: 5× schnelles Tippen auf die Geldanzeige schaltet das Overlay (fps, max ms, Speicher, persist) ein/aus,
      Zustand bleibt in der Sitzung; Feedback ≤ 100 ms; versehentliches Auslösen beim normalen Spielen ausgeschlossen
- [ ] E2E mit Screenshots je Grösse; `npm run check` grün

## Protokoll
