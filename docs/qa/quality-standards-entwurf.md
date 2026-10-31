# Entwurf QUALITY_STANDARDS (Ticket 004)

Status: **Konzept** – Entwurf von qa-performance zur Übernahme in `docs/QUALITY_STANDARDS.md` durch den Director.
Grundlage: `CLAUDE.md` (Startbudgets, DoD), `docs/MASTER_PROMPT.md` §8 und §14, Skills `perf-budget-check`
und `iphone-playtest`, bestehendes Setup (`package.json`, `playwright.config.ts`, `.github/workflows/ci.yml`).

## 0. Legende

| Kürzel | Bedeutung |
|---|---|
| **auto-V** | automatisch, Vitest (`npm test`), lokal und CI |
| **auto-C** | automatisch, Playwright Chromium im iPhone-Profil, lokal (`PW_LOCAL_CHROMIUM=1 npm run test:e2e`) – nur Vorprüfung |
| **auto-W** | automatisch, Playwright WebKit im iPhone-Profil, nur GitHub-CI – **verbindlich** für Abnahme |
| **auto-B** | automatisch, Build-Ausgabe (`npm run build`, Grösse von `dist/`) |
| **(Gerät)** | nur der Mensch auf seinem iPhone, `?debug=1`, Antwort über `docs/qa/playtest-vorlage.md` |
| **Trend** | Wert hängt von Host-CPU/GPU ab: nur Vergleich zwischen Commits, kein Absolutwert |

Phasen: **S** Setup · **0** Preproduction/Engine-Spike · **1** Vertical Slice · **2** Werkstattsystem ·
**3** Metall/3D-Druck · **4** Outdoor · **5** Freizeit · **6** Erweiterungen.
„ab Phase“ = ab dieser Phase blockiert ein Verstoss die Abnahme; davor nur messen und berichten.

**Standardrunde (Gerät und Playwright gleich):** Szene laden, 5 s warten (nicht gewertet), dann 60 s:
20 s gehen, 20 s umschauen, 20 s ein Arbeitsschritt. Laden und Szenenwechsel sind ausgenommen.

## 1. Performance

| ID | Kriterium | Ziel | Harte Grenze | Messmethode | Art | ab Phase |
|---|---|---|---|---|---|---|
| P1 | Bildrate Ziel-iPhone (Overlay „fps“, 1-s-Fenster) in der Standardrunde | ≥ 30 fps stabil | nie < 25 fps | `?debug=1`, niedrigsten abgelesenen Wert melden | (Gerät) | 1 (0: nur messen) |
| P2 | Längster Frame (Overlay „max ms“) in der Standardrunde | ≤ 50 ms | ≤ 100 ms | `?debug=1`, höchsten abgelesenen Wert melden | (Gerät) | 1 |
| P3 | Frame-Zeit p95 | ≤ 33,3 ms (Gerät) | ≤ 40 ms (Gerät) | `__perf().frameTimeMsP95`; in Emulation nur Regression: > +20 % ggü. letztem `main`-Lauf = Warnung | Trend (auto-C/W) | 1 (Trend ab 0) |
| P4 | Draw Calls pro Frame (inkl. Schatten- und Postprocessing-Pässe) | < 80 | ≤ 120 | `tests/perf/budget.spec.ts` liest `__perf().drawCalls` während der Standardrunde, Maximum | auto-W (auto-C vorab) | 0 (Spike-Szene), verbindlich ab 1 |
| P5 | Dreiecke im Bild | < 150 000 | ≤ 300 000 | wie P4, `__perf().triangles` | auto-W | 0 / 1 |
| P6 | GPU-Texturspeicher | < 120 MB | ≤ 200 MB | `__perf().textureMemoryMB`, **gerechnet im iPhone-Zielformat** (KTX2 → ASTC 4×4 = 1 B/px, unkomprimiert RGBA8 = 4 B/px, Mipmaps × 1,33), nicht im Format des Testrechners | auto-W | 1 |
| P7 | Erster Download bis spielbar (gzip, alle Anfragen bis `timeToPlayableMs`) | < 15 MB | ≤ 25 MB | Playwright summiert übertragene Bytes aller Antworten bzw. `__perf().transferredKB`; Gegenprobe gzip-Grösse von `dist/` | auto-W + auto-B | 1 |
| P8 | Startseite/Hülle ohne 3D (HTML+CSS+JS, gzip) | < 100 kB | ≤ 250 kB | `npm run build`, gzip-Grösse der Einstiegs-Chunks | auto-B | S |
| P9 | Ladezeit bis spielbar, iPhone, WLAN, Kaltstart | < 8 s | ≤ 15 s | Mensch zählt Sekunden ab Antippen des Links | (Gerät) | 1 |
| P10 | Ladezeit bis spielbar, Emulation | – | – | `__perf().timeToPlayableMs` | Trend | 0 |
| P11 | Dauerlast: fps nach 10 min (Wärmedrosselung) | ≥ 30 fps | ≥ 25 fps | Overlay nach 10 min ablesen, Wärme nein/etwas/stark | (Gerät) | 1 (nur Meilenstein-Playtest) |
| P12 | Kein Speicherleck: `textureCount`, `geometryCount` nach 3× Szene verlassen/betreten | konstant | ≤ +5 % | Playwright, `__perf()` vorher/nachher | auto-W | 2 |

## 2. Bedienbarkeit

Masse in CSS-px (= iOS-Punkte).

| ID | Kriterium | Ziel | Harte Grenze | Messmethode | Art | ab Phase |
|---|---|---|---|---|---|---|
| U1 | Touch-Ziele (Buttons, Joystick-Zone, Kontextmenü-Einträge) | ≥ 48 × 48 | ≥ 44 × 44, Abstand ≥ 8 | Playwright: `boundingBox()` aller `button, [role=button], [data-touch]` | auto-W | 1 |
| U2 | Sichtbares Feedback auf Touch (Hervorhebung, Ton, Zustandswechsel) | ≤ 50 ms (≈ 1–2 Frames) | ≤ 100 ms | `__perf().inputLatencyMsLast` (Event-Zeitstempel → erster gerenderter Frame mit Feedback); Gerät: „reagiert sofort?“ | auto-W + (Gerät) | 1 |
| U3 | Lesbarkeit Text in HUD/Menü | ≥ 16 px | ≥ 13 px; Kontrast ≥ 4,5 : 1, Symbole ≥ 3 : 1 | Playwright: berechnete `font-size` aller sichtbaren Texte; Kontrast automatisch nur bei UI auf eigener Fläche, über 3D-Szene (Gerät) | auto-W + (Gerät) | 1 |
| U4 | Safe Areas: kein Bedienelement unter Dynamic Island/Notch/Home-Balken | 0 Überlappungen | 0 | Statisch: `viewport-fit=cover` im Viewport-Meta und `env(safe-area-inset-*)` im CSS (Test liest Dateien); real nur (Gerät), da Emulation Insets = 0 | auto-V + (Gerät) | 1 |
| U5 | Hoch- und Querformat | Hauptformat voll bedienbar; anderes Format bedienbar oder klarer Dreh-Hinweis | kein horizontales Scrollen; alle Bedienelemente im Viewport; Spielzustand bleibt beim Drehen; Canvas angepasst ≤ 500 ms | Projekte `iPhone 15` + `iPhone 15 landscape`, zusätzlich Viewport-Wechsel mitten im Spiel | auto-W + (Gerät) | S (Scrollen), 1 (Rest) |
| U6 | Keine Browser-Störgesten auf dem Spielfeld: Doppeltipp-Zoom, Seiten-Pinch, Textauswahl, Gummiband-Scrollen | 0 | 0 | `touch-action: none`, `user-select: none` am Canvas (Playwright liest berechnetes CSS); Gefühl (Gerät) | auto-W + (Gerät) | 1 |
| U7 | Steuerung ohne Erklärung verständlich | ≥ 4 / 5 | ≥ 3 / 5 | Playtest-Frage | (Gerät) | 1 |

## 3. Stabilität

| ID | Kriterium | Ziel | Harte Grenze | Messmethode | Art | ab Phase |
|---|---|---|---|---|---|---|
| S1 | Konsole fehlerfrei | 0 `console.error`, 0 `pageerror`, 0 fehlgeschlagene Ressourcen | 0 | Jeder E2E-Test sammelt Fehler (Muster `tests/e2e/startseite.spec.ts`); Gerät: Fehlerliste im Overlay leer | auto-W + (Gerät) | S |
| S2 | Neuladen | Zustand nach Reload = Zustand davor | Verlust höchstens des laufenden, unvollendeten Arbeitsschritts | Playwright: Aktion → `page.reload()` → Spielstand-Hash vergleichen | auto-W + (Gerät) | 1 |
| S3 | Abbruch mitten im Arbeitsschritt (Reload/Schliessen während Sägen o. ä.) | Schritt sauber zurückgesetzt oder fortgesetzt | nie halber Zustand; Spielstand bleibt ladbar | Playwright: Reload während laufender Aktion; Vitest: Speichern atomar (alt oder neu, nie Mischung) | auto-V + auto-W | 1 |
| S4 | App-Wechsel / Tab im Hintergrund | Spiel pausiert, Speichern bei `visibilitychange: hidden` und `pagehide`, Rückkehr ohne Neuladen | auch wenn iOS den Tab neu lädt: kein Fortschrittsverlust | Playwright: `visibilitychange` auslösen, Speicheraufruf prüfen; (Gerät): 30 s andere App, zurück | auto-W + (Gerät) | 1 |
| S5 | WebGL-Kontextverlust (iOS gibt GPU-Speicher im Hintergrund frei) | Szene stellt sich selbst wieder her | höchstens automatisches Neuladen mit erhaltenem Spielstand; nie schwarzer Bildschirm | Playwright: `WEBGL_lose_context.loseContext()` → `restoreContext()` | auto-W | 1 |
| S6 | Speicherstand-Migration | jede frühere Version lädt | 100 % der Fixtures `tests/fixtures/saves/v*.json` migrieren und bestehen Schema-Prüfung | Vitest; neue Version ⇒ neue Fixture Pflicht | auto-V | 1 |
| S7 | Defekter oder zukünftiger Spielstand (`version: 999`) | Hinweis, Sicherungskopie, Neustart möglich | nie stilles Überschreiben/Löschen | Vitest | auto-V | 1 |
| S8 | Speicher nicht verfügbar (IndexedDB-Fehler, Kontingent voll) | sichtbarer Hinweis, Spiel läuft weiter | kein Absturz | Vitest mit simuliertem Fehler | auto-V | 1 |
| S9 | Lange Sitzung | 10 min ohne Absturz und ohne Safari-Meldung „Seite wurde neu geladen“ | 0 | Meilenstein-Playtest | (Gerät) | 1 |

## 4. Grafikqualität

| ID | Kriterium | Ziel | Harte Grenze | Messmethode | Art | ab Phase |
|---|---|---|---|---|---|---|
| G1 | Referenzbild-Vergleich an festen Kamerapositionen (fester Seed, festes Licht, Animationen aus über `?capture=1`) | ≤ 0,5 % abweichende Pixel | ≤ 2 % (`toHaveScreenshot`, `maxDiffPixelRatio: 0.02`) | Playwright, Referenzen **je Browser-Projekt**; Aktualisierung nur bewusst, im Ticket begründet | auto-W | 1 |
| G2 | Stil gegen Art Direction (warmes Licht, Materialien, Werkstückkanten) | Freigabe Director | Abweichung als Ticket erfasst | G1-Screenshots neben Referenz aus `ART_DIRECTION.md`, Bewertung asset-artist + Director | manuell | 1 |
| G3 | Renderauflösung `renderScale = renderWidth / canvasCssWidth` (Pixel pro CSS-px) | ≥ 2,0 im Normalbetrieb | ≥ 1,5 auch bei dynamischer Absenkung | `__perf()`; Gerät: Wert im Overlay (kleine Erweiterung) | auto-W + (Gerät) | 0 |
| G4 | Kantenschärfe/AA: keine Treppen an Werkstück-/Werkzeugkanten in Nahansicht, kein Flimmern bei Kamerabewegung | Playtest ≥ 4 / 5 | ≥ 3 / 5 | Verfahren in `__perf().aa` protokolliert; Ausschnitt aus G1; Urteil (Gerät) | (Gerät) + auto-W | 1 |
| G5 | UI und Text in nativer Auflösung (nicht mit Renderauflösung skaliert) | ja | ja | DOM-UI ausserhalb des Canvas; Playwright prüft | auto-W | 1 |

## 5. Definition of Done je Statusstufe

| Stufe | Eindeutig erreicht, wenn … | Nachweis |
|---|---|---|
| **Konzept** | Ticket mit Ziel, Scope, Abnahmekriterien; Entwurf/Beschreibung in `docs/` | Dateipfad |
| **Prototyp** | Im Browser lauffähig (lokal oder Pages-Unterpfad), Kernablauf ausführbar; darf ausserhalb des Spiels liegen (`spikes/`); bekannte Einschränkungen schriftlich | Link + Einschränkungsliste |
| **Implementiert** | Im Spiel angeschlossen und für den Spieler erreichbar (kein Mockup, keine tote UI); Stammdaten in JSON; Spielstand berücksichtigt; `typecheck`, `lint`, `test` grün | Commit auf Ticket-Branch, CI grün |
| **Getestet** | qa-performance hat jedes Abnahmekriterium einzeln belegt; WebKit-CI grün; P4–P8 und S1 eingehalten; Migrationstest bei Speicheränderung; Referenzbilder (G1) aktuell; (Gerät)-Kriterien belegt oder ausdrücklich als offen benannt | QA-Bericht + `docs/perf/<datum>-<ticket>.md` |
| **Freigegeben** | Director nimmt ab und merged auf `main`; Pages-Deploy erfolgreich; bei Meilenstein: iPhone-Playtest, alle (Gerät)-Kriterien innerhalb der harten Grenzen | Merge-Commit, Pages-Link, `docs/playtests/<datum>-<meilenstein>.md` |

Regel: Eine Stufe gilt nur, wenn alle vorherigen erfüllt sind. Eine verletzte harte Grenze setzt auf **Implementiert** zurück.

## 6. Testpyramide

| Ebene | Werkzeug / Ort | Prüft | Prüft nicht |
|---|---|---|---|
| Unit (breit, schnell) | Vitest `tests/unit/`, lokal + CI | Spiellogik, Qualitätsbewertung, Migrationen + Fixtures, atomares Speichern, Validierung JSON-Stammdaten und Modul-Manifeste, Messlogik (`FpsMeter`, p95), statische Prüfungen (Viewport-Meta, Safe-Area-CSS) | Rendering, Touch, Browser-APIs |
| E2E Vorprüfung | Playwright Chromium, iPhone-Profil, `PW_LOCAL_CHROMIUM=1`, Cloud-Sitzung | Abläufe, Layout hoch/quer, Touch-Ziele, Konsolenfehler, Reload/Abbruch, Kontextverlust, `__perf()`-Zählwerte vorab | WebKit-Eigenheiten, absolute Zeiten |
| E2E verbindlich | Playwright WebKit, iPhone-Profil, GitHub-CI (`ci.yml`) | wie oben, gilt für Abnahme; Referenzbilder (G1); Budgets P4–P7 über `tests/perf/` (Vorschlag: eigener CI-Schritt, Folge-Ticket) | echtes iOS, echte GPU, Wärme, Speicherdruck |
| Gerät (schmal, teuer) | Mensch, iPhone, `?debug=1`, `docs/qa/playtest-vorlage.md` | fps, max ms, Ladezeit, Wärme, Touch-Gefühl, Safe Areas, echter App-Wechsel, Schärfe, Verständlichkeit | alles automatisch Prüfbare – nie dafür verwenden |

Häufigkeit: Unit + E2E bei jedem Push; Budget-Check vor jeder Ticket-Abnahme; Gerät am Ende jedes Meilensteins
und nach Änderungen an Renderer, Steuerung oder Speicherung.

## 7. Ehrliche Grenzen der Emulation

| Grenze | Folge |
|---|---|
| Rendering auf CPU/GPU des Rechners (CI meist Software-Rendering) | fps, Frame-Zeit, Ladezeit nur Trend; p95 aus CI nie gegen 33 ms prüfen |
| CI-WebKit (Linux) ≠ Safari auf iOS (Metal-Backend, Treiber, Erweiterungen) | Renderunterschiede möglich; Referenzbilder je Projekt; Gerätetest bleibt Pflicht |
| Chromium lokal ist nicht WebKit | nur Vorprüfung, ersetzt WebKit-CI nie |
| ASTC fehlt auf Desktop, KTX2 wird anders transkodiert | P6 im iPhone-Zielformat rechnen statt messen |
| Safe-Area-Insets, Dynamic Island, einklappende Safari-Leiste, Home-Bildschirm-Modus nicht emuliert | U4, U5 teilweise nur (Gerät) |
| Touch-Emulation ohne echte Mehrfinger-Gesten und ohne iOS-Randgesten | U6, U7 (Gerät) |
| Keine Wärmedrosselung, kein iOS-Speicherlimit (Tab wird hart neu geladen) | P11, S9 nur (Gerät) |
| App-Wechsel nur simuliert (`visibilitychange`); iOS friert/beendet Tabs anders | S4 zusätzlich (Gerät) |
| `performance.memory` nur in Chromium | `heapMB` in WebKit/iOS `null` |
| Safari löscht Website-Speicher (IndexedDB) nach 7 Tagen ohne Nutzung, Home-Bildschirm-Apps nicht | nicht testbar; als Risiko führen: `navigator.storage.persist()` + Hinweis „Zum Home-Bildschirm“ |
| Headless-Browser drosseln `requestAnimationFrame` teils oder laufen ohne VSync | Frame-Zählung in Emulation nicht als fps deuten |

## 8. Vorschlag `window.__perf()` (für Ticket 005)

Aktiv bei `import.meta.env.DEV` **oder** URL-Parameter `?debug=1` bzw. `?perf=1` (Playwright testet den
Produktions-Build über `vite preview`). Sonst nicht vorhanden – kein Messaufwand im Spiel.
Einheiten: Zeiten in ms, Speicher in MB (= 1024² Byte), Download in kB (= 1024 Byte), Auflösung in Pixel.

```ts
interface PerfSnapshot {
  schema: 1;                         // Version dieser Schnittstelle
  engine: string;                    // 'babylon' | 'playcanvas' | 'three' | …
  engineVersion: string;
  scene: string;                     // stabile Szenen-ID, z. B. 'spike-werkstatt'
  // Zeit (ms ab performance.timeOrigin bzw. im Messfenster)
  timeToFirstFrameMs: number | null;
  timeToPlayableMs: number | null;   // Szene geladen und Eingabe aktiv
  windowMs: number;                  // Messfenster, Standard 5000
  frames: number;                    // Frames im Fenster
  fps: number;                       // (frames - 1) * 1000 / Zeitspanne
  frameTimeMsAvg: number;            // aus rAF-Abständen im Fenster
  frameTimeMsP50: number;
  frameTimeMsP95: number;            // Nearest-Rank auf sortierten Abständen
  frameTimeMsMax: number;            // längster Abstand seit letztem __perfReset()
  longFrames: number;                // Abstände > 50 ms seit letztem __perfReset()
  // Render (letzter vollständiger Frame, alle Pässe inkl. Schatten/Post)
  drawCalls: number;                 // Aufrufe drawArrays/drawElements(+Instanced/Range)
  triangles: number;                 // Σ count/3 × instanceCount bei TRIANGLES (Strips: count-2)
  // Speicher
  textureMemoryMB: number;           // im iPhone-Zielformat gerechnet (siehe P6)
  textureMemoryEstimated: boolean;   // true, wenn geschätzt
  textureCount: number;
  geometryCount: number;             // Vertex- und Index-Buffer
  bufferMemoryMB: number | null;
  heapMB: number | null;             // nur Chromium, sonst null
  // Auflösung / Bildqualität
  canvasCssWidth: number; canvasCssHeight: number;
  renderWidth: number; renderHeight: number;   // drawingBuffer
  devicePixelRatio: number;          // window.devicePixelRatio (unverändert)
  renderScale: number;               // renderWidth / canvasCssWidth (Pixel pro CSS-px)
  aa: 'none' | 'msaa' | 'fxaa' | 'smaa' | 'taa';
  msaaSamples: number;               // 0 ohne MSAA
  // Netz / Eingabe / Robustheit
  transferredKB: number | null;      // Σ transferSize bis timeToPlayableMs; null wenn Browser 0/unbekannt liefert
  inputLatencyMsLast: number | null; // event.timeStamp → erster Frame mit sichtbarem Feedback
  contextLostCount: number;
  errorCount: number;                // vom Debug-Overlay gefangene Fehler
}
// window.__perf(): PerfSnapshot     window.__perfReset(): void  (leert Fenster, Max, longFrames)
```

Engine-Neutralität: `drawCalls` und `triangles` **nicht** aus Engine-Statistiken (Babylon-Instrumentation,
PlayCanvas `app.stats`, Three.js `renderer.info`) übernehmen – diese zählen Pässe und Instanzen unterschiedlich.
Stattdessen eine dünne Hülle um `WebGL2RenderingContext.prototype.draw*` (nur wenn aktiv), Zähler bei jedem
Frame-Beginn zurücksetzen. Frame-Zeiten aus `requestAnimationFrame`-Abständen wie im bestehenden `FpsMeter`.

## 9. Abweichungen von den CLAUDE.md-Budgets

Die fünf Startbudgets bleiben unverändert. Präzisierungen und Ergänzungen:

| Punkt | Vorschlag | Begründung |
|---|---|---|
| „nie unter 25 fps“ | 1-s-Fenster im Overlay während der Standardrunde; Laden/Szenenwechsel ausgenommen | sonst nicht reproduzierbar ablesbar |
| Frame-Zeit (neu) | p95 ≤ 33,3 / 40 ms (Gerät); max ms ≤ 50 / 100 ms | fps-Mittel verdeckt Ruckler; Overlay zeigt „max ms“ bereits |
| Texturspeicher | im iPhone-Zielformat gerechnet | Testrechner transkodiert anders, Messwert wäre falsch |
| Erster Download | gzip-Übertragung bis `timeToPlayableMs`; nachgeladene Module/Gebiete zählen nicht | sonst wächst der Wert mit jedem Modul |
| Neu | Ladezeit iPhone < 8 s / ≤ 15 s; Startseite < 100 kB / ≤ 250 kB gzip | in CLAUDE.md nicht beziffert; 100 kB entspricht Ticket 005 |
| Offen (Director) | „Ziel-iPhone“ = Gerät des Menschen; älteste unterstützte Modellreihe per Entscheidung festlegen | alle Gerätebudgets hängen daran |
