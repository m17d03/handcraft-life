# DECISION_LOG

Index aller Entscheidungen; Details in `docs/decisions/`. Nur der Director setzt `angenommen`/`abgelehnt`.

| Nr. | Datum | Titel | Status | Link |
|---|---|---|---|---|
| 0001 | 2026-11-01 | Three.js wird die 3D-Engine (beste gemessene Performance) | angenommen | [0001](decisions/0001-engine-wahl.md) |
| 0002 | 2026-10-31 | Module im selben Code mit Manifest, IDs, materialunabhängige Kern-Prozesse | angenommen | [0002](decisions/0002-modulvertrag.md) |
| 0003 | 2026-10-31 | Spielstand als versioniertes JSON-Dokument in IndexedDB mit Migrationskette | angenommen | [0003](decisions/0003-speicherformat.md) |
| 0004 | 2026-10-31 | Vertical Slice nur Querformat, durchgehend Ich-Sicht (Konzept B) | angenommen | [0004](decisions/0004-querformat-ich-sicht.md) |

## Kleinere Director-Entscheide (ohne ADR)
| Datum | Entscheid | Grund |
|---|---|---|
| 2026-10-31 | WebKit-Tests laufen in GitHub-CI, lokal läuft Chromium als Vorprüfung | Die Cloud-Sitzung sperrt den WebKit-Download |
| 2026-10-31 | `public/konzepte/` und `.claude/` sind von ESLint ausgenommen | Wegwerf-Mockups bzw. Agenten-Worktrees, kein Produktivcode |
| 2026-10-31 | Sourcemaps werden auf Pages mitveröffentlicht | Fehlersuche auf dem iPhone |
| 2026-10-31 | Phase-0-Konzeptbilder auf 5 Kernansichten gekürzt, die übrigen 7 als Kurzprompts | UMSETZUNGSPLAN Punkt 5 |
| 2026-11-01 | Phase 0 vom Menschen freigegeben („wie empfohlen“); Engine nach bester Performance statt Gerätetest aller drei Engines | Freigabe des Menschen |
| 2026-11-01 | 3D-Modelle zuerst prozedural bzw. per Skript als GLB; Blender, sobald ein erreichbarer Konnektor existiert | Blender-Konnektor in der Cloud-Sitzung nicht verfügbar |
| 2026-11-01 | Referenzgerät für Budgets: iPhone 15 Pro Max; Pixeldichte im Spiel ≤ 2 | Angabe des Menschen |
