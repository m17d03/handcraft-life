---
id: 002
titel: Kern-Loop, MVP-Umfang und Realismus-Bewertung (Holz, Metall, 3D-Druck, Jagd) entwerfen
agent: game-designer
meilenstein: Phase 0
status: open
reifegrad: Konzept
blocked_by: [001]
branch: ticket/002-kern-loop
---

## Ziel
Der Director hat einen belastbaren Entwurf für Kern-Gameplay-Loop, MVP, bewusst ausgeschlossene
Funktionen, Skill-System-Grundidee und eine ehrliche Machbarkeits-/Realismusbewertung der vier
Bereiche – als Grundlage für GAME_VISION.md, GAME_DESIGN.md und PHASE0_ERGEBNIS.md.

## Kontext
- `docs/MASTER_PROMPT.md` Abschnitte 4–7, 10, 13, 16 (Game Design, Realism)
- `UMSETZUNGSPLAN.md` (Phasen, Vertical Slice 0.1: ein Brett exakt zuschneiden, bewerten, verkaufen, speichern)
- `.claude/skills/mechanik-entwurf/SKILL.md` (verbindliche Methode)

## Scope
- Darf ändern: `docs/design/core-loop.md`, `docs/design/realismus-bewertung.md`,
  `docs/design/holz-brett-zuschnitt.md`
- Darf nicht ändern: alles andere, insbesondere `docs/*.md` (Projektdokumente), `docs/decisions/`, Code

## Abnahmekriterien
- [ ] `core-loop.md`: Loop in 3 Zeitskalen (Minute: Arbeitsschritt · Sitzung 10–20 min: Auftrag →
      Fertigung → Verkauf · Langfristig: Werkstatt-Ausbau, Skills, Freizeit); MVP-Liste (max. 12 Punkte)
      und Liste bewusst ausgeschlossener Funktionen mit je einem Satz Begründung
- [ ] Skill-System-Skizze: 6 Bereiche aus Master-Prompt §10, pro Bereich max. 5 Knoten für die erste
      Version, jeder Knoten mit konkretem Effekt und Freischaltbedingung; XP nur aus aktiven Handlungen
- [ ] Wirtschafts-Skizze: Startgeld, Materialpreis, Verkaufspreis abhängig von Qualität (Formel), keine
      künstlichen Wartezeiten, keine Monetarisierung
- [ ] `realismus-bewertung.md`: je Bereich (Holz, Metall, 3D-Druck, Jagd) Tabelle der 6 Punkte aus
      Master-Prompt §7 + Aufwand (S/M/L/XL) + Risiko + empfohlene Phase; ehrliche Einschätzung, wo
      Hypothese statt Gewissheit
- [ ] `holz-brett-zuschnitt.md`: vollständiger Mechanik-Entwurf nach Skill `mechanik-entwurf`
      (Abschnitte 1–8) für den Vertical Slice: Balken messen, anzeichnen, sägen, Qualität, Verkauf;
      Qualitätsformel mit Zahlen (z. B. Massabweichung in mm → Qualitätsstufe)
- [ ] Jede Interaktion mit einem Daumen (hoch) oder zwei Daumen (quer) bedienbar; offene
      Steuerungsfragen an mobile-ux als Liste
- [ ] Abschluss: Liste der Entscheidungen, die der Director treffen muss

## Nicht Teil dieses Tickets
Code, Steuerungskonzepte (Ticket 003), Grafik (Ticket 007), Metall/3D-Druck/Jagd im Detail
(nur Bewertung, keine Mechanik-Entwürfe).

## Protokoll
