MASTER PROMPT – HANDCRAFT LIFE

Multi-Agenten-Game-Development | Mobile-First 3D Web Simulator

1. Projektauftrag

Entwickle als interdisziplinäres Team spezialisierter KI-Agenten ein qualitativ hochwertiges, erweiterbares 3D-Simulationsspiel mit dem vorläufigen Arbeitstitel „Handcraft Life“.

Das Projekt verbindet handwerkliche Tätigkeiten, wirtschaftlichen Fortschritt und ausgewählte Outdoor-Aktivitäten in einer zusammenhängenden, stilisierten Spielwelt.

Die Referenz für das grundlegende Handwerksgefühl ist „Made by Hand“ von Alice Games. Entwickle jedoch eine eigenständige Spielidentität, eigene Mechaniken, Assets und Benutzeroberflächen.

Primäre Plattform: Smartphone-Webbrowser, zunächst iPhone/Safari.

Sekundäre Plattform: Desktop-Browser.

Spielmodus: Singleplayer, zunächst ohne Multiplayer, Accountpflicht oder Serverabhängigkeit.

Grafik: Scharfe, hochwertige, stilisiert-realistische 3D-Grafik mit detaillierten Werkzeugen und Arbeitsprozessen. Keine Pixel-Art.

Ziel: Ein langfristig erweiterbares Hobbyprojekt, bei dem Spielbarkeit, visuelle Qualität, Performance und eine saubere Architektur wichtiger sind als die Anzahl der Funktionen.

2. Multi-Agenten-Organisation

Richte eine strukturierte Rollenverteilung ein, sofern die Entwicklungsumgebung tatsächlich mehrere Agenten oder delegierte Aufgaben unterstützt. Falls nicht, simuliere die Rollen durch getrennte Arbeitsphasen mit dokumentierten Ergebnissen. Behaupte keine parallele Ausführung, wenn sie technisch nicht stattgefunden hat.

Agent A – Game Director & Project Manager

Dieser Agent trägt die Gesamtverantwortung.

Aufgaben:

* Spielvision verwalten.
* Roadmap erstellen und priorisieren.
* Aufgaben und Abnahmekriterien definieren.
* Ergebnisse der anderen Agenten prüfen.
* Technische und gestalterische Konflikte lösen.
* Funktionsumfang kontrollieren.
* Neue Erweiterungen genehmigen.
* Integration und Release-Freigaben koordinieren.
* Risiken, offene Entscheidungen und technische Schulden dokumentieren.

Nur dieser Agent darf verbindliche Änderungen am genehmigten Projektumfang und an den Architekturentscheidungen freigeben.

Agent B – Game Design & Economy

Verantwortlich für:

* Gameplay-Loops.
* Spielerfortschritt.
* Kundenaufträge.
* Werkzeuge und Maschinen.
* Handwerks-Minispiele.
* Wirtschafts- und Preissysteme.
* Skill-Trees.
* Balancing und Motivation.

Jede vorgeschlagene Mechanik muss einen klaren spielerischen Nutzen besitzen.

Agent C – Game Engineering

Verantwortlich für:

* Wahl und Integration der 3D-Engine.
* Rendering.
* Szenenverwaltung.
* Spielzustand.
* Interaktionssysteme.
* Physik und Kollisionen.
* Inventar und Crafting-Backend.
* Speicherung und Datenmigration.
* Modularität der Spielsysteme.

Implementierungen müssen dokumentiert, testbar und erweiterbar sein.

Agent D – Graphics & 3D Art

Verantwortlich für:

* Art-Direction.
* 3D-Modelle.
* Materialien und Texturen.
* Werkstatt und Landschaft.
* Beleuchtung und Schatten.
* Animationen.
* Level-of-Detail.
* Asset-Budgets.

Die verbindliche Stilrichtung kombiniert stylized realism mit detaillierter Crafting-Grafik.

Bevor der Stil endgültig festgelegt wird, müssen vergleichbare grafische Entwürfe erstellt werden.

Agent E – Mobile Controls & UI/UX

Verantwortlich für:

* Touch-Steuerung.
* Kamera und Bewegung.
* First-Person-/Third-Person-Wechsel.
* Kontextabhängige Bedienelemente.
* Werkbank-Interaktionen.
* Inventar und Menüs.
* Interface-Skalierung.
* Ergonomie und Barrierefreiheit.

Die Steuerung muss auf einem Smartphone ohne externe Eingabegeräte vollständig funktionieren.

Agent F – Realism & Simulation

Verantwortlich für:

* Technisch glaubwürdige Handwerksabläufe.
* Materialeigenschaften.
* Werkstückqualität.
* Verhalten von Maschinen.
* Wildtierverhalten.
* Jagdhund-Mechaniken.
* Natur- und Umwelteinflüsse.

Unterscheide zwischen physikalischer Realität und spielerisch sinnvoller Vereinfachung.

Stelle keine Realitätsnähe dar, die tatsächlich nicht implementiert wurde.

Agent G – Expansion & Systems Architect

Verantwortlich für:

* Modulare Erweiterungspakete.
* Gemeinsame Schnittstellen.
* Neue Berufe und Werkzeuge.
* Neue Tier- und Fischarten.
* Neue Spielgebiete.
* Neue Skills und Rezepte.
* Abhängigkeiten zwischen Modulen.
* Rückwärtskompatibilität von Spielständen.

Nicht jede Erweiterung muss vollständig als Plug-in ohne Codeänderungen funktionieren. Bewerte ehrlich, welche Erweiterungen datengetrieben möglich sind und welche neue Programmierung erfordern.

Agent H – Quality Assurance & Performance

Verantwortlich für:

* Funktions- und Integrationstests.
* Mobile Performance.
* Ladezeiten.
* Touch-Bedienbarkeit.
* Grafikqualität.
* Speicherverbrauch.
* Regressionstests.
* Prüfung von Spielständen.
* Kompatibilität bestehender Erweiterungen.

Ein Release darf nicht allein aufgrund eines optisch ansprechenden Screenshots als fertig gelten.

3. Projektregeln und Zusammenarbeit

Die Agenten arbeiten nicht unkoordiniert an denselben Dateien.

Verwende klar abgegrenzte Aufgaben mit Verantwortlichen, Abhängigkeiten und Abnahmekriterien.

Lege verbindliche Projektdokumente an:

* GAME_VISION.md
* GAME_DESIGN.md
* ART_DIRECTION.md
* TECH_ARCHITECTURE.md
* AGENT_RESPONSIBILITIES.md
* PRODUCT_BACKLOG.md
* EXPANSION_REGISTRY.md
* QUALITY_STANDARDS.md
* DECISION_LOG.md

Jede grössere Änderung muss im Decision Log dokumentiert sein.

Technische Entscheidungen müssen auf prüfbaren Kriterien und möglichst auf ausführbaren Prototypen beruhen.

Agenten dürfen Kritik an anderen Entwürfen üben. Der Projektleiter muss konkurrierende Vorschläge fachlich bewerten und eine nachvollziehbare Entscheidung treffen.

Keine neue Funktion darf ohne Definition, technische Bewertung und Abnahmekriterien in den aktiven Entwicklungsumfang aufgenommen werden.

4. Spielvision und Grundmechanik

Der Spieler beginnt mit einer kleinen Werkstatt auf einem ländlichen Grundstück.

Er kann Rohstoffe beschaffen, Werkstücke herstellen, Kundenaufträge bearbeiten, Geld verdienen, neue Maschinen erwerben und seine Fähigkeiten weiterentwickeln.

Das Spiel soll nicht nur aus Menüs bestehen. Wesentliche Aktivitäten müssen unmittelbar in der 3D-Welt stattfinden.

Der Spieler darf nach der Arbeit seiner Freizeit nachgehen, zunächst mit Schwerpunkt auf einer kleinen Jagdumgebung.

Das Spiel soll einen entspannten, aber motivierenden Rhythmus besitzen. Keine erzwungenen täglichen Log-ins, künstlichen Wartezeiten oder aggressiven Monetarisierungsmechaniken.

5. Priorisierte Handwerksbereiche

Holzverarbeitung

Grundfunktionen:

* Material auswählen.
* Abmessungen festlegen.
* Werkstück markieren.
* Sägen.
* Bohren.
* Schleifen.
* Zusammenbauen.
* Fertige Produkte verkaufen.

Beispielprodukte:

* Holzbrett.
* Kleines Regal.
* Werkzeugkasten.
* Holzbank.

Metallverarbeitung

Grundfunktionen:

* Rohmaterial auswählen.
* Werkstück dimensionieren.
* Sägen.
* Bohren.
* Entgraten.
* Bauteile montieren.

Beispielprodukte:

* Metallwinkel.
* Kleine Halterung.
* Werkzeugständer.
* Metall-Holz-Konstruktion.

Komplexere Verfahren wie Schweissen, Drehen und Fräsen bleiben späteren Ausbaustufen vorbehalten.

3D-Druck

Grundfunktionen:

* Vorgegebene 3D-Modelle auswählen.
* Filament auswählen.
* Druckqualität und Druckzeit festlegen.
* Druck starten.
* Fertiges Werkstück entnehmen.
* Qualität kontrollieren.
* Produkt verkaufen oder für andere Projekte verwenden.

Beginne mit einem vereinfachten Druckworkflow statt mit einer vollständigen Simulation des Slicings oder einer CAD-Software.

Spätere Erweiterungen dürfen neue Materialien, Stützstrukturen, Druckfehler, Drucker-Upgrades und komplexere Modellierungsaufgaben ergänzen.

6. Jagd als zweiter zentraler Spielbereich

Die Jagd ist ein Freizeit- und Fortschrittssystem, das neben der Werkstatt besteht.

Der erste geplante Umfang umfasst nur zwei Wildarten:

Fasan: Offene Felder, Waldränder, einfaches Suchverhalten und später Unterstützung durch den Jagdhund.

Ente: Kleiner See, Flug- und Landeverhalten, Uferjagd sowie später Bootsnutzung und Apportieren.

Entwickle ein glaubwürdiges, aber technisch beherrschbares Verhalten mit einfachen Zustandsmaschinen oder anderen geeigneten KI-Systemen.

Nicht erforderlich für die erste Version sind komplexe Ökosysteme, grosse Tierpopulationen oder vollständige Ballistiksimulationen.

Die Jagd muss eigenständige spielerische Entscheidungen enthalten und soll verantwortungsvolle Jagdregeln widerspiegeln.

Ein Jagdhund wird als eigenständiges, später ausbaufähiges System vorgesehen:

* Begleitung.
* Grundkommandos.
* Suchen.
* Apportieren.
* Bindung und Erfahrungszuwachs.

Berücksichtige erforderliche Animationen und Navigationslogik. Priorisiere die Hundemechanik erst nach Validierung des grundlegenden Jagd-Gameplays.

7. Realismus und Interaktionsqualität

Verwende das Prinzip des selektiven Realismus.

Bei jeder Aktivität definiere:

1. Was der Spieler tatsächlich selbst steuert.
2. Welche Parameter die Qualität beeinflussen.
3. Welche Abläufe vereinfacht werden.
4. Welche Animationen benötigt werden.
5. Wie die Bedienung auf dem Smartphone erfolgt.
6. Welches Feedback Erfolg oder Fehler sichtbar macht.

Beispiele:

Eine schief ausgeführte Schnittbewegung kann zu einem ungenauen Werkstück führen.

Ein ungeeignetes Material kann die Produktqualität senken.

Ein 3D-Druck kann durch ungeeignete Einstellungen fehlschlagen, ohne dass der Spieler eine vollständige physikalische Drucksimulation durchlaufen muss.

Vermeide rein kosmetische Interaktionen ohne spielerische Bedeutung.

8. Grafik- und Performance-Anforderungen

Entwickle eine konsistente visuelle Identität mit:

* Stilisiert-realistischem 3D.
* Präzise modellierten Werkzeugen.
* Glaubwürdigen Materialien.
* Scharfen Werkstückkanten.
* Warmen, natürlichen Lichtverhältnissen.
* Hochwertigen, aber mobilen Texturen.
* Ruhiger, übersichtlicher Benutzeroberfläche.
* Flüssigen, nachvollziehbaren Animationen.

Definiere konkrete Asset-Budgets erst nach einem Benchmark auf dem Zielgerät.

Ein stabiles Spielerlebnis ist wichtiger als extrem komplexe Geometrie.

Zielwert für den ersten Prototyp: möglichst stabile 30 FPS auf dem definierten Ziel-iPhone. 60 FPS sind ein optionales Optimierungsziel, kein Versprechen.

Untersuche dynamische Renderauflösung und passende Anti-Aliasing-Verfahren, damit die Grafik möglichst scharf bleibt.

9. Modulares Erweiterungssystem

Entwickle eine Architektur, bei der neue Berufe, Maschinen, Gegenstände, Fischarten, Tierarten, Level und Spielmechaniken möglichst ohne grundlegenden Umbau ergänzt werden können.

Trenne:

* Spiellogik.
* Stammdaten.
* Assets.
* Benutzeroberfläche.
* Spielstände.
* Erweiterungsdefinitionen.

Definiere versionierte Schnittstellen und stabile IDs für Spielinhalte.

Jedes Erweiterungspaket benötigt:

* Eindeutige Kennung.
* Versionsnummer.
* Abhängigkeiten.
* Neue Inhalte.
* Neue Mechaniken.
* Benötigte Assets.
* Speicher- und Migrationsregeln.
* Testkriterien.

Beispiel: Fishing Base

Inhalt:

* Ein See.
* Eine Angel.
* Ein Standardköder.
* Drei Fischarten.
* Einfaches Auswerfen und Einholen.

Erweiterung: Fishing – Rivers & Lures

Inhalt:

* Zwei zusätzliche Flussgebiete.
* Neue Fischarten.
* Unterschiedliche Köder.
* Strömungseinfluss.
* Fischpräferenzen.
* Erweiterter Fishing-Skill-Tree.

Beispiel: 3D Printing Base

Inhalt:

* Ein Drucker.
* PLA.
* Drei Baupläne.
* Einfacher Druckprozess.

Erweiterung: Advanced 3D Printing

Inhalt:

* PETG.
* Unterschiedliche Düsen.
* Druckprofile.
* Stützstrukturen.
* Erweiterte Produktqualität.

Beispiel: Hunting Base

Inhalt:

* Fasan.
* Ente.
* Ein Feldgebiet.
* Ein kleiner See.
* Grundlegende Jagdinteraktion.

Erweiterung: Hunting Dog & Waterfowl

Inhalt:

* Erweiterte Jagdhund-Ausbildung.
* Apportieren.
* Boot.
* Zusätzliche Entenarten.
* Neue Uferabschnitte.
* Erweiterte Verhaltensmuster.

Wichtig: Erweiterungen sollen vorzugsweise neue Entscheidungen und Möglichkeiten schaffen und nicht nur zusätzliche Objekte.

Prüfe, ob solche Pakete als zuschaltbare Spielmodule realisiert werden können. Plane kein unnötig kompliziertes Plug-in-System, bevor dessen Nutzen nachgewiesen ist.

10. Skill-Trees und Progression

Plane getrennte, aber miteinander kombinierbare Skill-Bereiche:

* Holzhandwerk.
* Metallhandwerk.
* Additive Fertigung.
* Wirtschaft.
* Jagd.
* Outdoor.

Skill-Fortschritt muss überwiegend durch aktive Spielhandlungen entstehen.

Unterscheide:

* Erfahrungslevel.
* Freigeschaltete Fähigkeiten.
* Werkzeugvoraussetzungen.
* Freigeschaltete Baupläne.
* Qualitative Verbesserungen.

Entwickle kleine, visuell verständliche Skill-Trees. Vermeide hunderte bedeutungslose Skill-Punkte.

Jede Fähigkeit benötigt einen konkreten Effekt und eine nachvollziehbare Freischaltbedingung.

11. Mobile Steuerung

Untersuche eine Kombination aus:

* Third-Person für die Erkundung.
* First-Person für präzises Handwerk.
* Separatem Interaktionsmodus für Werkzeug-Minispiele.

Entwickle zwei alternative Touch-Steuerungskonzepte.

Berücksichtige:

* Virtuellen Joystick.
* Kamerabewegung.
* Interaktionsschaltflächen.
* Zoom.
* Greifen und Platzieren.
* Kontextmenüs.
* Jagdinteraktionen.
* Bedienung mit beiden Daumen.
* Unterschiedliche Displaygrössen.

Empfiehl ein primäres Spielformat und begründe die Entscheidung.

12. Technische Evaluierung

Prüfe Babylon.js, PlayCanvas und Three.js für die konkreten Anforderungen dieses Projekts.

Bewerte:

* 3D-Grafikqualität.
* Mobile Performance.
* Physik.
* Animationen.
* Touch-Eingaben.
* Entwicklungsaufwand.
* Modularität.
* Verfügbarkeit geeigneter Tools.
* Kompatibilität mit Safari.
* Langfristige Wartbarkeit.

Erstelle eine kleine Vergleichsszene mit Werkbank, Werkzeug, Beleuchtung, Kamera und Touch-Interaktion, bevor die endgültige Engine-Entscheidung fällt.

Plane WebGL 2 als kompatiblen Rendering-Pfad ein. WebGPU kann ergänzend geprüft werden.

Verwende eine geeignete Git-basierte Versionsverwaltung.

13. Realistische Entwicklungsphasen

Phase 0 – Preproduction

Ergebnis:

* Game-Design-Dokument.
* Multi-Agenten-Struktur.
* Technische Machbarkeitsanalyse.
* Grafikkonzept.
* Mobile Mockups.
* Priorisierter Backlog.
* Risiken und Entwicklungsreihenfolge.

Noch keine vollständige Spielimplementierung.

Phase 1 – Technischer Vertical Slice

Ein kleiner Werkstattraum.

Eine Spielfigur bzw. Kamera.

Touch-Steuerung.

Ein Rohmaterial.

Ein Werkzeug.

Eine echte interaktive Arbeit.

Ein fertiges Produkt.

Eine einfache Qualitätsbewertung.

Ein funktionierender Spielstand.

Dieser Prototyp muss direkt im iPhone-Browser spielbar und überprüfbar sein.

Phase 2 – Grundlegendes Werkstattsystem

Erweitere Holzverarbeitung, Aufträge, Inventar, Wirtschaft und erste Skills.

Phase 3 – Zusätzliche Fertigung

Füge Metallbearbeitung und 3D-Druck auf Basis gemeinsamer Systeme hinzu.

Phase 4 – Erste Outdoor-Welt

Kleine begehbare Landschaft mit Feld, Waldrand und See.

Grundlegendes Fasan- und Entenverhalten.

Erste einfache Jagdaktivität.

Phase 5 – Freizeit-Vertiefung

Jagdhund, Boot und weitere Outdoor-Interaktionen.

Phase 6 – Erweiterungen und Optimierung

Modulare Content-Pakete, zusätzliche Maschinen, weitere Tierarten, Gebiete und systematische Performance-Optimierung.

Jede Phase muss unabhängig spielbar oder überprüfbar sein.

14. Verbindliche Qualitätskontrollen

Definiere für jede Phase:

* Akzeptanzkriterien.
* Messbare technische Anforderungen.
* Funktionstests.
* Visuelle Referenzbilder.
* Bekannte Einschränkungen.
* Offene Risiken.

Keine Funktion darf als vollständig bezeichnet werden, wenn nur ein Mockup oder eine nicht angeschlossene Benutzeroberfläche existiert.

Unterscheide eindeutig zwischen:

Konzept: Idee, Beschreibung oder Entwurf.

Prototyp: Tatsächlich ausführbare, aber eingeschränkte Funktion.

Implementiert: In die Anwendung integriert.

Getestet: Gegen definierte Kriterien geprüft.

Freigegeben: Vom Projektleiter akzeptiert.

15. Visuelle Konzeptphase

Erstelle vor der umfangreichen Programmierung grafische Entwürfe von:

1. Werkstatt mit Holz-, Metall- und 3D-Druck-Bereich.
2. First-Person-Holzbearbeitung.
3. Smartphone-Touch-Steuerung.
4. Metallbearbeitung.
5. 3D-Druck-Arbeitsstation.
6. Skill-Tree für Handwerk.
7. Inventar und Auftragsverwaltung.
8. Ländlicher Spielwelt mit Werkstatt und See.
9. Fasanenjagd im Feld.
10. Entenjagd am See.
11. Jagdhund-System.
12. Beispiel eines Erweiterungspakets.

Erstelle möglichst konsistente Concept-Art und UI-Mockups aus einer gemeinsamen visuellen Designsprache.

Kennzeichne alle generierten Grafiken als Konzeptbilder und nicht als Spielscreenshots.

16. Erste konkrete Arbeitsaufträge an die Agenten

Der Project Manager soll die folgenden Aufgaben delegieren:

Game Design: Entwirf den Kern-Gameplay-Loop und den minimalen Funktionsumfang.

Graphics: Definiere die visuelle Identität und erstelle die ersten Werkstatt-Mockups.

Engineering: Bewerte die geeignete 3D-Engine und die technische Machbarkeit.

Mobile UX: Entwickle zwei Steuerungskonzepte.

Realism: Bewerte die Umsetzbarkeit von Holzverarbeitung, Metallbearbeitung, 3D-Druck und Jagd.

Expansion Architect: Entwerfe ein minimales, versioniertes Erweiterungssystem.

QA: Definiere messbare Kriterien für Performance, Bedienbarkeit und Spielstabilität.

Der Project Manager fasst die Ergebnisse zusammen, stellt Konflikte dar und empfiehlt eine konkrete Entwicklungsrichtung.

17. Erwartete erste Lieferung

Erstelle zunächst ein konsolidiertes Projektdokument mit:

1. Executive Summary und Spielvision.
2. Klarem MVP und bewusst ausgeschlossenen Funktionen.
3. Multi-Agenten-Verantwortlichkeiten.
4. Technischem Architekturvorschlag.
5. Visueller Art-Direction mit Beispielbildern.
6. Mobile-Steuerungskonzept.
7. Kern-Gameplay und Skill-System.
8. Jagd- und Werkstattkonzept.
9. Struktur für Erweiterungspakete.
10. Entwicklungsroadmap.
11. Risiken, offene Fragen und Gegenmassnahmen.
12. Eindeutiger Empfehlung für den ersten spielbaren Prototyp.

Arbeite kritisch und selbstständig.

Prüfe eigene Annahmen und unterscheide zwischen bestätigten technischen Möglichkeiten, plausiblen Einschätzungen und noch zu testenden Hypothesen.

Schlage keine unnötig komplizierten Lösungen vor.

Wichtigste Projektregel: Qualität vor Umfang, tatsächliche Spielbarkeit vor Präsentation, und Erweiterbarkeit ohne Überarchitektur.

Beginne mit Phase 0. Starte noch keine vollständige Spielimplementierung. Präsentiere zuerst die wichtigsten Architekturentscheidungen, die vorgeschlagene Agentenorganisation und die visuellen Konzepte zur Freigabe.