---
id: 018
titel: WebKit-CI wieder grün – Szene rendert in WebKit ohne GPU, Komplettablauf im Zeitlimit
agent: engine-engineer
meilenstein: Phase 1 – Vertical Slice 0.1
status: open
reifegrad: Implementiert
blocked_by: []
branch: ticket/018-webkit-ci
---

## Ziel
Der CI-Lauf auf main ist wieder vollständig grün (WebKit, iPhone-Profil hoch und quer), damit jede Änderung sicher geprüft ist.

## Befund (CI-Lauf 41345015425 auf 9918175, nach Merge von Ticket 013)
- `render.spec.ts:48` (hoch + quer): `__perf().triangles` = 0 (drawCalls offenbar ebenfalls 0) – vor 013 grün.
- `render.spec.ts:172` Kontextverlust: nach Wiederherstellung bleibt `drawCalls` 0 (60 s).
- `vertical-slice.spec.ts:139` (quer): Testzeit 420 s überschritten beim Sägen bzw. Abliefern.
- Flaky: `hud.spec.ts:265` (Stick + Umschauen gleichzeitig).
- Lokal (Chromium/SwiftShader) alles grün. WebKit ist in der Cloud-Sitzung nicht installierbar.
- Verdacht: In WebKit/Linux ohne GPU scheitert oder hängt das Laden von KTX2 (Basis-Transcoder-WASM) bzw. meshopt-GLB,
  oder die GL-Zählhülle greift in WebKit nicht mehr; oder Rendering ist so langsam, dass kein Frame zählt.

## Scope
- Darf ändern: `src/render/**`, `src/perf/**`, `tests/e2e/**`, `playwright.config.ts`
- Darf nicht ändern: `.github/workflows/` (parallel Ticket 015), `src/ui/`, `src/spiel/` (parallel Ticket 016), Regeln, Projektdokumente

## Vorgehen (Diagnose ohne lokales WebKit)
1. Diagnose-Ausgaben, die im Testfehler sichtbar werden: z. B. `__view.zustand()` (Asset-Status, Fehler beim Laden,
   Frames, Kontext) und `navigator.userAgent`/WebGL-Erweiterungen (`WEBGL_compressed_texture_*`) in die Fehlermeldung schreiben.
2. Branch pushen (`git push -u origin ticket/018-webkit-ci`), CI läuft automatisch; den Director bitten, die Logs zu lesen
   (er hat Zugriff), oder den öffentlichen Status per `curl https://api.github.com/repos/m17d03/handcraft-life/actions/runs?branch=ticket/018-webkit-ci` abfragen.
3. Ursache beheben (nicht Tests aufweichen!): z. B. robuster Fallback, wenn KTX2/Transcoder scheitert (unkomprimierte Texturen),
   Asset-Ladefehler sichtbar melden statt still nichts zu zeichnen.

## Abnahmekriterien
- [ ] CI-Lauf auf dem Ticket-Branch vollständig grün (WebKit hoch + quer), zweimal hintereinander
- [ ] Ursache im Protokoll benannt; Asset-Ladefehler werden im Spiel sichtbar gemeldet (Hinweis + Debug-Overlay), nie stilles Nichts
- [ ] Kein Test abgeschwächt oder übersprungen, um grün zu werden
- [ ] `npm run check` + lokale E2E grün

## Protokoll
