---
id: 013
titel: Vertical Slice verdrahten – Auftrag → Messen → Sägen → Ergebnis → Verkauf → Speichern
agent: engine-engineer
meilenstein: Phase 1 – Vertical Slice 0.1
status: open
reifegrad: Implementiert
blocked_by: [008, 009, 010, 011, 012]
branch: ticket/013-integration
---

## Ziel
`/spiel/` ist das spielbare Vertical Slice 0.1: Der Spieler nimmt einen Auftrag an, misst, reisst an, sägt,
sieht die Qualitätsnote mit Ursache, liefert ab, bekommt Geld – und alles übersteht Neuladen und App-Wechsel.

## Kontext
Ergebnisse von 008 (Logik), 009 (Spielstand), 010 (View-API), 011 (Befehle/HUD), 012 (Assets);
`docs/design/holz-brett-zuschnitt.md` §5 (Lernkurve: erster Kontakt geführt), QS S1–S5.

## Scope
- Darf ändern: `src/spiel/**`, `src/render/assets.ts` (GLB-Laden), kleine Anpassungen in `src/render/` nur für
  den Asset-Einbau, `tests/e2e/vertical-slice.spec.ts`
- Darf nicht ändern: Regeln in `src/core/`/`src/modules/` (Fehler dort → an Director melden), Projektdokumente

## Abnahmekriterien
- [ ] Ablauf vollständig spielbar ohne Debug-Hilfen; erster Durchgang mit kurzen Hinweisen (geführt)
- [ ] Ergebnis stimmt mit `src/core` überein (E2E liest Zustand per Debug-API und vergleicht mit der Karte)
- [ ] Autosave nach Anreissen, Schnitt, Abliefern, Kauf; `visibilitychange`/`pagehide` → sofort speichern;
      Neuladen mitten im Sägen → Schritt sauber zurückgesetzt, Geld/Lager erhalten (S2, S3, S4)
- [ ] Assets aus 012 eingebaut (Säge, Massband, Bleistift, Werkbank, Texturen); Budgets eingehalten
      (Draw Calls < 80, Dreiecke < 150 000, Download bis spielbar < 15 MB)
- [ ] E2E (WebKit-tauglich) für den kompletten Ablauf mit Touch; 0 Konsolenfehler (S1)
- [ ] `npm run check` grün; Perf-Bericht `docs/perf/<datum>-013.md`

## Protokoll
