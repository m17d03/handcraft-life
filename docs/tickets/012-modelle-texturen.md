---
id: 012
titel: Werkstatt-Assets – Säge, Massband, Bleistift, Werkbank, Holz- und Raumtexturen (per Skript, Stil A)
agent: asset-artist
meilenstein: Phase 1 – Vertical Slice 0.1
status: done
reifegrad: Implementiert
blocked_by: []
branch: ticket/012-assets
---

## Ziel
Die Werkstatt bekommt die wichtigsten Nahobjekte als optimierte GLB-Dateien und Texturen im Stil A,
reproduzierbar per Skript erzeugt (kein Blender in dieser Umgebung verfügbar), lizenzrein.

## Kontext
- `.claude/skills/asset-pipeline/SKILL.md` (verbindlich), `docs/ART_DIRECTION.md`, `docs/art/stil-varianten.md` (A),
  `docs/art/budgets-entwurf.md`
- Blender-Konnektor ist in der Cloud-Sitzung nicht erreichbar; Downloads von Poly Haven/ambientCG/Kenney sind
  gesperrt. Daher: **Modelle per Node-Skript** (Three.js-Geometrie + `GLTFExporter` in Node oder
  `@gltf-transform/core`), **Texturen prozedural** (Noise/Canvas in Node, z. B. über `pngjs` o. ä.).
  Neue devDependencies nur für das Asset-Werkzeug zulässig (`@gltf-transform/*`, ein PNG-Encoder) – im
  Abschlussbericht begründen. KTX2-Kodierung: versuchen (`@gltf-transform/cli` mit `toktx`/basis), falls in
  der Umgebung nicht verfügbar, PNG/WebP + Hinweis als technische Schuld.

## Scope
- Darf ändern: `tools/assets/**` (Erzeugungsskripte), `public/assets/**` (fertige GLB/Texturen),
  `assets/LICENSES.md`, `docs/art/assets-phase1.md`, `package.json`/`package-lock.json` (nur devDependencies für
  das Werkzeug + Skript `assets:build`)
- Darf nicht ändern: `src/`, Projektdokumente, ADRs

## Abnahmekriterien
- [x] GLB: Fuchsschwanz (Blatt mit Zahnung als Textur/Alpha, Holzgriff), Massband (Gehäuse, ausziehbares Band als
      eigenes Mesh, Haken), Bleistift, Werkbank (Platte Eiche, Gestell, Vorderzange angedeutet); Massstab 1 Einheit = 1 m,
      Ursprung sinnvoll (Griffpunkt), Namen der Knoten dokumentiert
- [x] Dreiecke: Säge ≤ 5 000, Massband ≤ 3 000, Bleistift ≤ 500, Werkbank ≤ 4 000; Materialien ≤ 2 je Objekt
- [x] Texturen: Fichte (Brett, Längs- und Hirnholz), Eiche (Werkbank), Wand/Boden – je Albedo + Normal (+ Rauheit),
      1024², kachelbar, Stil-A-Palette; Gesamtgrösse `public/assets/` ≤ 6 MB
- [x] `npm run assets:build` erzeugt alles reproduzierbar (fester Seed)
- [x] `assets/LICENSES.md`: jede Datei als „eigen erzeugt (Skript …), Lizenz CC0“
- [x] Vorschau: eine Screenshot-Seite oder PNG je Asset in `docs/art/assets-phase1.md` (Chromium-Render erlaubt),
      gekennzeichnet als „Asset-Vorschau“
- [x] `npm run check` bleibt grün

## Nicht Teil dieses Tickets
Einbau in die Szene (013), Hände/Figur, Sounds.

## Protokoll
- 2026-11-01 asset-artist (nach API-Limit fortgesetzt): 4 GLB + 12 KTX2, 3,61 MB, byte-identisch reproduzierbar.
  devDependencies: @gltf-transform/core+extensions 4.5.1, meshoptimizer 1.3.0, ktx2-encoder 0.6.0.
- QA: ABNAHME EMPFOHLEN. GPU-Speicher iPhone ≈ 20–28 MB. Hinweise für 013: Massband-Band steht im GLB auf 1 m (scale.z)
  → beim Laden auf 0 setzen; Basis-Transcoder (three/examples/jsm/libs/basis) nach public kopieren (+0,58 MB).
- Director: ESLint-Zeile für tools/**/*.mjs auf main ergänzt.
