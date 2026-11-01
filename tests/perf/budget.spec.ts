/**
 * Budget-Prüfung Vertical Slice /spiel/ (Ticket 015, Skill perf-budget-check, QUALITY_STANDARDS P3–P7, P10).
 *
 * Standardrunde (ein Durchlauf, frischer Spielstand, Saat 7):
 *   1. Erkunden: laden bis spielbar, 2 s stehen, einmal rundum umsehen (rechte Bildhälfte ziehen) und zurück.
 *   2. Werkbank: an die Bank, Bezugsende wählen, 600 mm messen, anreissen, ansetzen, sägen bis zum Ergebnis.
 *   3. Ergebnis: Brett getrennt, Reststück daneben, 2 s stehen.
 * Gemessen wird über `window.__perf()` (PerfSnapshot v1) alle 250 ms; Draw Calls und Dreiecke = Maximum je Ansicht.
 *
 * Harte Grenzen = Testfehler (P4 Draw Calls ≤ 120, P5 Dreiecke ≤ 300 000, P6 Texturspeicher ≤ 200 MB,
 * P7 Download bis spielbar ≤ 25 MB). Ziele (80 / 150 000 / 120 MB / 15 MB) nur als Warnung im Bericht.
 * Frame-Zeit und Ladezeit nur als Bericht (Emulation mit Software-GPU, kein iPhone).
 *
 * Texturspeicher: Die Emulation hat kein ASTC → KTX2 wird unkomprimiert (RGBA8, 4 B/px) hochgeladen.
 * P6 verlangt die Rechnung im iPhone-Zielformat. Daher: iPhone-Schätzung = Emulationswert
 * − KTX2-Texturen in RGBA8 + dieselben Texturen in ASTC 4×4 (1 B/px), Mipmaps je × 4/3.
 * Die KTX2-Grössen stammen aus den Kopfdaten der geladenen .ktx2-Dateien und der in GLB eingebetteten KTX2-Bilder.
 * Die harte Grenze gilt für die iPhone-Schätzung; der Emulationswert (obere Schranke) ist nur Bericht/Warnung.
 *
 * Download: alle Antworten bis „spielbar“, Textdateien (JS/CSS/HTML/JSON/SVG/WASM) gzip-komprimiert gezählt
 * (wie GitHub Pages ausliefert), Binärdateien (GLB/KTX2/PNG) roh. `vite preview` komprimiert selbst nicht,
 * deshalb ist `__perf().transferredKB` hier ungzipped und steht nur als Gegenprobe im Bericht.
 *
 * Bericht: test-results/perf-budget/budget.md (+ budget.json); CI hängt ihn an die Zusammenfassung.
 */
import ⟪ mkdirSync, writeFileSync ⟫ from 'node:fs';
import ⟪ join ⟫ from 'node:path';
import ⟪ gzipSync ⟫ from 'node:zlib';
import ⟪ expect, test, type Page ⟫ from '@playwright/test';
import type ⟪ PerfSnapshot ⟫ from '../../src/perf/perf-snapshot';
import type ⟪ WerkstattViewDebug ⟫ from '../../src/render/view-api';
import type ⟪ SpielDebug ⟫ from '../../src/spiel/spiel';

declare global ⟪
  interface Window ⟪
    __view?: WerkstattViewDebug;
    __spiel?: SpielDebug;
    /** Zähler der Budget-Prüfung (Init-Skript): Uploads mit echten komprimierten Bytes. */
    __budgetGl?: ⟪ compressedTexImage2D: number ⟫;
  ⟫
⟫

const SPIEL = './spiel/?debug=1&saat=7&test=1&dpr=1';
const LANG = ⟪ timeout: 60_000 ⟫;
const MB = 1024 * 1024;
const BERICHT = join(import.meta.dirname, '../../test-results/perf-budget');

/** QUALITY_STANDARDS „Budgets“: Ziel (strikt kleiner) und harte Grenze (kleiner gleich). */
export const BUDGET = ⟪
  drawCalls: ⟪ ziel: 80, grenze: 120 ⟫,
  dreiecke: ⟪ ziel: 150_000, grenze: 300_000 ⟫,
  texturMB: ⟪ ziel: 120, grenze: 200 ⟫,
  downloadMB: ⟪ ziel: 15, grenze: 25 ⟫,
⟫ as const;
