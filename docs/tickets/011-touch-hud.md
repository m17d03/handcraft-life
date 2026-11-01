---
id: 011
titel: Touch-Eingabe und HUD – Gehen/Schauen, Werkbank-Gesten (Messen, Anreissen, Sägen), Ergebniskarte
agent: mobile-ux
meilenstein: Phase 1 – Vertical Slice 0.1
status: done
reifegrad: Getestet
blocked_by: []
branch: ticket/011-touch-hud
---

## Ziel
Die Bedienung aus Steuerungskonzept B existiert als echtes, getestetes Modul, das abstrakte Befehle
ausgibt und ein DOM-HUD über dem Canvas zeigt – unabhängig von Engine und Spielregeln.

## Kontext
- `docs/design/steuerung-a-b.md` (Konzept B, §1, §3, §4, §5), ADR 0004, `.claude/skills/touch-steuerung/SKILL.md`
- Mockup `public/konzepte/steuerung/b-ich-sicht.html` als Vorlage (Verhalten, Masse, Farben)
- `docs/design/holz-brett-zuschnitt.md` §3 (Gesten je Schritt), Stil A aus `docs/ART_DIRECTION.md`
- QS U1–U7 (`docs/qa/quality-standards-entwurf.md`)

## Scope
- Darf ändern: `src/input/**`, `src/ui/**`, `tests/unit/input/**`, `tests/e2e/hud.spec.ts`, `hud-demo/index.html` +
  `src/hud-demo/main.ts` (eigenständige Testseite ohne 3D, wird in `vite.config.ts` NICHT eingetragen – stattdessen
  bitte dem Director melden; Director trägt den Eingang ein)
- Darf nicht ändern: `src/render/`, `src/core/`, `src/modules/`, `vite.config.ts`, `package.json`, Projektdokumente

## Schnittstelle (verbindlich, `src/input/befehle.ts`)
```ts
export type Befehl =
  | { art: 'bewegen'; vorwaerts: number; seitwaerts: number }      // pro Frame, -1..1
  | { art: 'umschauen'; dxPx: number; dyPx: number }
  | { art: 'tippen'; xCss: number; yCss: number }
  | { art: 'halten'; xCss: number; yCss: number }                   // ≥ 300 ms
  | { art: 'aktion'; id: string }                                   // HUD-Taste, z. B. 'werkbank', 'zurueck', 'anreissen', 'weiter', 'abliefern'
  | { art: 'massband'; deltaMm: number } | { art: 'massbandSetzen'; xCss: number; yCss: number }
  | { art: 'blattVersatz'; deltaMm: number }
  | { art: 'sägezug'; seitenabweichung: number; tempo: number }     // ein Hin+Her = ein Zug, Werte -1..1 bzw. 0..2
  | { art: 'stuetzen'; an: boolean };
```
HUD-API `src/ui/hud.ts`: `modus('erkunden' | 'werkbank-messen' | 'werkbank-ansetzen' | 'werkbank-saegen' | 'ergebnis')`,
`auftragAnzeigen(text)`, `messwertAnzeigen(mm)`, `lupe(pos | null)`, `saegeFortschritt(zug, von, tempoOk)`,
`ergebnisKarte({stufe, q, hauptursache, preis} | null)`, `geldAnzeigen(g)`, `hinweis(text | null)`.

## Abnahmekriterien
- [x] Erkunden: linker Bildschirmbereich = Stick am Daumen, rechts = Umschauen, gleichzeitig; Randzone 20 pt + Safe Area
- [x] Werkbank: Massband-Griff ziehen (Raster 0,5 mm, Feintasten ±0,5 mm), Lupe neben dem Daumen, Anreissen-Taste,
      Blatt ansetzen (seitlich ziehen ±3 mm), Sägen = Wischen rechts auf einer Führungsspur, links „stützen“ halten
- [x] Sägezug-Erkennung als reine Funktion mit Unit-Tests (Richtungsumkehr, Tempo, Seitenabweichung)
- [x] Ergebniskarte mit Stufe, Begründung, Preis; Tasten „Abliefern“ / „Neues Brett“
- [x] Feedback ≤ 100 ms (U2), Touch-Ziele ≥ 44 pt (U1), Text ≥ 15 pt, Kontrast AA, `touch-action: none` auf der
      Spielfläche, Hochformat-Hinweis
- [x] HUD-Demo-Seite bedienbar mit Fake-Werten; E2E (WebKit-tauglich) mit Touch für Stick, Massband, Sägezug
- [x] `npm run check` grün; Gesten-Tabelle im Abschlussbericht

## Nicht Teil dieses Tickets
3D-Darstellung, Spielregeln, Ton (Phase 2), PWA (014).

## Protokoll
- 2026-11-01 mobile-ux: umgesetzt (src/input, src/ui, hud-demo). API-Ergänzungen: aktionstaste, massbandGriff,
  blattVersatzAnzeigen, Aktion 'neuesBrett'.
- QA Runde 1: NACHARBEIT – B1 gleichgerichtete Hälften als Zug, B2 Gesten laufen nach Drehen/hidden weiter, B3 Zittern,
  B4 Abstand Ansetzfläche/Taste 0 pt. Behoben (fd27329). Nachprüfung Director: QA-Prüftests 18/18, E2E 36/36 (Chromium).
- Offen (Gerät): Daumengefühl, Rand-Wischen, Safe Areas, Lupe unter Daumen. WebKit-CI nach Push.
- Director: Playwright-Port per PW_PORT eingeführt (parallele Worktrees).
