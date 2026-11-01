# Phase 0 – Ergebnis zur Freigabe

Status: **Konzept – wartet auf deine Freigabe** · Stand 2026-11-01 · Director (Agent A)

> **Kurz:** Wir bauen zuerst eine kleine Holzwerkstatt in Ich-Sicht (Querformat), in der man ein
> Brett nach Auftrag misst, sägt, bewerten lässt und verkauft. Vorgeschlagene Engine: Babylon.js,
> endgültig erst nach deinem iPhone-Test. Unten stehen **8 Entscheidungen**. Du kannst einfach
> antworten: **„Freigabe wie empfohlen“** – oder einzelne Punkte ändern.

## Was du jetzt auf dem iPhone prüfen kannst

| Was | Link | Dauer |
|---|---|---|
| Startseite + fps-Anzeige | https://m17d03.github.io/handcraft-life/?debug=1 | 1 min |
| Steuerung A/B (quer halten, antippbar) | https://m17d03.github.io/handcraft-life/konzepte/steuerung/ | 3 min |
| Stilvarianten A/B/C (hochkant) | https://m17d03.github.io/handcraft-life/konzepte/stil/ | 3 min |
| **Engine-Test Babylon.js** (quer) | https://m17d03.github.io/handcraft-life/spikes/babylon/?debug=1 | 5 min |
| **Engine-Test PlayCanvas** (quer) | https://m17d03.github.io/handcraft-life/spikes/playcanvas/?debug=1 | 5 min |
| **Engine-Test Three.js** (quer) | https://m17d03.github.io/handcraft-life/spikes/three/?debug=1 | 5 min |

Alle Mockups und Stilseiten sind **Konzeptbilder – kein Spielscreenshot**. Die Engine-Tests sind echte,
einfache 3D-Szenen (Prototyp): linker Daumen gehen, rechter Daumen schauen, Balken antippen, dann auf dem
Balken wischen (Schnittlinie).

**Antwort pro Engine (eine Zeile):** `Babylon: a 4, b 41, c 60, d 4, e 4, f etwas, g ja, h nein`
– a) Sekunden bis steuerbar · b) kleinste fps · c) grösste „max ms“ · d) Touch-Gefühl 1–5 ·
e) Grafik 1–5 · f) nach 5 min warm? nein/etwas/stark · g) andere App und zurück: läuft noch? ·
h) Fehler in der Zeile oben? Dazu dein **iPhone-Modell**.

---

## 1. Executive Summary und Spielvision
Handcraft Life ist eine ruhige, ehrliche Handwerkssimulation für das iPhone. Man arbeitet mit wenigen,
aber echten Entscheidungen (messen, sägen, bohren, montieren), wird für Qualität bezahlt und baut die
Werkstatt aus. Nach Feierabend folgt später die Freizeit (zuerst Fasanenjagd) als eigenes Modul.
Leitregel: **selektiver Realismus.** Entscheidungen und Können werden simuliert, Wiederholung wird zu
einer Geste verdichtet. → `docs/GAME_VISION.md`

**Phase 0 hat geliefert:** 7 Tickets, 9 Projektdokumente, 4 ADR-Vorschläge, 2 klickbare
Steuerungs-Mockups, 3 Stilvarianten, 3 gemessene Engine-Szenen, CI mit WebKit und eine Pages-Veröffentlichung.

## 2. MVP und bewusst ausgeschlossene Funktionen
- **Vertical Slice 0.1 (Phase 1):** ein Rohbrett nach Auftrag ablängen (messen, anzeichnen, sägen),
  Qualitätsnote mit Hauptursache, verkaufen, Spielstand übersteht Neuladen und App-Wechsel.
- **MVP (Ende Phase 2):** drei Produkte (Regalbrett, kleines Regal, Werkzeugkasten), dazu Bohren,
  Schleifen, Montage, Auftragsbrett, Wirtschaft und Skills für Holz und Wirtschaft.
- **Ausgeschlossen:** Multiplayer/Server, Monetarisierung, Tageszwang/Timer, Third-Person-Figur,
  Holzbank, Hobeln/Holzverbindungen, freies Bauen, Bruchphysik, Survival, Strom-Maschinen.
  Metall/3D-Druck folgen in Phase 3, Jagd in Phase 4+.
→ `docs/design/core-loop.md` §2–3

## 3. Multi-Agenten-Verantwortlichkeiten
Director (Hauptsession) plus 5 Agenten. Tatsächlich parallel liefen höchstens 3 Agenten in getrennten
Git-Worktrees, ohne Dateikonflikte. QA prüft unabhängig und repariert nichts.
→ `docs/AGENT_RESPONSIBILITIES.md`

## 4. Technischer Architekturvorschlag
- **Bestätigt:** Vite + TypeScript strict + Vitest + Playwright. WebKit läuft in GitHub-CI, die
  Veröffentlichung auf Pages.
- **Engine (Vorschlag): Babylon.js.** Im Spike gleich schnell wie Three.js, mit eingebautem Picking,
  Kantenglättung, Physik und stabiler TypeScript-API; PlayCanvas war 60–80 % langsamer.
  Die Vorabwertung ist knapp (Babylon 2,0 · Three.js 1,9 · PlayCanvas 1,65 von 2,5). **Dein iPhone-Test
  zählt 50 %** und entscheidet nach einer festen Regel (ADR 0001).
- **Spiellogik ohne Engine** (reines TS, testbar), die Engine hängt an einem dünnen Adapter. Das macht
  einen späteren Wechsel bezahlbar.
- **Module im selben Code** mit Manifest und stabilen IDs, kein Plug-in-System (ADR 0002).
- **Spielstand** lokal in IndexedDB, versioniert, mit Migrationen und Sicherungskopie (ADR 0003).
→ `docs/TECH_ARCHITECTURE.md`, `docs/spikes/engine-vergleich.md`

| Messung (Chromium-Emulation, relativ) | Babylon.js | PlayCanvas | Three.js | Budget |
|---|---|---|---|---|
| Download bis spielbar (gzip) | 382 kB | 286 kB | 145 kB | < 15 MB |
| Draw Calls / Dreiecke | 27 / 1 428 | 26 / 1 416 | 27 / 1 428 | < 80 / < 150 000 |
| Frame-Zeit (nur Vergleich) | 155 ms | 250 ms | 148 ms | – |

## 5. Visuelle Art Direction mit Beispielbildern
Drei Varianten als Moodboard: **A „Honigwerkstatt“** (warme Nachmittagssonne, empfohlen),
**B „Nordische Werkbank“** (hell, kühl, am günstigsten), **C „Lampenlicht“** (stimmungsvoll, teuer,
schlecht lesbar). Gemalte Concept-Art kann Claude nicht erzeugen. Fertige Bild-Prompts für 5 Kernansichten
liegen in `docs/art/prompts.md` (optional mit der ChatGPT-App, Bild einfach in den Chat schicken).
→ `docs/ART_DIRECTION.md`, Moodboard-Link oben

## 6. Mobile-Steuerungskonzept
Empfohlen: **Querformat, durchgehend Ich-Sicht (Konzept B).** Links ziehen = gehen (Stick erscheint am
Daumen), rechts ziehen = schauen, antippen = auswählen, halten = Kontextmenü. An der Werkbank gibt es eine
feste Arbeitsansicht: Massband-Griff ziehen mit Lupe, anzeichnen, links festhalten und rechts sägen.
Konzept A (Third-Person draussen) wird erst mit Outdoor neu bewertet und spart jetzt etwa Aufwand L.
→ `docs/design/steuerung-a-b.md`, ADR 0004

## 7. Kern-Gameplay und Skill-System
Loop: Auftrag → Material → wenige entscheidende Gesten → Note mit Ursache → Geld/XP → Werkzeug/Bauplan →
schwierigerer Auftrag. Kern des Slice ist eine echte Entscheidung: Die Säge gehört auf die Abfallseite der
Linie, sonst wird das Brett 0,8–1,6 mm zu kurz (zu kurz ist nicht reparierbar). Es gibt sechs Skill-Bereiche
mit je höchstens fünf Knoten. Ein Knoten schaltet über Level **und** Handlung frei, ohne Punkteverteilen.
→ `docs/GAME_DESIGN.md`, `docs/design/holz-brett-zuschnitt.md`

## 8. Jagd- und Werkstattkonzept
- **Werkstatt:** Holz (Phase 1–2, Aufwand M) → Metall (Phase 3, M, nutzt dieselbe Mess-, Säge- und
  Bohrlogik) → 3D-Druck (Phase 3, S–M, vereinfacht).
- **Jagd:** ehrlich das teuerste Thema (Landschaft, Tier-KI, Animation = XL Assets). Vorschlag: Phase 4
  **nur Fasan** auf einem kleinen Feld ohne Hund; Ente/See danach; Hund und Boot erst Phase 5+.
  Jagdregeln als fiktiv gekennzeichnet, Darstellung zurückhaltend.
→ `docs/design/realismus-bewertung.md`

## 9. Struktur für Erweiterungspakete
Jedes Modul hat ID, Version, Abhängigkeiten, neue Mechanik, Assets, Speicher-Abschnitt mit Migrationen
und Testkriterien. Ehrliches Ergebnis: **Keines der Beispielpakete aus dem Auftrag ist rein
datengetrieben**, jedes bringt eine neue Mechanik und damit Code (z. B. Strömung bei Angeln S–M,
Hund XL).
→ `docs/EXPANSION_REGISTRY.md`, `docs/design/modul-vertrag.md`

## 10. Entwicklungsroadmap
| Phase | Ziel | Abschluss |
|---|---|---|
| S ✓ | Setup, CI, Pages | erledigt |
| 0 ✓ | Preproduction (dieses Dokument) | **deine Freigabe** + Engine-Test |
| 1 | Vertical Slice 0.1: Werkstatt, Steuerung, Messen/Sägen, Auftrag, Qualität, Verkauf, Speichern, PWA | auf deinem iPhone spielbar, ≥ 30 fps |
| 2 | Werkstattsystem: Bohren, Schleifen, Montage, Auftragsbrett, Skills = **MVP** | 3 Produkte fertigbar |
| 3 | Metall + 3D-Druck auf gemeinsamen Systemen | Metallwinkel + Druckteil verbaubar |
| 4 | Outdoor: Fasan auf kleinem Feld | eine Jagdrunde spielbar |
| 5+ | Ente, Hund, Boot, Angeln, Erweiterungen | je Modul eigener Slice |
Phase-1-Tickets (Vorschlag, 8 Stück): `docs/PRODUCT_BACKLOG.md`.

## 11. Risiken, offene Fragen und Gegenmassnahmen
| Risiko | Gegenmassnahme |
|---|---|
| Grafik wirkt auf dem iPhone billig | Stil A mit wenigen, sehr guten PBR-Assets + gebackenem Licht; nach Phase 1 ehrlich bewerten |
| Sägen per Wischgeste macht keinen Spass (grösstes Design-Risiko) | Ist das Erste, was in Phase 1 spielbar wird; Playtest vor allem anderen |
| Engine-Wahl ohne Gerätedaten | Dein 15-Minuten-Test, feste Entscheidungsregel im ADR |
| Safari löscht Spielstände nach 7 Tagen (ohne Home-Bildschirm) | Hinweis „Zum Home-Bildschirm“, `storage.persist()`, später Export/Import |
| Safari-Systemgesten stören (Rand-Wischen, Zoom) | Randzone 20 pt, `touch-action: none`; prüfst nur du auf dem Gerät |
| Asset-Lizenzen ungeprüft (Cloud sperrt Poly Haven/ambientCG/Kenney) | Kein Download ohne geprüfte Lizenz; Domains freischalten **oder** du öffnest 3–4 Lizenzseiten |
| WebKit nicht in der Cloud-Sitzung | WebKit-Tests laufen verbindlich in GitHub-CI |
| Jagd sprengt den Umfang | Phase 4 nur Fasan, Hund/Boot später |

**Unterscheidung:** *bestätigt* = Setup, CI, Pages, Messwerte im Browser · *plausibel* = Engine-Empfehlung,
Steuerung, Aufwandsschätzungen · *Hypothese* = Spass der Sägegeste, Preise/XP, echte iPhone-fps.

## 12. Empfehlung für den ersten spielbaren Prototyp
**Vertical Slice 0.1 = „Ein Regalbrett nach Auftrag“:** Ein Raum, Werkbank, Rohbrett, Massband, Säge.
Querformat, Ich-Sicht. Ein Auftrag („600 mm ±1 mm“) → messen → anzeichnen → sägen → Qualitätsnote mit
Ursache → verkaufen → Geld. Der Spielstand übersteht Neuladen und App-Wechsel, die App lässt sich zum
Home-Bildschirm hinzufügen, und das Spiel hält stabil 30 fps auf deinem iPhone. Stil A, Engine nach
deinem Test.

---

## Deine Entscheidungen (Empfehlung fett)

| # | Frage | Empfehlung |
|---|---|---|
| 1 | Engine | **Babylon.js**, falls dein Test keinen klaren Vorteil für Three.js zeigt (Regel ADR 0001) |
| 2 | Steuerung / Format | **Konzept B, nur Querformat** im Vertical Slice (ADR 0004) |
| 3 | Stil | **Variante A „Honigwerkstatt“** |
| 4 | MVP-Umfang | **MVP = Ende Phase 2**, Holzbank gestrichen, Phase 4 **nur Fasan** |
| 5 | Modulsystem + Spielstand | **ADR 0002 und 0003 annehmen**, im MVP nur ein Spielstand |
| 6 | Startwerte Wirtschaft | **40 G Start, Rohbrett 12 G, Regalbrett 14 G**, Feinjustierung nach Playtest |
| 7 | Skills | **ohne Punkteverteilung** (Level + Handlung) |
| 8 | Referenz-iPhone (unterste Grenze für Budgets) | **dein aktuelles iPhone** – bitte Modell nennen |

Kleinere Designfragen (Messraster 0,5 mm, Toleranz kappt Stufe auf C, Währung „G“, Feierabend-Knopf)
entscheidet der Director in Phase 1 nach dem ersten Playtest.

**Nächster Schritt nach deiner Freigabe:** ADRs annehmen, Phase-1-Tickets schreiben,
`/milestone-run Phase 1` starten. Ohne deine Freigabe startet kein Phase-1-Ticket.
