---
id: 015
titel: Performance-Prüfung in CI und Playtest Vertical Slice vorbereiten
agent: qa-performance
meilenstein: Phase 1 – Vertical Slice 0.1
status: done
reifegrad: Getestet
blocked_by: [013, 014]
branch: ticket/015-perf-ci
---

## Ziel
Budgets werden bei jedem Push automatisch geprüft, und der Mensch bekommt eine 5-Minuten-Checkliste für
das Vertical Slice auf seinem iPhone.

## Scope
- Darf ändern: `tests/perf/budget.spec.ts`, `.github/workflows/ci.yml` (Perf-Schritt), `docs/perf/**`,
  `docs/playtests/<datum>-phase1.md`
- Darf nicht ändern: Produktivcode

## Abnahmekriterien
- [x] `tests/perf/budget.spec.ts`: `/spiel/` laden, Standardrunde, `__perf()` → harte Grenzen aus QUALITY_STANDARDS
      als Testfehler (Draw Calls, Dreiecke, Texturspeicher, Download); Frame-Zeit nur als Bericht
- [x] CI-Schritt läuft in WebKit; Ergebnis-Tabelle als Artefakt
- [x] Playtest-Checkliste nach `docs/qa/playtest-vorlage.md`, Arbeitsschritt = „ein Regalbrett sägen“
- [x] Unabhängige Abnahmeprüfung aller Phase-1-Tickets gegen ihre Kriterien

## Protokoll
- qa-performance: tests/perf/budget.spec.ts + budget.config.ts, CI-Schritt „Performance-Budget (WebKit)“ mit Bericht in der
  Lauf-Zusammenfassung und Artefakt perf-budget. Harte Grenze Texturspeicher auf iPhone-Schätzung (P6). 0 Draw Calls = Messfehler.
  Lokal: 28/29 Draw Calls, ~15 000 Dreiecke, 4,1 MB Download, 39,8 MB iPhone-Textur.
- Playtest-Teil vom Director erledigt (docs/playtests/2026-11-01-phase1.md). Gemergt zusammen mit 018 (vorher wäre CI wegen
  0 Draw Calls in WebKit rot gewesen).
