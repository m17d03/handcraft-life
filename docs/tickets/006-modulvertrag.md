---
id: 006
titel: Minimalen, versionierten Modulvertrag und Speicherformat entwerfen (ADR-Vorschlag)
agent: engine-engineer
meilenstein: Phase 0
status: done
reifegrad: Konzept
blocked_by: [002]
branch: ticket/006-modulvertrag
---

## Ziel
Ein schlanker, ehrlicher Entwurf, wie Module/Erweiterungen (Holz, Metall, 3D-Druck, Jagd, Angeln)
im selben Code mit stabilen IDs, Manifest und versioniertem Spielstand funktionieren – ohne
Plug-in-System.

## Kontext
- `.claude/skills/modul-vertrag/SKILL.md` (verbindlich), `docs/MASTER_PROMPT.md` §9
- `docs/design/core-loop.md` (Ticket 002)
- CLAUDE.md: kein Plug-in-System vor belegtem Nutzen; IndexedDB, versioniert, Migrationen

## Scope
- Darf ändern: `docs/design/modul-vertrag.md`, `docs/decisions/0002-modulvertrag.md`,
  `docs/decisions/0003-speicherformat.md` (beide nur `status: vorgeschlagen`)
- Darf nicht ändern: Code, Projektdokumente, `docs/decisions/0001-*`

## Abnahmekriterien
- [x] TypeScript-Typskizze `ModuleManifest`, Kern-Schnittstellen (Werkstück, Werkzeug, Arbeitsschritt,
      Auftrag, Inventar) – nur Typen im Dokument, kein Code im Repo
- [x] Ehrliche Tabelle: welche der Beispiel-Erweiterungen aus §9 (Fishing Base, Rivers & Lures,
      3D Printing Base/Advanced, Hunting Base, Hunting Dog & Waterfowl) rein datengetrieben möglich sind
      und welche neuen Code brauchen
- [x] Speicherformat: Aufbau (Kern + Abschnitt pro Modul), Versionierung, Migrationskette, Verhalten bei
      fehlendem/unbekanntem Modul, Fixture-Test-Strategie
- [x] Zwei ADR-Vorschläge im Format des Skills `architektur-entscheid` mit Optionen und Rückweg
- [x] `EXPANSION_REGISTRY.md`-Entwurf als Abschnitt im Dokument (ID, Version, Abhängigkeiten, Status)

## Nicht Teil dieses Tickets
Implementierung (folgt in Phase 1).

## Protokoll
- 2026-10-31 engine-engineer: modul-vertrag.md, ADR 0002/0003 (vorgeschlagen). Director: abgenommen; Annahme der ADRs mit der Phase-0-Freigabe. Folgen: Skill `modul-vertrag` anpassen (Felder art, mechanics, assets, tests).
