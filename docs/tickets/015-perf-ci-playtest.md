---
id: 015
titel: Performance-Prüfung in CI und Playtest Vertical Slice vorbereiten
agent: qa-performance
meilenstein: Phase 1 – Vertical Slice 0.1
status: open
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
- [ ] `tests/perf/budget.spec.ts`: `/spiel/` laden, Standardrunde, `__perf()` → harte Grenzen aus QUALITY_STANDARDS
      als Testfehler (Draw Calls, Dreiecke, Texturspeicher, Download); Frame-Zeit nur als Bericht
- [ ] CI-Schritt läuft in WebKit; Ergebnis-Tabelle als Artefakt
- [ ] Playtest-Checkliste nach `docs/qa/playtest-vorlage.md`, Arbeitsschritt = „ein Regalbrett sägen“
- [ ] Unabhängige Abnahmeprüfung aller Phase-1-Tickets gegen ihre Kriterien

## Protokoll
