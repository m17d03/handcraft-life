---
name: perf-budget-check
description: Misst Bundle-Grösse, Ladezeit, Draw Calls, Dreiecke, Texturspeicher und Frame-Zeit und vergleicht sie mit den Budgets aus CLAUDE.md. Verwenden vor jeder Ticket-Abnahme und im Engine-Spike.
---

# Performance-Budget prüfen

## Messpunkte im Spiel
Das Spiel stellt im Dev-Build `window.__perf` bereit (einmalig in M2 einrichten):
```ts
window.__perf = () => ({
  drawCalls, triangles, textureMemoryMB, frameTimeMsAvg, frameTimeMsP95, heapMB
});
```
Werte aus der Engine-Instrumentierung lesen (z. B. Babylon `SceneInstrumentation` /
`EngineInstrumentation`, PlayCanvas `app.stats`, Three.js `renderer.info`).

## Ablauf
1. `npm run build` → Grösse von `dist/` und erstem Lade-Chunk notieren.
2. `npx vite preview` starten.
3. Playwright-Skript `tests/perf/budget.spec.ts`:
   - WebKit, Gerät `iPhone 15`, Querformat
   - Szene laden, 5 s warten, 10 s Standard-Kamerafahrt, dann `__perf()` auslesen
4. Werte mit Tabelle in `CLAUDE.md` vergleichen.

## Wichtig
- Emulation läuft auf der CPU/GPU des Rechners, nicht des iPhones. Frame-Zeit ist nur als
  **Trend** zwischen Commits aussagekräftig. Draw Calls, Dreiecke, Speicher und Bundle-Grösse
  sind dagegen geräteunabhängig und hart prüfbar.
- Echte fps misst nur der Mensch auf dem iPhone (Skill `iphone-playtest`).

## Bericht
| Grösse | Messwert | Ziel | Grenze | Status |
|---|---|---|---|---|
Ergebnis als `docs/perf/<datum>-<ticket>.md`. Bei Grenzverletzung: Ticket gilt als nicht erfüllt.
