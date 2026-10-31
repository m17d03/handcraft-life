# Mechanik-Entwurf: Holz – Brett ablängen (Vertical Slice 0.1)

Status: **Konzept** · Ticket 002 · Methode: Skill `mechanik-entwurf` · Autor: game-designer

Kennzeichnung: **[B]** bestätigt (reales Handwerkswissen / Fakt) · **[P]** plausibel (Einschätzung) ·
**[H]** Hypothese (muss im Playtest auf dem iPhone geprüft werden).

## 0. Umfang in einem Satz

Der Spieler sägt aus einem Rohbrett ein Regalbrett auf Mass (Ablängen, Querschnitt mit Handsäge),
bekommt eine nachvollziehbare Qualitätsnote, liefert es für Geld ab, und alles bleibt gespeichert.

| Im Slice | Nicht im Slice (Grund) |
|---|---|
| 1 Rohbrett Fichte 2000 × 140 × 18 mm | Längsschnitt/Auftrennen: schwer per Touch zu führen, lang und monoton |
| 1 Handsäge (Fuchsschwanz) | Winkel als eigenes Werkzeug: Strich wird automatisch rechtwinklig angerissen |
| Massband + Bleistift (ein Schritt "Anreissen") | Schleifen, Bohren, Kanten brechen: Phase 2 |
| 1 Auftrag "Regalbrett 600 mm ± 1 mm", danach endlos neue Längen | Holzarten, Feuchte, Werkzeugverschleiss |

Hinweis zur Benennung: Der Plan spricht von "Balken". Ein echter Balken müsste erst längs aufgetrennt
werden. Vorschlag: Rohmaterial ist ein **Rohbrett** (Fichte, gehobelt) – es wird nur abgelängt. **[B]**

## 1. Realer Ablauf (wie ein Schreiner es macht)

1. Auftrag lesen: Länge, Toleranz, Verwendung.
2. Brett prüfen: Risse an den Enden (Endrisse), Äste, ist das Werksende rechtwinklig?
3. Bezugskante/-ende wählen; falls nötig zuerst ein paar mm **kappen** (Ende sauber und rechtwinklig machen).
4. Brett auf Werkbank legen und einspannen (Zwinge).
5. Messen vom Bezugsende, Mass mit Bleistift anzeichnen.
6. Mit Anschlagwinkel einen rechtwinkligen Strich anreissen; Abfallseite mit "X" markieren.
7. Säge **auf der Abfallseite** der Linie ansetzen (Schnittfuge geht in den Abfall). **[B]**
8. Anschnitt: einige kurze, leichte Züge, bis die Säge geführt ist.
9. Durchsägen: viele gleichmässige Züge, Blatt senkrecht und auf der Linie halten.
10. Gegen Ende langsamer, Abfallstück stützen, damit die Unterkante nicht ausreisst. **[B]**
11. Ergebnis nachmessen (Länge, Winkel), Kante prüfen.
12. Ggf. nacharbeiten (zu lang: nachschneiden/hobeln; zu kurz: nicht reparierbar). **[B]**
13. Späne wegfegen, Reststück einlagern, Werkstück abliefern.

## 2. Jeden Schritt einordnen

| # | Schritt | Entscheidung? | Fehler möglich? | Monoton? | Im Spiel |
|---|---|---|---|---|---|
| 1 | Auftrag lesen | ja (annehmen?) | nein | nein | **simulieren** (Auftragskarte) |
| 2 | Brett prüfen | ja (welches Ende taugt) | ja (Riss übersehen) | nein | **simulieren**: Lupe zeigt Endriss |
| 3 | Bezugsende / Kappen | ja | ja | nein | **simulieren**: Ende wählen, optional Kappschnitt |
| 4 | Einspannen | nein | kaum | ja | **automatisch** (Zwinge schnappt zu, 0,5 s) |
| 5 | Messen + Anzeichnen | ja (Mass, Bezug) | ja (Ablesefehler, Fuge vergessen) | nein | **simulieren**, Raster 0,5 mm |
| 6 | Winkel anreissen | nein (im Slice) | ja (real) | nein | **verdichten**: Strich automatisch rechtwinklig |
| 7 | Säge ansetzen (Seite der Linie) | **ja – Kernentscheidung** | ja | nein | **simulieren** |
| 8 | Anschnitt | Können | ja (Abrutschen) | nein | **simulieren**: erster Zug, Lenkung wirksam |
| 9 | Durchsägen (20–40 Züge real) | Können (Führung) | ja (Drift → schief) | **ja** | **verdichten**: 8 Züge, jeder Zug = Lenk-/Tempo-Entscheidung |
| 10 | Langsam am Ende | ja (Timing) | ja (Ausriss) | nein | **simulieren**: Tempo der letzten 2 Züge |
| 11 | Nachmessen | nein | nein | nein | **automatisch** (2-s-Animation + Ergebniskarte) |
| 12 | Nacharbeit | ja | ja | nein | **simulieren** nur "Nachschnitt" (Überlänge ≥ 3 mm) |
| 13 | Aufräumen, Einlagern | nein | nein | ja | **automatisch** (Reststück ins Lager) |

Keine Phase dauert ohne neue Entscheidung länger als ca. 5 s. Ziel-Dauer eines Auftrags: **90–150 s**. **[H]**

## 3. Touch-Umsetzung (Annahmen – Details liefert mobile-ux, Ticket 003)

Grundannahme: First-Person an der Werkbank, Kamera fährt pro Schritt automatisch in eine feste
Arbeitsansicht. Kein freies Umschauen während des Sägens.

| Schritt | Ein Daumen (hoch) | Zwei Daumen (quer) | Feedback |
|---|---|---|---|
| Brett prüfen | Tippen auf Brettende → Lupe | gleich | Lupe zoomt auf Hirnholz, Riss sichtbar |
| Bezugsende wählen | Tippen auf Ende → Massband-Haken springt dort an | gleich | Haken-Klick-Sound, Ende hervorgehoben |
| Messen | Daumen zieht Markierung entlang des Massbands | rechts ziehen, links Lupe halten/zoomen | Lupe mit Skala, Zahl (Anfänger), Raster 0,5 mm |
| Anreissen | Tippen "Anreissen" | gleich | Bleistiftstrich erscheint, Kratzton |
| Säge ansetzen | Blatt in der Lupe seitlich ziehen (±3 mm) | gleich | Schnittfugen-Schatten (Anfänger) neben Linie |
| Sägen | Daumen wischt auf einer Führungsspur hin und her; 1 Hin+Her = 1 Zug | rechts sägen, links optional "Abfall stützen" halten | Fuge wächst, Sägegeräusch im Takt, Blatt neigt sich bei Abweichung |
| Ende langsamer | langsamer wischen (Tempo-Balken wird grün) | gleich | Ton tiefer, Tempo-Balken |
| Ergebnis | Tippen "Weiter" | gleich | Ergebniskarte mit Begründung |

Haptik: Nach meinem Kenntnisstand unterstützt iOS Safari die Vibration-API nicht. Feedback daher nur
visuell + Ton. **[P]** – mobile-ux prüft.

## 4. Qualität und Folgen

### 4.1 Wie das Ergebnis entsteht (Simulation)

Längen (in mm, gemessen vom Bezugsende entlang der Brettmitte):

```
Ist-Länge  = Markierung + Blattversatz − Fuge/2 + Bezugsfehler
Blattversatz = Mitte des Sägeblatts relativ zur Linie, + = Richtung Abfall
Fuge       = 1,6 mm (Fuchsschwanz) | 0,8 mm (Feinsäge, Upgrade)          [P]
Bezugsfehler = 0 am sauberen/gekappten Ende; am unbearbeiteten Werksende −2…+2 mm
               (zufällig pro Brett, im Spielstand fix, in der Lupe als schiefes Ende erkennbar)
```

| Blattposition | Ergebnis bei Fuge 1,6 mm |
|---|---|
| Blattkante bündig an der Linie, Abfallseite (Versatz +0,8) | ± 0 mm – richtig |
| Blatt mittig auf der Linie (Versatz 0) | − 0,8 mm |
| Blatt auf der Werkstückseite (Versatz −0,8) | − 1,6 mm |

Winkel (Rechtwinkligkeit, in Grad):

```
pro Zug:  Drift += Seitenabweichung_des_Daumens (normiert −1..+1) × 0,35° × Werkzeugfaktor
Lenken:   Gegenlenken baut Drift ab – aber nur in den ersten 3 von 8 Zügen (danach führt die Fuge)  [B: Prinzip, H: Zahlen]
Winkelfehler Δα = |Drift| am Ende
Werkzeugfaktor: Fuchsschwanz 1,0 · Feinsäge 0,6
```

Ausriss (Unterkante):

```
Tempo der letzten 2 Züge > Grenzwert         → kleiner Ausriss (≤ 2 mm)
Tempo deutlich > Grenzwert (× 1,5)           → grosser Ausriss
"Abfall stützen" gehalten (nur quer)         → Grenzwert × 1,3 (Bonus, nicht Pflicht)
```

### 4.2 Qualitätsformel (0–100 Punkte)

```
ΔL = |Ist-Länge − Soll|   (mm)       Δα = Winkelfehler (Grad)

P_Länge  = 40 × clamp(1 − (ΔL − 0,5) / 4,5 , 0, 1)    → ≤ 0,5 mm voll, ≥ 5 mm null
P_Winkel = 30 × clamp(1 − (Δα − 0,3) / 2,7 , 0, 1)    → ≤ 0,3° voll, ≥ 3° null
P_Kante  = 20 sauber · 10 kleiner Ausriss · 0 grosser Ausriss
P_Holz   = 10 fehlerfrei · 5 Ast im Werkstück (optisch)
Q = P_Länge + P_Winkel + P_Kante + P_Holz
Sonderregel: Endriss im Werkstück → "Ausschuss", unabhängig von Q
```

| Stufe | Q | Preisfaktor | Kundenreaktion |
|---|---|---|---|
| A – Meisterhaft | ≥ 90 | 1,3 | "Sitzt perfekt." + Trinkgeld-Text |
| B – Sauber | 75–89 | 1,0 | "Passt." |
| C – Brauchbar | 55–74 | 0,7 | "Geht so, nächstes Mal genauer." |
| D – Mangelhaft | 35–54 | 0,4 | Kunde nimmt es widerwillig |
| Ausschuss | < 35 oder Endriss | 0 | Abliefern nicht möglich; Stück wird Reststück |

Zusätzlich gilt die **Auftragstoleranz**: Liegt ΔL ausserhalb (z. B. > 1 mm), ist höchstens Stufe C möglich.
Grund: Ein Regalbrett mit 3 mm Untermass klappert im Regal – der Kunde merkt das. **[P]**

Rechenbeispiele (geprüft):

| Fall | ΔL | Δα | Kante | Holz | Q | Stufe |
|---|---|---|---|---|---|---|
| Profi | 0,4 | 0,3° | sauber | ok | 100 | A |
| Gut, Blatt auf Linie | 0,8 | 0,5° | sauber | ok | 95 | A |
| Anfänger | 2,5 | 1,5° | klein | ok | 59 → Toleranz verletzt | C |
| Hastig, schief | 1,0 | 3,0° | gross | Ast | 41 | D |

### 4.3 Folgen und Weiterverwendung

- **Preis**: Basispreis × Preisfaktor (siehe `core-loop.md`, Wirtschaft).
- **Kundenzufriedenheit**: 3× Stufe ≥ B beim selben Kunden → Stammkunde (Wirtschaft-Skill W3).
- **Reststücke**: bleiben mit echter Länge im Lager. Reicht ein Rest (≥ Soll + 2 mm), kann er für den
  nächsten Auftrag genutzt werden → Materialeffizienz ist eine echte Entscheidung.
- **Weiterverwendung (Phase 2)**: Ein selbst gesägtes Brett Stufe ≥ B kann als Ablage in der eigenen
  Werkstatt montiert werden (ein Werkzeug-Slot mehr). Gibt Qualität einen Nutzen jenseits von Geld.

## 5. Lernkurve

| Stufe | Wann | Hilfen | Belohnung |
|---|---|---|---|
| Geführt | Auftrag 1–2 | Geisterhand zeigt jede Geste, Zahl im Massband, Fugen-Schatten, Drift-Anzeige, Hinweis "Abfallseite!" | Tutorial-Auftrag hat Toleranz ± 2 mm |
| Hinweise | ab Auftrag 3 | Zahl + Fugen-Schatten bleiben; Tipps nur nach Fehlern auf der Ergebniskarte | normal |
| Meister | opt-in ab Holz-Level 5 | keine Zahl (nur Skala), kein Fugen-Schatten, keine Drift-Anzeige | Preis × 1,1, XP × 1,25 |

Die Ergebniskarte nennt immer **die eine wichtigste Ursache** ("Blatt lag auf der Linie: −0,8 mm").

## 6. Spielerentscheidungen und Fehlerfälle

Entscheidungen: Auftrag annehmen · welches Brett/Reststück · Bezugsende · kappen ja/nein ·
Markierung · Blattseite · Lenken in den ersten Zügen · Tempo am Ende · nachschneiden ja/nein.

| Fehlerfall | Folge im Spiel | Reparierbar? |
|---|---|---|
| Blatt auf/neben der Linie (Fuge vergessen) | 0,8–1,6 mm zu kurz | nein |
| Vom rissigen/ungeraden Werksende gemessen | Endriss im Werkstück → Ausschuss bzw. Bezugsfehler 0–2 mm | nein |
| Zu lang ≥ 3 mm | Abzug, Option "Nachschnitt" (nur Sägeschritt, kein neues Messen) | ja |
| Zu lang < 3 mm | bleibt (zu wenig Material, damit die Säge greift) **[P]**; Phase 2: Schleifen | nein (im Slice) |
| Zu kurz > Toleranz | höchstens C; ab −5 mm Ausschuss für diesen Auftrag, Stück → Lager | nein |
| Schief geführt | Winkelpunkte sinken; ab 3° null | nein |
| Zu schnell am Ende | Ausriss an der Unterkante | nein |
| Finger verlässt Spur / hebt ab | aktueller Zug endet, kein Fortschritt, keine Strafe | – |
| App-Wechsel / Neuladen mitten im Schnitt | Brett ist wieder ungeschnitten, Markierung bleibt | – |
| Material reicht nicht, Geld < Rohbrettpreis | Händler gibt 1 Rohbrett "auf Anschreiben" (wird vom nächsten Verkauf abgezogen) → kein Softlock | – |

## 7. Datenmodell-Skizze (nur Felder; IDs gemäss Modulvertrag, Ticket 006)

```
Material (Stammdaten JSON)
  id: "core.wood.spruce_board_2000x140x18"   art: "fichte"   masse_mm: {l, b, d}
  preis: 12   fehler_wahrscheinlichkeit: {endriss: 0.5, ast: 0.3}

Werkstueck (Spielstand)
  id   materialId   laenge_mm   breite_mm   dicke_mm
  enden: { a: {winkel_grad, endriss_mm}, b: {...} }   aeste: [{pos_mm}]
  herkunft: "rohbrett" | "rest" | "schnitt"   qualitaet?: {q, stufe}

Werkzeug (Stammdaten)
  id: "core.tool.handsaw"   fuge_mm: 1.6   werkzeugfaktor: 1.0
  zuege_gesamt: 8   lenkbare_zuege: 3   tempo_grenze: <Wert aus Playtest>   preis: 0

Arbeitsschritt Schnitt (nur zur Laufzeit, nicht gespeichert)
  werkstueckId   bezugsende: "a"|"b"   markierung_mm   blattversatz_mm
  zuege: [{seitenabweichung, tempo}]   drift_grad   stuetzen: bool

Ergebnis (Spielstand, am Werkstück)
  laenge_ist_mm   delta_l_mm   delta_winkel_grad   ausriss: 0|1|2   endriss_enthalten: bool
  punkte: {laenge, winkel, kante, holz}   q   stufe   hauptursache: <Text-ID>

Auftrag (Spielstand)
  id   produktId: "core.product.shelf_board"   soll_mm   toleranz_mm   basispreis   kundeId   status

Spielstand (IndexedDB)
  version   geld   schulden   lager: [Werkstueck]   auftraege: [Auftrag]
  skills: {holz: {xp, knoten[]}, ...}   tutorial_stufe   einstellungen
```

Speicherpunkte: nach Anreissen, nach Schnitt, nach Abliefern, nach Kauf (Autosave, kein Speichern-Knopf).

## 8. Grundspiel vs. Erweiterung

| Grundspiel (Phase 1–2) | Mögliche Erweiterung (neue Mechanik, nicht nur Inhalt) |
|---|---|
| Ablängen mit Handsäge | **Gehrungsschnitt**: Winkel ist Ziel statt Fehler (Bilderrahmen) |
| Bohren, Schleifen, Schrauben/Leimen | **Hobeln** mit Faserrichtung (Ausriss bei falscher Richtung) |
| 1 Holzart | **Holzarten + Feuchte**: Schwinden, Risse über Zeit |
| Handwerkzeuge | **Kreissäge/Kappsäge**: Vorschub, Sicherheit, schneller aber teuer |
| – | **Holzverbindungen** (Zapfen, Schwalbenschwanz) |

## 9. Offene Fragen

An den Director:
1. Rohmaterial "Rohbrett" statt "Balken" für den Slice akzeptiert?
2. Messen mit Raster 0,5 mm (Messen = Entscheidung, nicht Fingerakrobatik) – oder freies Messen ohne Raster?
3. Gilt die Auftragstoleranz als Kappung der Stufe (wie oben) oder nur als Preisabzug?
4. Soll der Slice den Kappschnitt (zwei Schnitte pro Brett) schon enthalten, oder nur "Ende wählen"?
5. Zahlen (8 Züge, 0,35°/Zug, Tempo-Grenze) sind **[H]** – Freigabe als Startwerte, Feinjustierung nach Playtest?

An mobile-ux (Ticket 003):
1. Sägegeste: Hin-und-her-Wischen auf fester Spur – oder Halten + rhythmisches Ziehen? Spur senkrecht oder waagerecht?
2. Wie wird Seitenabweichung des Daumens gemessen, ohne dass der Daumen das Blatt verdeckt (Spur seitlich versetzt)?
3. Lupe beim Messen: automatisch beim Ziehen oder per zweitem Daumen? Wie in Hochformat einhändig?
4. Feinpositionierung Blatt (±3 mm): reicht ein Ziehen in der Lupe mit Untersetzung (z. B. 1:10)?
5. "Abfall stützen" im Querformat mit linkem Daumen – sinnvoll oder Überforderung? (Im Hochformat entfällt es; Tempo reicht.)
6. Haptik in iOS Safari: wirklich nicht verfügbar? Ersatz durch Ton/Bildschirm-Puls?
7. Ziel-Dauer 90–150 s pro Auftrag mit Einhand-Bedienung realistisch?
