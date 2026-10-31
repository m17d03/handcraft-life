# Stilvarianten (Ticket 007)

Status: **Konzept** · Autor: asset-artist · Entwurf für `docs/ART_DIRECTION.md` (Übernahme durch Director)

Moodboard zum Vergleichen auf dem iPhone (hochkant): https://m17d03.github.io/handcraft-life/konzepte/stil/
Quelle: `public/konzepte/stil/index.html`. Alles dort ist **Konzeptbild – kein Spielscreenshot**:
Farbfelder, Schriftproben und HUD sind mit CSS gezeichnet; Holz/Metall/Licht sind nur
**Stimmungsproben**, keine Spielgrafik.
Vorschaubilder (Playwright, Chromium, iPhone-15-Profil hochkant, mit „KONZEPT“-Stempel):
`public/konzepte/stil/screenshots/` (`moodboard-oben.png`, `szene-a.png`, `szene-b.png`, `szene-c.png`).
Geprüft: keine Querscroll-Breite (393 px), kein Text unter 13 px ausserhalb der verkleinerten
HUD-Vorschau, keine externen Anfragen, keine JS-Fehler. Nicht auf echtem Safari/WebKit geprüft.

Gemeinsame Basis aller Varianten (aus Master-Prompt §8): stilisiert-realistisches 3D, präzise
Werkzeuge, glaubwürdige PBR-Materialien, scharfe Werkstückkanten, warmes natürliches Licht,
ruhige UI, Querformat (siehe `docs/design/steuerung-a-b.md` §8), Ich-Sicht (Konzept B).
Die Varianten unterscheiden sich in **Licht, Palette, Materialanmutung und UI-Haut** – nicht
in Geometrie. Dieselben Modelle und Texturen passen zu allen drei; gewechselt werden
Lightmap/HDRI, Farbkorrektur (Tonemapping/LUT) und UI-Farben. Das hält die Wahl umkehrbar.

Referenzlinks: Die Netzwerkregel dieser Sitzung sperrt die meisten Seiten. Die Links wurden
**nicht abgerufen**; sie sind Suchstarts bzw. bekannte Seiten. Keine fremden Bilder kopiert.

---

## Variante A – „Honigwerkstatt“ (warmer Spätnachmittag)

Anschlussfähig an die Steuerungs-Mockups (`public/konzepte/steuerung/`): gleiche Grundfarben
`#1F1A15` / `#F3E9DC` / `#D9A35B`.

**Palette**

| Rolle | Hex |
|---|---|
| Tiefen, UI-Grund | `#1F1A15` |
| Dunkles Holz, Boden | `#3B2A1C` |
| Nussbaum, Werkbankgestell | `#8E5D33` |
| Eiche, Werkbankplatte | `#C58F55` |
| Fichte hell, Werkstück | `#E3C08D` |
| Licht, UI-Text | `#F3E9DC` |
| Akzent Bernstein (UI, Ziel) | `#D9A35B` |
| Akzent hell (Hervorhebung) | `#FFD08A` |
| Stahl | `#7D8A8F` |
| Tannengrün (Textil, PLA) | `#2F5A4A` |
| Signal gut / Warnung / schlecht | `#8FD18B` / `#FFB36B` / `#FF8A7A` |

**Licht:** tiefstehende Sonne durch ein Werkstattfenster (ca. 3500–4000 K), lange weiche
Schatten, warmer Lichtfleck auf der Werkbank; Raumlicht aus Lightmap + Innenraum-HDRI,
leicht kühlere Schattenseite (Blau-Grau) für Tiefe. Tonemapping filmisch (ACES/AgX), kein starkes Bloom.

**Materialien:** Holz mit gut lesbarer Maserung, matt bis seidenmatt (Roughness 0,6–0,8);
Stirnholz sichtbar dunkler und poriger – wichtig, weil Schnittkanten das Spielergebnis zeigen.
Stahl gebürstet (Roughness 0,35–0,5), Kanten leicht abgegriffen. PLA (3D-Druck) seidig mit
feinen Schichtlinien in der Normal-Map. Sägemehl als helle Partikel.

**Kantenschärfe:** harte Silhouetten, aber jede Werkstückkante mit kleiner Fase (0,5–1 mm, ein
Segment), damit sie das Licht fängt – das macht „scharf“ auf kleinen Displays sichtbar.
Keine Outline-Shader.

**UI-Stil:** dunkle halbtransparente Panels (`#1F1A15` mit 88 % Deckung), Bernsteinrand 1,5 px,
Ecken 14 px, Systemschrift (SF Pro), Zahlen mit festen Ziffernbreiten. Exakt die Sprache
der Steuerungs-Mockups.

**Referenzen (nur Links, nicht abgerufen):**
1. https://polyhaven.com/a/carpentry_shop_02 – Tischlerei-HDRI als Lichtstimmung
2. https://www.firewatchgame.com/ – reduzierte warme Farbpalette (nur Farbgefühl, nichts übernehmen)
3. https://www.artstation.com/search?query=stylized%20realistic%20workshop
4. https://commons.wikimedia.org/w/index.php?search=carpentry+workshop+sunlight

**Mobile-Kosten:** mittel. 1 Echtzeit-Schatten (Sonne, kleine Shadow-Map nur um die
Werkbank), Rest gebacken. Warme Farben verzeihen niedrige Renderauflösung gut.

---

## Variante B – „Nordische Werkbank“ (heller Tag)

**Palette**

| Rolle | Hex |
|---|---|
| Wand warmweiss | `#F4F1EA` |
| Birke/Sperrholz | `#DCD3C4` |
| Esche, Werkstück | `#C9A979` |
| Eiche geölt | `#A27B4E` |
| Stahl/Zink | `#8C9499` |
| Schiefer (Schatten, Sekundärtext) | `#4A5560` |
| UI-Text dunkel | `#1E2A33` |
| Akzent Signalorange | `#E8692C` |
| Himmelblau (Fensterlicht, PLA) | `#3E7CB1` |
| Signal gut / Warnung / schlecht | `#2E8B57` / `#D98E04` / `#C8432F` |

**Licht:** diffuses Tageslicht (ca. 5500–6000 K) durch grosse Fenster, weiche kurze
Schatten, wenig Kontrast. Fast vollständig backbar.

**Materialien:** helle Hölzer (Birke, Esche, Sperrholz-Stirnseiten mit Schichten), Wände
verputzt, Stahl matt-grau, Werkzeuggriffe in Signalfarben. Wirkt sauber, aufgeräumt.

**Kantenschärfe:** sehr klar; durch geringen Kontrast müssen Kanten über Fasen und
Umgebungsverdeckung (AO, gebacken) lesbar werden, sonst wirkt alles flach.

**UI-Stil:** helle, deckende Karten (`#F4F1EA`), dunkler Text, Akzent Signalorange, Ecken
10 px, abgerundete Systemschrift (SF Pro Rounded via `ui-rounded`). Freundlich, sehr lesbar
in der Sonne.

**Referenzen (nur Links, nicht abgerufen):**
1. https://polyhaven.com/hdris/indoor – helle Innenraum-HDRIs als Lichtvergleich
2. https://www.artstation.com/search?query=scandinavian%20workshop
3. https://commons.wikimedia.org/w/index.php?search=birch+plywood+workshop
4. https://www.pinterest.com/search/pins/?q=nordic%20woodworking%20workshop

**Mobile-Kosten:** niedrig. Keine Echtzeit-Schatten nötig (optional einer), kaum
Nachbearbeitung. Risiko: Helligkeit zeigt jede unscharfe Textur und jede Polygonkante;
Stil kann steril/„Möbelhaus“ wirken und widerspricht leicht „warmes Licht“ aus §8.

---

## Variante C – „Lampenlicht am Abend“ (low-key)

**Palette**

| Rolle | Hex |
|---|---|
| Tiefschwarzbraun | `#0F0D0B` |
| Schattenholz | `#241C16` |
| Walnuss | `#5A3A22` |
| Messing dunkel | `#A0652F` |
| Lampenlicht | `#E0A24A` |
| Glanzlicht | `#FFE3B0` |
| Stahlblau Schatten | `#3C4A52` |
| Stahl hell | `#B8C4C9` |
| Ochsenblut (Akzent, PLA) | `#9C2F2A` |
| UI-Text | `#EDE3D3` |
| Signal gut / Warnung / schlecht | `#9BCB7A` / `#E8B04A` / `#E0675A` |

**Licht:** Abend, eine Werkstattlampe über der Werkbank (ca. 2700 K) als Lichtinsel, Raum
fällt ins Dunkle, kühles Restlicht vom Fenster. Hoher Kontrast, Hell-Dunkel-Malerei.

**Materialien:** dunkle Hölzer, Messing, geölter Stahl mit deutlichen Glanzlichtern,
Staub im Lichtkegel. Wirkt edel und atmosphärisch.

**Kantenschärfe:** Kanten leben von Glanzlichtern; im Schatten verschwinden Silhouetten
(kaschiert günstige Hintergrund-Assets, erschwert aber das Lesen von Werkstücken).

**UI-Stil:** fast schwarze Glas-Panels, dünne Messinglinien, Überschriften in Serifenschrift
(New York via `ui-serif`), Zahlen in SF Mono (`ui-monospace`). Elegant, aber kleinere
Kontrastreserve bei Sonne auf dem Display.

**Referenzen (nur Links, nicht abgerufen):**
1. https://en.wikipedia.org/wiki/Chiaroscuro – Hell-Dunkel-Prinzip
2. https://www.artstation.com/search?query=workshop%20night%20lamp%20lighting
3. https://commons.wikimedia.org/w/index.php?search=workshop+lamp+night
4. https://polyhaven.com/hdris/night – Nacht-HDRIs als Lichtvergleich

**Mobile-Kosten:** hoch. Lampe nahe am Werkstück braucht einen dynamischen
Punktlicht-Schatten (Cube-Map = bis 6 Render-Durchgänge) oder gute Fakes; Bloom und dunkle
Verläufe zeigen auf 8-Bit-Ausgabe Banding; Millimeter-Skala im Halbdunkel schwer lesbar.

---

## Vergleich

| Kriterium | A Honigwerkstatt | B Nordisch hell | C Lampenlicht |
|---|---|---|---|
| Passt zu §8 (warm, natürlich) | ja | teils (eher kühl) | ja, aber künstlich |
| Lesbarkeit Massband/Schnittkante | gut | sehr gut | schwach |
| Verzeiht günstige Assets | gut | schlecht | sehr gut |
| GPU-Kosten | mittel | niedrig | hoch |
| Anschluss an Steuerungs-Mockups | direkt | neue UI-Haut | neue UI-Haut |
| Outdoor (Feld, See) übertragbar | gut (goldene Stunde) | gut (Mittag) | schwer (Nacht-Jagd unüblich) |

## Empfehlung: Variante A „Honigwerkstatt“

1. **Erfüllt §8 am direktesten:** warmes, natürliches Licht ohne künstliche Lichtquelle.
2. **Lesbarkeit:** Helle Fichte auf dunklerer Eichenplatte gibt starken Kontrast genau dort,
   wo gemessen und gesägt wird; Stirnholz der Schnittkante hebt sich ab.
3. **Mobile-Kosten mittel und planbar:** Sonne = ein gerichtetes Licht mit einer kleinen
   Shadow-Map nur im Werkbankbereich; Raum gebacken (Lightmap) + HDRI-Umgebungslicht. Kein
   Punktlicht-Schatten wie bei C; mehr Atmosphäre als B bei kaum höheren Kosten.
4. **Kein Bruch:** UI-Sprache existiert bereits in den Steuerungs-Mockups.
5. **Übertragbar:** goldene Stunde funktioniert auch für Fasanenfeld und See.
6. **Umkehrbar:** Wird A auf dem iPhone zu dunkel oder matschig, ist B mit denselben Assets
   (andere Lightmap/HDRI und UI-Farben) erreichbar.

Risiko A: Warme Farbstiche können Holzarten angleichen („alles orange“). Gegenmittel:
kühles Schattenblau, Weissabgleich nicht über 3500 K treiben, Holzarten über Helligkeit
und Maserung unterscheiden, nicht nur Farbton.

Prüfung offen bis Engine-Spike: echter Look mit PBR-Texturen und Lightmap auf dem iPhone,
dynamische Renderauflösung und AA (FXAA vs. MSAA) gegen Kantenschärfe.
