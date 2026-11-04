---
id: 019
titel: Werkzeuge und Werkbank in Blender neu modellieren (bpy-Skripte, gebackene AO, Stil A)
agent: asset-artist
meilenstein: Phase 1 – Vertical Slice 0.1 (Grafik-Nachschärfung)
status: open
reifegrad: Implementiert
blocked_by: []
branch: ticket/019-blender-modelle
---

## Ziel
Säge, Massband, Bleistift und Werkbank wirken in der Nahansicht deutlich hochwertiger – modelliert mit echtem Blender
(ADR 0005), reproduzierbar per Skript, innerhalb der Budgets und mit denselben Knotennamen wie bisher (Einbau ohne Code-Änderung).

## Kontext
ADR 0005, `.claude/skills/asset-pipeline/SKILL.md`, `docs/art/assets-phase1.md` (bisherige Modelle, Knotennamen, Massstab),
`docs/ART_DIRECTION.md` (Stil A), Playtest: „Grafik bis jetzt super“ – Ziel ist Nachschärfung, kein Stilbruch.

## Scope
- Darf ändern: `tools/blender/**`, `public/assets/modelle/**`, `docs/art/assets-blender.md`, `docs/art/assets-blender/**`
  (Vorschauen), `assets/LICENSES.md`
- Darf nicht ändern: `src/`, `tests/`, `package.json`, Texturen der Raumhülle, Projektdokumente

## Abnahmekriterien
- [ ] Setup `bash tools/blender/setup.sh`, dann je Modell ein bpy-Skript; ein Sammelskript erzeugt alle GLB deterministisch
- [ ] Fuchsschwanz: Griff mit weichen Rundungen und Griffloch, Messingschrauben, Blatt mit Zahnung (Geometrie oder Alpha) und
      leichter Verjüngung; Massband: Gehäuse mit Rundungen und Gummierung, Band, Haken; Bleistift: sechseckig, gespitzt;
      Werkbank: Platte mit Fasen, Bankhaken-Löcher, Vorderzange mit Spindel
- [ ] Gebackene Ambient Occlusion (Cycles) je Modell in die ORM-Textur; Normal-Map-Bake aus High-Poly, wo es Detail bringt
- [ ] Gleiche Knotennamen, Ursprünge, Achsen und Massstab wie in `docs/art/assets-phase1.md` (dort verbindlich) – das Spiel lädt die
      neuen GLB ohne Code-Änderung; Massband-`Band` mit scale.z = 0 im Ruhezustand
- [ ] Budgets je Modell wie Ticket 012 (Säge ≤ 5 000, Massband ≤ 3 000, Bleistift ≤ 500, Werkbank ≤ 4 000 Dreiecke, ≤ 2 Materialien),
      KTX2 + meshopt über die bestehende Pipeline; `public/assets/` gesamt ≤ 6 MB
- [ ] Vorschau-Renders (Cycles) vorher/nachher je Modell, gekennzeichnet „Asset-Vorschau – kein Spielscreenshot“
- [ ] `npm run check` bleibt grün; Spiel lädt die neuen Modelle fehlerfrei (Chromium-E2E `vertical-slice.spec.ts` lokal)

## Protokoll
