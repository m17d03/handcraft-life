---
id: 009
titel: Spielstand – IndexedDB, Schema-Versionen, Migrationskette, Sicherung, Fixtures
agent: engine-engineer
meilenstein: Phase 1 – Vertical Slice 0.1
status: done
reifegrad: Implementiert
blocked_by: [008]
branch: ticket/009-spielstand
---

## Ziel
Der Spielzustand aus Ticket 008 wird zuverlässig lokal gespeichert und geladen – auch nach Neuladen, App-Wechsel
und künftigen Formatänderungen.

## Kontext
ADR 0003 (`docs/decisions/0003-speicherformat.md`, verbindlich), `docs/design/modul-vertrag.md` §6,
`docs/qa/quality-standards-entwurf.md` S2–S8.

## Scope
- Darf ändern: `src/core/save/**`, `tests/unit/save/**`, `tests/fixtures/saves/**`, `package.json` nur falls
  `fake-indexeddb` als devDependency für Tests nötig ist (ADR 0003 sagt: ohne – dann Speicher-Adapter-Interface
  mit In-Memory-Implementierung für Tests)
- Darf nicht ändern: übriges `src/`, Projektdokumente, ADRs

## Abnahmekriterien
- [x] `SpielstandDatei` mit Kern- und Modulabschnitten, je eigene `schema`-Version; Migrationskette n−1 → n
- [x] Store `spielstand` (Schlüssel `aktuell`) und `sicherung` (Rohkopie vor Migration + letzte 3 Autosaves)
- [x] Atomar: Schreiben in einer Transaktion; nie halber Zustand (Test mit simuliertem Abbruch)
- [x] Unbekannter Modulabschnitt bleibt erhalten; zu neue Version → nur lesend + Hinweis (S7); IndexedDB-Fehler →
      Spiel läuft weiter mit Hinweis (S8)
- [x] `navigator.storage.persist()` wird versucht, Ergebnis abfragbar
- [x] Fixture `tests/fixtures/saves/v1.json` + Test „alter Spielstand lädt“ (S6)
- [x] Autosave-API: `speichern(zustand)` entprellt (≤ 1×/s) plus `sofortSpeichern()` für `visibilitychange`/`pagehide`
- [x] `npm run check` grün

## Nicht Teil dieses Tickets
Export/Import (Phase 2), mehrere Spielstände.

## Protokoll
- 2026-11-01 engine-engineer (2. Anlauf nach API-Limit): src/core/save, 5 Fixtures, 39 Tests.
- QA Runde 1: NACHARBEIT – (hoch) älterer Stand überschreibt neueren; (mittel) keine Neuverbindung nach close (iOS);
  (mittel) Speichern vor laden() überschreibt still; Sicherungen unbegrenzt; Rotation nach Uhrzeit. Echte IndexedDB im
  Browser (Chromium) von QA geprüft: Reload, Rotation, harter Abbruch – ok.
- Behoben (7928483), 51 Tests. Nachprüfung Director: QA-Suite 9/9 (zwei Fälle um laden() ergänzt – beabsichtigte Sperre
  vor dem Laden; Uhr-Rücksprung-Fall mit verschärfter Erwartung).
