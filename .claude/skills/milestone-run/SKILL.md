---
name: milestone-run
description: Orchestriert als Game Director einen Meilenstein – Tickets ableiten, Agenten beauftragen, Ergebnisse prüfen lassen, integrieren, Playtest anstossen. Verwenden mit "/milestone-run <Meilenstein>" oder wenn ein Meilenstein umgesetzt werden soll.
---

# Meilenstein durchführen (nur Hauptsession / Director)

Eingabe: Name des Meilensteins aus die Projektdokumente in `docs/` (z. B. `M3 Vertical Slice 0.1`).

## Sonderfall Phase 0 (Preproduction) – kein Spielcode
Parallel beauftragen (Ergebnisse nur Dokumente, keine Dateikonflikte):
| Agent | Auftrag | Skill | Ergebnis |
|---|---|---|---|
| game-designer | Kern-Loop, MVP, ausgeschlossene Funktionen; Machbarkeit Holz/Metall/3D-Druck/Jagd | `mechanik-entwurf` | `docs/design/core-loop.md`, `docs/design/realismus-bewertung.md` |
| asset-artist | 2–3 Stilvarianten, Bild-Prompts, Asset-Quellen | `konzept-visuals`, `asset-pipeline` | `docs/art/…` |
| mobile-ux | Zwei Steuerungskonzepte + HTML-Mockups | `touch-steuerung`, `konzept-visuals` | `docs/design/steuerung-a-b.md` |
| engine-engineer | Engine-Spike (3 Engines), minimaler Modulvertrag | `engine-spike`, `modul-vertrag` | `spikes/`, Entscheidungs-Vorschläge |
| qa-performance | Messbare Kriterien für Performance, Bedienbarkeit, Stabilität | `perf-budget-check` | Entwurf `QUALITY_STANDARDS.md` |

Danach erstellt der Director das konsolidierte Dokument `docs/PHASE0_ERGEBNIS.md` mit den 12
Punkten aus Master-Prompt Abschnitt 17, füllt die 9 Projektdokumente und legt Konflikte und
Empfehlung dem Menschen **zur Freigabe** vor. Kein Phase-1-Ticket vor dieser Freigabe.

## 1. Lage klären
- Lies die Projektdokumente in `docs/`, alle ADRs, `docs/tickets/` (offene und erledigte), letzten Playtest-Bericht
  in `docs/playtests/`.
- Schreibe in 5–10 Zeilen: Ziel des Meilensteins, was schon existiert, was fehlt, grösstes Risiko.
- Wenn das Ziel zu gross ist: zuerst kürzen und dem Menschen den gekürzten Umfang zeigen.

## 2. Tickets schneiden
- Mit Skill `ticket-schreiben` 3–8 Tickets anlegen. Jedes Ticket: ein Agent, ein Datei-Scope,
  prüfbare Kriterien, maximal ein Arbeitstag Agentenarbeit.
- Abhängigkeiten als `blocked_by` notieren. Erst Design-Tickets, dann Code, dann Assets/Polish.

## 3. Beauftragen
- Pro Ticket den passenden Subagenten starten. Prompt enthält: Ticket-Pfad, Worktree/Branch,
  "Lies CLAUDE.md und dein Ticket zuerst", erwartetes Abschlussformat.
- Höchstens 3–4 Agenten gleichzeitig. Code-Tickets parallel nur, wenn sich ihre Datei-Scopes
  nicht überschneiden; sonst nacheinander.

## 4. Prüfen
- Nach jeder Umsetzung `qa-performance` mit demselben Ticket starten (frischer Kontext).
- NACHARBEIT NÖTIG → Fehlerbericht an den umsetzenden Agenten, höchstens 2 Runden.
  Danach Ticket verkleinern oder neu entscheiden.
- Einwände von Agenten ernst nehmen: entweder ADR (Skill `architektur-entscheid`) oder
  begründet ablehnen und im Ticket notieren.

## 5. Integrieren
- Branches einzeln in `main` mergen, nach jedem Merge Tests laufen lassen.
- Ticket auf `status: done` setzen, Kurzprotokoll ins Ticket.

## 6. Abschluss
- Build erzeugen, Skill `iphone-playtest` für den Menschen vorbereiten.
- Meilenstein-Bericht in `docs/milestones/<name>.md`: erreicht / nicht erreicht / gelernt /
  nächster Schritt. Erst nach dem Playtest des Menschen den nächsten Meilenstein starten.
