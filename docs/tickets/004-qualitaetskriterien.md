---
id: 004
titel: Messbare Qualitätskriterien für Performance, Bedienbarkeit und Spielstabilität entwerfen
agent: qa-performance
meilenstein: Phase 0
status: open
reifegrad: Konzept
blocked_by: [001]
branch: ticket/004-qualitaet
---

## Ziel
Ein Entwurf für `docs/QUALITY_STANDARDS.md`, den der Director übernehmen kann: messbare Kriterien,
wie und womit sie gemessen werden, und welche nur auf dem iPhone prüfbar sind.

## Kontext
- `CLAUDE.md` (Startbudgets, Definition of Done), `docs/MASTER_PROMPT.md` §8, §14
- `.claude/skills/perf-budget-check/SKILL.md`, `.claude/skills/iphone-playtest/SKILL.md`
- Bestehendes Setup: `package.json`, `playwright.config.ts`, `.github/workflows/ci.yml`
- Einschränkung: In der Cloud-Sitzung ist WebKit nicht installierbar; WebKit läuft nur in GitHub-CI.

## Scope
- Darf ändern: `docs/qa/quality-standards-entwurf.md`, `docs/qa/playtest-vorlage.md`
  (Dateien per Bash anlegen; kein Produktivcode)
- Darf nicht ändern: alles andere

## Abnahmekriterien
- [ ] Kriterien in 4 Gruppen: Performance (fps, Frame-Zeit p95, Draw Calls, Dreiecke, Texturspeicher,
      Download, Ladezeit), Bedienbarkeit (Touch-Ziele, Feedback-Zeit, Lesbarkeit, Safe Areas,
      Hoch/Quer), Stabilität (Neuladen, App-Wechsel, Speicherstand-Migration, Fehlerfreiheit Konsole),
      Grafikqualität (Referenzbild-Vergleich, Kantenschärfe/AA, Auflösung)
- [ ] Pro Kriterium: Ziel, harte Grenze, Messmethode (Befehl/Test/Gerät), automatisch oder (Gerät),
      ab welcher Phase verbindlich
- [ ] Definition of Done pro Statusstufe (Konzept → Freigegeben) eindeutig
- [ ] Testpyramide: was Vitest, was Playwright (WebKit/CI vs. Chromium/lokal), was Mensch auf iPhone
- [ ] Ehrliche Grenzen der Emulation benannt
- [ ] `playtest-vorlage.md`: max. 10 Fragen, beantwortbar in < 5 Minuten im Chat
- [ ] Vorschlag für `window.__perf()`-Schnittstelle (Felder, Einheiten) für den Engine-Spike

## Nicht Teil dieses Tickets
Implementierung von Messcode, Änderungen an Konfiguration.

## Protokoll
