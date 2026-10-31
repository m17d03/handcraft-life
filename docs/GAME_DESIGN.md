# GAME_DESIGN

Status: **Konzept – Entwurf zur Freigabe** (Phase 0). Details in `docs/design/`.

| Thema | Dokument | Kern |
|---|---|---|
| Kern-Loop, MVP, Skills, Wirtschaft | `design/core-loop.md` | Auftrag → Material → Fertigen → Note mit Ursache → Geld/XP → Werkzeug/Bauplan |
| Realismus & Machbarkeit | `design/realismus-bewertung.md` | Holz M, Metall M, 3D-Druck S–M, Jagd L/XL (nur Fasan in Phase 4) |
| Mechanik Brett-Zuschnitt (Vertical Slice) | `design/holz-brett-zuschnitt.md` | Säge auf der Abfallseite der Linie ansetzen, Qualität 0–100 → A–D/Ausschuss |
| Steuerung | `design/steuerung-a-b.md` | Konzept B: Ich-Sicht, Querformat (ADR 0004) |
| Module & Spielstand | `design/modul-vertrag.md` | Module im selben Code, IDs `<modul>.<typ>.<name>` (ADR 0002/0003) |

## Kern-Loop (Kurzfassung)
- **Minute:** Werkstück prüfen → Entscheidung → Geste → sofortiges Feedback.
- **Sitzung (10–20 min):** 4–8 Aufträge, pro Sitzung etwa eine Anschaffung.
- **Langfristig:** Werkstatt-Ausbau über feste Slots, Skill-Knoten, Baupläne, später Freizeit.

## Skills
Sechs Bereiche mit je höchstens fünf Knoten. Ein Knoten schaltet frei, wenn **Level UND Handlung** erfüllt
sind; es gibt keine Punkteverteilung. XP gibt es nur für aktive Handlungen. Skills geben vor allem
Optionen und Information, Hilfen für die Hand höchstens −15 %.

## Wirtschaft (Startwerte, Hypothese)
Startgeld 40 G · Rohbrett 12 G · Regalbrett 14 G · Preisfaktor nach Stufe A 1,3 / B 1,0 / C 0,7 / D 0,4.
Es gibt keine Wartezeiten und keinen Softlock: Ohne Geld liefert der Händler auf Anschreiben.
Feinjustierung nach dem Playtest.
