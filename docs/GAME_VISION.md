# GAME_VISION

Status: **Freigegeben** (Mensch, 2026-11-01) (Phase 0, 2026-10-31). Quelle: `docs/design/core-loop.md`.

## Vision in drei Sätzen
Handcraft Life ist eine ruhige, ehrliche Handwerkssimulation für das iPhone. Man arbeitet in einer
kleinen ländlichen Werkstatt mit wenigen, aber echten Entscheidungen (messen, sägen, bohren, montieren),
wird für Qualität bezahlt und baut die Werkstatt Stück für Stück aus. Später kommt nach Feierabend die
Freizeit dazu (zuerst Fasanenjagd), als eigenes, kleines Modul.

## Leitprinzipien
1. **Selektiver Realismus:** Was der Spieler entscheidet oder können muss, wird simuliert. Repetitives
   wird zu einer Geste verdichtet, und Bedeutungsloses wird weggelassen.
2. **Qualität vor Umfang:** Lieber drei sehr gute Produkte als zehn mittelmässige.
3. **Spielbarkeit vor Präsentation:** Jede Phase endet spielbar auf dem iPhone des Inhabers.
4. **Entspannter Rhythmus:** Keine Tageszwänge, Wartezeiten oder Monetarisierung.
5. **Werkstatt mit Identität:** Selbst gefertigte Gegenstände werden im Spiel weiterverwendet.

## MVP (Ende Phase 2)
Holzwerkstatt in Ich-Sicht (Querformat) mit drei Produkten: Regalbrett, kleines Regal, Werkzeugkasten.
Dazu gehören Messen, Sägen, Bohren, Schleifen und Montage, ein Auftragsbrett, eine Qualitätsnote mit
Hauptursache und eine einfache Wirtschaft. Skills gibt es für Holz und Wirtschaft. Gespeichert wird
offline. Der Vertical Slice 0.1 (Phase 1) ist eine Teilmenge davon: ein Brett nach Auftrag ablängen,
bewerten, verkaufen und speichern.

## Bewusst ausgeschlossen (MVP)
Multiplayer/Accounts/Server · Monetarisierung · tägliche Belohnungen und Echtzeit-Timer · Third-Person-Figur ·
Metall/3D-Druck (Phase 3) · Jagd/Hund/Boot/Angeln (Phase 4+) · Holzbank (bringt keine neue Mechanik) ·
Längsschnitt/Hobeln/Holzverbindungen · Holzfeuchte/Werkzeugverschleiss · freies Bauen/CAD ·
Bruchphysik · Survival · elektrische Maschinen.
Begründungen: `docs/design/core-loop.md` §3.
