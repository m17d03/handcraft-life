---
adr: 0001
titel: Three.js wird die 3D-Engine
status: angenommen
datum: 2026-11-01
---

## Problem
Für den Vertical Slice und das Modulsystem muss die Web-3D-Engine feststehen. Pflicht sind WebGL 2,
iPhone-Safari als erste Plattform und die Budgets aus `CLAUDE.md`. Ticket 005 hat dieselbe Werkstattszene
in Babylon.js, PlayCanvas und Three.js gebaut und gemessen. Der Mensch hat am 2026-11-01 entschieden: Gewählt
wird die Engine mit der besten Performance; ein Gerätetest aller drei Engines entfällt.

## Optionen
| Option | Vorteile | Nachteile | Messwerte (Chromium/SwiftShader, relativ) |
|---|---|---|---|
| Babylon.js 9.33 | in TS geschrieben, Physik/GUI/AA eingebaut, stabile API | grösstes Bundle, langsamer spielbar, 8–20 % langsamere Frames | 382 kB, spielbar 1,4 s, Frame Ø 147 ms (hoch) / 41 ms (niedrig) |
| PlayCanvas 2.23 | mittleres Bundle | 60–75 % langsamere Frames, kein FXAA, Physik über altes Ammo.js | 286 kB, 0,7 s, 233 / 61 ms |
| **Three.js r187** | **schnellste Frames, am schnellsten spielbar, kleinstes Bundle, grösste Beispielmenge** | Physik und GUI selbst bauen oder anbinden; monatliche Breaking Changes; Typen separat | **145 kB, 0,57 s, 134 / 38 ms** |

Belege: `docs/perf/2026-11-01-engine-benchmark.md` (3 Durchgänge, 2 Lastvarianten), QA-Messung in
Ticket 005, `docs/spikes/engine-vergleich.md`.

## Entscheid
**Three.js** (`three`, Version exakt gepinnt, `@types/three` passend), WebGL 2, MSAA als Standard,
Pixeldichte höchstens 2.

## Begründung
- Three.js ist in **allen** gemessenen Leistungsgrössen vorn, reproduzierbar über 3 Läufe und 2
  Lastvarianten. Die unabhängige QA-Messung kommt zum selben Ergebnis.
- Kleinstes Bundle (145 kB) und schnellster Start (0,57 s); das zählt beim Start im iPhone-Browser.
- Die Vorteile von Babylon (Physik, GUI) braucht der Vertical Slice nicht: Das HUD ist ohnehin DOM
  (QS G5), und das Sägen ist regelbasiert statt physikalisch.

## Folgen
- Die Three.js-Version wird **exakt gepinnt**. Updates nur mit eigenem Ticket, das Migrationshinweise und
  Tests prüft.
- Physik nur bei Bedarf und dann per ADR (Kandidat Rapier); in Phase 1 nicht nötig.
- `src/render/` kapselt Three.js. Die Spiellogik importiert nie `three`; das setzt eine ESLint-Regel durch.
- Babylon und PlayCanvas werden aus den Abhängigkeiten entfernt, wenn die Spikes archiviert werden (Phase 1).
- Die absoluten fps prüft der iPhone-Playtest in Phase 1. Liegt Three.js dort dauerhaft unter 25 fps,
  wird die ADR erneut geprüft.

## Rückweg
Mittel. Die Spiellogik bleibt engine-frei; der Adapter hatte im Spike rund 190 Zeilen. Ein Wechsel kostet
vor allem Materialien, Schatten, Asset-Laden und Post-Processing: in Phase 1 wenige Tage, später mit jedem
Modul mehr.
