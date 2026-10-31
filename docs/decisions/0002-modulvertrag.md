---
adr: 0002
titel: Spielbereiche sind Module im selben Code mit statischem Manifest, stabilen IDs und materialunabhängigen Kern-Prozessen – kein Plug-in-System
status: vorgeschlagen
datum: 2026-10-31
---

## Problem
Holz, Metall, 3D-Druck, Jagd und Angeln sollen nacheinander ergänzt werden, ohne Grundumbau und ohne
alte Spielstände zu brechen (Master-Prompt §9). Vor dem ersten Code (Phase 1, Vertical Slice) muss
feststehen, wo Modulgrenzen liegen, wie Inhalte benannt werden und was der Kern kann – sonst entsteht
Holz-spezifischer Kern-Code, den Metall später kopieren muss. Details: `docs/design/modul-vertrag.md`.

## Optionen
| Option | Vorteile | Nachteile | Messwerte/Belege |
|---|---|---|---|
| A Plug-in-System: Module als getrennte Bundles, zur Laufzeit geladen, stabile öffentliche API | echte Drittanbieter-Pakete möglich | API-Stabilität, Versionsmatrix, Laden/Sicherheit; kein Nutzen ohne Dritte; CLAUDE.md verbietet es vor belegtem Nutzen | kein Bedarf belegt |
| **B Module im selben Code**: `src/modules/<id>/` mit statischem Manifest, zentrale Liste, Aktivierung pro Spielstand, Kontakt nur über Inhalts-IDs + Kern-Schnittstellen | einfach, typgeprüft, ein Build; Vertrag trotzdem explizit; Abschalten pro Spielstand möglich | jedes Modul ist im Build (Downloadgrösse → ggf. `import()`-Chunk) | Bewertung `modul-vertrag.md` §5: alle §9-Beispiele brauchen ohnehin neuen Code |
| C Kein Modulbegriff, nur Ordner + Feature-Flags | am wenigsten Aufwand heute | keine Regeln für IDs, Abhängigkeiten, Speicherabschnitte → Kopplung wächst unbemerkt | – |
| D Alles datengetrieben (Content-Packs + generische Engine/ECS) | Inhalte ohne Code | neue Mechaniken (Strömung, Hund, Druck) passen nicht in Daten; Überarchitektur | `modul-vertrag.md` §5: kein §9-Paket rein datengetrieben |

## Entscheid
Option B: Module im selben Code mit Manifest (`ModuleManifest`), Inhalts-IDs `<modul>.<typ>.<name>`,
keine Importe zwischen Modulen, und materialunabhängige Kern-Prozesse `messen`, `trennen`, `bohren`,
die Material- und Werkzeugwerte als Daten erhalten; materialtypische Fehlerbilder sind kleine Modul-Regeln.

## Begründung
- Master-Prompt §9 verlangt ehrliche Bewertung statt Plug-in-Pflicht; die Bewertung (`modul-vertrag.md` §5)
  zeigt: Jede Beispiel-Erweiterung bringt neue Mechanik = Code. Ein Laufzeit-Plug-in-System würde nichts sparen.
- `realismus-bewertung.md` §2: Metall bleibt Aufwand M nur, wenn Messen/Sägen/Bohren parametrisch sind **[P]**.
  Die Kern-Prozesse setzen das direkt um; die Holz-Qualitätsformel (`holz-brett-zuschnitt.md` §4.2) ist als
  Daten-`Bewertung` darstellbar.
- Ein Manifest kostet wenige Zeilen pro Modul und macht die §9-Pflichtangaben (ID, Version, Abhängigkeiten,
  Assets, Speicherregeln, Tests) prüfbar (Start-Prüfung, Vitest).
- Noch nicht belegt: dass die generischen Prozesse für Metall ohne Umbau reichen **[H]** – Prüfung im Metall-Spike (Phase 3).

## Folgen
- Einfacher: neue Inhalte als JSON; Module einzeln testbar (Logik ohne Engine); Spiel startet mit/ohne Modul.
- Schwerer: Der Holz-Slice muss Messen/Trennen im Kern statt direkt im Holz-Code bauen (geschätzt +1 Sitzung **[H]**).
- Anzupassen nach Annahme: `TECH_ARCHITECTURE.md` (Ordner, Abhängigkeitsrichtung), `EXPANSION_REGISTRY.md`
  (Entwurf in `modul-vertrag.md` §7), ESLint-Regel `no-restricted-imports` (Phase-1-Ticket),
  Skill `modul-vertrag` (Manifest-Felder `art`, `mechanics`, `assets`, `tests`; Semver-Prüfung nur Hauptversion),
  ID-Präfix in `holz-brett-zuschnitt.md` §7 (`core.wood.…` → `holz.…`).

## Rückweg
- B → A (echte Plug-ins): mittel. Manifest und ID-Regeln bleiben; nötig wären Bundle-Trennung und eine
  eingefrorene Kern-API. Der Vertrag ist dafür die Vorarbeit.
- Kern-Prozesse wieder materialspezifisch machen: billig (Code verschieben), solange nur Holz existiert.
- Inhalts-IDs umbenennen: teuer nach dem ersten veröffentlichten Spielstand (Migration je ID) – darum vor Phase 1 festlegen.
