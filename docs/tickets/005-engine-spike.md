---
id: 005
titel: Engine-Spike – gleiche Werkstatt-Demoszene in Babylon.js, PlayCanvas und Three.js, gemessen
agent: engine-engineer
meilenstein: Phase 0
status: done
reifegrad: Prototyp
blocked_by: [001, 004]
branch: ticket/005-engine-spike
---

## Ziel
Drei lauffähige, vergleichbare Demoszenen, die der Mensch auf seinem iPhone per Link öffnen kann,
mit automatischen Messwerten und einem ADR-Vorschlag zur Engine-Wahl.

## Kontext
- `.claude/skills/engine-spike/SKILL.md` (verbindlich: Szene, Messung, Gewichtung)
- `.claude/skills/perf-budget-check/SKILL.md`, `docs/qa/quality-standards-entwurf.md` (Ticket 004,
  insbesondere `window.__perf()`-Vorschlag)
- `docs/design/steuerung-a-b.md` (Ticket 003) für die Touch-Steuerung (linker Daumen gehen,
  rechter Daumen schauen)
- `docs/MASTER_PROMPT.md` §8, §12

## Scope
- Darf ändern: `spikes/**`, `vite.config.ts` (nur Multi-Page-Eingänge für die Spikes),
  `package.json`/`package-lock.json` (nur die drei Engines + ggf. ein KTX2-/glTF-Hilfspaket als
  devDependencies – Ausnahme vom ADR-Zwang, weil Spike), `tests/perf/**`, `tests/e2e/spikes.spec.ts`,
  `tsconfig*.json` (nur include), `docs/spikes/engine-vergleich.md`,
  `docs/decisions/0001-engine-wahl.md` (nur `status: vorgeschlagen`), `index.html` (nur ein Link-Abschnitt
  „Engine-Spikes“ zu den drei Szenen)
- Darf nicht ändern: `src/` (Debug-Overlay nur importieren), Projektdokumente, andere ADRs

## Abnahmekriterien
- [x] Je Engine eine Seite, nach Deploy erreichbar unter `/handcraft-life/spikes/babylon/`,
      `/spikes/playcanvas/`, `/spikes/three/`; Startseite verlinkt alle drei
- [x] Identische Szene: Raum 6 × 4 m, Werkbank, Holzbalken mit PBR-Holzmaterial (prozedurale oder
      selbst erzeugte Textur zulässig, weil Asset-Downloads in der Cloud evtl. blockiert sind – Quelle
      dokumentieren), Säge als einfaches Modell, 1 Richtungslicht mit Schatten + Umgebungslicht,
      20 Kleinteile als Instanzen
- [x] Touch: linke Hälfte gehen (Stick am Daumen), rechte Hälfte schauen; Balken antippen → Hervorhebung;
      Schnittlinie per Wischen auf dem Balken setzen (sichtbare Linie)
- [x] Jede Seite: `?debug=1`-Overlay (bestehendes `src/debug/` wiederverwenden), `window.__perf()` mit
      drawCalls, triangles, textureMemoryMB (Schätzung zulässig, kennzeichnen), frameTimeMsAvg, frameTimeMsP95
- [x] Dynamische Renderauflösung (devicePixelRatio-Deckel, z. B. max 2) und ein AA-Vergleich
      (MSAA vs. FXAA o. ä.) per URL-Parameter umschaltbar
- [x] Playwright-Messskript `tests/perf/spikes.spec.ts`: lädt jede Szene, wartet, liest `__perf()`,
      schreibt Tabelle; lokal mit Chromium im iPhone-Profil gelaufen (Werte als Relativvergleich gekennzeichnet)
- [x] `docs/spikes/engine-vergleich.md`: Tabelle Bundle-Grösse (gzip), Ladezeit lokal, Draw Calls,
      Dreiecke, Frame-Zeit (relativ), Aufwand Touch/Physik/GUI, TS-Qualität, Agenten-Tauglichkeit;
      Gewichtung aus Skill `engine-spike`; Felder für iPhone-Messung durch den Menschen leer lassen
- [x] ADR-Vorschlag `docs/decisions/0001-engine-wahl.md` (`status: vorgeschlagen`), vorläufige
      Empfehlung unter Vorbehalt des iPhone-Tests
- [x] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` grün; Hauptseite bleibt < 100 kB gzip
- [x] Budget je Szene: < 80 Draw Calls, < 150 000 Dreiecke
- [ ] (Gerät) fps, Hitze nach 5 min, Touch-Gefühl, Grafikeindruck – Checkliste in
      `docs/playtests/2026-11-engine-spike.md`

## Nicht Teil dieses Tickets
Spiellogik, Modulsystem (Ticket 006), endgültige Assets, Physik-Engine-Integration (nur bewerten).

## Protokoll
- 2026-11-01 engine-engineer: 3 Szenen, Messskript, Vergleich, ADR 0001 (vorgeschlagen). Unterbrochen durch API-Limit, fortgesetzt.
- QA (qa-performance): ABNAHME EMPFOHLEN (Prototyp); alle Budgets eingehalten (≤ 29 DC, ≤ 1 430 Dreiecke).
  Korrektur Director: Three.js in der QA-Messung ≈ 20 % schneller als Babylon → Vergleich, ADR und PHASE0_ERGEBNIS angepasst.
  Hinweise für Folge-Ticket "perf nach src/": __perf behält alte Werte ohne Frame; Tap an 350-ms-Zeitgrenze (Flake-Risiko in CI);
  HUD-Zeile von Debug-Overlay überdeckt; inputLatencyMsLast vor Present gestempelt; Sourcemaps blähen dist auf 18 MB (Download unberührt).
- Director: ESLint schloss .claude/-Worktrees nicht aus (OOM) → behoben. Offen: (Gerät)-Playtest.
