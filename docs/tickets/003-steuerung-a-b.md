---
id: 003
titel: Zwei Touch-Steuerungskonzepte (A Hybrid, B First-Person) mit klickbaren HTML-Mockups
agent: mobile-ux
meilenstein: Phase 0
status: open
reifegrad: Konzept
blocked_by: [001]
branch: ticket/003-steuerung
---

## Ziel
Zwei vergleichbare Steuerungskonzepte mit Gesten-Tabellen, Aufwand, Risiken und Empfehlung –
und Mockups, die der Mensch auf seinem iPhone per Link öffnen und antippen kann.

## Kontext
- `docs/MASTER_PROMPT.md` §11 (Mobile Steuerung), §15 Nr. 3 und 7
- `.claude/skills/touch-steuerung/SKILL.md` (verbindlich), `.claude/skills/konzept-visuals/SKILL.md`
- Bestehende Startseite (`index.html`, `src/style.css`) für Farbwelt

## Scope
- Darf ändern: `docs/design/steuerung-a-b.md`, `public/konzepte/steuerung/**`
  (statische HTML/CSS/JS-Dateien ohne Build-Schritt, werden von Vite unverändert nach `dist/` kopiert
  und sind dann unter https://m17d03.github.io/handcraft-life/konzepte/steuerung/ erreichbar)
- Darf nicht ändern: `src/`, `index.html`, Projektdokumente, `docs/decisions/`

## Abnahmekriterien
- [ ] `steuerung-a-b.md`: pro Konzept Gesten-Tabelle (Geste → Aktion → Feedback ≤ 100 ms),
      Kamera-/Moduswechsel, Werkbank-Interaktion (Messen, Anzeichnen, Sägen), Inventar/Aufträge,
      Jagd-Interaktion (nur skizziert), Aufwand (inkl. Figur/Animationen bei Third-Person), Risiken
- [ ] Empfehlung primäres Spielformat (Quer/Hoch) und Konzept für den Vertical Slice, mit Begründung
- [ ] Mockups (je eine Seite pro Konzept + `index.html` mit Übersicht): Querformat iPhone (852 × 393 pt),
      sichtbar beschriftet „KONZEPT – kein Spielscreenshot“; virtueller Stick erscheint am Daumen,
      Umschau-Bereich, Kontext-Buttons, Arbeitsansicht Werkbank mit Säge-Geste, Inventar/Auftrags-Panel;
      Touch-Ziele ≥ 44 pt, Safe-Area-Insets, kein Seiten-Zoom
- [ ] Mockups reagieren auf Touch mit sichtbarem Feedback (reine DOM-Attrappe, keine 3D-Engine)
- [ ] Mockups mit Playwright (iPhone-15-Profil quer; lokal `PW_LOCAL_CHROMIUM=1`-Ansatz bzw.
      `executablePath: '/opt/pw-browsers/chromium'`) als PNG gerendert nach
      `public/konzepte/steuerung/screenshots/` (max. 300 kB je Bild)
- [ ] Liste der Punkte, die nur auf dem echten Gerät prüfbar sind (Gerät)

## Nicht Teil dieses Tickets
Implementierung im Spiel, PWA-Manifest, 3D-Szene.

## Protokoll
