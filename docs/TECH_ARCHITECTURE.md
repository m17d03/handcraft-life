# TECH_ARCHITECTURE

Status: **Konzept – Entwurf zur Freigabe** (Phase 0). Grundlage: ADR 0001–0004, `docs/spikes/engine-vergleich.md`,
`docs/design/modul-vertrag.md`.

## Bestätigt (Phase S, im Repo, getestet)
| Baustein | Stand |
|---|---|
| Build | Vite 8, TypeScript 6 strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| Qualität | ESLint `strictTypeChecked`, Vitest, Playwright (iPhone 15 hoch/quer) |
| CI | `.github/workflows/ci.yml`: typecheck, lint, Vitest, Playwright **WebKit** bei jedem Push |
| Auslieferung | `deploy-pages.yml` → https://m17d03.github.io/handcraft-life/ (Multi-Page: Startseite, Konzepte, Spikes) |
| Debug | `?debug=1`: fps, längster Frame, JS-, Promise- und Ladefehler |

## Vorgeschlagen (Freigabe offen)
| Bereich | Vorschlag | Beleg / ADR |
|---|---|---|
| Engine | **Babylon.js** (`@babylonjs/core`, tiefe Importe), endgültig erst nach dem iPhone-Spike-Test | ADR 0001 |
| Renderpfad | WebGL 2 Pflicht; WebGPU erst später prüfen | CLAUDE.md |
| Auflösung/AA | Pixeldichte auf 2 begrenzt, MSAA×4 als Standard; FXAA als Ausweichoption; dynamische Absenkung bei Last | Spike-Messung, QS G3/G4 |
| Format/Kamera | Querformat, durchgehend Ich-Sicht | ADR 0004 |
| Module | im selben Code, `src/modules/<id>/module.ts` mit Manifest; keine Importe zwischen Modulen; IDs `<modul>.<typ>.<name>` | ADR 0002 |
| Kern-Prozesse | `messen`, `trennen`, `bohren` materialunabhängig (Metall später Aufwand M) | ADR 0002 |
| Spielstand | ein JSON-Dokument in IndexedDB, Schema-Version je Abschnitt, Migrationskette, Rohkopie vor jeder Migration, Speichern bei `visibilitychange`, `storage.persist()` | ADR 0003 |
| Messung | `window.__perf()` (PerfSnapshot v1), GL-Zählhülle aus `spikes/shared/perf.ts` | QS-Entwurf §8 |

## Schichten (Zielbild Phase 1)
```
src/core/        Spielzustand, Prozesse, Qualität, Wirtschaft, Speichern   ← reines TS, ohne Engine, Vitest
src/modules/     kern-unabhängige Inhalte + Regeln je Modul (holz …)        ← Daten + kleine Regeln
src/render/      Engine-Adapter (Babylon): Szene, Licht, Picking, Assets   ← dünn, austauschbar
src/input/, ui/  Touch, HUD als DOM über dem Canvas                         ← mobile-ux
public/data/     Stammdaten (JSON)       assets/  GLB/KTX2
```
Regeln: Spiellogik importiert nie die Engine. Die UI ist DOM, keine Engine-GUI (QS G5).

## Bekannte technische Schulden / Risiken
- Spike-Texturen sind unkomprimiert. Die KTX2-Pipeline (`@gltf-transform/cli`) kommt mit dem ersten Asset-Ticket.
- Babylon lädt ungenutzte Texturlader mit (Bundle 382 kB gzip): Folge-Ticket Bundle-Diät.
- WebKit läuft nur in GitHub-CI, weil die Cloud-Sitzung den Download nicht erlaubt.
