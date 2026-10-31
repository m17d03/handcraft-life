---
name: iphone-playtest
description: Bereitet einen Playtest auf dem echten iPhone vor (Build bereitstellen, Checkliste für den Menschen) und wertet die Rückmeldung aus. Verwenden am Ende jedes Meilensteins und im Engine-Spike.
---

# iPhone-Playtest

Claude Code kann nicht auf einem echten iPhone testen. Der Mensch ist das Testgerät.

## 1. Build bereitstellen
Der Mensch hat nur ein iPhone. Bereitstellung ausschliesslich über GitHub Pages:
- Auf `main` mergen → Workflow `Deploy to GitHub Pages` läuft automatisch.
- Mit `gh run list --workflow deploy-pages.yml` prüfen, dass er erfolgreich war.
- Link an den Menschen: https://m17d03.github.io/handcraft-life/ (bei Spikes Unterpfad nennen,
  z. B. `/spikes/babylon/`).
- Falls Pages noch nicht aktiv ist: dem Menschen den direkten Link
  https://github.com/m17d03/handcraft-life/settings/pages geben → Source "GitHub Actions".

## 2. Checkliste an den Menschen (kurz halten, max. 10 Punkte)
Datei `docs/playtests/<datum>-<meilenstein>.md` vorbereiten:

```markdown
Gerät / iOS-Version:
Safari oder Home-Bildschirm-App:

1. Ladezeit bis spielbar (Sekunden):            
2. Läuft es flüssig? (flüssig / leicht ruckelig / stark ruckelig)
3. Wird das iPhone nach 5 Minuten warm? (nein / etwas / stark)
4. Steuerung Gehen/Umschauen verständlich? (1–5)
5. <Mechanik des Meilensteins> verständlich ohne Erklärung? (1–5)
6. Hat es Spass gemacht? Was am meisten / am wenigsten?
7. App-Wechsel und zurück: Spielstand noch da? (ja/nein)
8. Seite neu laden: Spielstand noch da? (ja/nein)
9. Grafik: wirkt die Werkstatt echt? (1–5) Was stört?
10. Fehler / Abstürze (Screenshot oder Bildschirmaufnahme gern anhängen)
```
Optional fps-Anzeige einblenden (`?debug=1`), damit der Mensch den Wert ablesen kann.

## 3. Auswerten
- Jede Rückmeldung → bestehendes Ticket ergänzen oder neues Ticket (Skill `ticket-schreiben`).
- Spass- und Verständniswerte unter 3 → vor neuen Features nachbessern.
- Ergebnis im Meilenstein-Bericht festhalten.
