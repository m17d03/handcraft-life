# Asset-Budgets – Entwurf (Ticket 007)

Status: **Konzept – Platzhalter.** **Final nach Engine-Spike-Benchmark** auf dem Ziel-iPhone
(Master-Prompt §8: Budgets erst nach Benchmark festlegen). Danach per Entscheidung in
`docs/decisions/` fixieren und in `docs/QUALITY_STANDARDS.md` übernehmen (Director).

Rahmen aus `CLAUDE.md`: Dreiecke im Bild < 150 000 (hart 300 000), Draw Calls < 80 (hart 120),
GPU-Texturspeicher < 120 MB (hart 200 MB), erster Download < 15 MB (hart 25 MB).
Die Werte unten verteilen diesen Rahmen auf die Werkstatt des Vertical Slice mit ca. 30 % Reserve.

## 1. Dreiecke je Objektklasse

| Klasse | Beispiele | Dreiecke je Objekt | Anzahl im Bild | Summe |
|---|---|---|---|---|
| Nahwerkzeug, interaktiv | Säge, Massband, Bleistift | 2 000–5 000 | 2–3 | ≤ 12 000 |
| Werkstück (prozedural) | Brett, Reststück | 50–300 (Fasen) | 1–5 | ≤ 1 500 |
| Hände (Ich-Sicht, falls gezeigt) | linke/rechte Hand | 3 000–6 000 je Hand | 2 | ≤ 12 000 |
| Werkbank + feste Ausstattung | Platte, Schraubstock, Zwingen | 1 000–4 000 | 3–6 | ≤ 15 000 |
| Mittelgrund-Möbel | Regal, Holzlager, Pegboard | 300–2 000 | 6–10 | ≤ 15 000 |
| Kleinkram, instanziert | Schrauben, Dosen, Werkzeuge am Brett | 50–500 | 20–60 (Instanzen) | ≤ 15 000 |
| Raumhülle | Wände, Balken, Fenster, Tür, Boden | – | 1 | ≤ 8 000 |
| Hintergrund (Phase 3) | Metall-Ecke, 3D-Drucker als Kulisse | 500–3 000 | 2–4 | ≤ 10 000 |
| **Summe Werkstatt** | | | | **≤ ca. 90 000** (Ziel < 150 000) |

Outdoor (Phase 4) bekommt ein eigenes Budget nach eigenem Benchmark (Gras/Vegetation dominiert).

## 2. Texturgrössen

| Klasse | Grösse | Maps | Hinweis |
|---|---|---|---|
| Nahwerkzeug | 1024² | Basisfarbe, Normal, ORM (AO/Rough/Metal gepackt) | ein Atlas pro Werkzeug |
| Werkstück-Holz | 1024² gekachelt | Basisfarbe, Normal, ORM | Stirnholz eigenes 512²-Set |
| Grosse Flächen (Werkbankplatte, Boden, Wand) | 2048² gekachelt oder 1024² + Detail-Kachel | wie oben | Detail-Kachel spart Speicher |
| Mittelgrund-Möbel | 512–1024² | Basisfarbe, Normal, ORM | gemeinsamer Atlas anstreben |
| Hintergrund / Kleinkram | 256–512² | Basisfarbe (+ORM) | Atlas, kein Normal nötig |
| Massband-Skala | Canvas, z. B. 2048 × 64 | Basisfarbe (+Alpha) | prozedural, mm-genau |
| Lightmap Werkstatt | 2048² (1 Stück) | RGB(M) | gebacken, KTX2 |
| HDRI/Umgebung | 1K Quelle → vorgefilterte Cube-Map | – | nur für Reflexionen/Ambient |

Format: KTX2 (Basis Universal). Basisfarbe als ETC1S (klein), Normal-Maps als UASTC (Qualität).
Auf dem iPhone werden sie zu ASTC/ETC2 transkodiert.

## 3. GPU-Texturspeicher (Rechnung, Schätzung)

ASTC 4×4 = 1 Byte/Pixel, Mipmaps +33 %: 1024² ≈ 1,4 MB, 2048² ≈ 5,6 MB je Map.

| Posten | Rechnung | ≈ MB |
|---|---|---|
| 3 Nahwerkzeuge × 3 Maps × 1024² | 9 × 1,4 | 13 |
| Holz Werkstück + Stirnholz | 3 × 1,4 + 3 × 0,35 | 5 |
| 3 grosse Flächen × 3 Maps × 2048² | 9 × 5,6 | 50 |
| Möbel/Kleinkram-Atlanten (4 × 3 × 1024²) | 12 × 1,4 | 17 |
| Lightmap 2048² (unkomprimiert RGBA8 als Worst Case) | 16 × 1,33 | 21 |
| Umgebung (Cube-Map, vorgefiltert) | | 3 |
| **Summe** | | **≈ 109 MB** (Ziel < 120 MB – eng) |

Folgerung: Grosse Flächen besser 1024² + Detail-Kachel (spart ≈ 35 MB), Lightmap komprimieren.

## 4. Materialanzahl und Draw Calls

| Grösse | Platzhalter |
|---|---|
| Unterschiedliche Materialien in der Werkstatt | ≤ 20 |
| Materialien je Objekt | 1 (Ausnahme Nahwerkzeug: 2, z. B. Griff + Blatt) |
| Draw Calls Werkstatt (inkl. Schattenpass) | ≤ 60 (Ziel < 80) |
| Echtzeit-Lichter mit Schatten | 1 (Sonne, Shadow-Map 1024², nur Werkbankbereich) |
| Weitere Echtzeit-Lichter ohne Schatten | ≤ 2 |
| Transparente Materialien | nur Fensterglas, Sägemehl-Partikel |

Instanzen für Wiederholungen (Schrauben, Bretter im Lager); statische Möbel zusammenführen.

## 5. Download

| Posten | Platzhalter |
|---|---|
| Werkstatt-Assets gesamt (GLB meshopt + KTX2) | ≤ 10 MB |
| Code + Engine (gzip) | nach Engine-Wahl |
| Erster Download gesamt | < 15 MB (hart 25 MB) |

## 6. Was der Benchmark klären muss
- Echte fps mit 1 Schatten-Licht + Lightmap + PBR auf dem iPhone (Variante A).
- Dynamische Renderauflösung: ab welcher Stufe wird die Massband-Skala unlesbar?
- FXAA vs. MSAA 4× gegen Kantenschärfe der Fasen.
- Ob 2048²-Flächentexturen nötig sind oder 1024² + Detail reicht.
- Speicherdruck in Safari (Tab-Neuladen bei zu viel Texturspeicher).
