---
id: 008
titel: Kern-Logik und Holz-Modul – Werkstück, Messen, Schnitt, Qualität, Auftrag, Wirtschaft (engine-frei)
agent: engine-engineer
meilenstein: Phase 1 – Vertical Slice 0.1
status: done
reifegrad: Implementiert
blocked_by: []
branch: ticket/008-kern-logik
---

## Ziel
Die gesamte Spielregel des Vertical Slice existiert als reines, getestetes TypeScript ohne Engine und ohne DOM.
Jeder Schritt (Bezugsende wählen, messen, anreissen, Blatt ansetzen, Züge, Ergebnis, Abliefern) ist eine
Funktion über einem Zustand.

## Kontext
- `docs/design/holz-brett-zuschnitt.md` §1–7 (verbindlich: Formeln §4.1, Qualität §4.2, Datenmodell §7)
- ADR 0002 (`docs/decisions/0002-modulvertrag.md`), `docs/design/modul-vertrag.md` §1–5.
  **IDs nach ADR 0002** (`holz.material.fichte-brett-2000`, `kern.…`), nicht wie im Datenmodell-Entwurf (`core.wood…`).
- `docs/design/core-loop.md` §5 (Wirtschaft: Start 40 G, Rohbrett 12 G, Regalbrett Basispreis 14 G, Preisfaktoren)
- Festlegungen Director für offene Designfragen: Messraster 0,5 mm; Toleranz verletzt → höchstens Stufe C;
  Währung „G“; Kappschnitt nicht im Slice (nur ein Schnitt, Bezugsende wählbar); Zufall nur über einen
  übergebenen Seed (deterministisch testbar).

## Scope
- Darf ändern: `src/core/**` (ohne `src/core/save/`), `src/modules/**`, `tests/unit/core/**`, `tests/unit/modules/**`
- Darf nicht ändern: `src/render/`, `src/input/`, `src/ui/`, `src/core/save/`, `package.json`, Projektdokumente, `docs/decisions/`

## Abnahmekriterien
- [x] `ModuleManifest`-Typ und Manifeste `kern` und `holz` (`src/modules/holz/module.ts`), Registry `src/modules/index.ts`
- [x] Stammdaten des Slice als typisierte Daten (Material Rohbrett, Werkzeug Fuchsschwanz, Produkt Regalbrett,
      Auftragsvorlage 600 mm ± 1 mm o. ä.) mit stabilen IDs
- [x] Zustandsautomat Zuschnitt: `bezugsende → messen → anreissen → ansetzen → saegen (8 Züge) → ergebnis`,
      ungültige Übergänge werfen nicht, sondern liefern unveränderten Zustand + Grund
- [x] Formeln §4.1/4.2 exakt umgesetzt; die 4 Rechenbeispiele aus §4.2 sind Unit-Tests (Q und Stufe stimmen)
- [x] Zusätzliche Tests: Blatt auf Abfallseite/mittig/Werkstückseite (0 / −0,8 / −1,6 mm), Gegenlenken nur in den
      ersten 3 Zügen wirksam, Ausriss bei Tempo, Endriss → Ausschuss, Toleranzkappung auf C
- [x] Wirtschaft: Material kaufen, Abliefern → Geld = runden(Basispreis × Preisfaktor), kein Softlock
      (Brett auf Anschreiben bei Geld < Preis), Reststück entsteht
- [x] Prozesse `messen`/`trennen` materialunabhängig (Material- und Werkzeugwerte als Daten); ESLint-Regel:
      `src/core` und `src/modules` dürfen `three` und DOM nicht importieren (`no-restricted-imports`)
- [x] Der Spielzustand ist JSON-serialisierbar (für Ticket 009)
- [x] `npm run check` grün, Abdeckung `src/core` + `src/modules` ≥ 90 % Zeilen (Vitest coverage, falls ohne neue
      Abhängigkeit nicht möglich: begründen)

## Nicht Teil dieses Tickets
Speichern (009), Darstellung (010), Eingabe (011), Verdrahtung (013), Skills/XP-Freischaltungen (nur XP zählen).

## Protokoll
- 2026-11-01 engine-engineer: umgesetzt (src/core, src/modules/holz), 87 Tests. Abweichungen: Stammdaten als TS-Konstanten
  statt JSON; Instanz-IDs als Zähler; Merkmal.laenge_mm für Endrisse.
- QA Runde 1: NACHARBEIT (B1 Endriss am Gegenende, B3 Laufzeitvalidierung, B5 Länge 0, B4 ESLint-Globals). Behoben
  (Commit 786ab40; B4 durch Director in eslint.config.js). Nachprüfung Director: QA-Suite (19 Fälle, 40 000-Schritt-Fuzz) grün.
- Director-Entscheide: Coverage-Kriterium entfällt (kein Werkzeug, Testliste + Fuzz als Ersatz); Nachschnitt nicht im Slice
  (Phase 2); Hinweis game-designer: max. Winkelfehler mit Fuchsschwanz 2,8° → Formel prüfen in Phase 2.
