# PRODUCT_BACKLOG

Status: **Entwurf zur Freigabe** (Phase 0). Phase-1-Tickets werden erst nach der Freigabe von
`docs/PHASE0_ERGEBNIS.md` geschrieben.

## Erledigt
| Ticket | Titel | Phase | Reifegrad |
|---|---|---|---|
| 001 | Projekt-Grundgerüst, Startseite, Debug-Overlay, CI | S | Implementiert (Getestet nach iPhone-Check) |
| 002 | Kern-Loop, MVP, Realismus | 0 | Konzept |
| 003 | Steuerungskonzepte A/B + Mockups | 0 | Konzept |
| 004 | Qualitätskriterien | 0 | Konzept |
| 005 | Engine-Spike | 0 | Prototyp |
| 006 | Modulvertrag + Speicherformat | 0 | Konzept |
| 007 | Art Direction | 0 | Konzept |

## Phase 1 – Vertical Slice 0.1 (Vorschlag, Reihenfolge = Priorität)
1. Engine-Grundgerüst, Szene „Werkstatt“ (Blockout + Licht nach Stil A), `__perf()` – engine-engineer
2. Kern: Spielstand (IndexedDB, Version, Migration, Fixture-Test), `kern`- und `holz`-Manifest – engine-engineer
3. Touch-Steuerung Ich-Sicht quer, Werkbank-Modus, HUD, Hochformat-Hinweis – mobile-ux
4. Mechanik Brett ablängen: Messen, Anzeichnen, Sägen, Qualitätsformel (reine Logik mit Tests) – engine-engineer
5. Auftrag, Ergebniskarte, Verkauf, Geld – engine-engineer + mobile-ux (getrennte Tickets)
6. Assets: Säge, Massband, Werkbank, Holztexturen (Lizenzprüfung, KTX2) – asset-artist
7. PWA: Manifest, Icons, Speichern bei `visibilitychange`, `storage.persist()` – mobile-ux
8. Perf-CI-Schritt `tests/perf/` + Playtest – qa-performance

## Später
Phase 2: Bohren, Schleifen, Montage, Auftragsbrett, Skills Holz/Wirtschaft · Export/Import Spielstand ·
Phase 3: Metall, 3D-Druck · Phase 4: Fasan · Phase 5+: Ente, Hund, Boot, Angeln.
