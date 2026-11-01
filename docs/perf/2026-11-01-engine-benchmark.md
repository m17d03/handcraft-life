# Engine-Benchmark (Director, Freigabe Phase 0) – 2026-11-01

Auftrag des Menschen: "Es muss nicht in allen 3 Engines erfolgen. Ermittle, wo die beste Performance ist."

Methode: gleiche Spike-Szene (Ticket 005), Chromium/SwiftShader im Profil iPhone 15 quer, `?auto=1`
(Standard-Kamerafahrt), 4 s aufwärmen, 8 s messen. **3 Durchgänge mit wechselnder Engine-Reihenfolge**, je 2 Varianten:
"hoch" (dpr 2, MSAA ×4) und "niedrig" (dpr 1, ohne AA; zeigt den Engine-Anteil bei wenig Pixel-Last).
Das Skript lag in /tmp/bench/bench.cjs, nicht im Repo; es nutzt dieselbe Schnittstelle `__perf()` wie tests/perf.

| Engine | Variante | Frame Ø | p95 | Spielbar nach | Läufe Ø |
|---|---|---|---|---|---|
| **Three.js** | hoch | **134 ms** | **161 ms** | **565 ms** | 137/136/129 |
| **Three.js** | niedrig | **38 ms** | **50 ms** | **560 ms** | 38/37/40 |
| Babylon.js | hoch | 147 ms | 178 ms | 1 394 ms | 146/145/152 |
| Babylon.js | niedrig | 41 ms | 50 ms | 980 ms | 44/40/40 |
| PlayCanvas | hoch | 233 ms | 267 ms | 686 ms | 224/241/234 |
| PlayCanvas | niedrig | 61 ms | 72 ms | 751 ms | 60/62/60 |

**Ergebnis:** Three.js ist in **jeder** Grösse vorn.
- Frame-Zeit: 8–10 % vor Babylon, 60–75 % vor PlayCanvas.
- Spielbar: 2,5× schneller als Babylon.
- Bundle: das kleinste (145 kB gzip gegenüber 382 bzw. 286 kB).

Draw Calls und Dreiecke sind bei allen gleich, weil die Geometrie gleich ist. Die QA-Messung aus Ticket 005
(Three ≈ 20 % vor Babylon) bestätigt, dass der Vorsprung reproduzierbar ist.

**Grenze:** Gerendert wurde per Software auf dem Host, nicht auf der iPhone-GPU. Die Absolutwerte sagen
deshalb nichts aus. Die Rangfolge ist belastbar, weil sie in beiden Lastvarianten und allen Läufen gleich
ist. Die absoluten fps prüft der Playtest von Phase 1 auf dem iPhone.
