---
name: engine-spike
description: Baut dieselbe kleine Werkstatt-Demoszene in mehreren Web-3D-Engines, misst sie und bereitet die Engine-Entscheidung per ADR vor. Verwenden in Meilenstein M1 oder wenn die Engine-Wahl erneut geprüft werden soll.
---

# Engine-Spike

Ziel: Entscheidung auf Basis einer echten Szene auf dem iPhone, nicht eines Papiervergleichs.

## Kandidaten (Standard)
1. Babylon.js
2. PlayCanvas Engine (Open-Source-Engine über npm, ohne Editor)
3. Three.js (als Referenz: sehr verbreitet, aber mehr Eigenbau für Physik/GUI)

Vor dem Start aktuelle Versionen und Doku prüfen (Release-Notes, Mobile-Hinweise).

## Identische Testszene pro Engine (`spikes/<engine>/`)
- Raum 6 × 4 m, Werkbank, Holzbalken mit PBR-Holztextur (2048² → KTX2), Säge als einfaches Modell
- 1 Richtungslicht mit Schatten + Umgebungslicht (HDRI, klein)
- First-Person-Kamera mit Touch: linker Daumen bewegen, rechter Daumen schauen
- Interaktion: Balken antippen → hervorheben → Schnittlinie per Wischen setzen
- 20 zusätzliche Kleinteile (Schrauben, Werkzeuge) als Instanzen, um Draw Calls zu testen

## Messen
- Automatisch (Skill `perf-budget-check`): Bundle-Grösse, Ladezeit, Draw Calls, Dreiecke,
  Frame-Zeit in WebKit-Emulation (nur Relativvergleich!).
- Auf echtem Gerät durch den Menschen (Skill `iphone-playtest`): fps, Hitze nach 5 Min.,
  Touch-Gefühl, Grafikeindruck, Absturz bei App-Wechsel.

## Bewertung (Gewichtung)
| Kriterium | Gewicht |
|---|---|
| Echtes iPhone: fps + Stabilität | 30 % |
| Grafikeindruck bei gleichem Budget | 20 % |
| Aufwand für Touch, Physik, GUI | 20 % |
| Bundle-Grösse/Ladezeit | 10 % |
| TypeScript-Qualität, Doku, Pflege | 10 % |
| Wie gut können Agenten damit arbeiten (Beispiele, stabile API) | 10 % |

## Ergebnis
- `docs/spikes/engine-vergleich.md` mit Tabelle und Messwerten
- ADR-Vorschlag "Engine-Wahl" (Skill `architektur-entscheid`), Entscheid durch den Director
- Spikes werden nach dem Entscheid nicht weitergepflegt
