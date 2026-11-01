# Meilenstein-Bericht Phase S + Phase 0 (Preproduction)

Zeitraum: 2026-10-31 bis 2026-11-01 · Freigabe durch den Menschen: 2026-11-01 („Freigabe wie empfohlen“)

## Erreicht
- **Phase S:** Vite, TS strict, Vitest, Playwright (iPhone 15 hoch/quer), ESLint, CI mit WebKit, Pages-Deploy.
  Startseite mit Debug-Overlay. Ticket 001: Implementiert, QA-geprüft.
- **Phase 0:** Tickets 002–007 abgenommen. 9 Projektdokumente sind freigegeben, ADR 0001–0004 angenommen.
  - **Engine:** Three.js, auf Wunsch des Menschen nach bester Performance gewählt
    (`docs/perf/2026-11-01-engine-benchmark.md`).
  - **Stil:** A „Honigwerkstatt“.
  - **Steuerung:** Querformat mit durchgehender Ich-Sicht.
  - **Umfang:** MVP = Ende Phase 2; in Phase 4 nur Fasan.

## Nicht erreicht / offen
- Kein iPhone-Playtest der Engine-Szenen; der Mensch hat darauf verzichtet. Die absoluten fps werden im
  Phase-1-Playtest geprüft.
- Asset-Lizenzen sind ungeprüft (Asset-Seiten in der Cloud gesperrt).
- Der Blender-Konnektor ist in der Cloud-Sitzung nicht verfügbar.
- Referenz-iPhone-Modell noch nicht genannt.

## Gelernt
- **Cloud-Umgebung:** WebKit, Poly Haven, ambientCG und Kenney sind gesperrt → WebKit läuft in GitHub-CI.
  Lizenzprüfung braucht den Menschen oder eine Freigabe in den Netzwerkeinstellungen.
- **Agenten:** Ein Agent kann mitten in der Arbeit durch ein Nutzungslimit abbrechen. Die Arbeit im Worktree
  bleibt erhalten, und der Agent lässt sich fortsetzen.
- **ESLint:** Muss `.claude/` (Agenten-Worktrees) ausschliessen, sonst läuft der Speicher voll.
- **Messungen:** Die Frame-Zeit in Emulation ist nur als Rangfolge belastbar. Wiederholte Läufe in
  wechselnder Reihenfolge machen sie robust.

## Nächster Schritt
`/milestone-run Phase 1` – Vertical Slice 0.1 „Ein Regalbrett nach Auftrag“ (Backlog in `docs/PRODUCT_BACKLOG.md`).
