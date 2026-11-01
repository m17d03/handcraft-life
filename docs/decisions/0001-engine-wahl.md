---
adr: 0001
titel: Babylon.js wird die 3D-Engine (vorläufig, vorbehaltlich iPhone-Test)
status: vorgeschlagen
datum: 2026-11-01
---

## Problem
Für Vertical Slice und Modulsystem muss die Web-3D-Engine feststehen (WebGL 2 Pflicht, iPhone-Safari
zuerst, Budgets aus `CLAUDE.md`). Ticket 005 hat dieselbe Werkstattszene in Babylon.js, PlayCanvas und
Three.js gebaut und automatisch gemessen. Die Gerätemessung (50 % der Gewichtung) steht aus.

## Optionen
| Option | Vorteile | Nachteile | Messwerte/Belege (Chromium/SwiftShader, relativ) |
|---|---|---|---|
| Babylon.js 9.33 | in TS geschrieben, stabile API mit Abwärtskompatibilität; Picking, FXAA/TAA, Havok-Physik, GUI, Inspector eingebaut; Doku + Playground | grösstes Bundle; Tree-Shaking zieht ungenutzte Lader; CW-Vorderseiten-Konvention auch im RH-Modus | 382 kB gzip, spielbar 1,25 s, 27 DC, 1 428 Dreiecke, 64,5 MB Textur, Frame Ø 153–157 ms |
| PlayCanvas 2.23 (ohne Editor) | kleineres Bundle, schnell spielbar, wenig Texturspeicher, AABB-Kulling | kein FXAA, Physik über altes Ammo.js, weniger Beispiele ohne Editor, im Spike langsamste Frames | 286 kB, 0,72 s, 25 DC, 1 404 Dreiecke, 32 MB, Frame Ø 232–275 ms |
| Three.js r187 | kleinstes Bundle, schnelle Frames, grösste Beispielmenge | Physik/GUI/Touch-Kamera Eigenbau bzw. Fremdpakete; monatliche Breaking Changes; Typen separat | 145 kB, 0,82–0,91 s, 27 DC, 1 428 Dreiecke, 48 MB, Frame Ø 144–152 ms |

Details: `docs/spikes/engine-vergleich.md`.

## Entscheid
Vorschlag: **Babylon.js** (`@babylonjs/core`, tiefe Importe, rechtshändiges System,
Materialien CCW). Endgültig erst nach dem iPhone-Playtest `docs/playtests/2026-11-engine-spike.md`.

Entscheidungsregel für den Director nach dem Playtest:
1. Liegt Babylon auf dem iPhone unter 25 fps oder > 100 ms max, Three.js aber nicht → **Three.js**.
2. Liegen beide innerhalb der Grenzen und Three.js ist ≥ 20 % flüssiger oder kühler → Three.js prüfen
   (Gewicht 30 % schlägt den Vorsprung bei Aufwand/TS).
3. Sonst Babylon.js.
PlayCanvas nur, wenn es als einzige Engine die Gerätegrenzen einhält.

## Begründung
- Messbar gleich: Draw Calls und Dreiecke (gleiche Geometrie), Grafik im Chromium-Vergleich gleichwertig.
- Frame-Zeit (relativ): Three.js je nach Lauf 5–20 % schneller als Babylon (unabhängige QA-Messung: Ø 130 vs. 161 ms, p95 150 vs. 183 ms, MSAA); PlayCanvas 60–80 % langsamer. Der Vorsprung von Babylon in der Teilsumme beruht allein auf Aufwand/TS/Agenten-Kriterien – der iPhone-Test muss gezielt Babylon gegen Three.js vergleichen.
- Bundle: alle drei weit unter 15 MB; der Vorsprung von Three.js (≈ 240 kB) wiegt 10 %.
- Ausschlaggebend bei Gleichstand: Babylon bringt Physik (Havok), Picking, AA-Verfahren und GUI aus
  einer Hand mit stabiler, in TS geschriebener API. Das senkt Eigenbau und Pflege für ein Projekt, das
  über Jahre Module ergänzt und überwiegend von Agenten gepflegt wird.
- Vorläufige Teilsumme (50 % gewichtet): Babylon 2,0 · Three 1,9 · PlayCanvas 1,65 von 2,5 – knapp.

## Folgen
- `TECH_ARCHITECTURE.md` (Director): Engine, Importstil (tiefe Importe), RH-System + CCW-Konvention,
  Lichtnormierung (× π) festhalten.
- Bundle-Diät als Folge-Ticket: ungenutzte Texturlader (DDS/EXR/Basis/ENV) aus dem Startpfad halten.
- `window.__perf()`/GL-Zählhülle aus `spikes/shared/perf.ts` nach `src/` übernehmen (eigenes Ticket).
- Spikes werden nach dem Entscheid nicht weitergepflegt; gemeinsame Logik (Steuerung, Strahl-Picking,
  Interaktion) kann als Vorlage dienen.
- Eintrag in `docs/DECISION_LOG.md` durch den Director.

## Rückweg
Mittel: Spiellogik bleibt engine-frei (reine TS-Module), die Engine steckt hinter einem dünnen
Adapter wie im Spike (~190–260 Zeilen je Engine). Ein Wechsel kostet vor allem Materialien, Schatten,
Asset-Laden und Post-Processing – früh (Phase 1) wenige Tage, später mit jedem Modul mehr.
