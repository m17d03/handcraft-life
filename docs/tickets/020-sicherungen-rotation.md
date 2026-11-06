---
id: 020
titel: Sicherungs-Rotation robust bei Transaktionsabbruch und mehreren Tabs
agent: engine-engineer
meilenstein: Phase 1 – Vertical Slice 0.1 (Nachlauf)
status: done
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
- [x] Fuzz (≥ 2000 Folgen mit Abbrüchen): immer ≤ 3 Autosaves, Laufnummern eindeutig, `aktuell` nie rückwärts
- [x] Zwei Tabs (echte IndexedDB, Chromium): nach N Speichervorgängen genau 3 Autosaves, eindeutig geordnet
- [x] Navigation-weg-Tests aus 017 bleiben grün (alle Anfragen synchron, tx.commit())
- [x] `npm run check` + E2E grün

## Protokoll
- engine-engineer: Speichertransaktion aktuell → Sicherung → Bereichs-Löschen → tx.commit(); Laufnummer `<nr>.<Tab-Kennung>`;
  eigene Aufräum-Transaktion nach jedem Speichern (auch fremde Tabs), BroadcastChannel als Beschleuniger.
- QA: ABNAHME EMPFOHLEN – eigener Fuzz 0/3000 (1 Tab), 0/1000 (2 Tabs mit Kanal), echte Zwei-Tab-IndexedDB 12/12, Navigation-weg
  weiterhin grün, alte Schlüsselformate korrekt. CI 42261489693 (2. Versuch nach Installationsfehler) vollständig grün.
- Restpunkte (niedrig, Backlog): nach Abbruch vorübergehend nur 2 Autosaves; seltene Wegrotation der neuesten Sicherung bei
  gleichzeitigem Speichern zweier Tabs bzw. im Rückfall-Pfad (`aktuell` immer korrekt); Laufnummern nur mit Tab-Kennung eindeutig;
  Test-Attrappe führt lesende Transaktionen sofort aus.
