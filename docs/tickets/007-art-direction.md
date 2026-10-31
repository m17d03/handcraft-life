---
id: 007
titel: Art Direction – 2–3 Stilvarianten, Bild-Prompts, Asset-Quellen, Moodboard-Seite
agent: asset-artist
meilenstein: Phase 0
status: done
reifegrad: Konzept
blocked_by: [001]
branch: ticket/007-art-direction
---

## Ziel
Der Mensch kann auf dem iPhone 2–3 Stilvarianten vergleichen und wählen; es gibt fertige Bild-Prompts
für Concept-Art und eine geprüfte Liste von Asset-Quellen mit Lizenzen.

## Kontext
- `.claude/skills/konzept-visuals/SKILL.md`, `.claude/skills/asset-pipeline/SKILL.md` (verbindlich)
- `docs/MASTER_PROMPT.md` §8, §15; `UMSETZUNGSPLAN.md` Punkt 5 (Konzeptbilder auf 4–5 Kernansichten kürzen)
- Ehrliche Grenze: keine gemalte Concept-Art; der Mensch erzeugt Bilder mit einem Bildgenerator
  auf dem iPhone aus den Prompts

## Scope
- Darf ändern: `docs/art/**`, `public/konzepte/stil/**` (statisches HTML/CSS, unverändert von Vite kopiert,
  erreichbar unter https://m17d03.github.io/handcraft-life/konzepte/stil/)
- Darf nicht ändern: `src/`, `assets/` (keine Downloads in dieser Phase), Projektdokumente, `docs/decisions/`

## Abnahmekriterien
- [x] `docs/art/stil-varianten.md`: 2–3 Varianten, je Palette (Hex), Lichtstimmung, Materialien,
      Kantenschärfe, UI-Stil, 3–5 Referenzlinks (nur Links); Empfehlung mit Begründung inkl. Mobile-Kosten
- [x] `public/konzepte/stil/index.html`: Moodboard pro Variante, auf iPhone hochkant gut lesbar –
      Farbfelder, Typografie-Probe, ein mit CSS gezeichnetes HUD-Beispiel; deutlich
      „KONZEPT – kein Spielscreenshot“
- [x] `docs/art/prompts.md`: Prompts für die 5 Kernansichten (Werkstatt mit Holz/Metall/3D-Druck-Bereich,
      First-Person-Holzbearbeitung, Touch-Steuerung, Auftrag/Inventar, Fasanenfeld) pro empfohlener Variante
      in einheitlicher Struktur; die übrigen 7 Ansichten aus §15 als Kurzprompt; Anleitung für den Menschen
      (welche App, wohin Bilder legen – per Chat schicken genügt)
- [x] `docs/art/asset-quellen.md`: Kandidatenliste für Vertical Slice (Holztexturen, Werkbank, Säge,
      Massband, HDRI Werkstatt) mit Quelle-URL, Lizenz (auf Originalseite geprüft oder als „ungeprüft“
      markiert), geschätzter Grösse; keine Downloads
- [x] `docs/art/budgets-entwurf.md`: Asset-Budgets als Platzhalter (Dreiecke je Objektklasse,
      Texturgrössen, Materialanzahl), Hinweis „final nach Engine-Spike-Benchmark“

## Nicht Teil dieses Tickets
3D-Blockout (kommt mit Engine-Wahl), Downloads, Integration ins Spiel.

## Protokoll
- 2026-10-31 asset-artist: 3 Varianten (A Honigwerkstatt empfohlen), Moodboard-Seite, Prompts K1–K5 + Z6–Z12, Asset-Quellen, Budget-Entwurf (~109 MB Textur). Alle Lizenzen UNGEPRÜFT: Poly Haven/ambientCG/Kenney durch Netzwerkregel blockiert. Director: abgenommen als Konzept; Lizenzprüfung vor jedem Download in Phase 1 Pflicht.
