# Meilenstein-Bericht Phase 1 – Vertical Slice 0.1 „Ein Regalbrett nach Auftrag“

Zeitraum: 2026-11-01 · Playtest des Menschen: 2026-11-01, iPhone 15 Pro Max (Home-Bildschirm-App)
Spiel: https://m17d03.github.io/handcraft-life/spiel/

## Erreicht
- Ablauf komplett spielbar: Auftrag → Bezugsende prüfen (Lupe) → messen → anreissen → ansetzen → sägen (8 Züge) →
  Qualitätsnote mit Ursache → abliefern → Geld; Einstieg geführt, ab Auftrag 3 knappe Hinweise.
- Tickets 008–014 umgesetzt, unabhängig von QA geprüft (je 1 Nacharbeitsrunde bei 008, 009, 010, 011, 013), gemergt;
  Reifegrad **Getestet** (Playtest bestanden).
- Playtest: sofort steuerbar, flüssig, ohne Erklärung verständlich, **Sägen macht Spass**, keine Safari-Störgesten,
  Spielstand übersteht App-Wechsel, Beenden und Neustart als Home-App, Gerät bleibt kühl.
- Budgets (Emulation): ≤ 28 Draw Calls, ≤ 15 000 Dreiecke, 4,4 MB Download, iPhone-Texturspeicher ≈ 28 MB.
- Testbasis: 239 Unit-Tests, 64 E2E (WebKit in CI, Chromium lokal).

## Nicht erreicht / offen
- Ticket 015 (Perf-Prüfung als CI-Schritt) noch nicht umgesetzt.
- Ticket 016 (Feinschliff: Nahansicht auf kleinen iPhones, Schräge in 3D, Speichern 0–300 ms nach Aktion,
  Debug-Anzeige in der Home-App) offen.
- Echte fps-Zahlen auf dem Gerät fehlen (Overlay war in der Home-App nicht aktiv).

## Gelernt
- Selektiver Realismus trägt: wenige, bedeutsame Züge statt monotoner Wiederholung wurde ausdrücklich gelobt.
- Unabhängige QA fand in fast jedem Ticket echte Fehler (u. a. Spielstand-Überschreiben, unfaire Rohbretter, blinde
  Ende-Wahl) – der Prozess lohnt sich.
- WebKit-CI ist unverzichtbar (fand `user-select`-Vererbung, die Chromium nicht zeigte).
- API-Nutzungslimits unterbrechen Agenten mehrfach; Zwischen-Commits und Fortsetzen per Nachricht verhindern Verluste.

## Nächster Schritt (Vorschlag)
1. Ticket 015 + 016 abschliessen (klein).
2. Phase 2 planen: Bohren, Schleifen, Montage, Auftragsbrett, Skills Holz/Wirtschaft – plus Kandidat **Holzarten**
   (Wunsch aus dem Playtest; braucht Mechanik-Entwurf und deine Freigabe, weil bisher im MVP ausgeschlossen).
