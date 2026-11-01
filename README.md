# Handcraft Life

Mobiles 3D-Handwerks- und Outdoor-Spiel für den iPhone-Browser. Hobbyprojekt, entwickelt mit
Claude Code und mehreren spezialisierten Agenten.

- Regeln und Rollen: [`CLAUDE.md`](CLAUDE.md)
- Plan und Bewertung: [`UMSETZUNGSPLAN.md`](UMSETZUNGSPLAN.md)
- Ursprünglicher Auftrag: [`docs/MASTER_PROMPT.md`](docs/MASTER_PROMPT.md)
- Spielbarer Stand: https://m17d03.github.io/handcraft-life/ (fps/Fehler: `?debug=1`)

## Entwicklung

| Befehl | Zweck |
|---|---|
| `npm run dev` | Dev-Server |
| `npm run check` | Typecheck + Lint + Unit-Tests |
| `npm run test:e2e` | Playwright, WebKit mit iPhone-15-Profil (hoch + quer) |
| `PW_LOCAL_CHROMIUM=1 npm run test:e2e` | Notlösung ohne WebKit (Cloud-Sitzung), nur Chromium |
| `PW_PORT=4xxx …` | eigener Port je Worktree (parallele Agenten) |
| `npm run build` | Produktions-Build nach `dist/` |

CI (`.github/workflows/ci.yml`) führt alle Prüfungen inkl. WebKit bei jedem Push aus;
`deploy-pages.yml` veröffentlicht `main` auf GitHub Pages.
