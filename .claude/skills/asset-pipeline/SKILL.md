---
name: asset-pipeline
description: Regeln und Schritte, um 3D-Modelle, Texturen, HDRIs und Sounds zu beschaffen, Lizenzen zu prüfen, für iPhone zu optimieren und einzubinden. Verwenden für jedes Ticket mit Assets.
---

# Asset-Pipeline

## 1. Bedarf
Pro Asset: Zweck, Grösse im Bild (Nahaufnahme vs. Hintergrund), Interaktiv ja/nein.
Nahes, interaktives Werkzeug bekommt Detail; Hintergrund wird billig.

## 2. Herkunft (in dieser Reihenfolge)
1. Prozedural / Primitive: Bretter, Balken, Platten, einfache Regale – im Code erzeugen.
2. CC0-Bibliotheken: Poly Haven (Modelle, Texturen, HDRIs), ambientCG (Texturen), Kenney (Stil-Assets).
3. Lizenzierte Assets (z. B. Sketchfab mit kommerziell nutzbarer Lizenz, Asset-Shops) –
   nur mit Freigabe des Menschen, Kauf macht der Mensch.
4. Eigene Modelle durch den Menschen (Blender) oder KI-3D-Generatoren – Ergebnis immer
   nachbearbeiten und messen.

Vor jedem Download: Kandidatenliste (Name, Quelle-URL, Lizenz, Dateigrösse) an den Director.
Lizenz immer auf der Originalseite prüfen, nicht aus Suchergebnissen übernehmen.

## 3. Optimieren (Node-Tools)
```bash
npx @gltf-transform/cli optimize in.glb out.glb \
  --compress meshopt --texture-compress ktx2 --texture-size 1024
npx @gltf-transform/cli inspect out.glb   # Dreiecke, Texturen, Grösse prüfen
```
- Texturgrössen: Nahwerkzeug 1024², grosse Flächen 2048² (gekachelt), Hintergrund 512².
- Gleiche Materialien zusammenfassen, Instanzen für Wiederholungen (Schrauben, Bretter).
- LOD nur, wenn Objekte stark unterschiedlich weit weg sind.
- Licht möglichst einbacken (Lightmaps) für die statische Werkstatt; nur ein Echtzeit-Schatten.

## 4. Ablage
- `assets/<bereich>/<name>.glb`, Rohdateien in `assets-src/` (nicht ins Bundle)
- Eintrag in `assets/LICENSES.md`: Datei | Quelle | Autor | Lizenz | URL | Datum

## 5. Prüfen
Budget-Check (Skill `perf-budget-check`) und Screenshot der Szene in `docs/screenshots/`.
