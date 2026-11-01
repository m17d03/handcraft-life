# EXPANSION_REGISTRY

Status: **Freigegeben** (Mensch, 2026-11-01) (übernommen aus `docs/design/modul-vertrag.md` §7, ADR 0002).

| ID | Art | Version | Abhängigkeiten | Neue Mechanik | Phase | Status |
|---|---|---|---|---|---|---|
| `kern` | kern | 0.1.0 | – | Inventar, Wirtschaft, Aufträge, Skills, Speichern, Prozesse messen/trennen/bohren | 1 | Konzept |
| `holz` | grundmodul | 0.1.0 | kern ^0 | Ablängen mit Bezugsende/Fuge/Drift; später Bohren, Schleifen, Montage | 1–2 | Konzept |
| `metall` | modul | – | kern ^1 | Körnen, Zahnteilung, Drehzahl/Überhitzung, Entgraten | 3 | Konzept |
| `druck` | modul | – | kern ^1 | Ausrichtung/Schichthöhe/Füllgrad, Druck parallel zur Werkstatt | 3 | Konzept |
| `druck-erweitert` | erweiterung → `druck` | – | druck ^1 | Stützstrukturen, Düsen, Profile, PETG | 6 | Konzept |
| `jagd` | modul | – | kern ^1 | Ansprechen, Wind, Schussfeld; zuerst nur Fasan | 4 | Konzept |
| `jagd-hund-wasserwild` | erweiterung → `jagd` | – | jagd ^1 | Hund (Suchen, Apportieren, Bindung), Boot, Enten | 5+ | Konzept |
| `angeln` | modul | – | kern ^1 | Auswerfen/Einholen, Fischpräferenz | 5+ | Konzept |
| `angeln-fluesse-koeder` | erweiterung → `angeln` | – | angeln ^1 | Strömung, Köderwahl | 6 | Konzept |

`kern` und `holz` bleiben auf 0.x bis zum MVP (Ende Phase 2) und gehen dann auf 1.0.0. Querbezüge laufen nur
über Item-IDs (z. B. Lockente aus `holz` für `jagd`). Keines der Beispielpakete aus dem Master-Prompt §9
ist rein datengetrieben, weil jedes eine neue Mechanik mitbringt.
