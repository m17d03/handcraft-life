# Handcraft Life – mobiles 3D-Handwerks- und Outdoor-Spiel (Browser, iPhone zuerst)

Singleplayer-3D-Simulation im iPhone-Safari (sekundär Desktop-Browser), als Web-App zum
Home-Bildschirm hinzufügbar. Kern: Handwerk mit **selektivem Realismus** (Holz → Metall → 3D-Druck),
danach Outdoor (Fasan, Ente, Jagdhund, Boot, Angeln) als Module. Stil: stilisiert-realistisch,
scharf, warmes Licht. Gefühlsreferenz "Made by Hand" – aber eigene Mechaniken, Assets und UI,
nichts übernehmen.

Wichtigste Regel: **Qualität vor Umfang, Spielbarkeit vor Präsentation, Erweiterbarkeit ohne
Überarchitektur.**

## Arbeitsumgebung des Menschen

Der Projektinhaber arbeitet **nur mit dem iPhone**, ohne Laptop. Claude Code läuft in der Cloud.
Daraus folgt:
- Nie verlangen, dass er etwas lokal installiert, ein Terminal öffnet oder Dateien hochlädt.
- Alles Prüfbare wird über GitHub Pages veröffentlicht (`.github/workflows/deploy-pages.yml`,
  Link: https://m17d03.github.io/handcraft-life/). Nach jedem Merge auf `main` den Link nennen.
- Anweisungen an ihn kurz, Schritt für Schritt, mit direkten Links.
- Ein Debug-Overlay (`?debug=1`) zeigt fps und Fehler direkt auf dem iPhone.

## Verbindliche Dokumente (`docs/`)

| Datei | Inhalt | Ändern darf |
|---|---|---|
| `MASTER_PROMPT.md` | Ursprünglicher Projektauftrag (Quelle, nicht bearbeiten) | niemand |
| `GAME_VISION.md` | Vision, MVP, bewusst ausgeschlossene Funktionen | Director |
| `GAME_DESIGN.md` | Loops, Mechaniken, Wirtschaft, Skills (Details in `docs/design/`) | game-designer → Director |
| `ART_DIRECTION.md` | Stil, Paletten, Referenzen, Asset-Budgets | asset-artist → Director |
| `TECH_ARCHITECTURE.md` | Engine, Systeme, Datenmodell, Speicherung | Director |
| `AGENT_RESPONSIBILITIES.md` | Rollen ↔ Agenten ↔ Skills | Director |
| `PRODUCT_BACKLOG.md` | Priorisierte Liste, verweist auf `docs/tickets/` | Director |
| `EXPANSION_REGISTRY.md` | Alle Module mit ID, Version, Abhängigkeiten | Director |
| `QUALITY_STANDARDS.md` | Budgets, Tests, Definition of Done | Director (QA schlägt vor) |
| `DECISION_LOG.md` | Index aller Entscheidungen, Details in `docs/decisions/` | Director |

Bei Widerspruch gilt: Entscheidung in `docs/decisions/` > Projektdokumente > Ticket > Rest.

## Rollen

- **Diese Hauptsession ist Game Director & Project Manager (Agent A).** Nur sie ändert die
  Director-Dokumente, nimmt Tickets ab, integriert in `main` und löst Konflikte.
- Subagenten in `.claude/agents/`:
  - `game-designer` – Game Design & Economy **und** Realism & Simulation (B + F)
  - `engine-engineer` – Game Engineering **und** Umsetzung des Modulsystems (C + G)
  - `asset-artist` – Graphics & 3D Art (D)
  - `mobile-ux` – Mobile Controls & UI/UX (E)
  - `qa-performance` – Quality Assurance & Performance (H), unabhängig, repariert nichts
- Expansion Architect (G) und Technical Producer sind als Skills umgesetzt
  (`modul-vertrag`, `ticket-schreiben`), nicht als eigene Agenten.
- Subagenten starten keine weiteren Subagenten. Höchstens 3–4 gleichzeitig aktiv.
  Parallele Code-Arbeit nur in getrennten Git-Worktrees mit nicht überlappendem Datei-Scope.
- Keine parallele Ausführung behaupten, die nicht stattgefunden hat.

## Statusstufen (überall gleich verwenden)

`Konzept` → `Prototyp` → `Implementiert` → `Getestet` → `Freigegeben`.
Nichts ist "fertig", wenn nur ein Mockup oder eine nicht angeschlossene Oberfläche existiert.
Konzeptbilder sind immer als **Konzeptbild – kein Spielscreenshot** gekennzeichnet.

## Arbeitsweise

1. Keine Funktion ohne Ticket mit Definition, technischer Bewertung und Abnahmekriterien
   (`docs/tickets/NNN-titel.md`, Skill `ticket-schreiben`).
2. Grössere Änderung → Entscheidung (Skill `architektur-entscheid`) + Eintrag in `DECISION_LOG.md`.
3. Technische Entscheidungen auf Prototypen und Messungen stützen.
4. Jede Phase endet spielbar oder prüfbar, mit Playtest auf echtem iPhone (Skill `iphone-playtest`).
5. Skills: `milestone-run` (Phasen steuern), `konzept-visuals`, `engine-spike`, `mechanik-entwurf`,
   `asset-pipeline`, `touch-steuerung`, `perf-budget-check`, `modul-vertrag`.

## Definition of Done (jedes Code-Ticket)

- Abnahmekriterien von `qa-performance` unabhängig geprüft.
- `npm run typecheck`, `npm run lint`, `npm test` grün.
- Performance-Budget eingehalten (Skill `perf-budget-check`).
- Neue Assets in `assets/LICENSES.md`.
- Speicherformat unverändert ODER Migration + Test mit altem Spielstand.

## Startbudgets (nach Engine-Spike per Entscheidung fixieren)

| Grösse | Ziel | Harte Grenze |
|---|---|---|
| Bildrate auf Ziel-iPhone | stabile 30 fps (60 fps optional) | nie unter 25 fps |
| Draw Calls pro Frame | < 80 | 120 |
| Dreiecke im Bild | < 150 000 | 300 000 |
| GPU-Texturspeicher | < 120 MB | 200 MB |
| Erster Download bis spielbar | < 15 MB | 25 MB |

Dynamische Renderauflösung und Anti-Aliasing (FXAA/TAA/MSAA) im Spike vergleichen.

## Tech-Grundsätze

- TypeScript strict, Vite, Vitest, Playwright. Git, ein Branch pro Ticket.
- WebGL 2 als Pflicht-Renderpfad, WebGPU optional.
- Assets glTF/GLB, Texturen KTX2, Meshes komprimiert.
- Getrennt halten: Spiellogik · Stammdaten (JSON) · Assets · UI · Spielstände · Modul-Definitionen.
- Speichern lokal (IndexedDB), versioniert, mit Migrationen. Kein Server, kein Account.
- Kein Plug-in-System bauen, bevor sein Nutzen belegt ist: zuerst Module im selben Code mit
  stabilen IDs und Manifest.
