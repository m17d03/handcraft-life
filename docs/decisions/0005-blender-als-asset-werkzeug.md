---
adr: 0005
titel: Blender (bpy, headless) wird das Werkzeug für 3D-Modelle
status: angenommen
datum: 2026-11-04
---

## Problem
Der Mensch möchte Modelle mit Blender erstellen lassen. Einen Blender-Konnektor gibt es in der Cloud-Sitzung nicht
(weder verbunden noch im Plugin-Katalog). Bisher entstanden Modelle per Node-Skript (three-Geometrie + glTF-Transform,
Ticket 012) – reproduzierbar, aber ohne Modifikatoren, UV-Werkzeuge, Baking.

## Optionen
| Option | Vorteile | Nachteile | Belege |
|---|---|---|---|
| Blender-Konnektor (MCP) | interaktiv | in der Cloud nicht verfügbar; braucht laufendes Blender auf einem Rechner | Suche Tools + Plugin-Katalog 2026-11-04: kein Treffer |
| **bpy von PyPI, headless im Container** | echtes Blender 5.2.3 LTS: Bevel/Subdivision/Boolean, UV-Unwrap, Cycles-Baking (AO, Normal aus High-Poly), glTF-Export; per Skript reproduzierbar | ~350 MB Installation pro Sitzung; nur CPU-Rendering | Test 2026-11-04: Modell + Cycles-Render + GLB-Export erfolgreich |
| Node-Skripte (bisher) | leicht, schnell | begrenzte Modellier- und Bake-Möglichkeiten | Ticket 012 |

## Entscheid
Neue und überarbeitete 3D-Modelle entstehen als **Blender-Python-Skripte** unter `tools/blender/` (bpy 5.2.3, exakt
gepinnt), Setup per `bash tools/blender/setup.sh` in `.venv-blender/` (nicht im Repo). Ausgabe: GLB → bestehende
Optimierung (meshopt, KTX2) aus `tools/assets/`. Skripte sind deterministisch (fester Seed) und erzeugen Vorschau-Renders.

## Begründung
Belegt lauffähig in dieser Umgebung; deckt den Wunsch des Menschen ab; Ergebnisse bleiben versioniert und reproduzierbar.

## Folgen
- Ticket 019: Werkzeuge und Werkbank in Blender neu (Bevel, gebackene AO, bessere Proportionen).
- Lizenz: eigene Skripte → CC0, Eintrag in `assets/LICENSES.md` wie bisher.
- Ein späterer echter Blender-Konnektor kann die Skripte ergänzen, nicht ersetzen.

## Rückweg
Gering: Die Node-Pipeline bleibt bestehen; GLB ist das Austauschformat.
