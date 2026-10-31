---
id: 001
titel: Projekt-Grundgerüst einrichten – Vite, TS strict, Vitest, Playwright, ESLint, Startseite mit Debug-Overlay
agent: Director (Phase S, laut UMSETZUNGSPLAN.md)
meilenstein: Phase S
status: in_progress
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
- [ ] `npm ci` auf leerem Checkout erfolgreich
- [ ] `npm run typecheck` (TS strict, `noUncheckedIndexedAccess`) ohne Fehler
- [ ] `npm run lint` ohne Fehler und ohne Warnungen
- [ ] `npm test` (Vitest) grün, mindestens ein Unit-Test für die fps-Berechnung des Overlays
- [ ] `npm run test:e2e` (Playwright, WebKit, Profil `iPhone 15`) grün: Startseite lädt ohne
      Konsolenfehler; Overlay ist ohne `?debug=1` unsichtbar und mit `?debug=1` sichtbar
      und zeigt einen fps-Wert; ein absichtlich ausgelöster Fehler erscheint im Overlay
- [ ] `npm run build` erzeugt `dist/`; erster Download < 100 kB (gzip)
- [ ] Startseite: Viewport für iPhone (Safe Areas, kein Seiten-Zoom), zeigt Projektname,
      Status "Phase S" und ob WebGL 2 verfügbar ist
- [ ] GitHub-Pages-Workflow auf `main` erfolgreich; https://m17d03.github.io/handcraft-life/ lädt
- [ ] (Gerät) Startseite und `?debug=1` auf dem iPhone lesbar, fps-Wert sichtbar

## Nicht Teil dieses Tickets
3D-Engine, PWA-Manifest, Speicherung, Spiellogik.

## Protokoll
<wird bei Abschluss gefüllt>
