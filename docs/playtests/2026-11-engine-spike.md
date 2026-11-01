# Playtest Engine-Spike (Ticket 005) – Checkliste iPhone

Status: **offen** – wird vom Menschen auf seinem iPhone ausgefüllt (Skill `iphone-playtest`,
Vorlage `docs/qa/playtest-vorlage.md`). Alle drei Szenen sind identisch; verglichen wird nur die Engine.
Dauer: ca. 3 × 5 Minuten (für die Hitze-Frage je Engine 5 Minuten laufen lassen).

## An den Menschen (so verschicken)

> iPhone **quer** halten, WLAN, Safari. Drei Links nacheinander öffnen, jeweils **5 Minuten**:
> 1. https://m17d03.github.io/handcraft-life/spikes/babylon/?debug=1
> 2. https://m17d03.github.io/handcraft-life/spikes/playcanvas/?debug=1
> 3. https://m17d03.github.io/handcraft-life/spikes/three/?debug=1
>
> In jeder Szene: linker Daumen = gehen (Kreis erscheint unter dem Daumen), rechter Daumen = umschauen.
> Den Holzbalken auf der Werkbank antippen (er leuchtet), dann **auf dem Balken** wischen: eine dunkle
> Schnittlinie folgt dem Finger, unten steht „Schnitt bei … mm“.
> Oben links stehen **fps** und **max … ms**.
>
> Pro Engine bitte antworten:
> a) Sekunden bis steuerbar · b) kleinste fps beim Gehen/Umschauen · c) grösste max ms ·
> d) Gefühl Touch (1–5) · e) Bild/Grafik (1–5) · f) nach 5 Min. warm? (nein/etwas/stark) ·
> g) kurz andere App öffnen, zurück – läuft es noch? (ja/nein) · h) Fehler in der grünen Zeile? (ja/nein)
>
> Optional: Kantenglättung vergleichen – an den Link `&aa=fxaa` anhängen (bei PlayCanvas ist das TAA)
> und sagen, ob die Kanten besser/gleich/schlechter wirken.
>
> Beispiel: `Babylon: a 4, b 41, c 60, d 4, e 4, f etwas, g ja, h nein`

## Ergebnisse (vom Director eintragen)

iPhone-Modell / iOS: ______ · Datum: ______

| Frage | Babylon.js | PlayCanvas | Three.js | Grenze (Entwurf QS) |
|---|---|---|---|---|
| a) Sekunden bis steuerbar | | | | < 8 s / ≤ 15 s (P9) |
| b) kleinste fps (Gehen/Umschauen) | | | | ≥ 30 / nie < 25 (P1) |
| c) grösste max ms | | | | ≤ 50 / ≤ 100 ms (P2) |
| d) Touch-Gefühl 1–5 | | | | ≥ 4 / ≥ 3 (U7) |
| e) Grafikeindruck 1–5 | | | | – |
| f) Hitze nach 5 min | | | | – (P11 Hinweis) |
| g) App-Wechsel überstanden | | | | ja (S4/S5) |
| h) Fehler im Overlay | | | | nein (S1) |
| optional: AA msaa vs. fxaa/taa | | | | – (G4) |

Danach Spalte „Echtes iPhone“ und „Grafikeindruck“ in `docs/spikes/engine-vergleich.md` füllen und
den ADR-Vorschlag `docs/decisions/0001-engine-wahl.md` entscheiden.
