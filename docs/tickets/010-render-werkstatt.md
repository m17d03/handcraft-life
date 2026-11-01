---
id: 010
titel: Render-Grundgerüst mit Three.js – Werkstatt-Szene Stil A, Ich-Kamera, Arbeitsansicht, Picking, __perf
agent: engine-engineer
meilenstein: Phase 1 – Vertical Slice 0.1
status: done
reifegrad: Getestet
blocked_by: []
branch: ticket/010-render
---

## Ziel
Eine Spielseite `/spiel/` zeigt die Werkstatt im Stil A (warmes Nachmittagslicht) in Ich-Sicht, flüssig und
innerhalb der Budgets, mit einer schmalen View-API, die Eingabe und Spiellogik später ansteuern.

## Kontext
- ADR 0001 (Three.js), ADR 0004 (Querformat, Ich-Sicht), `docs/ART_DIRECTION.md`, `docs/art/stil-varianten.md`
  (Variante A: Paletten, Licht), `docs/art/budgets-entwurf.md`
- Spike-Code als Vorlage: `spikes/three/main.ts`, `spikes/shared/{perf,math,geometry,textures,scene-spec,player}.ts`
  (übernehmen und aufräumen, nicht importieren; Spikes bleiben unverändert)
- QS-Entwurf §8 (`window.__perf()` PerfSnapshot v1) und die QA-Befunde aus Ticket 005 (Protokoll): `__perf` ohne
  Frame auf 0, `inputLatencyMsLast` nach Present

## Scope
- Darf ändern: `src/render/**`, `src/perf/**`, `spiel/index.html`, `src/spiel/main.ts` (vorläufiger Einstieg,
  wird in 013 erweitert), `vite.config.ts` (Eingang `spiel`), `package.json` (`three` exakt gepinnt 0.187.0 +
  `@types/three` – bereits vorhanden, nur Pinning), `tests/e2e/render.spec.ts`, `tests/unit/render/**`,
  `index.html` (Link „Spielen“ als ersten Eintrag), `eslint.config.js` (nur Regel: `three` nur in `src/render/`)
- Darf nicht ändern: `src/core/`, `src/modules/`, `src/input/`, `src/ui/`, `spikes/`, Projektdokumente

## View-API (verbindlich, `src/render/view-api.ts`)
```ts
export interface WerkstattView {
  bewegen(vorwaerts: number, seitwaerts: number): void;   // -1..1, pro Frame vom Input
  umschauen(dxPx: number, dyPx: number): void;
  pick(xCss: number, yCss: number): string | null;          // ID des getroffenen Objekts (z. B. 'werkbank', 'brett')
  arbeitsansicht(an: boolean): void;                         // Kamerafahrt ≤ 600 ms zur Werkbank / zurück
  brettZeigen(laengeMm: number, bezugsende: 'a' | 'b' | null): void;
  markierungZeigen(mm: number | null): void;                 // Bleistiftstrich
  massbandZeigen(mm: number | null): void;                   // ausgezogenes Massband bis mm
  saegeZeigen(zustand: { versatzMm: number; tiefe01: number; driftGrad: number } | null): void;
  schnittErgebnisZeigen(laengeIstMm: number | null): void;   // Brett getrennt, Reststück daneben
  hervorheben(id: string | null): void;
  weltNachBildschirm(mmAufBrett: number): { x: number; y: number } | null; // für HUD-Lupe
  bildschirmNachBrettMm(xCss: number, yCss: number): number | null;      // Wischen auf dem Brett → mm
  dispose(): void;
}
```

## Abnahmekriterien
- [x] `/spiel/` lädt Szene: Raum, Werkbank, Brett (prozedurale Holztextur Fichte), Säge/Massband als Primitive-
      Platzhalter (Assets folgen in 012/013), Licht Stil A (Sonne + Umgebung), ein Schatten nur im Werkbankbereich
- [x] Alle View-API-Methoden implementiert und per `window.__view` im Debug-Modus erreichbar; Unit-Tests für
      Koordinatenumrechnung (mm ↔ Welt) ohne WebGL
- [x] Ich-Kamera quer, Pixeldichte ≤ 2, MSAA; dynamische Auflösung aus Spike übernommen
- [x] `window.__perf()` (PerfSnapshot v1) in `src/perf/` inkl. der zwei QA-Befunde behoben; Debug-Overlay aus
      `src/debug/` eingebunden
- [x] Budgets: Draw Calls < 80, Dreiecke < 150 000, Download `/spiel/` < 1 MB gzip ohne Assets
- [x] Kontextverlust (`WEBGL_lose_context`) → Szene stellt sich wieder her (S5)
- [x] E2E (WebKit-tauglich): Seite lädt ohne Fehler, Canvas da, `__perf()` liefert Werte, `pick` auf Brett-Mitte → 'brett'
- [x] Hochformat: Hinweis „Bitte quer halten“ (einfaches DOM-Element; das endgültige HUD macht 011)
- [x] `npm run check` + E2E grün; Startseite verlinkt „Spielen“

## Nicht Teil dieses Tickets
Touch-Eingabe (011), Spielregeln (008), echte Modelle (012), Verdrahtung (013).

## Protokoll
- 2026-11-01 engine-engineer (nach API-Limit fortgesetzt): src/render, src/perf, /spiel/. Download /spiel/ 156 kB gzip,
  ≤ 28 Draw Calls, ~2 500 Dreiecke. View-API unverändert, Ergänzungen: WerkstattViewDebug, erzeugeWerkstattView (async).
- QA Runde 1: NACHARBEIT (klein) – Hervorhebung färbte Regal mit, Massband verdeckte Strich, Ziffern bei Ende b kopfüber,
  GL-Warnungen nach Kontextverlust; Stil A „alles orange“. Behoben (b22d2f4).
- Director: Nachprüfung auf main: 207 Unit, 49 E2E grün (Chromium). Rest Stil A (Lichtfleck auf Werkbank) → Ticket 013.
