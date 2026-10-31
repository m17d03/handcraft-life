# QUALITY_STANDARDS

Status: **Konzept – Entwurf zur Freigabe** (Phase 0). Die vollständige Kriterienliste (33 Kriterien
P/U/S/G mit Messmethode und Startphase) steht in `docs/qa/quality-standards-entwurf.md` und gilt mit
der Freigabe als verbindlich. Playtest-Vorlage: `docs/qa/playtest-vorlage.md`.

## Budgets (CLAUDE.md, mit Präzisierungen aus Ticket 004)
| Grösse | Ziel | Harte Grenze | Messung |
|---|---|---|---|
| fps Ziel-iPhone (1-s-Fenster, Standardrunde, ohne Laden) | ≥ 30 | nie < 25 | (Gerät) `?debug=1` |
| Längster Frame ("max ms") | ≤ 50 ms | ≤ 100 ms | (Gerät) |
| Frame-Zeit p95 | ≤ 33,3 ms | ≤ 40 ms | Gerät; Emulation nur als Trend |
| Draw Calls / Frame | < 80 | 120 | `__perf()`, Playwright |
| Dreiecke im Bild | < 150 000 | 300 000 | `__perf()` |
| GPU-Texturspeicher (gerechnet im iPhone-Format) | < 120 MB | 200 MB | `__perf()` |
| Erster Download bis spielbar (gzip) | < 15 MB | 25 MB | Build + Playwright |
| Startseite (gzip) | < 100 kB | 250 kB | Build |
| Ladezeit iPhone, WLAN | < 8 s | 15 s | (Gerät) |

## Testpyramide
Vitest (Logik, Speichern, Migration) → Playwright Chromium lokal (Vorprüfung) → **Playwright WebKit in
GitHub-CI (verbindlich)** → Mensch auf dem iPhone (fps, Wärme, Gefühl, Safe Areas).

## Definition of Done
Siehe CLAUDE.md und `docs/qa/quality-standards-entwurf.md` §5 (je Statusstufe). Ein Screenshot allein
macht nichts "fertig".

## Offen
- Referenz-iPhone (unterste Grenze) legt der Mensch fest.
- Folge-Ticket: eigener CI-Schritt für `tests/perf/`.
