# Handcraft Life – Bewertung & realistischer Umsetzungsplan mit Claude Code

## 1. Bewertung der ChatGPT-Unterhaltung

**Was trägt (übernehmen):**
- Selektiver Realismus – das stärkste Designprinzip im ganzen Konzept.
- Bereiche nacheinander statt gleichzeitig, auf gemeinsamen Grundsystemen.
- Erweiterungen bringen neue Mechaniken, nicht nur mehr Objekte.
- Ein einziger Director, der Architektur freigibt; nur 3–4 aktive Rollen gleichzeitig.
- Vertical Slice 0.1 (ein Brett exakt zuschneiden, bewerten, verkaufen, speichern) als erster Beweis.
- Statusstufen Konzept → Prototyp → Implementiert → Getestet → Freigegeben.
- 30 fps als ehrliches Ziel, Engine-Entscheid per Demoszene statt Papiervergleich.
- Gefertigte Gegenstände im Spiel weiterverwenden – gibt den Berufen eine gemeinsame Identität.

**Wo es unrealistisch oder lückenhaft ist:**
1. **Grafikqualität ist das grösste Risiko und wird unterschätzt.** KI-Agenten erzeugen keine
   hochwertigen 3D-Modelle, Animationen oder gemalte Concept-Art. Es braucht eine Asset-Strategie:
   CC0-Bibliotheken (Poly Haven, ambientCG, Kenney), gekaufte Assets, Blender-Arbeit oder
   KI-3D-Generatoren mit Nacharbeit. Concept-Art erzeugst du selbst mit einem Bildgenerator aus
   Prompts, die die Agenten schreiben.
2. **Acht Agenten sind zu viele.** Realism, Expansion Architect und Technical Producer sind besser
   als Checklisten/Skills umgesetzt. Ergebnis hier: Director (Hauptsession) + 5 Subagenten + 11 Skills.
3. **Claude Code testet nicht auf dem iPhone.** Emulation (Playwright/WebKit) prüft Draw Calls,
   Speicher, Bundle-Grösse und Abläufe, aber keine echten fps, Hitze oder Daumengefühl.
   Du bist das Testgerät – nach jeder Phase.
4. **Mechanik von Claude Code:** Subagenten können keine weiteren Subagenten starten. Der Director
   muss deshalb die Hauptsession sein, nicht ein Agent unter vielen.
5. **Phase 0 ist im Master-Prompt zu gross** (12 Konzeptbilder, 9 Dokumente, 2 Steuerungen,
   3 Engines). Realistisch: Konzeptbilder auf 4–5 Kernansichten kürzen (Werkstatt, Holzbearbeitung
   First-Person, Touch-Steuerung, Auftrag/Inventar, Fasanenfeld). Der Rest folgt in der jeweiligen Phase.
6. **Third-Person** kostet Spielfigur, Rig und Animationen. Für den Vertical Slice reicht First-Person.
7. **Jagd** ist technisch machbar, aber Tier-KI, Animationen und Landschaft sind teurer als die ganze
   Werkstatt. Bleibt bewusst Phase 4+.

## 2. Aufbau in Claude Code

```
CLAUDE.md                     Regeln, Rollen, Budgets, Definition of Done
.claude/agents/               game-designer · engine-engineer · asset-artist · mobile-ux · qa-performance
.claude/skills/               milestone-run · ticket-schreiben · architektur-entscheid · engine-spike
                              mechanik-entwurf · konzept-visuals · asset-pipeline · touch-steuerung
                              perf-budget-check · modul-vertrag · iphone-playtest
docs/                         MASTER_PROMPT + 9 Projektdokumente, decisions/, tickets/, design/
```

| Rolle laut Master-Prompt | Umsetzung |
|---|---|
| A Game Director | Hauptsession + Skill `milestone-run` |
| B Game Design & Economy | Agent `game-designer` |
| C Game Engineering | Agent `engine-engineer` |
| D Graphics & 3D Art | Agent `asset-artist` + Skills `asset-pipeline`, `konzept-visuals` |
| E Mobile UX | Agent `mobile-ux` + Skill `touch-steuerung` |
| F Realism & Simulation | Teil von `game-designer` via Skill `mechanik-entwurf` |
| G Expansion Architect | Skill `modul-vertrag` (Design + Engineering), Freigabe Director |
| H QA & Performance | Agent `qa-performance` + Skill `perf-budget-check` |
| Technical Producer | Skill `ticket-schreiben` |

## 3. Phasenplan

Zeitangaben in Arbeitssitzungen (eine Sitzung ≈ 1–3 h mit Claude Code), plus deine Testzeit.

| Phase | Ziel | Agenten aktiv | Sitzungen | Abschluss-Kriterium |
|---|---|---|---|---|
| **S – Setup** | Vite + TS + Vitest + Playwright, GitHub-Pages-Veröffentlichung | Director | 1 | `npm test` läuft, Startseite per Link auf dem iPhone erreichbar |
| **0 – Preproduction** | Kern-Loop, MVP, 2 Steuerungen, Stilvarianten, Engine-Spike (3 Engines), Modulvertrag, Qualitätskriterien | alle 5, in 2 Wellen | 4–6 | `PHASE0_ERGEBNIS.md` von dir freigegeben, Engine-Entscheidung nach iPhone-Test |
| **1 – Vertical Slice 0.1** | Werkstattraum, Touch-Steuerung, Balken, Massband, Säge, ein Auftrag, Qualität, Verkauf, Speichern, PWA | Engineer, UX, Artist, QA | 6–10 | Auf deinem iPhone spielbar, ≥ 30 fps, Spielstand übersteht Neuladen |
| **2 – Werkstattsystem** | Bohren, Schleifen, Montage, Auftragsliste, Inventar, Wirtschaft, erster Skill-Tree (Holz) | Designer, Engineer, UX, QA | 8–12 | 3 Produkte (Brett, Regal, Werkzeugkasten) fertigbar |
| **3 – Metall & 3D-Druck** | Gemeinsame Mess-/Säge-/Bohrsysteme wiederverwenden, Drucker-Workflow vereinfacht | wie 2 + Artist | 8–12 | Metallwinkel + 3D-Druck-Halter in der Werkstatt verbaubar |
| **4 – Outdoor & Jagd** | Feld, Waldrand, See; Fasan + Ente mit Zustandsmaschinen; Third-Person prüfen | alle | 10–15 | Eine Jagdrunde spielbar, Performance hält |
| **5 – Freizeit-Vertiefung** | Jagdhund, Boot, Angeln Basis | alle | offen | je Modul eigener Vertical Slice |
| **6 – Erweiterungen** | Pakete aus `EXPANSION_REGISTRY.md`, Optimierung | nach Bedarf | laufend | Alte Spielstände laden weiter |

Wichtig: Nach Phase 1 ehrlich bewerten. Sieht die Werkstatt auf dem iPhone nicht gut genug aus,
zuerst Grafik und Assets nachschärfen, bevor neue Bereiche kommen.

## 4. So startest du (nur mit dem iPhone)

Die Dateien liegen bereits im Repo https://github.com/m17d03/handcraft-life.

1. Claude-App → Bereich **Code** → Repo `m17d03/handcraft-life` wählen → neue Sitzung.
2. Diesen Start-Prompt einfügen:
   > Du bist Game Director laut CLAUDE.md. Führe `/milestone-run Phase S` aus: richte Vite,
   > TypeScript strict, Vitest, Playwright (WebKit, iPhone-Profil) und ESLint ein, dazu eine
   > einfache Startseite mit Debug-Overlay (`?debug=1`). Prüfe, dass der GitHub-Pages-Workflow
   > durchläuft, und gib mir den Link. Danach `/milestone-run Phase 0` – zuerst Welle 1
   > (game-designer, mobile-ux, qa-performance), dann Welle 2 (engine-engineer Spike, asset-artist).
   > Ich habe nur ein iPhone: alles, was ich prüfen soll, als Link. Lege mir am Ende
   > PHASE0_ERGEBNIS.md zur Freigabe vor.
3. Einmalig GitHub Pages einschalten: https://github.com/m17d03/handcraft-life/settings/pages →
   Source **GitHub Actions**. Bei privatem Repo braucht Pages GitHub Pro; sonst das Repo
   öffentlich machen.
4. Bei jedem Playtest: Link auf dem iPhone öffnen, Checkliste aus `docs/playtests/` beantworten
   (einfach in den Chat schreiben).

## 5. Grösste Risiken & Gegenmassnahmen

| Risiko | Gegenmassnahme |
|---|---|
| Grafik wirkt billig | Früh Stil festlegen, wenige, sehr gute Assets; Lightmaps; Engine-Spike mit echten Texturen |
| Safari-Abstürze durch Speicher | Texturbudget, KTX2, Messung jedes Ticket |
| Agenten überschreiben sich | Ein Ticket = ein Agent = ein Datei-Scope, Worktrees, Director integriert |
| Scope wächst | Keine Funktion ohne Ticket; Phase-Ende = Freigabe durch dich |
| Spielstände brechen | Versioniertes Schema + Fixture-Tests ab Phase 1 |
| Motivation sinkt | Jede Phase endet spielbar auf deinem iPhone |
