# Playtest-Vorlage iPhone (Ticket 004)

Status: **Konzept** – Vorlage für `docs/playtests/<datum>-<meilenstein>.md` (Skill `iphone-playtest`).
Dauer: **unter 5 Minuten**. Antwort direkt im Chat, nur Zahlen/Buchstaben, Text nur wo verlangt.

## Teil A – an den Menschen (so verschicken)

> **Vorbereitung (1 Min.):** Link öffnen: `<LINK>?debug=1` (WLAN, Safari).
> Oben erscheint eine kleine Zeile mit **fps** und **max … ms** – die beiden Zahlen brauchen wir.
> Dann: 20 s herumgehen, 20 s umschauen, 20 s `<ARBEITSSCHRITT>`.
>
> 1. iPhone-Modell und iOS-Version? (Einstellungen → Allgemein → Info) – Safari oder Home-Bildschirm?
> 2. Wie viele Sekunden vom Antippen des Links, bis du steuern konntest? (grob zählen)
> 3. Beim **Gehen/Umschauen**: kleinste **fps**-Zahl und grösste **max ms**-Zahl, die du gesehen hast?
> 4. Beim **`<ARBEITSSCHRITT>`**: kleinste **fps** und grösste **max ms**?
> 5. Wie fühlt es sich an? **a** flüssig · **b** leicht ruckelig · **c** stark ruckelig
> 6. Reagiert jeder Fingertipp sofort, und liegt kein Knopf unter Kamera-Aussparung oder Home-Balken? **ja / nein** (+ was)
> 7. Ohne Erklärung verstanden, wie man geht, schaut und arbeitet? **1–5**
> 8. iPhone drehen (hoch ↔ quer) – passt alles und bleibt der Fortschritt? **ja / nein**
> 9. 30 s eine andere App öffnen, zurück; danach Seite neu laden – Fortschritt beide Male noch da? **ja/nein, ja/nein**
> 10. Wirkt das Bild scharf (keine Treppen an Kanten, kein Flimmern)? **1–5** – Fehlermeldungen in der Zeile oben oder Absturz? Gerät warm (**nein / etwas / stark**)? Was stört am meisten (ein Satz)?
>
> Antwort-Beispiel: `1) 13 Pro, iOS 18.1, Safari 2) 6 3) 31/45 4) 28/70 5) a 6) ja 7) 4 8) ja 9) ja,ja 10) 4, keine, etwas, Joystick zu klein`

## Teil B – Auswertung (Director / qa-performance)

| Frage | Kriterium (`docs/qa/quality-standards-entwurf.md`) | Erfüllt | Grenze verletzt |
|---|---|---|---|
| 2 | P9 Ladezeit | < 8 s | > 15 s |
| 3, 4 | P1 fps / P2 max ms | fps ≥ 30, max ≤ 50 ms | fps < 25 oder max > 100 ms |
| 5 | P1/P2 Gegenprobe Gefühl | a | c |
| 6 | U2 Feedback, U4 Safe Areas, U6 Störgesten | ja | nein |
| 7 | U7 Verständlichkeit | ≥ 4 | < 3 |
| 8 | U5 Hoch/Quer | ja | nein |
| 9 | S4 App-Wechsel, S2 Neuladen | ja, ja | ein nein |
| 10 | G4 Schärfe/AA, S1 Fehler, P11 Wärme (Hinweis) | ≥ 4, keine Fehler | < 3 oder Fehler/Absturz |

Regeln:
- Jede verletzte Grenze → Ticket (Skill `ticket-schreiben`), Stufe höchstens **Implementiert**.
- Zahlen widersprechen Gefühl (z. B. 30 fps, aber „c“) → nachfragen, ggf. Bildschirmaufnahme erbitten.
- Fragen 8–9 entfallen, solange es keinen Spielstand gibt (Phase 0); dann „–“ eintragen.
- Dauerlast (P11, S9: 10 min) nur im Meilenstein-Playtest als freiwilliger Zusatz, nicht in dieser Vorlage.
