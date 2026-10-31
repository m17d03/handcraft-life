---
name: modul-vertrag
description: Definiert und prüft den Vertrag für Spielmodule und Erweiterungen (Holz, Metall, 3D-Druck, Outdoor, Angeln …) inkl. Abhängigkeiten, Inhalte, Speicherstand-Versionierung und Kompatibilität. Verwenden beim Anlegen oder Ändern eines Moduls (Rolle Expansion Architect).
---

# Modul-Vertrag

Jeder Spielbereich ist ein Modul unter `src/modules/<id>/`. Das Grundsystem (`src/core/`) kennt
keine konkreten Module.

## Manifest (`src/modules/<id>/module.ts`)
```ts
export const manifest: ModuleManifest = {
  id: 'holz-basis',
  version: '1.0.0',
  requires: { core: '^1.0.0' },          // Semver
  extends: [],                            // z. B. ['angeln-basis'] für eine Erweiterung
  provides: {
    materials: ['fichte', 'eiche'],
    tools: ['massband', 'fuchsschwanz'],
    jobs: ['brett-zuschnitt'],
    items: ['brett'],                     // weiterverwendbare Gegenstände
  },
  saveSchemaVersion: 1,
  migrations: {},                         // { 2: (alt) => neu }
};
```

## Gemeinsame Kernsysteme, die Module nutzen
- Werkstück (Material, Masse, Zustand, Qualität)
- Werkzeug (Art, Zustand, erlaubte Arbeitsschritte)
- Arbeitsschritt (Eingabe → Ergebnis → Qualitätswert)
- Auftrag (Anforderungen, Bewertung, Belohnung)
- Inventar & Gegenstände (modulübergreifend weiterverwendbar)
- Speicherung (pro Modul eigener, versionierter Abschnitt)

## Regeln
- Erweiterungen fügen eine **neue Mechanik** hinzu (z. B. Strömung + Köderwahl beim Angeln),
  nicht nur mehr Inhalt.
- Ein Modul darf das Grundspiel nicht brechen: Ohne Erweiterung bleibt alles spielbar.
- Keine direkten Importe zwischen Modulen; nur über IDs und Kern-Schnittstellen.
- Jede Änderung am Speicherformat: `saveSchemaVersion` erhöhen + Migration + Test mit altem
  Spielstand aus `tests/fixtures/saves/`.

## Prüfliste vor Abnahme
- [ ] Manifest vollständig, Version erhöht
- [ ] Spiel startet mit und ohne das Modul
- [ ] Alter Spielstand lädt (Fixture-Test)
- [ ] Hergestellte Gegenstände in mindestens einem anderen Kontext nutzbar (oder begründet nicht)
