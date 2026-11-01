---
id: 016
titel: Vertical-Slice-Feinschliff – Nahansicht auf kleinen iPhones, Schräge in 3D, Speichern beim Verlassen
agent: mobile-ux (N1, N2, N4) / engine-engineer (N3, F7) – vor Start teilen
meilenstein: Phase 1 – Vertical Slice 0.1
status: open
reifegrad: Implementiert
blocked_by: [013]
branch: ticket/016-feinschliff
---

## Ziel
Restbefunde aus der QA von Ticket 013 beheben, ergänzt um die Rückmeldungen aus dem ersten iPhone-Playtest.

## Befunde (QA 013, Nachprüfung)
- N1: Tasten der Nahansicht am Brettende zu schmal (iPhone SE 667 pt: „Von hier messen“ abgeschnitten; 734 pt: „Anderes“ läuft über).
- N2: Riss-Warnung bei Breite ≤ 734 pt mit „…“ abgeschnitten – genau die Handlungsanweisung fehlt.
- N3: Schräges Ende in 3D kaum erkennbar (≈ 5 px) – Wahl hängt allein an der Nahansicht.
- N4: Bei 300 pt Höhe (Safari-Leisten sichtbar) liegt die Kopfzeile der Nahansicht unter dem Hinweisbalken.
- F7: Verlassen 0–300 ms nach „Anreissen“ verliert die Markierung (Geld/Lager nie betroffen); evtl. src/core/save.

## Abnahmekriterien
- [ ] N1/N2/N4 bei 667×375, 734×343, 852×393, 932×430 und 932×300 ohne Abschneiden/Überdeckung (E2E mit Screenshots)
- [ ] N3: schiefes Ende in der Werkbankansicht ohne Nahansicht erkennbar (Markierung, Schatten oder Kontur), Screenshot-Vergleich
- [ ] F7: Verlassen 0 ms nach einer Aktion verliert den Stand nicht mehr (Chromium-Repro aus QA) oder begründeter Restfall
- [ ] Punkte aus dem iPhone-Playtest (docs/playtests/…-phase1.md) eingearbeitet
- [ ] `npm run check` + E2E grün

## Protokoll
