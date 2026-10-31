# AGENT_RESPONSIBILITIES

Status: **Freigegeben durch Director** (Struktur in CLAUDE.md, in Phase 0 erprobt).

| Rolle (Master-Prompt) | Umsetzung | Schreibt in | Phase-0-Ergebnis |
|---|---|---|---|
| A Director & PM | Hauptsession, Skill `milestone-run` | Projektdokumente, `docs/decisions/`, Integration in `main` | PHASE0_ERGEBNIS.md |
| B Game Design & Economy + F Realism | Agent `game-designer` | `docs/design/` | Ticket 002 |
| C Engineering + G Expansion (Technik) | Agent `engine-engineer` | `src/`, `spikes/`, `tests/` | Tickets 005, 006 |
| D Graphics & 3D Art | Agent `asset-artist` | `assets/`, `docs/art/`, `public/konzepte/stil/` | Ticket 007 |
| E Mobile UX | Agent `mobile-ux` | `src/ui/`, `src/input/`, Konzept-Mockups | Ticket 003 |
| H QA & Performance | Agent `qa-performance` (repariert nichts) | Berichte, `tests/` (wenn erlaubt) | Tickets 001 (Prüfung), 004 |
| G Expansion Architect | Skill `modul-vertrag` | – | über Ticket 006 |
| Technical Producer | Skill `ticket-schreiben` | `docs/tickets/` | Tickets 001–007 |

## Erfahrungen aus Phase 0
- Tatsächlich parallel liefen jeweils bis zu drei Agenten in getrennten Git-Worktrees: Welle 1
  (002, 003, 004) und Welle 2 (005, 006, 007). Dateikonflikte gab es keine.
- `game-designer` hat kein git: Der Director committet für ihn.
- Die Cloud-Umgebung sperrt WebKit-Downloads und Asset-Seiten (Poly Haven, ambientCG, Kenney). WebKit läuft
  deshalb in GitHub-CI, und Lizenzen prüft der Mensch oder eine freigeschaltete Domain.
