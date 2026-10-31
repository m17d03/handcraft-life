# Steuerungskonzepte A und B (Ticket 003)

Status: **Konzept** · Autor: mobile-ux · Grundlage: `docs/MASTER_PROMPT.md` §11, §15 Nr. 3 und 7,
Skill `touch-steuerung`.

Mockups (antippbar, iPhone quer): https://m17d03.github.io/handcraft-life/konzepte/steuerung/
Quelle: `public/konzepte/steuerung/` · Bilder: `public/konzepte/steuerung/screenshots/`
Alle Bilder und Mockups: **Konzeptbild – kein Spielscreenshot.** Die Mockups sind reine
DOM-Attrappen (keine 3D-Engine); sie prüfen Bedienung, Feedback und Platzbedarf, nicht Grafik.

## 1. Gemeinsame Grundlage (beide Konzepte)

- **Format:** Querformat 852 × 393 pt (iPhone 15). Layout funktioniert auch im Safari-Fenster
  mit Leiste (734 × 343 pt) geprüft.
- **Zonen:** linke Bildhälfte = Gehen, rechte Bildhälfte = Umsehen/Objekte. Die äussersten
  20 pt links und rechts (zusätzlich zur Safe Area) sind tot, damit Safaris Zurück-Wischgeste
  nicht ausgelöst wird.
- **Safe Areas:** alle HUD-Elemente über `env(safe-area-inset-*)` versetzt (Notch quer ≈ 59 pt,
  Home-Leiste ≈ 21 pt). Mockup-Parameter `?notch=1` simuliert diese Werte in Desktop-Browsern.
- **Kein Seiten-Zoom:** `user-scalable=no`, `touch-action: none`, `gesturestart` und
  `touchmove` werden unterdrückt (ausser in scrollbaren Panels).
- **Touch-Ziele:** alle Tasten ≥ 44 × 44 pt (geprüft per Skript), Haupttasten 56–104 pt.
  Text ≥ 15 pt, heller Text auf dunklem Panel (WCAG AA).
- **Werkbank-Arbeitsansicht ist in A und B identisch** (bewusst: der teuerste und wichtigste
  Teil der Steuerung wird nur einmal gebaut; die Konzepte unterscheiden sich beim Erkunden).

## 2. Konzept A – Hybrid (Third-Person + Ich-Sicht an der Werkbank)

### Gesten-Tabelle

| Geste | Aktion | Feedback (≤ 100 ms) |
|---|---|---|
| Linke Hälfte: Daumen aufsetzen + ziehen | Figur geht (analog, Richtung relativ zur Kamera) | Stick-Ring + Knopf erscheinen sofort unter dem Daumen; Figur wippt und neigt sich |
| Rechte Hälfte: ziehen | Kamera kreist um die Figur (Gieren/Neigen) | Finger-Punkt folgt; Bild dreht sich mit |
| Rechte Hälfte: zwei Finger spreizen/zusammen | Kameraabstand näher/weiter | Beschriftung „Kameraabstand n %“ |
| Objekt in Reichweite (vor der Figur) | wird Ziel | Umriss leuchtet, Namensschild, runde Aktionstaste erscheint rechts |
| Objekt antippen | Ziel manuell wählen | Umriss + Hinweis „… ausgewählt“ |
| Objekt halten 300 ms | Kontextmenü (Benutzen, Ansehen, Aufnehmen …) | Fortschrittsring ab dem ersten Frame, Menü nach 300 ms |
| Aktionstaste (88 pt) | Hauptaktion des Ziels | Taste skaliert sofort (gedrückt) |
| „Werkbank benutzen“ | Kamera fährt automatisch in Ich-Sicht, Arbeitsansicht | Zoom + Einblendung „Kamera wechselt automatisch: Ich-Sicht“ |
| „‹ Zurück“ | zurück zur Third-Person | Einblendung „Kamera: Third-Person“, Figur wieder sichtbar |
| „Tasche“ oben links | Panel Inventar/Aufträge | Panel fährt in 160 ms ein |

### Kamera- und Moduswechsel
Erkunden = Third-Person (Schulterkamera, Abstand per Pinch). An der Werkbank automatischer
Wechsel in die Ich-Sicht-Arbeitsansicht; Gehen ist dort aus. Verlassen nur über die sichtbare
Zurück-Taste. Kamerakollision mit Wänden in der Werkstatt ist ein eigenes Thema (enger Raum!).

### Aufwand
- Spielfigur: Modell, Rig, mind. Idle/Gehen/Laufen/Drehen/Greifen, Übergänge (Blend-Tree),
  Fussplatzierung auf unebenem Boden: **L**, plus laufende Kosten für jede neue Tätigkeit
  (Angeln, Boot, Hund führen braucht eigene Animationen).
- Third-Person-Kamera mit Kollision, Verdeckung, Kamerafahrt zur Werkbank: **M**.
- Gesamtsteuerung A (ohne Werkbank-Modus): **L**; Werkbank-Modus wie B: **M**.

### Risiken
- Figur und Animationen dominieren den Aufwand des Vertical Slice, ohne das Handwerk zu verbessern.
- Third-Person-Kamera in einer kleinen Werkstatt: Wände verdecken, Kamera springt.
- Zwei Kamera-Logiken = doppelte Tests; Übergang kann bei 30 fps ruckeln.
- Figur kostet Draw Calls und Dreiecke (Skinning auf Mobil-GPU).

## 3. Konzept B – durchgehend Ich-Sicht

### Gesten-Tabelle

| Geste | Aktion | Feedback (≤ 100 ms) |
|---|---|---|
| Linke Hälfte: Daumen aufsetzen + ziehen | Gehen (vor/zurück/seitlich) | Stick erscheint sofort unter dem Daumen; Bild bewegt sich |
| Rechte Hälfte: ziehen | Umsehen | Finger-Punkt folgt; Bild dreht sich mit |
| Rechte Hälfte: zwei Finger | „Genau hinsehen“ (Sichtfeld enger) | Beschriftung „Genau hinsehen n %“ |
| Fadenkreuz auf Objekt | wird Ziel | Fadenkreuz wächst und färbt sich, Umriss, Aktionstaste erscheint |
| Objekt antippen | Ziel direkt wählen, ohne zu zielen | Umriss + Hinweis |
| Objekt halten 300 ms | Kontextmenü | Fortschrittsring sofort, Menü nach 300 ms |
| Aktionstaste (88 pt) | Hauptaktion | Taste gedrückt |
| „Werkbank benutzen“ | Kamera zoomt in die feste Arbeitsansicht | Zoom + „Arbeitsansicht“ |
| „‹ Zurück“ | zurück zum Gehen | Ansicht zoomt heraus |
| „Tasche“ | Inventar/Aufträge | Panel fährt ein |

### Kamera- und Moduswechsel
Eine Kamera; die Werkbank ist nur eine feste Kameraposition. Kein Figurenmodell, höchstens
Hände/Werkzeug im Bild (für Werkbank ohnehin nötig).

### Aufwand
- Ich-Sicht-Steuerung + Zielerfassung: **S–M**. Werkbank-Modus: **M** (identisch zu A).
- Keine Figur, keine Gehanimationen. Hände/Werkzeug-Animationen nur dort, wo gearbeitet wird.

### Risiken
- Motion Sickness bei schnellem Umsehen → Empfindlichkeit einstellbar, leichte Glättung, kein Kopfwippen.
- Weniger „Ich sehe meine Figur in der Welt“ – Atmosphäre muss aus Licht und Werkstatt kommen.
- Outdoor (Boot, Hund, Jagdfeld) wirkt in reiner Ich-Sicht ggf. eng → dort später A prüfen.

## 4. Werkbank-Interaktion (A und B gleich)

Schritte oben als Leiste „1 Messen · 2 Anzeichnen · 3 Sägen“, Auftrag darunter.

| Geste | Aktion | Feedback (≤ 100 ms) |
|---|---|---|
| Massband-Griff (56 × 72 pt) ziehen | Massband ausziehen (Grobmass) | Griff leuchtet, Lupe neben dem Daumen zeigt Skala 8 pt/mm mit Nadel, Messwert unten mittig |
| „−1 mm“ / „+1 mm“ (links unten, linker Daumen) | Feinstellen | Wert ändert sich, Lupe blendet 0,7 s ein, „✓ passt“ bei Zielmass |
| „✎ Anzeichnen“ (rechts unten) | Strich auf dem Balken | Strich + Kreuz, Hinweis „Angezeichnet bei n mm – jetzt sägen“ |
| Rechte Fläche: auf und ab wischen | Säge führen; jeder Richtungswechsel = ein Zug | Säge folgt dem Finger, Sägemehl je Zug, Schnitttiefe wächst |
| Beim Wischen seitlich abdriften/gegensteuern | Schnitt läuft vom Strich weg / zurück | Anzeige „Strich“ (grün–rot), Sägeblatt färbt sich rot über 1,5 mm |
| Zu schnell wischen (> 2,2 pt/ms) | Zug zählt nicht | „Zu schnell – die Säge hakt“ |
| „Balken festhalten“ (96 pt, linker Daumen halten) | Balken ruhig | Taste gefüllt; ohne Halten wackelt der Schnitt („Balken wackelt – links festhalten“) |
| Schnitt fertig | Reststück fällt ab, Ergebnis | Karte: Länge, Abweichung, Qualität, „Nochmal“ / „Zur Werkstatt“ |

Begründung Lupe + ±1 mm: Auf einem 1000-mm-Balken über ~620 pt ist 1 mm < 1 pt; der Daumen
deckt ~10 mm ab. Millimeter-Genauigkeit gelingt nur mit Lupe neben dem Daumen und Feintasten.
Qualitätsstufen im Mockup (≤ 1 / ≤ 2 / ≤ 4 mm) sind Platzhalter bis Ticket 002.

Offen für Ticket 002: Zählt Sägen als Rhythmus (Takt) oder nur Strecke? Soll Abdrift
automatisch durch „Festhalten“ begrenzt werden oder nur zufälliges Wackeln entfernen (Mockup)?

## 5. Inventar und Aufträge (A und B gleich)

„Tasche“ oben links öffnet ein Panel von links (max. 72 % Breite, Spielbild rechts bleibt
sichtbar). Reiter „Inventar“ (Raster aus 88-pt-Feldern mit Anzahl) und „Aufträge“ (Karte:
Titel, Auftraggeber, Lohn, Mindestqualität, „Annehmen“/„✓ Aktiv“). Der aktive Auftrag
erscheint in der Werkbank-Kopfzeile und bestimmt das Zielmass. Getragene Gegenstände zeigt
ein Chip „In der Hand: …“ mit „Ablegen“ (Greifen und Platzieren: Aufnehmen über Kontextmenü
oder Aktionstaste, Ablegen über Chip oder automatisch an der Werkbank).

## 6. Jagd-Interaktion (nur skizziert)

| Situation | A (Third-Person) | B (Ich-Sicht) |
|---|---|---|
| Durchs Feld gehen, Hund lenken | Figur + Hund sichtbar, Hund-Befehle als 3 Kontexttasten rechts (Such / Bei Fuss / Apport) | gleiche Tasten, Hund nur vor sich sichtbar |
| Vogel steigt auf | Kamera zieht automatisch über die Schulter | — |
| Anschlagen + Zielen | Halten der Aktionstaste = Anschlag; rechter Daumen zielt (Kamerasteuerung mit reduzierter Empfindlichkeit) | identisch |
| Abdrücken | Loslassen der Aktionstaste (verhindert versehentliches Auslösen beim Tippen) | identisch |
| Sicherheit | Gewehr gesichert, solange Hund/Person im Schussfeld (Taste gesperrt + Hinweis) | identisch |

Jagd braucht in A die Figur mit Gewehr-Animationen (Gehen mit Gewehr, Anschlag) – zusätzlich **L**.

## 7. Displaygrössen
Layout aus Ecken verankert (Safe Area + feste pt-Abstände), Mittelteile relativ. Geprüft mit
852 × 393 (Vollbild/Home-Bildschirm) und 734 × 343 (Safari mit Leiste). Kleinere Geräte
(iPhone SE quer 667 × 375) sind nicht geprüft: Mess-/Sägeflächen werden schmaler, Lupe bleibt nötig.

## 8. Empfehlung

**Primäres Spielformat: Querformat.** Zwei Daumen gleichzeitig (Gehen + Umsehen, Festhalten +
Sägen) brauchen die Breite; der Balken als Hauptobjekt ist horizontal, und 3D-Szenen nutzen
das 19,5:9-Bild quer besser. Hochformat wird im Vertical Slice nicht unterstützt (Hinweis
„Bitte quer halten“) – das braucht laut Regel eine **Architekturentscheidung (ADR)** durch den
Director. Inventar/Aufträge könnten später auch hochkant bedienbar sein.

**Konzept für den Vertical Slice: B (durchgehend Ich-Sicht).** Es spart Figur, Rig,
Gehanimationen und Third-Person-Kamera (zusammen ca. L) und steckt den Aufwand in die
Werkbank-Bedienung, die in beiden Konzepten gleich ist und den Kern des Spiels bildet. A wird
neu bewertet, wenn das Outdoor-Modul (Hund, Boot, Jagd) kommt; da der Werkbank-Modus identisch
ist, verliert man durch B jetzt nichts.

## 9. Nur auf dem echten Gerät prüfbar (Gerät)

- (Gerät) Daumengefühl: Stick-Radius 50 pt, Umseh-Empfindlichkeit, Sägewisch-Rhythmus.
- (Gerät) Ob Safaris Rand-Wischgeste (Zurück) trotz 20-pt-Totzone und `touch-action: none` auslöst.
- (Gerät) Ob Pinch und Doppeltippen die Seite trotz Unterdrückung zoomen (iOS ignoriert `user-scalable=no` teils).
- (Gerät) Echte Safe-Area-Werte quer, Notch links und rechts, Home-Leiste unten.
- (Gerät) Querformat im Safari-Fenster (Adressleiste) vs. vom Home-Bildschirm.
- (Gerät) Verdeckt der Daumen die Lupe? (Lupe sitzt links neben dem Griff.)
- (Gerät) Festhalten links + Sägen rechts gleichzeitig: ermüdend? Fehlauslösungen?
- (Gerät) Feedback-Latenz real (im Test: Stick nach < 100 ms im DOM, Chromium-Emulation).
- (Gerät) Wirkung von reiner Ich-Sicht auf Übelkeit bei längerem Spielen (erst mit 3D prüfbar).

## 10. Prüfung der Mockups (Chromium-Emulation, nicht WebKit)

Playwright 1.64 mit Chromium (`/opt/pw-browsers/chromium`), Profil „iPhone 15 landscape“ mit
Viewport 852 × 393 und `?notch=1`; WebKit ist in der Cloud-Umgebung nicht installierbar.
Touch-Ereignisse per CDP (Mehrfinger). 25 Prüfungen grün: Stick am Aufsetzpunkt < 100 ms,
Stick + Umsehen gleichzeitig, Randzone ignoriert, Nähe-Ziel A, Pinch-Feedback, Halte-Ring
sofort und Kontextmenü nach 300 ms, Lupe, ±1 mm auf 450 mm, Anzeichnen → Sägen, Festhalten +
Sägen (zwei Finger) bis Ergebnis, Zurück, Aufträge-Tab, alle sichtbaren Tasten ≥ 44 pt,
Hochformat-Hinweis, Übersicht hochkant ohne Querscrollen; keine JS-Fehler. Das Prüfskript liegt
bewusst nicht im Repo (reine Konzeptphase); Gesten-Tests für das echte Spiel kommen mit dem
Implementierungs-Ticket in `tests/` mit WebKit.

Hinweis Technik: Das Mockup-Skript ist in `a-hybrid.html` und `b-ich-sicht.html` identisch
eingebettet, weil `npm run lint` (typgeprüftes ESLint über `.`) jede `.js`-Datei unter `public/`
erfasst und daran scheitert. Will man es auslagern, muss `public/konzepte/` in die
ESLint-Ignore-Liste (Director-Entscheid, ausserhalb dieses Tickets).
