---
id: 020
titel: Sicherungs-Rotation robust bei Transaktionsabbruch und mehreren Tabs
agent: engine-engineer
meilenstein: Phase 1 – Vertical Slice 0.1 (Nachlauf)
status: open
reifegrad: Implementiert
blocked_by: [017]
branch: ticket/020-sicherungen
---

## Ziel
Es bleiben immer genau die letzten 3 Autosaves (plus Rohkopien vor Migration) – auch nach einem abgebrochenen Schreibvorgang
und wenn das Spiel in zwei Tabs offen ist. Der Spielstand `aktuell` ist schon heute korrekt; es geht nur um die Sicherungen.

## Befund (QA Ticket 017, Nachprüfung)
- A1: Nach Abbruch einer Transaktion verwenden bereits angelegte Folge-Transaktionen Phantom-Schlüssel → 4–5 Autosaves statt 3
  (6/1000 Fuzz-Folgen; Seeds 318, 291, 511, 524, 923, 969; Skript /tmp/qa017/fuzz.test.ts – evtl. nicht mehr vorhanden).
- A2: Zwei Tabs schreiben abwechselnd → 6 Autosaves, doppelte Laufnummern (Skript /tmp/qa017/zweitab.mjs).

## Scope
- Darf ändern: `src/core/save/**`, `tests/unit/save/**`, `tests/e2e/vertical-slice.spec.ts` (nur neue Tests)

## Abnahmekriterien
- [ ] Fuzz (≥ 2000 Folgen mit Abbrüchen): immer ≤ 3 Autosaves, Laufnummern eindeutig, `aktuell` nie rückwärts
- [ ] Zwei Tabs (echte IndexedDB, Chromium): nach N Speichervorgängen genau 3 Autosaves, eindeutig geordnet
- [ ] Navigation-weg-Tests aus 017 bleiben grün (alle Anfragen synchron, tx.commit())
- [ ] `npm run check` + E2E grün

## Protokoll
