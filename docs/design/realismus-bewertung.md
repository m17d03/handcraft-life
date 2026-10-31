# Realismus- und Machbarkeitsbewertung: Holz, Metall, 3D-Druck, Jagd

Status: **Konzept** · Ticket 002 · Autor: game-designer (Rolle Realism & Simulation)

Kennzeichnung: **[B]** bestätigt (reales Fachwissen oder Fakt) · **[P]** plausibel (Einschätzung) ·
**[H]** Hypothese (nur per Prototyp/Playtest prüfbar). Kein Punkt hier ist schon implementiert.

Aufwand (Arbeitssitzungen à 1–3 h mit Claude Code, ohne Assets): **S** ≤ 2 · **M** 3–5 · **L** 6–10 · **XL** > 10.
Assets (Modelle, Animationen) sind separat bewertet, weil sie das grösste Risiko sind (Plan §1 Punkt 1).

## Übersicht

| Bereich | Aufwand Logik | Aufwand Assets | Risiko | Empfohlene Phase | Urteil |
|---|---|---|---|---|---|
| Holz | M (Slice) → L (MVP) | M | mittel | 1–2 | machbar, Kern des Spiels |
| Metall | M (nutzt Holz-Systeme) | M | niedrig–mittel | 3 | machbar, wenn Holz-Systeme generisch gebaut sind |
| 3D-Druck | S–M | S–M | niedrig (Technik), mittel (Spielspass) | 3 | machbar; Risiko: zu wenig Handlung |
| Jagd (Fasan, Ente) | L | XL | **hoch** | 4 | machbar nur stark verkleinert |
| Jagdhund | XL | XL | **sehr hoch** | 5+ | erst nach validierter Jagd |

---

## 1. Holzverarbeitung

| §7-Punkt | Bewertung |
|---|---|
| 1 Spieler steuert | Bezugsende, Mass, Blattseite, Sägeführung (Lenken, Tempo); später Bohrposition/-tiefe, Schleifkörnung, Montagereihenfolge |
| 2 Qualitätsparameter | Längenabweichung (mm), Winkel (°), Ausriss, Holzfehler im Werkstück; später Bohrlochlage, Oberfläche, Spaltmass bei Montage |
| 3 Vereinfacht | Sägen 8 statt 20–40 Züge; Winkel-Anriss automatisch; Einspannen/Aufräumen automatisch; Messen im 0,5-mm-Raster; keine Holzfeuchte, keine Faserphysik |
| 4 Animationen | Säge (Zug-Zyklus an Geste gekoppelt), Massband ausziehen, Bleistift, Zwinge, fallendes Abfallstück, Messanimation. Keine Figur, nur Hände/Werkzeug in First-Person |
| 5 Smartphone | Wischen auf Führungsspur (Sägen), Ziehen mit Lupe (Messen), Tippen (Anreissen, Bestätigen) – ein Daumen genügt |
| 6 Feedback | Fuge wächst im Bild, Blatt kippt sichtbar bei Drift, Sägeton im Takt, Lupe zeigt Fuge vs. Linie, Ergebniskarte mit Hauptursache |

Realitätsabgleich:
- Schnittfuge auf die Abfallseite, "zu lang reparierbar, zu kurz nicht", Ausriss bei schnellem Durchsägen ohne Stütze. **[B]**
- Säge lässt sich nur am Anfang lenken, danach führt die Fuge. **[B]** im Prinzip, Zahlen (3 von 8 Zügen) **[H]**.
- Fugenbreite Fuchsschwanz ca. 1,5–2 mm, Feinsäge deutlich schmaler. **[P]**
- Dass Sägen per Wischgeste Spass macht und nicht ermüdet: **[H]** – grösste Designfrage des Slice.
- Ablesen eines Masses auf dem Handydisplay auf 0,5 mm genau mit Lupe: **[H]** (mobile-ux).

Aufwand: Slice **M** (Logik) + **M** (Werkbank, Säge, Brett, Massband). MVP (Bohren, Schleifen, Montage): **L**.
Risiko: **mittel** – Mechanik ist klar, Spielgefühl und Grafikqualität sind offen. Phase: **1–2**.

---

## 2. Metallverarbeitung

| §7-Punkt | Bewertung |
|---|---|
| 1 Spieler steuert | Profilwahl (Flach, Winkel, Rohr), Mass, Sägeblatt-Zahnteilung, Körnerpunkt, Bohrerdurchmesser und Drehzahlstufe, Entgraten (welche Kanten), Montagereihenfolge |
| 2 Qualitätsparameter | Längen-/Winkelabweichung (wie Holz), Bohrlochlage (Körnen ja/nein), Grat (scharf = Abzug + Kunde unzufrieden), Überhitzung bei falscher Drehzahl |
| 3 Vereinfacht | Gleiches Säge-/Mess-System wie Holz mit anderen Werten (langsamer Hub, mehr Züge verdichtet); Bohren als Halten mit Tempo-Fenster; Entgraten als eine Wischgeste pro Kante; keine Spanbildung, kein Härten |
| 4 Animationen | Metallsäge (Bügelsäge), Schraubstock, Körner + Hammer, Ständerbohrmaschine, Feile/Entgrater, Funken optional |
| 5 Smartphone | wie Holz; Bohren: Daumen halten, Druck = Haltedauer im grünen Fenster |
| 6 Feedback | Ton (Kreischen bei zu hoher Drehzahl), Anlauffarbe/Rauch bei Überhitzung, Grat glänzt in der Lupe |

Realitätsabgleich:
- Körnen verhindert Verlaufen des Bohrers; zu hohe Drehzahl bei Stahl überhitzt den Bohrer; Grat muss entfernt werden. **[B]**
- Zahnteilung passend zur Wandstärke (mind. ~3 Zähne im Eingriff). **[B]** – als einfache Wahl fein/grob abbildbar.
- Wiederverwendung von Mess-/Säge-/Bohr-Logik aus Holz spart den Grossteil: **[P]** – nur wenn Holz-Systeme parametrisch gebaut werden (Hinweis an engine-engineer).
- Schweissen, Drehen, Fräsen: bewusst später (Master-Prompt §5). Schweissen wäre eine eigene Erweiterung mit neuer Mechanik.

Aufwand: **M** Logik, **M** Assets. Risiko: **niedrig–mittel** (Hauptrisiko: fühlt sich wie "Holz mit grauer Textur" an).
Gegenmassnahme: Körnen, Drehzahl und Entgraten als metalltypische Entscheidungen hervorheben. Phase: **3**.

---

## 3. 3D-Druck

| §7-Punkt | Bewertung |
|---|---|
| 1 Spieler steuert | Bauplan wählen, Filament (PLA; später PETG), Schichthöhe (Qualität vs. Zeit), Füllgrad (Festigkeit vs. Material), Ausrichtung auf dem Druckbett (2–3 Optionen), Bett reinigen ja/nein, Teil entnehmen, prüfen |
| 2 Qualitätsparameter | Regelwerk statt Simulation: Haftung (Bett sauber, Temperatur passend), Überhänge (Ausrichtung), Festigkeit (Füllgrad × Lastrichtung), Oberfläche (Schichthöhe) |
| 3 Vereinfacht | Kein Slicer, kein CAD; Druck läuft im Zeitraffer (Sekunden statt Stunden), während der Spieler anderes tut; Fehler aus Tabelle, nicht aus Physik |
| 4 Animationen | Druckkopf-Bewegung (Pfad abspielen), Teil wächst schichtweise (Clip-Ebene/Shader), Entnehmen, ggf. "Spaghetti"-Fehldruck als vorgefertigtes Modell |
| 5 Smartphone | Menü-artige Auswahl am Drucker-Display (gross, wenige Optionen), Entnehmen per Ziehen |
| 6 Feedback | Erste Schicht sichtbar (haftet/löst sich), Fehldruck-Modell, Ergebniskarte (Festigkeit, Oberfläche) |

Realitätsabgleich:
- Erste-Schicht-Haftung, Überhänge > ca. 45° ohne Stützen, Schichthöhe ↔ Druckzeit/Oberfläche, Füllgrad ↔ Festigkeit,
  Lastrichtung quer zu Schichten ist die Schwachstelle. **[B]**
- Ausrichtung als Entscheidung (Festigkeit vs. Überhang) ist die einzige wirklich interessante Wahl. **[P]**
- Risiko Spielspass: Drucken ist real überwiegend Warten. Ohne körperliche Handlung droht ein Menü-Minispiel. **[H]**
  Gegenmassnahme: Druck parallel zur Holzarbeit laufen lassen; Ergebnis wird **in Holz-/Metallprodukten verbaut** (Haken, Halter, Kappen).

Aufwand: **S–M** Logik, **S–M** Assets (Drucker, wenige Druckteile). Risiko: **niedrig** technisch, **mittel** spielerisch. Phase: **3**.
Master-Prompt-Umfang "3D Printing Base" (1 Drucker, PLA, 3 Baupläne) ist angemessen.

---

## 4. Jagd (Fasan, Ente)

| §7-Punkt | Bewertung |
|---|---|
| 1 Spieler steuert | Route und Tempo durchs Feld/am Ufer, Wind beachten, Ansprechen (Art, Geschlecht, Schonzeit), Schussentscheidung (sicheres Schussfeld, Distanz), Anschlag + Vorhalt beim fliegenden Vogel, Nachsuche/Bergen |
| 2 Qualitätsparameter | Regelkonformität (Pflicht), Distanz ≤ ca. 35 m bei Schrot, Treffer sauber vs. angebleit (Nachsuche nötig), Wildbret-Qualität |
| 3 Vereinfacht | Schrotgarbe als Kegel mit Trefferwahrscheinlichkeit nach Distanz statt Ballistik; Tiere als einfache Zustandsmaschinen (Äsen → Sichern → Drücken/Laufen → Aufstehen/Flug → Einfallen); keine Population, kein Ökosystem; Gebiet klein und begrenzt |
| 4 Animationen | Fasan: laufen, sichern, aufstehen, fliegen, gleiten. Ente: schwimmen, gründeln, auffliegen, fliegen, landen. Gewehr in First-Person (Anschlag, Nachladen). Landschaft: Feld, Waldrand, See, Vegetation mit LOD |
| 5 Smartphone | Gehen per Stick/Tippen, Fernglas per Taste, Anschlag halten → Ziel per Daumenbewegung/Gyroskop (Gyro **[H]**, Safari-Berechtigung nötig), Abgabe beim Loslassen |
| 6 Feedback | Aufstehgeräusch, Flugbahn gut lesbar, Fernglas-Info, Treffer/Fehlschuss sichtbar, Regelverstoss sofort mit Erklärung (Abbruch der Runde) |

Verantwortungsvolle Regeln (Spielregeln, fiktiv, angelehnt an mitteleuropäische Praxis – rechtlich nicht verbindlich):
- Erst ansprechen, dann schiessen. Beim Fasan nur Hahn. **[P]** (regional verschieden)
- Kein Schuss ohne freies Schussfeld (Mensch, Hund, Gebäude, flacher Schuss übers Wasser zum Ufer). **[B]** als Sicherheitsprinzip
- Ente nur im Flug, nicht auf dem Wasser. **[P]** (waidgerechte Praxis, regional verschieden)
- Maximale Schussdistanz; angeschossenes Wild muss nachgesucht werden. **[B]**

Realitätsabgleich:
- Fasan drückt sich und steht erst bei Annäherung auf; Ente reagiert stark auf Bewegung, fällt gegen den Wind ein. **[B]** grob, Details **[P]**.
- Zustandsmaschinen reichen für glaubwürdiges Verhalten bei 3–8 Tieren gleichzeitig. **[P]**
- Landschaft (Vegetation, Wasser, Fernsicht) bei 30 fps auf dem iPhone innerhalb der Budgets: **[H]** – grösstes technisches Risiko.
- Fliegende Vögel mit guter Animation sind teuer zu beschaffen (KI-Agenten erzeugen keine guten Animationen). **[B]** (Plan §1)

**Zu gross im Master-Prompt:** Fasan + Ente + Feld + See + Hund + Boot gleichzeitig.
**Kleinerer Vorschlag für Phase 4:** **nur Fasan**, ein Feld mit Waldrand (ca. 150 × 150 m), 3–5 Tiere, ohne Hund.
Ente + See als eigener Schritt danach; Boot und Hund erst Phase 5.

Aufwand: Fasan-Slice **L** Logik, **XL** Assets (Landschaft, Vogel, Gewehr). Ente zusätzlich **M** + **L**.
Risiko: **hoch** (Assets, Performance, Thema). Phase: **4**.

### Jagdhund (Kurzbewertung)

| Teil | Aufwand | Kommentar |
|---|---|---|
| Begleiten (Navmesh-Folgen) | M | technisch Standard **[B]** |
| Grundkommandos (Sitz, Hier, Such) | M | Zustandsmaschine **[P]** |
| Suchen + Vorstehen | L | glaubwürdige Suche ist schwer **[H]** |
| Apportieren (inkl. Wasser) | L | braucht viele Animationen + Wasser |
| Bindung, Erfahrung | M | reine Logik, aber Balancing **[H]** |
| Animationen (Vierbeiner, ~15 Clips) | **XL** | grösster Kostenblock |

Empfehlung: erst nach validierter Fasanenjagd; Einstieg nur "Begleiten + Apportieren an Land". Phase **5+**.

## Offene Fragen an den Director

1. Jagd in Phase 4 auf **nur Fasan** verkleinern (Ente als Schritt 4b)?
2. Jagdregeln als **fiktives, an Mitteleuropa angelehntes Regelwerk** kennzeichnen (kein rechtlicher Anspruch)?
3. Darstellung erlegten Wilds: zurückhaltend (kein Blut, Wild "verschwindet" in Jagdtasche) – Ton der Vision festlegen.
4. Gyroskop-Zielen nur optional (Safari fragt Berechtigung) – mobile-ux in Phase 4 prüfen lassen?
5. Engine-Engineer anweisen, Mess-/Säge-/Bohr-Logik von Anfang an material-parametrisch zu bauen (Voraussetzung für Metall-Aufwand M)?
