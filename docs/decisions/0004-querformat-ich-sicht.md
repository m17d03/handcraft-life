---
adr: 0004
titel: Vertical Slice nur im Querformat, durchgehend Ich-Sicht (Steuerungskonzept B)
status: angenommen
datum: 2026-10-31
---

## Problem
Der Master-Prompt verlangt zwei Steuerungskonzepte und ein primäres Format. Die Regel von mobile-ux
verlangt eine ADR, wenn nur ein Format unterstützt wird. Phase 1 braucht eine feste Grundlage für die
Kamera, das HUD und die Tests.

## Optionen
| Option | Vorteile | Nachteile | Belege |
|---|---|---|---|
| A Hybrid (Third-Person draussen, Ich-Sicht an der Werkbank) | Figur sichtbar, gut für Outdoor/Jagd | Figur, Rig, Animationen, Third-Person-Kamera: zusammen ca. Aufwand L | `docs/design/steuerung-a-b.md` §2, §8 |
| **B durchgehend Ich-Sicht, Querformat** | Kein Figur-Aufwand; Arbeit fliesst in die Werkbank, also den Kern | Mögliche Übelkeit bei längerem Spielen (Gerät) | §3, §8; Mockups `/konzepte/steuerung/` |
| Hoch- und Querformat gleichwertig | Einhändig spielbar | Zwei-Daumen-Gesten (Gehen+Umsehen, Festhalten+Sägen) brauchen Breite; doppelter Test- und Layout-Aufwand | §7 |

## Entscheid
Der Vertical Slice (Phase 1) läuft nur im Querformat, mit durchgehender Ich-Sicht nach Konzept B. Im
Hochformat erscheint der Hinweis "Bitte quer halten". Die Werkbank-Bedienung ist in A und B gleich.

## Begründung
Die Werkbank-Interaktion ist der Kern des Spiels und in beiden Konzepten identisch. B spart ca. Aufwand L
ohne Verlust für Phase 1. In den Mockups liefen alle 25 Prüfungen grün (Chromium-Emulation); der
Daumentest auf dem iPhone steht noch aus.

## Folgen
- Phase-1-Tickets: Kamera, HUD und Tests nur für das Querformat.
- Das Inventar und die Aufträge dürfen später zusätzlich hochkant bedienbar werden.
- Konzept A wird neu bewertet, wenn Outdoor/Jagd beginnt (Phase 4).

## Rückweg
Die Kosten bleiben gering, solange HUD-Layout und Eingabe über Safe-Area-Variablen und getrennte
Eingabemodule laufen. Third-Person lässt sich als zusätzlicher Kameramodus nachrüsten.
