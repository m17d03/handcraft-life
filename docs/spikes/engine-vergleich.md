# Engine-Vergleich (Ticket 005) – Babylon.js · PlayCanvas · Three.js

Status: **Prototyp** – automatische Messung erledigt, **iPhone-Messung offen**
(`docs/playtests/2026-11-engine-spike.md`). Autor: engine-engineer. Datum: 2026-11-01.

Links (nach Deploy): https://m17d03.github.io/handcraft-life/spikes/babylon/ ·
https://m17d03.github.io/handcraft-life/spikes/playcanvas/ · https://m17d03.github.io/handcraft-life/spikes/three/
URL-Parameter: `?debug=1` (Overlay + Zählwerte), `?perf=1` (nur `window.__perf()`), `?aa=msaa|fxaa|none`,
`?dpr=2` (Deckel devicePixelRatio, Standard 2), `?dyn=1` (dynamische Renderauflösung 1,5…Deckel),
`?tex=512|1024|2048` (Holztextur), `?auto=1` (Standard-Kamerafahrt).

## 1. Versionen und Aufbau

| | Babylon.js | PlayCanvas | Three.js |
|---|---|---|---|
| Paket | `@babylonjs/core` 9.33.1 | `playcanvas` 2.23.3 (Engine, ohne Editor) | `three` 0.187.0 + `@types/three` 0.187.0 |
| Einbindung | tiefe Importe, `Engine` (WebGL 2) | `AppBase` + nur Render/Kamera/Licht-Komponenten, `WebglGraphicsDevice` | `WebGLRenderer`, `EffectComposer` nur für FXAA |
| Adaptercode | `spikes/babylon/main.ts` (~220 Z.) | `spikes/playcanvas/main.ts` (~260 Z.) | `spikes/three/main.ts` (~190 Z.) |

**Fairness:** Alles ausser dem Rendern ist gemeinsamer, engine-freier Code in `spikes/shared/`:
identische Vertex-/Indexdaten (eigene Box/Zylinder mit Tangenten), identische Texturbytes, dieselbe
Kamera (Position, Blickrichtung, 50° vertikal), dieselbe Pick-Logik (Strahl gegen Quader), dieselben
Lichtwerte, ACES-Tonemapping, Schattenkarte 2048², MSAA ×4 als Standard.
Lichtnormierung: Three und Babylon-PBR rechnen Lambert mit 1/π → Lichtstärke × π; PlayCanvas × 1.
Per Screenshot-Vergleich abgeglichen (Chromium, gleiche Kamera): die drei Bilder sind nahezu
deckungsgleich; Restunterschiede durch unterschiedliche ACES-Varianten und Schattenfilter.

**Szene** (Ticket-Abnahme): Raum 6 × 4 m (Höhe 2,8 m, offene Decke als Oberlicht), Werkbank mit
Ablage, Holzbalken 1200 × 100 × 80 mm mit PBR-Holz (Albedo sRGB, ORM, Normalenkarte, 1024², Mipmaps),
Säge (Blatt + Griff), 12 Schrauben + 8 Werkzeugklötze als Instanzen (2 Instanz-Draw-Calls),
1 Richtungslicht mit Schatten + Umgebungslicht (flach, kein HDRI – Downloads gesperrt).
**Textur-Quelle:** prozedural erzeugt in `spikes/shared/textures.ts` (periodisches Value-Noise +
Jahresringe), keine externen Assets. KTX2 nicht genutzt (kein Encoder ohne neue Abhängigkeit) → Texturen
unkomprimiert RGBA8; im iPhone-Zielformat identisch gerechnet.

**Touch** (Konzept B, `docs/design/steuerung-a-b.md`): linke Hälfte Stick unter dem Daumen, rechte Hälfte
umsehen, 20 px Randzone tot; Balken antippen → Hervorhebung (orange Tönung + Eigenleuchten); auf dem ausgewählten Balken
wischen → Schnittlinie folgt dem Finger, auf 1 mm gerastert, Mass im HUD. Desktop: WASD/Maus.

## 2. Messwerte (automatisch)

Messung: `PW_LOCAL_CHROMIUM=1 npx playwright test -c tests/perf/playwright.config.ts`
(Chromium 1243 headless, iPhone-15-Profil quer 734 × 343 CSS-px, DPR 3 → Deckel 2 → 1468 × 686 px,
SwiftShader-Software-Rendering, 4 CPU-Kerne). Je Szene 5 s Aufwärmen, dann 10 s Kamerafahrt `?auto=1`.
Zwei Läufe; Zählwerte identisch, Frame-Zeit/Ladezeit als Spanne.
**Frame-Zeiten sind nur ein Relativvergleich** (CPU-Rasterisierung, kein iPhone, kein Metal).

| Grösse | Babylon.js | PlayCanvas | Three.js | Budget |
|---|---|---|---|---|
| Bundle gzip, alles bis spielbar (JS/CSS/HTML) | **382 kB** (31 Dateien, u. a. ungenutzte DDS/EXR/KTX/Basis/ENV-Lader) | **286 kB** (6 Dateien) | **145 kB** (6 Dateien) | < 15 MB Download |
| Ladezeit lokal bis spielbar (`timeToPlayableMs`) | 1 250 ms | 720–744 ms | 820–910 ms | – (Trend) |
| Draw Calls / Frame (inkl. Schattenpass), max | 27 | 25–26 | 27 | < 80 |
| Dreiecke / Frame (inkl. Schattenpass), max | 1 428 | 1 404–1 416 | 1 428 | < 150 000 |
| Texturspeicher (Schätzung aus Upload-Aufrufen) | 64,5 MB | 32,0 MB | 48,0 MB | < 120 MB |
| Frame-Zeit Ø, MSAA (relativ) | 153–157 ms | 232–275 ms | 144–152 ms | nur Trend |
| Frame-Zeit p95, MSAA (relativ) | 167–200 ms | 267–333 ms | 167 ms | nur Trend |
| Frame-Zeit Ø, `aa=fxaa` (relativ) | 175–180 ms (FXAA) | 400–470 ms (**TAA**, kein FXAA eingebaut) | 303–326 ms (FXAA über EffectComposer) | nur Trend |
| Startseite ohne 3D (gzip) | 3,1 kB – unverändert, Spikes laden eigene Chunks | | | < 100 kB |

Erläuterungen:
- Draw Calls/Dreiecke zählt eine Hülle um `WebGL2RenderingContext.draw*` (engine-neutral, alle Pässe).
  PlayCanvas kullt mit Hüllquadern statt Kugeln und zeichnet daher 1–2 Wände weniger.
- Texturspeicher: Holz 3 × 1024² × 4 B × 4/3 = 16 MB bei allen gleich; der Rest sind Schattenkarte und
  engine-interne Ziele (Babylon legt die Schattenkarte grösser/in mehr Formaten an, Three den
  Composer-Zwischenspeicher bei FXAA). Renderbuffer (MSAA-Farbe/-Tiefe) sind nicht enthalten.
- Frame-Zeit in SwiftShader wird von Füllrate dominiert (CPU rastert 1 Mio. Pixel mit 4× MSAA):
  Babylon ≈ Three, PlayCanvas ~ 60–80 % langsamer (aufwendigere Standard-Shader). Ob das auf der
  Apple-GPU so bleibt, zeigt nur der iPhone-Test.
- WebKit-Messung (verbindlich laut QS-Entwurf) läuft erst in GitHub-CI.

> **QA-Gegenmessung (Ticket 005, unabhängig):** Babylon MSAA Ø 161 / p95 183 ms, Three MSAA Ø 130 / p95 150 ms,
> PlayCanvas Ø 246 / p95 283 ms. Three.js war dort ≈ 20 % schneller als Babylon – nicht „gleichauf“.

## 3. Bewertung ohne iPhone (Aufwand, TS, Agenten)

| Kriterium | Babylon.js | PlayCanvas | Three.js |
|---|---|---|---|
| Touch | eigene Pointer-Logik in allen drei gleich; Babylon hat zusätzlich fertige Touch-Kamera-Eingaben | wie links; `scripts/esm` mit First-Person-Controller (Editor-Stil) | keine Touch-Kamera im Kern (Addons) |
| Picking | `scene.pick` eingebaut (hier nicht genutzt, gemeinsamer Strahl-Test) | ohne Physik nur über `Picker` (Render-Pass) oder eigene Mathematik | `Raycaster` eingebaut |
| Physik (nur bewertet, nicht eingebunden) | offizielles Havok-Plugin (WASM), Ammo/Cannon-Plugins | Ammo.js-Integration (älter, gross) | keine eigene; Rapier/cannon-es extern anbinden |
| GUI | Babylon GUI (Canvas) optional; DOM-HUD geht überall gleich (QS G5 verlangt ohnehin DOM-UI) | Element/Screen-Komponenten | nur DOM |
| Kantenglättung | MSAA, FXAA, TAA, SMAA eingebaut | MSAA, **TAA** (CameraFrame), **kein FXAA** | MSAA, FXAA/SMAA/TAA als Addons |
| Fallstricke im Spike | Vorderseiten-Konvention CW auch im RH-Modus (Szene war erst „von innen“ zu sehen), Licht × π, Tree-Shaking lädt ungenutzte Texturlader | Instanzen brauchen Hüllquader von Hand, kein FXAA | Licht × π, `PCFSoftShadowMap` in r186 abgekündigt (monatliche Breaking Changes) |
| TypeScript | in TS geschrieben, Typen im Paket | JS + generierte `.d.ts` im Paket, gut | JS, Typen separat (`@types/three`, Versionen koppeln) |
| Pflege/Stabilität | Abwärtskompatibilitäts-Versprechen, Release alle paar Wochen | stabil, kleines Kernteam, Fokus Editor | sehr aktiv, Releases monatlich mit Breaking Changes |
| Agenten-Tauglichkeit | grosse Doku + Playground, stabile API | weniger Beispiele ohne Editor | grösste Beispielmenge, aber viele veraltete |

## 4. Gewichtung (Skill `engine-spike`) – vorläufig, iPhone-Spalten leer

Punkte 1–5. Die zwei Gerätekriterien (50 %) fehlen noch; Summe daher nur über 50 %.

| Kriterium | Gewicht | Babylon.js | PlayCanvas | Three.js |
|---|---|---|---|---|
| Echtes iPhone: fps + Stabilität | 30 % | _offen_ | _offen_ | _offen_ |
| Grafikeindruck bei gleichem Budget | 20 % | _offen_ (Chromium: gleichwertig) | _offen_ (Chromium: gleichwertig) | _offen_ (Chromium: gleichwertig) |
| Aufwand Touch, Physik, GUI | 20 % | 4 | 3 | 3 |
| Bundle-Grösse/Ladezeit | 10 % | 3 | 3,5 | 5 |
| TypeScript-Qualität, Doku, Pflege | 10 % | 5 | 4 | 3,5 |
| Agenten-Tauglichkeit | 10 % | 4 | 3 | 4,5 |
| **Zwischensumme (von 2,5)** | 50 % | **2,0** | **1,65** | **1,9** |

Hinweis Frame-Zeit (relativ): Babylon ≈ Three, PlayCanvas deutlich dahinter – nur ein Indiz für das
30-%-Kriterium.

## 5. Vorläufige Empfehlung

**Babylon.js, knapp vor Three.js; PlayCanvas nicht weiter verfolgen** – unter Vorbehalt des iPhone-Tests.
Begründung und Entscheidungsregel: ADR-Vorschlag `docs/decisions/0001-engine-wahl.md`.
