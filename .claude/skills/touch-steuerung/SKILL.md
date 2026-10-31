---
name: touch-steuerung
description: Verbindliche Regeln für Touch-Gesten, Kamera, HUD, Safe Areas und PWA-Verhalten auf iPhone Safari. Verwenden bei jeder Bedien- oder Interface-Arbeit.
---

# Touch-Steuerung & Mobile UX

## Phase 0: zwei Konzepte vergleichen
Master-Prompt verlangt zwei Steuerungskonzepte und eine begründete Empfehlung:
- **Konzept A – Hybrid:** Third-Person beim Gehen/Erkunden, automatischer Wechsel in
  First-Person an der Werkbank, eigener Interaktionsmodus für Werkzeug-Minispiele.
- **Konzept B – durchgehend First-Person:** Gehen und Arbeiten aus einer Kamera, Werkbank
  zoomt in eine feste Arbeitsansicht.
Pro Konzept: Gesten-Tabelle, HTML-Mockup (Skill `konzept-visuals`), Aufwand (Third-Person
braucht Figur + Animationen!), Risiken. Empfehlung als Entscheidung an den Director.
Realistischer Vorschlag für den Vertical Slice: B (keine Spielfigur-Animationen nötig);
A erst, wenn Outdoor/Jagd kommt.

## Grundsteuerung (Querformat, Standard)
| Bereich | Geste | Aktion |
|---|---|---|
| Linke Bildhälfte | Ziehen | Gehen (virtueller Stick, erscheint am Daumen) |
| Rechte Bildhälfte | Ziehen | Umschauen |
| Objekt | Antippen | Auswählen / Werkzeug ansetzen |
| Objekt | Halten 300 ms | Kontextaktionen |
| Arbeitsmodus | Spezialgesten der Mechanik | z. B. Säge führen |
| Oben rechts | Antippen | Pause/Menü |

Arbeitsmodus: Beim Arbeiten an einem Werkstück wechselt die Kamera in eine feste Arbeitsansicht;
Gehen ist dann aus. Verlassen per sichtbarer Zurück-Taste.

## Pflichtregeln
- Touch-Ziele ≥ 44 × 44 pt, Abstand ≥ 8 pt.
- Safe Areas: `env(safe-area-inset-*)` für alle HUD-Elemente.
- Seiten-Zoom und Rand-Wischen verhindern: `touch-action: none` auf dem Canvas,
  `user-scalable=no` im Viewport, keine Gesten in den äussersten 20 pt am linken/rechten Rand.
- Feedback ≤ 100 ms (Hervorhebung, Ton, optional Vibration – Vibration ist in iOS Safari
  nicht verfügbar, also nie darauf verlassen).
- Kein Hover-Zustand als einzige Information.
- Text ≥ 15 pt, Kontrast WCAG AA.

## PWA
- `manifest.webmanifest` mit `display: fullscreen` oder `standalone`, Icons 180/192/512 px,
  `apple-touch-icon`, `apple-mobile-web-app-capable`.
- Spielstand beim Wechsel in den Hintergrund speichern (`visibilitychange`).
- Audio erst nach erster Berührung starten (iOS-Vorgabe).

## Tests
Playwright mit `devices['iPhone 15']` (WebKit), Querformat und Hochformat, Touch-Events
simulieren. Was nur echt prüfbar ist (Daumengefühl, Systemgesten), als `(Gerät)` im Ticket markieren.
