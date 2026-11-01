# DECISION_LOG

Index aller Entscheidungen; Details in `docs/decisions/`. Nur der Director setzt `angenommen`/`abgelehnt`.

| Nr. | Datum | Titel | Status | Link |
|---|---|---|---|---|
| 0001 | 2026-11-01 | Babylon.js wird die 3D-Engine (vorbehaltlich iPhone-Test) | vorgeschlagen | [0001](decisions/0001-engine-wahl.md) |
| 0002 | 2026-10-31 | Module im selben Code mit Manifest, IDs, materialunabhängige Kern-Prozesse | vorgeschlagen | [0002](decisions/0002-modulvertrag.md) |
| 0003 | 2026-10-31 | Spielstand als versioniertes JSON-Dokument in IndexedDB mit Migrationskette | vorgeschlagen | [0003](decisions/0003-speicherformat.md) |
| 0004 | 2026-10-31 | Vertical Slice nur Querformat, durchgehend Ich-Sicht (Konzept B) | vorgeschlagen | [0004](decisions/0004-querformat-ich-sicht.md) |

## Kleinere Director-Entscheide (ohne ADR)
| Datum | Entscheid | Grund |
|---|---|---|
| 2026-10-31 | WebKit-Tests laufen in GitHub-CI, lokal läuft Chromium als Vorprüfung | Die Cloud-Sitzung sperrt den WebKit-Download |
| 2026-10-31 | `public/konzepte/` und `.claude/` sind von ESLint ausgenommen | Wegwerf-Mockups bzw. Agenten-Worktrees, kein Produktivcode |
| 2026-10-31 | Sourcemaps werden auf Pages mitveröffentlicht | Fehlersuche auf dem iPhone |
| 2026-10-31 | Phase-0-Konzeptbilder auf 5 Kernansichten gekürzt, die übrigen 7 als Kurzprompts | UMSETZUNGSPLAN Punkt 5 |
