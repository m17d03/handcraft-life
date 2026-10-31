---
adr: 0003
titel: Spielstand ist ein JSON-Dokument in IndexedDB mit Kern- und Modulabschnitten, je eigener Schema-Version und Migrationskette
status: vorgeschlagen
datum: 2026-10-31
---

## Problem
Ab dem Vertical Slice wird gespeichert (MVP-Punkt 12, `core-loop.md`). Jede spätere Formatänderung muss
alte Spielstände laden können (CLAUDE.md, Definition of Done). Module kommen und gehen pro Spielstand
(ADR 0002). Zusätzlich löscht iOS Safari Website-Speicher unter Bedingungen, die der Spieler nicht sieht.
Details: `docs/design/modul-vertrag.md` §6.

## Optionen
| Option | Vorteile | Nachteile | Messwerte/Belege |
|---|---|---|---|
| A localStorage, ein JSON-String | trivial | synchron (blockiert Frame), ca. 5 MB, gleiche 7-Tage-Löschung | – |
| **B IndexedDB, ein Dokument pro Spielstand**: Hülle + `kern` + `module[id]`, je eigene `schema`-Zahl und Migrationen | eine Transaktion = atomar; Module unabhängig versioniert; Migrationen sind reine Funktionen auf JSON (Vitest ohne Browser); Export = dasselbe JSON | ganzes Dokument wird bei jedem Speichern geschrieben | erwartete Grösse < 100 KB **[H]**, im Slice messen |
| C IndexedDB normalisiert (Store pro Entität: Werkstücke, Aufträge …) | Teil-Schreiben | Migration über mehrere Stores, Konsistenz schwer; Export aufwendiger; kein Bedarf bei kleinen Daten | – |
| D Eine globale Versionsnummer für alles | eine Zahl | jede Modul-Änderung zwingt Kern-Migration; ruhende Module nicht abbildbar | – |
| E Bibliothek (`idb`, `localforage`, `zod`) | weniger eigener Code | neue Abhängigkeit (ADR-pflichtig) für ca. 50 Zeilen Wrapper | – |

## Entscheid
Option B ohne neue Abhängigkeit: ein `SpielstandDatei`-Dokument in IndexedDB (Store `spielstand`, Schlüssel
`'aktuell'`, plus Store `sicherung` mit Rohkopie vor jeder Migration und den letzten 3 Autosaves); Kern und
jedes Modul haben eine eigene ganzzahlige `schema`-Version mit lückenloser Migrationskette `n-1 → n`;
unbekannte Modulabschnitte bleiben unverändert erhalten; ein zu neuer Spielstand wird nur lesend geöffnet.

## Begründung
- IndexedDB ist asynchron und auf iOS Safari verfügbar **[B]**; ein Dokument mit einer Transaktion schliesst
  halb geschriebene Stände aus.
- Abschnitt pro Modul folgt direkt aus ADR 0002 und dem Skill `modul-vertrag` ("pro Modul eigener, versionierter Abschnitt").
- Reine Migrationsfunktionen + Fixtures in `tests/fixtures/saves/` sind ohne Browser testbar; die echte
  Ablage prüft Playwright – dafür braucht es kein `fake-indexeddb`.
- iOS: WebKit löscht skriptbaren Speicher nach 7 Tagen ohne Nutzung für nicht installierte Websites **[B]**
  (WebKit-Blog "Full Third-Party Cookie Blocking and More", März 2020); Home-Bildschirm-Apps sind laut
  demselben Beitrag ausgenommen **[P]**. Darum: Installationshinweis, `navigator.storage.persist()` versuchen
  (Wirkung auf iOS **[H]**, im Debug-Overlay anzeigen), Speichern bei `visibilitychange`.
  Export/Import als JSON nur als **Vorschlag** (eigenes Ticket, Aufwand S).

## Folgen
- Einfacher: Formatänderungen sind lokal (ein Abschnitt, eine Migration, eine Fixture); Export/Import nutzt denselben Ladepfad.
- Schwerer: Disziplin – Migrationen und Fixtures dürfen nie geändert oder gelöscht werden; jede Schema-Erhöhung
  braucht eine Fixture, erzeugt mit dem alten Stand.
- Anzupassen nach Annahme: `TECH_ARCHITECTURE.md` (Speicherung), `QUALITY_STANDARDS.md` (Pflicht-Fixtures,
  `modul-vertrag.md` §6.6), Slice-Ticket Phase 1 (Ablage, Migrationsrahmen, Speicherstatus im Debug-Overlay),
  optional Ticket Export/Import.

## Rückweg
- B → C (normalisiert): mittel; eine Migration teilt das Dokument auf, Hülle und Schema-Zahlen bleiben.
- Bibliothek (E) nachträglich: billig, nur der Wrapper hinter der Schnittstelle `Ablage` wird getauscht.
- Abschnitte/Versionen später nachrüsten wäre teuer – darum jetzt, vor dem ersten veröffentlichten Spielstand.
