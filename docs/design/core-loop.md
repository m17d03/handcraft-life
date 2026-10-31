# Kern-Loop, MVP, Skills, Wirtschaft

Status: **Konzept** · Ticket 002 · Autor: game-designer · Entwurf für GAME_VISION.md / GAME_DESIGN.md (Übernahme durch Director)

Kennzeichnung: **[B]** bestätigt · **[P]** plausibel · **[H]** Hypothese (Playtest auf iPhone nötig).
Alle Zahlen zu Preisen, XP und Dauer sind **[H]** – Startwerte für den ersten Playtest.

## Kernaussagen

- **MVP in einem Satz:** Eine kleine Holzwerkstatt in First-Person, in der man Kundenaufträge
  (Brett, Regal, Werkzeugkasten) mit echten Entscheidungen misst, sägt, bohrt, schleift und montiert,
  für die Qualität bezahlt wird und davon Werkzeuge kauft – offline, gespeichert, auf dem iPhone.
- **Loop in einem Satz:** Auftrag wählen → Material wählen → mit wenigen, entscheidenden Gesten fertigen
  → nachvollziehbare Qualitätsnote → Geld und XP → besseres Werkzeug und neue Baupläne → anspruchsvollerer Auftrag.

## 1. Loop in drei Zeitskalen

| Skala | Dauer | Ablauf | Motivation |
|---|---|---|---|
| **Minute** – Arbeitsschritt | 10–40 s | Werkstück prüfen → Entscheidung (Mass, Seite, Werkzeug) → Geste → sofortiges Feedback (Fuge, Ton, Lupe) | Können spüren, Fehler verstehen |
| **Sitzung** – Auftrag | 10–20 min | Auftragsbrett (2–3 Angebote) → Material kaufen/aus Lager → 2–8 Arbeitsschritte → Ergebniskarte → Abliefern → Geld + XP → evtl. Werkzeug kaufen | 4–8 Aufträge pro Sitzung, jede Sitzung bringt eine sichtbare Anschaffung |
| **Langfristig** | Wochen | Werkstatt-Ausbau (feste Slots: Ablage, Bohrer, 2. Werkbank, Metall-Ecke, Drucker) · Skill-Knoten · neue Baupläne · Freizeit (Jagd ab Phase 4) | Werkstatt füllt sich sichtbar mit selbst gebauten und gekauften Dingen |

Rhythmus: Arbeit in der Werkstatt, danach optional Freizeit. Kein Tageszwang, keine Echtzeit-Timer.
Ein "Arbeitstag" endet, wenn der Spieler will (Knopf "Feierabend": speichert, wechselt Licht auf Abend). **[P]**

## 2. MVP (Ende Phase 2) – max. 12 Punkte

Vorschlag: **MVP = Ende Phase 2**. Der Vertical Slice 0.1 (Phase 1) ist eine Teilmenge (Spalte VS).

| # | Funktion | VS 0.1 |
|---|---|---|
| 1 | Ein Werkstattraum, First-Person, Werkbank mit festen Werkzeug-Slots | ja |
| 2 | Touch-Steuerung nach Ticket 003 (ein Daumen hoch / zwei Daumen quer) | ja |
| 3 | Holz: Messen, Anreissen, Ablängen mit Handsäge (`holz-brett-zuschnitt.md`) | ja |
| 4 | Holz: Bohren (Position, Tiefe, Ausriss) | – |
| 5 | Holz: Schleifen (Körnung wählen, Überlänge bis 2 mm korrigieren) | – |
| 6 | Holz: Montage (Schrauben, Leimen, Reihenfolge) | – |
| 7 | 3 Produkte: Regalbrett, kleines Regal, Werkzeugkasten | nur Regalbrett |
| 8 | Auftragsbrett mit 2–3 Aufträgen (Mass, Toleranz, Basispreis, Kunde) | 1 Auftragstyp, wechselnde Längen |
| 9 | Qualitätsbewertung mit Ergebniskarte und Hauptursache | ja |
| 10 | Wirtschaft: Geld, Material- und Werkzeugkauf (4–5 Werkzeuge) | nur Verkauf + Rohbrett kaufen |
| 11 | Skill-Bereiche Holz (5 Knoten) + Wirtschaft (3 Knoten) | – (XP wird schon gezählt) |
| 12 | Autosave in IndexedDB, versioniert, als Web-App installierbar | ja |

Gekürzt gegenüber Master-Prompt: **Holzbank** gestrichen (bringt keine neue Mechanik gegenüber Regal). **[P]**

## 3. Bewusst ausgeschlossen (MVP)

| Funktion | Begründung |
|---|---|
| Multiplayer, Accounts, Cloud-Speicher | Laut Vision Singleplayer ohne Server; jede Serverlogik wäre Betriebsaufwand ohne Spielgewinn. |
| Monetarisierung, Shop, Werbung | Ausdrücklich ausgeschlossen; Hobbyprojekt. |
| Tägliche Belohnungen, Echtzeit-Wartezeiten | Widerspricht dem entspannten Rhythmus (Master-Prompt §4). |
| Third-Person-Spielfigur | Kostet Figur, Rig, Animationen; Werkstatt braucht nur First-Person (Plan Punkt 6). |
| Metall, 3D-Druck | Phase 3 – erst wenn die gemeinsamen Mess-/Säge-/Bohrsysteme im Holz bewiesen sind. |
| Jagd, Hund, Boot, Angeln | Phase 4+ – Tier-KI, Animation und Landschaft sind teurer als die ganze Werkstatt. |
| Längsschnitt, Hobeln, Holzverbindungen | Schwer per Touch, monoton bzw. eigene Erweiterung. |
| Holzarten, Feuchte, Werkzeugverschleiss | Mehr Parameter ohne neue Entscheidung im MVP. |
| Freies Bauen/CAD, frei platzierbare Möbel | Riesiger UI-Aufwand auf dem Handy; feste Slots reichen für sichtbaren Ausbau. |
| Bruch-/Splitterphysik, echte Spanbildung | Ergebnis wird regelbasiert berechnet und dargestellt; echte Physik ist teuer und nicht nötig. |
| Survival (Hunger, Schlaf), Tag-Nacht-Zyklus mit Zwang | Kein Bezug zur Kernidee Handwerk. |
| Maschinen mit Strom (Kreissäge etc.) | Erweiterung mit eigener Mechanik (Vorschub, Sicherheit) – nicht im MVP. |

## 4. Skill-System (erste Version)

Regeln:
- XP **nur aus aktiven Handlungen**: abgeschlossener Arbeitsschritt, abgelieferter Auftrag, erlegtes Wild nach Regeln.
  Keine XP für Zeit, Einloggen, Kaufen oder Warten.
- XP pro Arbeitsschritt = Basis-XP × (0,5 + Q/200) → gute Arbeit zählt bis doppelt, schlechte zählt trotzdem.
- Level-Schwelle: Level n → n+1 braucht 50 × n XP (Lv 2 nach ca. 7 Schnitten, Lv 5 nach ca. 60). **[H]**
- Ein Knoten schaltet frei, wenn **Level-Bedingung UND Handlungsbedingung** erfüllt sind – kein Punkteverteilen.
- Skills geben vor allem **Optionen und Information** (Baupläne, Werkzeuge, Anzeigen); Hand-Hilfen höchstens −15 %,
  damit das Können des Spielers zählt.
- UI zeigt nur Bereiche, die freigeschaltet sind (im MVP: Holz, Wirtschaft).

Typen nach Master-Prompt §10: **Fähigkeit** (F), **Werkzeugvoraussetzung** (W), **Bauplan** (B), **qualitative Verbesserung** (Q).

### Holzhandwerk (Phase 1–2)
| Knoten | Typ | Effekt | Freischaltung |
|---|---|---|---|
| H1 Scharfes Auge | F | Massband-Lupe zeigt 0,5-mm-Teilstriche deutlicher, Endrisse leuchten in der Lupe auf | Lv 2 |
| H2 Ruhige Hand | Q | Drift pro Sägezug −15 % | Lv 3 + 10 Schnitte mit Stufe ≥ B |
| H3 Regalbauer | B | Bauplan "Kleines Regal" | Lv 3 + Akku-Bohrer besitzen |
| H4 Holz lesen | F | Äste und Risse ohne Lupe sichtbar; Händler zeigt Brettqualität vor Kauf | Lv 4 + 5× ein fehlerhaftes Ende korrekt gekappt |
| H5 Meisterschnitt | Q | Meistermodus (keine Hilfen) mit Preis × 1,1, XP × 1,25; Bauplan "Werkzeugkasten" | Lv 5 + 5× Stufe A in Folge |

### Wirtschaft (Phase 2)
| Knoten | Typ | Effekt | Freischaltung |
|---|---|---|---|
| W1 Aushang | F | Auftragsbrett zeigt 3 statt 2 Angebote | 5 Aufträge abgeliefert |
| W2 Resteverwerter | F | Reststücke ≥ 200 mm als "Bastelholz" verkaufbar (1 G/100 mm) | 10 Aufträge aus Reststücken erfüllt |
| W3 Stammkunde | Q | Kunde mit 3× Stufe ≥ B zahlt +10 % | 3× Stufe ≥ B beim selben Kunden |
| W4 Mengenrabatt | Q | Material ab 3 Stück −10 % | Lv 3 Wirtschaft |
| W5 Werkstattschild | F | Laufkundschaft kauft Lagerware ohne Auftrag zu 80 % des Basispreises | Lv 5 + Werkstatt-Ausbau "Ablage" |

### Metallhandwerk (Phase 3, Skizze)
| Knoten | Typ | Effekt | Freischaltung |
|---|---|---|---|
| M1 Körnen | F | Körner verfügbar: Bohrer verläuft beim Anbohren nicht | Lv 1 (Tutorial) |
| M2 Zahnteilung | F | Sägeblattwahl fein/grob; passende Wahl = 2 Züge weniger | Lv 2 |
| M3 Entgraten | Q | Entgraten mit einer Geste pro Kante statt zwei | Lv 3 + 10 Teile entgratet |
| M4 Kühlen | Q | Bohrer überhitzt nicht bei Stahl (ohne: Qualitätsabzug) | Lv 3 + Schneidöl gekauft |
| M5 Halterungen | B | Bauplan "Werkzeugständer" (Metall-Holz) | Lv 4 + Holz Lv 3 |

### Additive Fertigung (Phase 3, Skizze)
| Knoten | Typ | Effekt | Freischaltung |
|---|---|---|---|
| A1 Erster Druck | B | Bauplan "Wandhaken" | Drucker gekauft |
| A2 Fein-Profil | F | Schichthöhe 0,12 mm wählbar (schöner, doppelte Druckzeit) | Lv 2 |
| A3 Erste Schicht | F | Haftungsproblem wird nach der 1. Schicht angezeigt → Abbruch spart Filament | Lv 2 + 3 Fehldrucke erlebt |
| A4 Werkstatthelfer | B | Bauplan "Werkzeughalter" (ein Werkbank-Slot mehr) | Lv 3 |
| A5 Funktionsteile | B | Baupläne für Teile, die in Holz-/Metallprodukten verbaut werden | Lv 4 + Holz Lv 3 |

### Jagd (Phase 4, Skizze)
| Knoten | Typ | Effekt | Freischaltung |
|---|---|---|---|
| J1 Ansprechen | F | Fernglas zeigt Art und Geschlecht (Fasan: nur Hahn frei) | Lv 1 (Pflicht-Tutorial) |
| J2 Windgefühl | F | Windanzeige; Wild bemerkt Spieler später bei Gegenwind | Lv 2 |
| J3 Ruhiger Anschlag | Q | Zielschwanken −15 % | Lv 3 + 10 regelkonforme Abgaben |
| J4 Entenlocker | W | Lockpfeife: Enten fallen näher ein | Lv 3 + Werkstatt-Bauplan "Lockente" gefertigt |
| J5 Hundeführer | F | Jagdhund-Modul verfügbar | Lv 4 + Hund-Modul installiert |

### Outdoor (Phase 4–5, Skizze)
| Knoten | Typ | Effekt | Freischaltung |
|---|---|---|---|
| O1 Leiser Schritt | Q | Fluchtdistanz −15 % beim langsamen Gehen | Lv 2 |
| O2 Spuren lesen | F | Federn/Spuren werden markiert | Lv 2 + 5 Spuren selbst gefunden |
| O3 Waldrand | F | Zweites Gebiet auf der Karte | Lv 3 |
| O4 Bootsführer | W | Boot nutzbar (Modul Boot) | Lv 4 + Boot gekauft oder gebaut |
| O5 Angler | F | Angeln Basis (Modul) | Lv 3 + Angel gekauft |

Querbezug: J4, M5, A5 verbinden Bereiche – Werkstatt liefert Ausrüstung für die Freizeit. **[P]**

## 5. Wirtschaft (Skizze)

| Grösse | Wert | Begründung |
|---|---|---|
| Startgeld | 40 G | reicht für 3 Rohbretter → kein Fehlstart möglich |
| Rohbrett Fichte 2000 × 140 × 18 | 12 G | ergibt 3 Regalbretter à 600 mm (+ Kapp- und Fugenverlust) |
| Basispreis | Materialkosten × 1,5 + Arbeitsschritte × 4 G | Arbeit wird bezahlt, nicht nur Material |
| Beispiel Regalbrett 600 mm | 4 × 1,5 + 2 × 4 = **14 G** | |
| Beispiel kleines Regal (Phase 2) | 24 × 1,5 + 10 × 4 = **76 G** | |

```
Verkaufspreis = runden( Basispreis × Preisfaktor(Stufe) × (1 + Boni) )
Preisfaktor:  A 1,3 · B 1,0 · C 0,7 · D 0,4 · Ausschuss 0
Boni:         Meistermodus +0,10 · Stammkunde +0,10  (max. +0,20)
```

Erste Anschaffungen (Richtwerte): Feinsäge 45 G · Schleifklotz 10 G · Zwingen-Set 30 G · Akku-Bohrer 120 G ·
Ablage-Ausbau 60 G · (Phase 3) Metallsäge 50 G · 3D-Drucker 400 G.
Erwartung: eine Sitzung (6 Regalbretter, Stufe B) ≈ 84 G Umsatz, ≈ 60 G Gewinn → **eine Anschaffung pro Sitzung**. **[H]**

Regeln:
- **Keine künstlichen Wartezeiten.** Material ist sofort da (Lager an der Wand). Lange Prozesse (3D-Druck, Leim trocknen)
  laufen, während der Spieler anderes tut, oder werden per "Zeit vorspulen" übersprungen – ohne Kosten.
- **Keine Monetarisierung**, keine Zweitwährung.
- **Kein Softlock:** Ist Geld < Rohbrettpreis und kein brauchbares Holz da, gibt der Händler ein Brett auf Anschreiben.
- **Keine Preis-Inflation mit dem Level:** Mehr Geld kommt aus komplexeren Produkten und besserer Qualität.

## 6. Offene Fragen an den Director

1. MVP = Ende Phase 2 (statt Phase 1) – einverstanden?
2. Holzbank aus dem Produktumfang streichen?
3. Skill-Freischaltung ohne Punkteverteilung (Level + Handlung) – einverstanden?
4. Währung: neutral "G" oder ein Name (z. B. "Taler")?
5. "Feierabend"-Knopf als Sitzungsende und Übergang zur Freizeit – gewünscht?
