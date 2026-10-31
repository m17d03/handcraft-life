---
name: konzept-visuals
description: Erstellt in Phase 0 die visuellen Konzepte (Art Direction, Moodboard, UI-Mockups, 3D-Blockouts, Prompts für Concept-Art) und kennzeichnet sie als Konzeptbilder. Verwenden für ART_DIRECTION.md und die 12 Konzeptansichten aus dem Master-Prompt.
---

# Visuelle Konzepte

Ehrliche Grenze: Claude Code erzeugt keine gemalte Concept-Art. Es kann
(a) UI-Mockups als HTML/CSS bauen, (b) 3D-Blockouts in der gewählten Engine rendern und
als Screenshot speichern, (c) präzise Bild-Prompts schreiben, die der Mensch in einem
Bildgenerator ausführt, (d) Referenzen recherchieren.

## Ablauf
1. **Stilrichtung in 2–3 Varianten** in `docs/art/stil-varianten.md`:
   je Variante Palette (Hex), Lichtstimmung, Materialbeschreibung, Kantenschärfe,
   UI-Stil, 3–5 Referenzlinks (nur verlinken, keine fremden Bilder kopieren).
2. **Bild-Prompts** für die 12 Ansichten aus Master-Prompt Abschnitt 15, pro Stilvariante,
   in `docs/art/prompts.md`. Gleiche Struktur pro Prompt (Motiv, Kamera, Licht, Material, Stil,
   Format 16:9 bzw. Hochformat für UI). Der Mensch erzeugt die Bilder und legt sie in
   `docs/art/konzepte/` ab.
3. **UI-Mockups** (Touch-Steuerung, Inventar/Aufträge, Skill-Tree) als HTML-Dateien in
   `docs/art/mockups/`, im iPhone-Format (z. B. 852 × 393 pt quer), mit Playwright als PNG
   gerendert.
4. **3D-Blockout** der Werkstatt (Holz-, Metall-, 3D-Druck-Bereich) aus Primitiven im Engine-Spike,
   Screenshot nach `docs/art/blockouts/`.
5. Jede Bilddatei bekommt im Namen oder als Overlay `KONZEPT` und im Dokument den Hinweis
   **Konzeptbild – kein Spielscreenshot**.

## Ergebnis
`docs/ART_DIRECTION.md`-Entwurf mit empfohlener Stilvariante und Begründung, Asset-Budgets
als Platzhalter bis zum Benchmark. Entscheidung trifft der Director mit dem Menschen.
