---
id: 001
titel: Projekt-Grundgerüst einrichten – Vite, TS strict, Vitest, Playwright, ESLint, Startseite mit Debug-Overlay
agent: Director (Phase S, laut UMSETZUNGSPLAN.md)
meilenstein: Phase S
status: done
reifegrad: Implementiert
blocked_by: []
branch: ticket/001-projekt-setup
---

## Ziel
Es gibt ein baubares, getestetes Web-Projekt. Eine einfache Startseite ist per GitHub-Pages-Link
auf dem iPhone erreichbar; mit `?debug=1` zeigt ein Overlay fps und Fehler.

## Kontext
CLAUDE.md (Tech-Grundsätze, Definition of Done), UMSETZUNGSPLAN.md Abschnitt 3 (Phase S),
`.github/workflows/deploy-pages.yml`.

## Scope
- Darf ändern: `package.json`, `package-lock.json`, `tsconfig*.json`, `vite.config.ts`,
  `vitest.config.ts`, `playwright.config.ts`, `eslint.config.js`, `index.html`, `src/`, `public/`,
  `tests/`, `.gitignore`, `.github/workflows/`, `README.md`
- Darf nicht ändern: `docs/decisions/`, `docs/GAME_VISION.md`, `docs/MASTER_PROMPT.md`

## Abnahmekriterien
- [x] `npm ci` auf leerem Checkout erfolgreich
- [x] `npm run typecheck` (TS strict, `noUncheckedIndexedAccess`) ohne Fehler
- [x] `npm run lint` ohne Fehler und ohne Warnungen
- [x] `npm test` (Vitest) grün, mindestens ein Unit-Test für die fps-Berechnung des Overlays
- [x] `npm run test:e2e` (Playwright, WebKit, Profil `iPhone 15`) grün: Startseite lädt ohne
      Konsolenfehler; Overlay ist ohne `?debug=1` unsichtbar und mit `?debug=1` sichtbar
      und zeigt einen fps-Wert; ein absichtlich ausgelöster Fehler erscheint im Overlay
- [x] `npm run build` erzeugt `dist/`; erster Download < 100 kB (gzip)
- [x] Startseite: Viewport für iPhone (Safe Areas, kein Seiten-Zoom), zeigt Projektname,
      Status "Phase S" und ob WebGL 2 verfügbar ist
- [ ] GitHub-Pages-Workflow auf `main` erfolgreich; https://m17d03.github.io/handcraft-life/ lädt
- [ ] (Gerät) Startseite und `?debug=1` auf dem iPhone lesbar, fps-Wert sichtbar

## Nicht Teil dieses Tickets
3D-Engine, PWA-Manifest, Speicherung, Spiellogik.

## Protokoll
- 2026-10-31 Director: umgesetzt. Abweichung: WebKit ist in der Cloud-Sitzung nicht installierbar
  (Netzwerkregel sperrt cdn.playwright.dev) → WebKit-Tests laufen in `.github/workflows/ci.yml`
  (grün, Run 41244493173); lokal Notlösung `PW_LOCAL_CHROMIUM=1` (Chromium, iPhone-Profil).
- Pages-Workflow war ungültig (`hashFiles` in Job-`if` nicht erlaubt) → Bedingung entfernt.
- QA (qa-performance): ABNAHME EMPFOHLEN. Befunde behoben: Viewport-Anzeige nach Rotation,
  Hänger > 1 s wurden in "max ms" verschluckt (Test ergänzt), Ressourcen-Ladefehler erscheinen jetzt
  im Overlay (E2E-Test ergänzt), Overlay max. 40 % Bildhöhe. Bewusst: Sourcemaps werden mit
  veröffentlicht (Fehlersuche auf dem iPhone); 11 moderate npm-audit-Befunde nur in Dev-Werkzeugen
  (eslint/minimatch), kein Einfluss auf das ausgelieferte Spiel.
- Budget: docs/perf/2026-10-31-001.md. Offen: Pages-Deploy auf main, (Gerät)-Prüfung durch den Menschen.
