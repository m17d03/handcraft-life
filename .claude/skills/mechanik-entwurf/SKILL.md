---
name: mechanik-entwurf
description: Entwirft eine Spielmechanik oder einen Handwerksablauf nach dem Prinzip selektiver Realismus (z. B. Messen, Sägen, Bohren, 3D-Druck, Angeln, Fasanenjagd). Verwenden, bevor eine neue Mechanik programmiert wird.
---

# Mechanik-Entwurf (selektiver Realismus)

Datei: `docs/design/<bereich>-<mechanik>.md`

## 1. Realer Ablauf
Liste den echten Arbeitsablauf in Schritten (so wie ein Profi ihn macht).

## 2. Jeden Schritt einordnen
| Schritt | Spielerentscheidung? | Fehler möglich? | Monoton? | Im Spiel |
|---|---|---|---|---|
| Mass nehmen | ja (wo messen) | ja | nein | **simulieren** |
| Sägen hin und her | nein | Führung ja | ja | **verdichten**: eine Führungsgeste, Takt automatisch |
| Späne wegräumen | nein | nein | ja | **weglassen** oder Auto |

Faustregeln:
- Simulieren, wenn der Spieler entscheidet oder Können zeigt (Position, Winkel, Reihenfolge,
  Werkzeugwahl, Timing).
- Verdichten, wenn die Bewegung echt, aber repetitiv ist: eine Geste steht für viele Wiederholungen.
- Weglassen oder automatisieren, wenn weder Entscheidung noch Können drinsteckt.
- Kein Arbeitsschritt dauert ohne neue Entscheidung länger als ca. 5 Sekunden.

## 3. Touch-Umsetzung
Geste pro simuliertem Schritt (mit `mobile-ux` abgleichen, Skill `touch-steuerung`).

## 4. Qualität und Folgen
- Woran wird das Ergebnis gemessen (Massabweichung, Winkel, Oberfläche)?
- Wie wirkt Qualität auf Preis, Kundenzufriedenheit, Weiterverwendbarkeit im Spiel?
- Hergestellte Gegenstände: wo im Spiel weiterverwendbar (Werkbank, Haus, andere Berufe)?

## 5. Lernkurve
Erster Kontakt (geführt) → Wiederholung (Hinweise) → Meisterschaft (keine Hilfen, Bonus).

## 6. Datenmodell-Skizze
Werkstück, Werkzeug, Arbeitsschritt, Ergebnis – nur Felder, keine Klassen.

## 7. Grundspiel vs. Erweiterung
Was gehört ins Grundspiel, welche **neue Mechanik** (nicht nur mehr Inhalt) wäre eine Erweiterung?

## 8. Offene Fragen an den Director
