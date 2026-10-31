# Asset-Quellen – Kandidaten für Vertical Slice 0.1 (Ticket 007)

Status: **Konzept** · Autor: asset-artist · Regeln: `.claude/skills/asset-pipeline/SKILL.md`

**Keine Downloads.** Diese Liste ist die Kandidatenliste für die Freigabe durch Director/Mensch.

## Prüfstatus – ehrlich

In dieser Sitzung waren `polyhaven.com`, `api.polyhaven.com`, `docs.ambientcg.com` und
`kenney.nl` **nicht erreichbar** (Proxy: `connect_rejected`, WebFetch: Host nicht erlaubt,
geprüft am 2026-10-31). Deshalb:

- **Jede Lizenz unten ist „ungeprüft“.** Angaben stammen aus Vorwissen, nicht von der Originalseite.
- **Auch die konkreten Asset-Namen sind ungeprüft** – sie können umbenannt oder entfernt sein.
  Bei Spalte „Name“ steht „(Name unsicher)“, wo ich mir nicht sicher bin; dort ist die Such-URL massgeblich.
- Vor jedem Download muss jemand die Seite öffnen und Lizenz + Name bestätigen. Dafür
  entweder die Domains in den Netzwerkeinstellungen der Sitzung freigeben (dann prüft der
  asset-artist nach) oder der Mensch öffnet die Links auf dem iPhone und bestätigt im Chat.

Grössen sind **Schätzungen**: „Roh“ = Download, „Spiel“ = nach `gltf-transform` mit KTX2/meshopt
auf Zielauflösung.

## 1. Prozedural / Primitive (kein Download, empfohlen zuerst)

| Asset | Umsetzung | Begründung |
|---|---|---|
| Rohbrett / Werkstück (Fichte 2000 × 140 × 18) | Box mit Fasen im Code, UV in mm skaliert, Holztextur gekachelt; Schnittfläche als eigenes Material (Stirnholz) | Länge ändert sich im Spiel (Schnitt) – muss ohnehin prozedural sein |
| Werkbank (Platte, Beine, Zarge) | Primitive (Boxen) mit Eiche/Buche-Textur, Fasen 2 mm | Laut Pipeline: Platten und Balken prozedural |
| Massband – Band und Skala | Band als schmale Fläche, **Skala per Canvas generiert** (mm-Striche, Zahlen, exakt); Gehäuse aus Primitiven (gerundete Box) + gelber Kunststoff | Skala muss mm-genau zur Spiellogik passen; fremde Texturen passen nie exakt |
| Säge (Sägeblatt) | Blatt als extrudierte Kontur, Zähne per Alpha/Normal-Textur; Griff ggf. als Modell (unten) | Blattlänge und Zahnbild für die Mechanik wichtig |
| Regale, Wandbretter, Pegboard | Primitive + Instanzen | billig, viele Wiederholungen |

## 2. CC0-Bibliotheken – Kandidaten

| # | Zweck | Name | Quelle-URL | Lizenz (Status) | Grösse roh (geschätzt) | Grösse im Spiel (geschätzt) |
|---|---|---|---|---|---|---|
| T1 | Holz Werkstück (Fichte/Kiefer hell) | Poly Haven „fine_grained_wood“ (Name unsicher) | https://polyhaven.com/a/fine_grained_wood · Suche: https://polyhaven.com/textures/wood | CC0 laut Vorwissen – **ungeprüft** | 2K-Set JPG/PNG (Diffus, Normal, Rough) ca. 8–15 MB | 1024² KTX2 ca. 0,6–1 MB |
| T2 | Sperrholz-Stirnseiten / Regale | Poly Haven „plywood“ (Name unsicher) | https://polyhaven.com/a/plywood | CC0 – **ungeprüft** | 2K-Set ca. 8–15 MB | 1024² KTX2 ca. 0,6–1 MB |
| T3 | Werkbankplatte (Eiche, benutzt) | Poly Haven „wood_table_001“ (Name unsicher) | https://polyhaven.com/a/wood_table_001 | CC0 – **ungeprüft** | 2K-Set ca. 10–20 MB | 2048² gekachelt KTX2 ca. 2–3 MB |
| T4 | Alternative Holztexturen | ambientCG Holz-Kategorie (z. B. „Wood049“ – ID unsicher) | https://ambientcg.com/list?q=wood · https://ambientcg.com/view?id=Wood049 | CC0 laut Vorwissen – **ungeprüft** | 2K-JPG-ZIP ca. 10–25 MB | 1024² KTX2 ca. 0,6–1 MB |
| T5 | Boden (Holzdielen/Beton) | ambientCG „WoodFloor…“ / „Concrete…“ (ID offen) | https://ambientcg.com/list?q=wood+floor | CC0 – **ungeprüft** | 2K ca. 10–20 MB | 2048² gekachelt ca. 2–3 MB |
| T6 | Stahl gebürstet (Schraubstock, Säge) | ambientCG „Metal…“ (ID offen) | https://ambientcg.com/list?q=metal | CC0 – **ungeprüft** | 1K ca. 3–6 MB | 512–1024² ca. 0,3–1 MB |
| H1 | HDRI Werkstatt (Umgebungslicht, Reflexion) | Poly Haven „carpentry_shop_02“ | https://polyhaven.com/a/carpentry_shop_02 | CC0 – **ungeprüft** | 1K .hdr ca. 1,5 MB · 2K ca. 6 MB | vorgefiltert (PMREM) aus 1K: < 1,5 MB Download |
| H2 | HDRI Alternative | Poly Haven „carpentry_shop_01“ | https://polyhaven.com/a/carpentry_shop_01 | CC0 – **ungeprüft** | wie H1 | wie H1 |
| H3 | HDRI Alternative (Variante A, warmes Innenlicht) | Poly Haven „artist_workshop“ (Name unsicher) | https://polyhaven.com/a/artist_workshop · Suche: https://polyhaven.com/hdris/indoor | CC0 – **ungeprüft** | wie H1 | wie H1 |
| M1 | Werkbank-Zubehör (Schraubstock, Zwinge) | Poly Haven Modelle, Suche „vise“/„clamp“ | https://polyhaven.com/models | CC0 – **ungeprüft**; Existenz passender Modelle unbekannt | glTF 1K ca. 2–8 MB | ca. 0,5–1,5 MB, Ziel ≤ 3 000 Dreiecke |
| M2 | Säge-Griff / Handsäge komplett | Poly Haven Modelle, Suche „saw“ | https://polyhaven.com/models | CC0 – **ungeprüft**; passendes Modell nicht bestätigt | glTF ca. 2–8 MB | Ziel ≤ 4 000 Dreiecke, 1024² |
| M3 | Massband-Gehäuse | Poly Haven Modelle, Suche „tape measure“ | https://polyhaven.com/models | CC0 – **ungeprüft**; passendes Modell nicht bestätigt | glTF ca. 1–5 MB | Ziel ≤ 2 000 Dreiecke, 512–1024² |
| K1 | Platzhalter-Kleinkram (Werkzeuge, Kisten) im Blockout | Kenney Asset-Packs (z. B. Furniture/Prototype) | https://kenney.nl/assets | CC0 laut Vorwissen – **ungeprüft** | Pack ca. 5–30 MB | nur Blockout, nicht im Endlook (Stil zu comichaft) |

## 3. Lizenzierte Assets (nur mit Freigabe, Kauf durch den Menschen)

| Zweck | Quelle | Lizenz (Status) | Hinweis |
|---|---|---|---|
| Säge, Massband in Nahaufnahme, falls CC0 nicht reicht | https://sketchfab.com/search?q=hand+saw&type=models (Filter „Downloadable“, Lizenz CC0/CC-BY) | je Modell verschieden – **ungeprüft** | CC-BY braucht Namensnennung in `assets/LICENSES.md` und im Spiel-Impressum; nur nach Freigabe |

## 4. Gesamtschätzung Vertical Slice (Download)

| Gruppe | geschätzt |
|---|---|
| Holz/Metall/Boden-Texturen (6 Sets, KTX2) | 5–9 MB |
| HDRI (1 Stück, 1K vorgefiltert) | ≤ 1,5 MB |
| Modelle (Säge, Massband, Schraubstock, meshopt) | 1–3 MB |
| Lightmap Werkstatt (KTX2, 2048²) | 1–2 MB |
| **Summe Assets** | **ca. 8–15 MB** – knapp am Ziel < 15 MB (inkl. Code); Grenze 25 MB |

Abweichungsrisiko: Wenn T3/T5 als 2048² nötig sind, wird das 15-MB-Ziel eng. Gegenmittel:
1024² mit Detail-Kachelung, Diffus als ETC1S (klein), nur Normal-Maps als UASTC.

## 5. Nächste Schritte (nach Freigabe)
1. Domains `polyhaven.com`, `ambientcg.com`, `kenney.nl` für die Sitzung freigeben **oder**
   Mensch bestätigt Lizenzseiten per Chat: https://polyhaven.com/license · https://docs.ambientcg.com/license/ · https://kenney.nl/support
2. Asset-Namen auf den Seiten bestätigen, Status hier auf „geprüft (Datum)“ setzen.
3. Erst dann Download (durch Mensch oder Sitzung mit Netz) nach `assets-src/`, Optimierung,
   Eintrag in `assets/LICENSES.md`.
