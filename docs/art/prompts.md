# Bild-Prompts für Concept-Art (Ticket 007)

Status: **Konzept** · Autor: asset-artist · Grundlage: `docs/art/stil-varianten.md`, Master-Prompt §15,
`UMSETZUNGSPLAN.md` Punkt 5 (auf 5 Kernansichten gekürzt)

Alle erzeugten Bilder sind **Konzeptbild – kein Spielscreenshot**. Sie zeigen Stimmung, nicht
die spätere Spielgrafik.

## Anleitung für dich (iPhone)

1. Öffne die **ChatGPT-App** (Bildgenerierung) – andere Apps mit Bildgenerator gehen auch.
2. Kopiere einen Prompt unten (Codeblock antippen und halten → Kopieren) und füge ihn ein.
3. Gefällt das Bild nicht, schreibe dazu z. B. „warmer light, less clutter“ und lass es neu
   erzeugen. Höchstens 2–3 Versuche pro Ansicht.
4. **Bild einfach hier im Claude-Chat schicken** und dazuschreiben, welche Nummer es ist
   (z. B. „K1“). Der Director legt es unter `docs/art/konzepte/` ab und kennzeichnet es mit
   „KONZEPT“. Du musst nichts hochladen oder umbenennen.
5. Erst die 5 Kernansichten (K1–K5). Die Kurzprompts Z6–Z12 erst, wenn die jeweilige Phase kommt.

Hinweise:
- Die Prompts sind auf Englisch, weil Bildgeneratoren damit zuverlässiger arbeiten.
- Bildgeneratoren schreiben Text und Zahlen oft fehlerhaft. Für UI-Bilder (K3, K4) zählt die
  Stimmung; genaue Bedienung zeigen die HTML-Mockups unter
  https://m17d03.github.io/handcraft-life/konzepte/steuerung/
- Format: Das Spiel läuft **quer**, deshalb alle Bilder 16:9 quer.
- Alle Prompts sind für die empfohlene **Variante A „Honigwerkstatt“**. Willst du B oder C
  vergleichen, ersetze nur die Zeile `Style:` durch den passenden Stil-Baustein unten.

## Stil-Bausteine (austauschbar)

Variante A (Standard):
```
Style: stylized-realistic 3D game art, crisp clean edges with small bevels, believable PBR materials, warm late-afternoon sunlight, honey and walnut tones with cool blue-grey shadows, calm and tidy, high detail on tools, simple background. Color palette: #1F1A15, #8E5D33, #C58F55, #E3C08D, #F3E9DC, #D9A35B.
```

Variante B:
```
Style: stylized-realistic 3D game art, crisp clean edges, bright diffuse Scandinavian daylight, light birch plywood and ash wood, warm white plaster walls, zinc grey steel, signal orange tool handles, airy and minimal, soft short shadows. Color palette: #F4F1EA, #DCD3C4, #C9A979, #8C9499, #1E2A33, #E8692C.
```

Variante C:
```
Style: stylized-realistic 3D game art, low-key evening mood, one warm workshop lamp creating a pool of light, deep dark surroundings, walnut wood, brass and oiled steel with strong highlights, dust in the light cone, chiaroscuro. Color palette: #0F0D0B, #241C16, #5A3A22, #A0652F, #E0A24A, #FFE3B0.
```

Für alle Prompts gilt am Ende dieser Zusatz (ist unten schon enthalten):
`No text, no logos, no watermark, no people's faces, no brand names. Concept art, not a screenshot.`

---

## Die 5 Kernansichten (Variante A, vollständig)

Einheitliche Struktur: **Motiv · Kamera · Licht · Material · Stil · Format · Ausschluss**.

### K1 – Werkstatt mit Holz-, Metall- und 3D-Druck-Bereich
Zweck: Gesamteindruck der Werkstatt, drei Bereiche klar getrennt erkennbar.
```
Subject: interior of a small cozy craft workshop in an old countryside barn, three clearly separated zones: on the left a wooden workbench with hand saw, tape measure, clamps and a stack of spruce boards; in the middle a steel metalworking corner with a bench vise, files, a hacksaw and an anvil; on the right a clean shelf with a desktop 3D printer, filament spools and small printed parts. Tools hang on a pegboard. Wood shavings on the floor.
Camera: wide establishing shot from the doorway at standing eye height, 24 mm lens, slight perspective, all three zones visible.
Light: warm late-afternoon sun (3800 K) through a large side window, long soft shadows across the floor, cool blue-grey fill light in the shadows, dust in the sunbeam.
Material: spruce and oak wood with readable grain, darker porous end grain, brushed steel, matte silk PLA plastic with fine layer lines, worn painted pegboard.
Style: stylized-realistic 3D game art, crisp clean edges with small bevels, believable PBR materials, warm late-afternoon sunlight, honey and walnut tones with cool blue-grey shadows, calm and tidy, high detail on tools, simple background. Color palette: #1F1A15, #8E5D33, #C58F55, #E3C08D, #F3E9DC, #D9A35B.
Format: 16:9 landscape.
No text, no logos, no watermark, no people's faces, no brand names. Concept art, not a screenshot.
```

### K2 – First-Person-Holzbearbeitung
Zweck: Kernmoment des Spiels – Brett messen und sägen aus der Ich-Sicht.
```
Subject: first-person view of the player's hands at a wooden workbench: the left hand presses a light spruce board (about 600 mm long, 18 mm thick) firmly onto the bench, the right hand guides a Japanese-style pull saw exactly along a fine pencil line. A yellow tape measure lies extended beside the board. Fresh sawdust and a half-finished kerf, the cut edge shows crisp bright end grain. Simple work gloves or bare hands, no visible face.
Camera: first-person, eye height looking down at about 40 degrees onto the bench, 35 mm lens, shallow depth of field on the background only, board and saw tack sharp.
Light: warm late-afternoon sun from a window on the left, a soft warm light spot on the bench, cool blue-grey shadows under the board.
Material: spruce board with clear grain and small knots, oak workbench top with scratches and glue marks, steel saw blade with fine teeth and subtle reflections, yellow tape measure with millimeter markings.
Style: stylized-realistic 3D game art, crisp clean edges with small bevels, believable PBR materials, warm late-afternoon sunlight, honey and walnut tones with cool blue-grey shadows, calm and tidy, high detail on tools, simple background. Color palette: #1F1A15, #8E5D33, #C58F55, #E3C08D, #F3E9DC, #D9A35B.
Format: 16:9 landscape.
No text, no logos, no watermark, no people's faces, no brand names. Concept art, not a screenshot.
```

### K3 – Smartphone-Touch-Steuerung
Zweck: Wie das Spielbild mit Bedienelementen auf dem iPhone (quer) wirkt.
```
Subject: a modern smartphone held horizontally in two hands, the screen shows a first-person workshop game: a spruce board on a workbench, a round magnifier loupe showing a millimeter scale, a simple step bar at the top (three pill-shaped tabs), a large measurement readout at the bottom center, round and rounded-rectangle buttons in the lower left and lower right corners, a small hold button under the left thumb. UI panels are dark brown, semi-transparent, with thin amber outlines and rounded corners; calm, minimal, readable.
Camera: over-the-shoulder close-up of the phone in landscape orientation, slightly from above, phone screen fills most of the frame, thumbs visible at the edges.
Light: warm late-afternoon light in a real room, soft reflections on the phone glass, screen bright and readable.
Material: phone with thin dark bezels; game image inside with wood and steel in warm tones.
Style: stylized-realistic 3D game art, crisp clean edges with small bevels, believable PBR materials, warm late-afternoon sunlight, honey and walnut tones with cool blue-grey shadows, calm and tidy, high detail on tools, simple background. Color palette: #1F1A15, #8E5D33, #C58F55, #E3C08D, #F3E9DC, #D9A35B.
Format: 16:9 landscape.
No text, no logos, no watermark, no people's faces, no brand names. Concept art, not a screenshot.
```

### K4 – Auftrag und Inventar
Zweck: Ruhige, handwerkliche UI für Aufträge und Lager.
```
Subject: game user interface screen for a craft workshop game in landscape orientation: on the left a dark semi-transparent panel with two tabs; one tab shows a grid of inventory slots with simple 3D icons (spruce board, oak board, hand saw, tape measure, sandpaper, screws, clamp) each with a small count badge; the other side shows two job cards pinned like paper notes with a customer silhouette icon, a small sketch of a wall shelf, a coin icon for the reward and a quality star rating. On the right the blurred workshop is still visible behind the panel.
Camera: straight-on flat UI view, no perspective distortion.
Light: UI evenly lit; background workshop in warm late-afternoon light, out of focus.
Material: UI panels dark brown (#1F1A15) at 88 % opacity, thin amber outlines (#D9A35B), rounded corners, paper job cards in warm off-white (#F3E9DC), icons rendered as small clean 3D objects.
Style: stylized-realistic 3D game art, crisp clean edges with small bevels, believable PBR materials, warm late-afternoon sunlight, honey and walnut tones with cool blue-grey shadows, calm and tidy, high detail on tools, simple background. Color palette: #1F1A15, #8E5D33, #C58F55, #E3C08D, #F3E9DC, #D9A35B.
Format: 16:9 landscape.
No text, no logos, no watermark, no people's faces, no brand names. Concept art, not a screenshot.
```

### K5 – Fasanenfeld
Zweck: Stimmung des späteren Outdoor-Moduls (Phase 4), gleiche Lichtsprache wie die Werkstatt.
```
Subject: rural harvested field edge in late autumn with stubble, a hedgerow and a strip of tall grass; a male common pheasant with copper plumage and a red face just flushing up from the grass; a hunting dog (German shorthaired pointer) pointing in the foreground grass; in the distance a small wooden barn workshop and a reed-lined lake. First-person hunter's perspective, the barrel of a side-by-side shotgun barely visible at the lower edge, held safely pointing at the sky.
Camera: first-person at standing eye height, 35 mm lens, wide view over the field, pheasant in the upper third.
Light: golden hour, low sun from behind the hedgerow, long shadows, warm haze, cool blue-grey shadows.
Material: dry stubble and grass with readable blades, oiled walnut gun stock, glossy iridescent pheasant feathers, short-haired dog coat.
Style: stylized-realistic 3D game art, crisp clean edges with small bevels, believable PBR materials, warm late-afternoon sunlight, honey and walnut tones with cool blue-grey shadows, calm and tidy, high detail on tools, simple background. Color palette: #1F1A15, #8E5D33, #C58F55, #E3C08D, #F3E9DC, #D9A35B.
Format: 16:9 landscape.
No text, no logos, no watermark, no people's faces, no brand names, no blood, no gore. Concept art, not a screenshot.
```

---

## Die übrigen 7 Ansichten aus §15 (Kurzprompts, erst in der jeweiligen Phase)

An jeden Kurzprompt den Stil-Baustein A anhängen.

Z6 – Metallbearbeitung (Phase 3)
```
First-person view at a steel workbench: left hand holds a steel angle bracket in a bench vise, right hand files a burr off the cut edge, fine metal filings, a center punch and a hacksaw nearby, warm sun from a window, 16:9 landscape. No text, no logos. Concept art, not a screenshot.
```

Z7 – 3D-Druck-Arbeitsstation (Phase 3)
```
Close-up of a tidy desktop 3D printer on a wooden shelf in a craft workshop, printing a small green wall hook layer by layer, filament spool on top, a few finished printed parts and a caliper on the shelf, warm afternoon light, 16:9 landscape. No text, no logos. Concept art, not a screenshot.
```

Z8 – Skill-Tree Handwerk (Phase 2)
```
Game UI concept in landscape: a craft skill tree drawn like branches burned into a wooden board, round nodes with small tool icons (saw, tape measure, drill, file, 3D printer), unlocked nodes glowing amber, locked nodes dark, dark brown semi-transparent panel, calm and readable, 16:9. No text, no logos. Concept art, not a screenshot.
```

Z9 – Ländliche Spielwelt mit Werkstatt und See (Phase 4)
```
Elevated wide view of a small rural property: a wooden barn workshop with open doors, a garden, a gravel path down to a calm reed-lined lake with a small rowing boat and a jetty, fields and hedgerows behind, golden hour, 16:9 landscape. No text, no logos. Concept art, not a screenshot.
```

Z10 – Entenjagd am See (Phase 4)
```
First-person view from a reed hide at a misty lake at dawn, a few wooden decoy ducks on the water, a pair of mallards approaching low over the water, a retriever dog waiting calmly beside the hide, cool morning light with warm sunrise glow, 16:9 landscape. No text, no logos, no blood. Concept art, not a screenshot.
```

Z11 – Jagdhund-System (Phase 5)
```
Third-person view of a German shorthaired pointer in the field responding to hand signals, three simple round command icons floating at the lower right (search, heel, fetch), the dog alert and pointing, golden hour, 16:9 landscape. No text, no logos. Concept art, not a screenshot.
```

Z12 – Beispiel Erweiterungspaket (Phase 6)
```
Key art for a game expansion "boat building": a half-built wooden rowing boat upside down on trestles inside the barn workshop, steamed oak ribs, clamps, plank stacks, the lake visible through the open barn doors, warm afternoon sun, 16:9 landscape. No text, no logos. Concept art, not a screenshot.
```
