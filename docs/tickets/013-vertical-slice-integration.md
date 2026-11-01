---
id: 013
titel: Vertical Slice verdrahten – Auftrag → Messen → Sägen → Ergebnis → Verkauf → Speichern
agent: engine-engineer
meilenstein: Phase 1 – Vertical Slice 0.1
status: done
reifegrad: Getestet
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
- [x] Ablauf vollständig spielbar ohne Debug-Hilfen; erster Durchgang mit kurzen Hinweisen (geführt)
- [x] Ergebnis stimmt mit `src/core` überein (E2E liest Zustand per Debug-API und vergleicht mit der Karte)
- [x] Autosave nach Anreissen, Schnitt, Abliefern, Kauf; `visibilitychange`/`pagehide` → sofort speichern;
      Neuladen mitten im Sägen → Schritt sauber zurückgesetzt, Geld/Lager erhalten (S2, S3, S4)
- [x] Assets aus 012 eingebaut (Säge, Massband, Bleistift, Werkbank, Texturen); Budgets eingehalten
      (Draw Calls < 80, Dreiecke < 150 000, Download bis spielbar < 15 MB)
- [x] E2E (WebKit-tauglich) für den kompletten Ablauf mit Touch; 0 Konsolenfehler (S1)
- [x] `npm run check` grün; Perf-Bericht `docs/perf/<datum>-013.md`

## Protokoll
- 2026-11-01 engine-engineer (2× nach API-Limit fortgesetzt): Ablauf verdrahtet, Assets eingebaut, Stil-A-Licht auf Werkbank.
- Director-Entscheid (Commit 998eb6d, Regeländerung): Rohbrett mit einem sauberen (≤ 0,3 mm) und einem schiefen Ende
  (1–2 mm), Endriss am schiefen Ende – sonst war die Toleranz ±1 mm ohne Spielerfehler verfehlbar.
- QA Runde 1: NACHARBEIT – F1 Ende-Wahl blind, F2 Ergebniskarte verdeckt (blockierend), F3–F9. Director-Freigaben
  ausserhalb Scope: src/ui (Nahansicht endpruefung.ts), src/core/auftraege+typen+zuschnitt und holz-Stammdaten
  (Einstiegsaufträge ±2 mm laut Design §5).
- QA Nachprüfung: F1–F6, F8, F9 behoben; Regression grün (3 Touch-Durchgänge, Reload, Kontextverlust, Budgets,
  239 Unit, 64 E2E). Rest → Ticket 016: N1/N2 Layout auf schmalen iPhones (≤ 734 pt), N3 Schräge in 3D schwach,
  N4 Kopfzeile Nahansicht bei 300 pt Höhe, F7 Speichern 0–300 ms nach Aktion beim Verlassen.
- Director: auf Referenzgerät (15 Pro Max, 932 pt) nicht blockierend → gemergt für Playtest.
