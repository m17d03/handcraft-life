---
id: 009
titel: Spielstand – IndexedDB, Schema-Versionen, Migrationskette, Sicherung, Fixtures
agent: engine-engineer
meilenstein: Phase 1 – Vertical Slice 0.1
status: open
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
- [ ] `SpielstandDatei` mit Kern- und Modulabschnitten, je eigene `schema`-Version; Migrationskette n−1 → n
- [ ] Store `spielstand` (Schlüssel `aktuell`) und `sicherung` (Rohkopie vor Migration + letzte 3 Autosaves)
- [ ] Atomar: Schreiben in einer Transaktion; nie halber Zustand (Test mit simuliertem Abbruch)
- [ ] Unbekannter Modulabschnitt bleibt erhalten; zu neue Version → nur lesend + Hinweis (S7); IndexedDB-Fehler →
      Spiel läuft weiter mit Hinweis (S8)
- [ ] `navigator.storage.persist()` wird versucht, Ergebnis abfragbar
- [ ] Fixture `tests/fixtures/saves/v1.json` + Test „alter Spielstand lädt“ (S6)
- [ ] Autosave-API: `speichern(zustand)` entprellt (≤ 1×/s) plus `sofortSpeichern()` für `visibilitychange`/`pagehide`
- [ ] `npm run check` grün

## Nicht Teil dieses Tickets
Export/Import (Phase 2), mehrere Spielstände.

## Protokoll
