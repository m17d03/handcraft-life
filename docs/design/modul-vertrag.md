# Modulvertrag und Speicherformat

Status: **Konzept** · Ticket 006 · Autor: engine-engineer (Rolle Expansion Architect, Skill `modul-vertrag`)
Entscheidungsvorschläge: `docs/decisions/0002-modulvertrag.md`, `docs/decisions/0003-speicherformat.md` (beide *vorgeschlagen*).
Grundlagen: `docs/MASTER_PROMPT.md` §9, `docs/design/core-loop.md`, `docs/design/realismus-bewertung.md`,
`docs/design/holz-brett-zuschnitt.md` §7.

Kennzeichnung: **[B]** belegt · **[P]** plausibel · **[H]** Hypothese (per Prototyp/Messung prüfen).
Alle Typen unten sind **Skizzen im Dokument**, kein Code im Repo. Implementierung folgt in Phase 1.

## Kernaussagen

1. **Module im selben Code, kein Plug-in-System.** Jedes Modul ist ein Ordner `src/modules/<id>/` mit
   statischem Manifest. Eine einzige Datei `src/modules/index.ts` listet alle Module. Kein Laden fremden
   Codes zur Laufzeit, keine Sandbox, keine Modul-Downloads.
2. **Kern ist materialunabhängig.** Messen, Trennen (Sägen) und Bohren sind generische Prozesse im Kern,
   parametrisiert über Material- und Werkzeugwerte. Holz liefert Daten + wenige Regeln; Metall nutzt
   dieselben Prozesse (Ziel: Metall bleibt Aufwand **M**, siehe `realismus-bewertung.md` §2).
3. **Datengetrieben, wo es nur Inhalt ist; Code, wo es eine neue Entscheidung ist.** Neue Mechaniken
   (Strömung, Hund, Druck) brauchen Code – das ist gewollt, nicht ein Mangel des Vertrags.
4. **Ein Spielstand = ein Dokument** mit Kern-Abschnitt und einem versionierten Abschnitt pro Modul;
   jede Version hat eine lückenlose Migrationskette und einen Fixture-Test.

## 1. Was ist ein Modul?

| Art | Bedeutung | Beispiel | Abschaltbar? |
|---|---|---|---|
| `kern` | `src/core/`: Kernsysteme, kennt kein konkretes Modul | Inventar, Wirtschaft, Aufträge, Skills, Speichern | nein |
| `grundmodul` | Spielbereich, ohne den das Grundspiel nicht existiert | `holz` | nein |
| `modul` | eigener Spielbereich mit neuer Mechanik | `metall`, `druck`, `jagd`, `angeln` | ja (wird im Spiel freigeschaltet) |
| `erweiterung` | erweitert genau ein Modul um eine neue Mechanik | `angeln-fluesse-koeder` | ja |

"Abschaltbar" heisst: Der Code ist immer im Build, das Modul ist pro Spielstand **aktiv oder nicht**.
Ob grosse Module (Jagd) per `import()` als eigener Chunk nachgeladen werden, ist eine reine
Download-Budget-Frage (Startbudget < 15 MB) und wird gemessen, nicht vorab gebaut. **[H]**

### Ordner und Abhängigkeitsrichtung

```
src/core/                 Kernsysteme (reines TS, ohne Engine-Import, ohne Modul-Import)
src/modules/index.ts      einzige Stelle, die Module kennt: export const alleModule = [holz, metall, …]
src/modules/<id>/
  module.ts               Manifest
  logic/                  Spielregeln (reines TS, Vitest ohne Engine)
  data/*.json             Stammdaten (Materialien, Werkzeuge, Produkte, Auftragsvorlagen, Skills)
  view/                   Engine-gebundene Szene/UI (einziger Ort mit Engine-Import)
tests/fixtures/saves/     eingefrorene alte Spielstände
```

Regeln (per ESLint `no-restricted-imports` durchsetzbar, keine neue Abhängigkeit):
- `core` importiert nie aus `modules`. Module importieren aus `core`, **nie aus einem anderen Modul**.
- Querbezüge (z. B. Lockente aus der Werkstatt für die Jagd, Druckteil im Holzregal) laufen nur über
  **Inhalts-IDs** im Inventar und über Kern-Schnittstellen.
- `logic/` importiert keine Engine. `view/` darf Engine und `logic/` importieren, nie umgekehrt.

## 2. Stabile IDs

| Was | Format | Beispiel | Regel |
|---|---|---|---|
| Modul-ID | `[a-z][a-z0-9-]*` | `holz`, `angeln-fluesse-koeder` | nie umbenennen |
| Inhalts-ID | `<modul>.<typ>.<name>` | `holz.material.fichte-rohbrett-2000x140x18`, `holz.werkzeug.fuchsschwanz`, `kern.produkt.…` | nie umbenennen, nie wiederverwenden; Löschen nur mit Migration |
| Instanz-ID (Spielstand) | kurze Zufalls-ID | `ws_8f3k2a` | nur im Spielstand, nie in Stammdaten |

- Typen: `material`, `werkzeug`, `prozess`, `produkt`, `auftrag`, `item`, `skill`, `zaehler`, `parameter`, `text`, `ort`.
- Das Präfix zeigt den Besitzer: Ein Spielstand mit `angeln.item.forelle` ist ohne Modul `angeln` sofort
  als "fremd" erkennbar (siehe §6.4).
- Abweichung zur Skizze in `holz-brett-zuschnitt.md` §7 (`core.wood.…`): Holz ist ein **Grundmodul**,
  nicht Kern – daher `holz.…`. Sprache der IDs: Deutsch ohne Umlaute (wie Skill-Beispiel). → offene Frage 1.

## 3. Manifest (Typskizze)

```ts
type ModulId = string;            // 'holz'
type InhaltsId = string;          // 'holz.werkzeug.fuchsschwanz'

interface ModuleManifest {
  id: ModulId;
  art: 'grundmodul' | 'modul' | 'erweiterung';
  version: string;                          // Semver des Moduls, z. B. '1.0.0'
  requires: {
    core: string;                           // '^1.0.0' – geprüft wird nur die Hauptversion (YAGNI: kein Semver-Löser)
    modules?: Record<ModulId, string>;      // harte Abhängigkeiten, z. B. { jagd: '^1.0.0' }
  };
  extends?: ModulId;                        // nur bei art 'erweiterung': genau ein Basismodul
  freischaltung?: Bedingung[];              // wann im Spiel aktiv (z. B. Skill O5 "Angler"); leer = sofort

  provides: {                               // nur IDs; Inhalte stehen in data/*.json
    materials?: InhaltsId[];
    tools?: InhaltsId[];
    processes?: InhaltsId[];                // eigene Prozesse = neuer Code (siehe §5)
    products?: InhaltsId[];
    jobs?: InhaltsId[];                     // Auftragsvorlagen
    items?: InhaltsId[];                    // modulübergreifend weiterverwendbar
    skills?: InhaltsId[];
    places?: InhaltsId[];                   // Gebiete/Szenen (Werkstatt-Slot, See, Feld)
  };
  mechanics: string[];                      // Klartext: welche neue Entscheidung das Modul bringt (Pflicht, ≥ 1)
  assets: { glb: string[]; ktx2: string[]; audio: string[]; budgetMB: number };
  data: () => Promise<ModulDaten>;          // JSON-Import, von Vite gebündelt
  logic?: ModulLogik;                       // Code-Haken: Prozesse, Regeln (§5)
  view?: () => Promise<ModulView>;          // Engine-Teil, lazy
  save: ModulSpeicher<unknown>;             // §6
  tests: string[];                          // Abnahmekriterien in Kurzform, z. B. 'Spiel startet ohne Modul'
}

interface ModulSpeicher<T> {
  schemaVersion: number;                    // ganze Zahl, startet bei 1
  defaults(): T;                            // Abschnitt für neuen Spielstand / neu aktiviertes Modul
  migrations: Record<number, (alt: unknown) => unknown>;  // Schlüssel n: Version n-1 → n
  validate(data: unknown): data is T;       // handgeschriebener Typ-Wächter (keine Schema-Bibliothek)
}
```

Deckt §9 des Master-Prompts ab: Kennung (`id`), Version (`version`), Abhängigkeiten (`requires`, `extends`),
neue Inhalte (`provides` + `data`), neue Mechaniken (`mechanics` + `logic`), Assets (`assets`),
Speicher-/Migrationsregeln (`save`), Testkriterien (`tests`).

Start-Prüfung beim Spielstart (Kern, reine Funktion, unit-testbar): IDs eindeutig · Präfixe passen zur
Modul-ID · `requires`/`extends` erfüllt und zyklenfrei · jede Inhalts-ID in `provides` existiert in `data`.
Fehler → Modul wird deaktiviert und im Debug-Overlay (`?debug=1`) gemeldet, das Grundspiel läuft weiter.

## 4. Kern-Schnittstellen (materialunabhängig)

Leitidee (Hinweis game-designer): Der Kern rechnet **Geometrie und Abweichungen**; das Material und das
Werkzeug liefern nur **Zahlen**; materialtypische Fehlerbilder (Endriss, Grat, Überhitzung) sind kleine
**Regeln** des Moduls.

### 4.1 Material und Werkstück

```ts
interface MaterialDef {                     // Stammdaten (JSON)
  id: InhaltsId;
  klasse: 'holz' | 'metall' | 'kunststoff'; // Prozesse prüfen nur die Klasse, nie die konkrete ID
  profil: 'brett' | 'flach' | 'winkel' | 'rohr' | 'druckteil';
  masse_mm: { l: number; b: number; d: number };
  preis: number;
  werte: Record<string, number>;            // z. B. holz: { endriss_p: 0.5, ast_p: 0.3 }, metall: { haerte: 2 }
}

interface Werkstueck {                       // Spielstand
  id: string;                                // Instanz-ID
  materialId: InhaltsId;
  masse_mm: { l: number; b: number; d: number };
  enden: { a: Ende; b: Ende };               // a/b = Bezugsenden entlang der Längsachse
  merkmale: Merkmal[];                       // Ast, Bohrung, Grat, Anriss … (offene Liste, typisiert per id)
  herkunft: 'roh' | 'rest' | 'schnitt' | 'druck' | 'montage';
  teile?: string[];                          // bei Montage: Instanz-IDs der verbauten Werkstücke
  qualitaet?: Qualitaet;
}
interface Ende { winkel_grad: number; merkmale: Merkmal[] }          // z. B. Endriss, Ausriss, Grat
interface Merkmal { id: InhaltsId; pos_mm?: number; wert?: number }  // 'holz.merkmal.endriss', 'metall.merkmal.grat'
```

### 4.2 Werkzeug

```ts
interface WerkzeugDef {                      // Stammdaten (JSON)
  id: InhaltsId;
  prozesse: InhaltsId[];                     // z. B. ['kern.prozess.trennen']
  materialKlassen: MaterialDef['klasse'][];  // Fuchsschwanz: ['holz'], Bügelsäge: ['metall']
  werte: Record<string, number>;             // fuge_mm, werkzeugfaktor, zuege_gesamt, lenkbare_zuege, tempo_grenze …
  preis: number;
  slot?: InhaltsId;                          // Werkbank-Slot in der Werkstatt
}
interface WerkzeugBesitz { werkzeugId: InhaltsId; zustand?: number }   // Verschleiss: YAGNI im MVP, Feld reserviert
```

### 4.3 Arbeitsschritt (Prozess)

```ts
interface ProzessDef<Eingabe, Detail> {      // Code (Kern oder Modul)
  id: InhaltsId;                             // 'kern.prozess.messen' | 'kern.prozess.trennen' | 'kern.prozess.bohren'
  ausfuehren(ctx: ProzessKontext, eingabe: Eingabe): ProzessErgebnis<Detail>;   // reine Funktion
}
interface ProzessKontext {
  werkstueck: Werkstueck; material: MaterialDef; werkzeug: WerkzeugDef;
  mod: (parameterId: InhaltsId, basis: number) => number;   // Skill-Modifikatoren (z. B. Drift −15 %)
  zufall: () => number;                                      // gesät → deterministisch testbar
  regeln: MaterialRegel[];                                   // Regeln aller Module für diese Materialklasse
}
interface ProzessErgebnis<Detail> {
  werkstuecke: Werkstueck[];                 // Trennen: Werkstück + Rest
  messwerte: Record<string, number>;         // delta_l_mm, delta_winkel_grad, ausriss …
  ursachen: InhaltsId[];                     // Text-IDs für die Ergebniskarte, wichtigste zuerst
  zaehler: InhaltsId[];                      // für Skill-Handlungsbedingungen
  detail: Detail;                            // nur Laufzeit (Animation, Feedback), nie gespeichert
}
interface MaterialRegel {                    // Modul-Code, klein
  klasse: MaterialDef['klasse']; prozess: InhaltsId;
  anwenden(ctx: ProzessKontext, e: ProzessErgebnis<unknown>): ProzessErgebnis<unknown>;
}
```

Kern-Prozesse und ihre materialspezifischen Regeln:

| Kern-Prozess | Kern rechnet (generisch) | Regel `holz` | Regel `metall` (Phase 3) |
|---|---|---|---|
| `messen` | Markierung relativ zum Bezugsende, Raster, Bezugsfehler aus `enden.winkel_grad` | – | – |
| `trennen` | Ist-Länge (Markierung + Blattversatz − Fuge/2), Drift pro Zug, lenkbare Züge, Tempo am Ende | Ausriss bei Tempo > Grenze; Endriss im Teil → Ausschuss | Grat an beiden Schnittkanten; Zahnteilung (Wert des Blatts) ändert Zugzahl |
| `bohren` | Position, Tiefe, Verlaufen (ohne Vorpunkt) | Ausriss auf der Rückseite | Körnerpunkt = Vorpunkt; Drehzahl zu hoch → Überhitzung |
| `entgraten` | – | – | eigener Prozess im Modul `metall` (neuer Code, klein) |

Laufzeitzustand eines Schritts (Züge, Drift) wird **nicht** gespeichert (wie `holz-brett-zuschnitt.md` §6:
Neuladen mitten im Schnitt → Brett ungeschnitten). Das hält das Speicherformat klein und stabil.

### 4.4 Qualität und Auftrag

```ts
interface Bewertung {                        // Stammdaten pro Produkt (JSON) – datengetrieben
  kriterien: { messwert: string; punkte: number; voll_bis: number; null_ab: number }[];  // lineare Rampen
  feste: { merkmal: InhaltsId; punkte: number; abzug: number }[];                      // z. B. Ast −5
  ausschuss_wenn: InhaltsId[];                                                          // z. B. Endriss
  toleranz_kappt_auf?: Stufe;                                                           // Auftragstoleranz → max. C
}
type Stufe = 'A' | 'B' | 'C' | 'D' | 'ausschuss';
interface Qualitaet { q: number; stufe: Stufe; punkte: Record<string, number>; hauptursache: InhaltsId }

interface ProduktDef {                       // Stammdaten
  id: InhaltsId; schritte: InhaltsId[]; bewertung: Bewertung;
  verwendungen: ('verkauf' | 'werkstatt-slot' | 'bauteil' | 'ausruestung')[];          // Weiterverwendung
}
interface AuftragVorlage {                   // Stammdaten
  id: InhaltsId; produktId: InhaltsId; soll: Record<string, [min: number, max: number]>;
  toleranz: Record<string, number>; basispreis: { material_faktor: number; je_schritt: number };
  freischaltung?: Bedingung[];
}
interface Auftrag {                          // Spielstand
  id: string; vorlageId: InhaltsId; soll: Record<string, number>; toleranz: Record<string, number>;
  basispreis: number; kundeId: string; status: 'angeboten' | 'angenommen' | 'abgeliefert' | 'abgelehnt';
  werkstueckId?: string;
}
```

Die Qualitätsformel aus `holz-brett-zuschnitt.md` §4.2 ist vollständig als `Bewertung` darstellbar
(P_Länge = Rampe 40/0,5/5, P_Winkel = Rampe 30/0,3/3, P_Kante, P_Holz, Endriss → Ausschuss). **[P]**
Preisformel und Stufenfaktoren aus `core-loop.md` §5 liegen im Kern (Wirtschaft ist Kern, nicht Modul).

### 4.5 Inventar, Gegenstände, Skills

```ts
interface Inventar {                         // Kern-Abschnitt im Spielstand
  geld: number; schulden: number;
  werkstuecke: Werkstueck[];                 // Lager inkl. Reststücke, auch fertige Produkte
  gegenstaende: { itemId: InhaltsId; anzahl: number }[];   // Köder, Filament, Lockente …
  werkzeuge: WerkzeugBesitz[];
  werkstatt: Record<InhaltsId, string | null>;              // Slot-ID → Instanz/Item
}

type Bedingung =                             // bewusst nur drei Arten (YAGNI: keine Skriptsprache)
  | { art: 'level'; bereich: InhaltsId; min: number }
  | { art: 'zaehler'; zaehler: InhaltsId; min: number }      // z. B. 'holz.zaehler.schnitt-stufe-b'
  | { art: 'besitz'; id: InhaltsId };                        // Werkzeug/Item/Modul aktiv

interface SkillDef {                         // Stammdaten
  id: InhaltsId; bereich: InhaltsId; typ: 'F' | 'W' | 'B' | 'Q';
  bedingungen: Bedingung[];                                 // UND-verknüpft
  effekte: ({ art: 'parameter'; parameter: InhaltsId; faktor: number }   // Drift × 0,85
          | { art: 'freischalten'; id: InhaltsId }                       // Bauplan, Anzeige, Modul
          | { art: 'flag'; flag: InhaltsId })[];                         // vom Modul-Code abgefragt
}
```

Damit sind alle Skill-Knoten aus `core-loop.md` §4 als Daten darstellbar. Ausnahme: Was ein `flag` bewirkt
(z. B. "Endrisse leuchten in der Lupe"), ist Code im jeweiligen Modul.

## 5. Datengetrieben vs. neuer Code (ehrliche Bewertung)

Aufwand wie `realismus-bewertung.md`: S ≤ 2 · M 3–5 · L 6–10 · XL > 10 Sitzungen, **ohne Assets**.
"Datengetrieben" heisst: nur JSON + Assets + Manifest, kein neuer TS-Code ausser Tests. Assets sind nie
gratis – auch ein reines Daten-Paket braucht Modelle, Texturen, Ton.

| Paket (§9) | Datengetrieben möglich | Neuer Code nötig | Code-Aufwand | Voraussetzung |
|---|---|---|---|---|
| **Metall Basis** (zum Vergleich) | Profile, Materialien, Werkzeuge, Produkte, Skills | Regeln Grat/Körnen/Drehzahl, Prozess Entgraten, Schraubstock-Ansicht | **M** | Kern-Prozesse generisch (§4.3) |
| **Fishing Base** | 3 Fischarten, Angel, Köder, Skill-Knoten | Auswerfen/Einholen (Geste, Schnurspannung), Fisch-Zustandsmaschine, Wasser-Szene, Ort ausserhalb der Werkstatt | **L** | Orts-/Szenenwechsel im Kern (kommt mit Jagd oder Angeln, wer zuerst) |
| **Rivers & Lures** | 2 Flussgebiete (als Orte), neue Fischarten, Köder, Fischpräferenzen (Tabelle Art × Köder × Ort), Skill-Erweiterung | **Strömung**: Köderdrift im Fluss, Wurfposition stromauf als Entscheidung | **S–M** | Base hat Präferenzen bereits als Daten-Tabelle, nicht als Code |
| **3D Printing Base** | Drucker, PLA, 3 Baupläne, Fehlerregeln als Tabelle | Druckablauf (Einstellungen → Zeitraffer → Entnehmen), Schicht-Wachstum (Shader/Clip), "läuft parallel"-Zeitmodell | **S–M** | Kern-Zeit "vorspulen" (core-loop §5) |
| **Advanced 3D Printing** | PETG, Düsen, Druckprofile, erweiterte Qualitätskriterien | **Stützstrukturen** (Überhang-Entscheidung, Nacharbeit Entfernen) | **S** | Base-Regelwerk parametrisch (Material × Profil × Ausrichtung) |
| **Hunting Base** | Fasan/Ente-Werte (Fluchtdistanz, Schussdistanz), Regeln-Texte, Skill-Knoten | Landschaft + LOD, Gehen im Gelände, Tier-Zustandsmaschinen, Schrotkegel, Ansprechen/Regelprüfung, Gewehr-Ansicht | **XL** (realistisch: L Logik + XL Assets) | Szenenwechsel, Budget-Messung Landschaft |
| **Hunting Dog & Waterfowl** | Zusätzliche Entenarten, Uferabschnitte (Orte), Verhaltens-**Parameter** | **Hund** (Navigation, Kommandos, Suchen, Apportieren, Bindung), **Boot** (Fahren, Schuss vom Boot, Regeln), neue Verhaltens**zustände** | **XL** | validierte Jagd (realismus-bewertung: Hund erst Phase 5+) |

Kurzform: **Rein datengetrieben ist keines der sechs §9-Beispiele** – jedes bringt laut Master-Prompt eine
neue Mechanik, und neue Mechanik ist Code. Fast datengetrieben (≤ S Code) sind nur die Erweiterungen,
deren Basis ihre Regeln als Tabelle statt als Code baut: *Advanced 3D Printing* und zum grössten Teil
*Rivers & Lures*. Reine Inhalts-Pakete (neue Holzart, neue Auftragsvorlagen, neuer Fisch) sind dagegen
ohne Code möglich – das sind aber laut Skill-Regel keine Erweiterungen, sondern Modul-Updates.

Wo bewusst **YAGNI** gilt:
- kein Laden von Modulen aus dem Netz, keine Sandbox, kein Modul-Store, keine Modul-API-Stabilität gegenüber Dritten;
- kein Semver-Löser (nur Hauptversion), keine optionalen/weichen Abhängigkeiten, keine Ladereihenfolge-Prioritäten;
- keine generische Ereignis-/Skriptsprache für Bedingungen (drei Bedingungsarten reichen für alle Skills in core-loop §4);
- kein ECS-Umbau; kein Werkzeugverschleiss im MVP (Feld reserviert, nicht ausgewertet);
- `Werkstueck` kennt nur eine Längsachse mit zwei Enden – genügt für Brett, Leiste, Profil, Rohr; echte 3D-Formen erst, wenn ein Produkt sie verlangt.

## 6. Speicherformat (Kurzfassung, Details ADR 0003)

### 6.1 Aufbau

```ts
interface SpielstandDatei {
  format: 'handcraft-life-save';
  huelle: 1;                                 // Version der Hülle selbst (ändert sich fast nie)
  spielVersion: string;                      // package.json-Version beim Speichern, nur Info
  gespeichert: string;                       // ISO-Zeit
  kern: { schema: number; daten: KernSpeicher };
  module: Record<ModulId, { modulVersion: string; schema: number; aktiv: boolean; daten: unknown }>;
}
interface KernSpeicher {
  inventar: Inventar; auftraege: Auftrag[];
  skills: Record<InhaltsId, { xp: number; knoten: InhaltsId[] }>;    // Bereich → Fortschritt
  zaehler: Record<InhaltsId, number>;
  tutorial: number; einstellungen: { steuerung: 'A' | 'B'; meister: boolean; /* … */ };
  zufallSaat: number;
}
```

Beispiel `module.holz.daten`: Fehlerbild noch nicht geprüfter Rohbretter im Händlerangebot, holzspezifische
Freischaltungen. Was mehrere Module brauchen (Werkstücke, Geld, Zähler), liegt im **Kern**.

### 6.2 Ablage in IndexedDB

| Objektspeicher | Schlüssel | Inhalt |
|---|---|---|
| `spielstand` | `'aktuell'` | die eine `SpielstandDatei` (ein Spielstand, kein Slot-System im MVP) |
| `sicherung` | Zeitstempel | Rohkopie **vor** jeder Migration und rotierend die letzten 3 Autosaves |

- Ganzes Dokument in **einer** Transaktion schreiben (erwartete Grösse < 100 KB **[H]**) → nie halb gespeichert.
- Speicherpunkte wie `holz-brett-zuschnitt.md` §7, zusätzlich bei `visibilitychange → hidden`
  (iOS feuert `beforeunload`/`unload` beim App-Wechsel nicht zuverlässig **[P]**).
- Der Kern greift über eine schmale Schnittstelle `Ablage { lesen(); schreiben(datei); sicherungen() }` zu.
  Migration und Prüfung sind reine Funktionen auf JSON → Vitest ohne IndexedDB; die echte IndexedDB-Ablage
  wird im Playwright-Test geprüft. Keine neue Abhängigkeit (`idb`, `fake-indexeddb`, `zod` jeweils nur per ADR).

### 6.3 Versionierung und Migrationskette

1. Jeder Abschnitt (Kern, jedes Modul) hat eine eigene ganze `schema`-Zahl. Jede Formatänderung: +1,
   Migration `n-1 → n`, neue Fixture.
2. Laden: Hülle prüfen → Rohkopie in `sicherung` → Kern migrieren → jedes bekannte Modul migrieren
   (schrittweise `migrations[alt+1] … migrations[aktuell]`) → `validate` → erst dann im Spiel verwenden.
3. Migrationen sind reine Funktionen, nie gelöscht, nie nachträglich geändert. Sie dürfen nur ihren eigenen
   Abschnitt ändern. Ausnahme: ein Modul darf **seine eigenen** Inhalts-IDs im Kern-Inventar umbenennen
   (Hilfsfunktion des Kerns `ersetzeIds(alt → neu)`), weil Werkstücke im Kern liegen.
4. Modul-Semver und Schema sind getrennt: `version` steigt bei jeder Änderung, `schema` nur bei Formatänderung.

### 6.4 Fehlende, unbekannte und zu neue Abschnitte

| Fall | Verhalten |
|---|---|
| Modul im Code, Abschnitt fehlt (neues Modul, alter Spielstand) | `defaults()` einfügen, `aktiv` nach `freischaltung` |
| Abschnitt im Spielstand, Modul nicht im Code (entfernt oder Spielstand aus neuerer Version) | Abschnitt **unverändert mitspeichern** ("ruhend"), nie löschen; Meldung im Debug-Overlay |
| Kern-Inventar enthält IDs eines unbekannten/inaktiven Moduls | Einträge bleiben erhalten, werden in UI und Wirtschaft ausgeblendet; kein Absturz |
| Abschnitt hat höhere `schema` als der Code kennt (Downgrade, z. B. altes Pages-Deployment im Cache) | Spiel startet **nur lesend** mit Hinweis + Export-Knopf; es wird **nicht** überschrieben |
| Migration oder `validate` schlägt fehl | Rohkopie bleibt in `sicherung`; Modul deaktiviert (Kern-Fehler: Hinweis + Export, kein Überschreiben) |
| Hülle unbekannt / JSON kaputt | Neuer Spielstand nur nach Bestätigung; kaputte Daten bleiben in `sicherung` |

### 6.5 iOS-Safari-Eigenheiten

| Eigenheit | Massnahme |
|---|---|
| Safari löscht skriptbaren Speicher (inkl. IndexedDB) einer Website nach 7 Tagen ohne Nutzung, wenn sie **nicht** als Home-Bildschirm-App läuft **[B]** (WebKit ITP, 2020); installierte Web-Apps sind ausgenommen **[P]** | Startseite fordert sichtbar zum Installieren auf (Teilen → Zum Home-Bildschirm), solange `navigator.standalone`/`display-mode: standalone` nicht zutrifft |
| `navigator.storage.persist()` verhindert Löschung bei Speicherdruck; Verfügbarkeit/Wirkung in iOS Safari je Version **[H]** | beim ersten Speichern aufrufen, Ergebnis + `storage.estimate()` im Debug-Overlay zeigen; nie darauf verlassen |
| Privates Surfen: Speicher endet mit dem Tab **[P]** | Hinweis, wenn erkannt; kein Sonderpfad |
| App-Wechsel beendet Seite ohne `unload` **[P]** | Speichern bei `visibilitychange` und an jedem Speicherpunkt |
| Altes Service-Worker-Bundle kann nach Deploy weiterlaufen | Fall "zu neue Schema-Version" (§6.4) schützt den Spielstand |

**Vorschlag (nicht Teil der Entscheidung): Export/Import als Sicherung.** Einstellungen → "Spielstand
sichern" erzeugt die `SpielstandDatei` als JSON; auf dem iPhone über `navigator.share({ files })` an
Dateien/Mail/Notizen **[P]**, Rückfall Download per `<a download>`. "Spielstand laden" per
`<input type="file">` → derselbe Lade-/Migrationspfad wie IndexedDB (kein zweiter Code-Pfad). Aufwand **S**.

### 6.6 Fixture-Test-Strategie

| Test | Ort | Inhalt |
|---|---|---|
| Migration alter Stände | Vitest, `tests/unit/save/` | jede Datei in `tests/fixtures/saves/` laden → migrieren → `validate` → Kernfelder (Geld, Anzahl Werkstücke, Skill-XP) gegen erwartete Werte |
| Fixture-Pflege | Konvention | pro Schema-Erhöhung eine Fixture `kern-s<N>-<inhalt>.json` bzw. `<modul>-s<N>-<inhalt>.json`, erzeugt mit dem **alten** Stand; Fixtures sind schreibgeschützt (nie ändern, nur hinzufügen) |
| Pflicht-Fixtures | Vitest | leerer Neustart · Spielstand mit Reststücken und offenem Auftrag · Abschnitt eines unbekannten Moduls (bleibt erhalten) · zu neue Schema-Version (nur lesend) · kaputtes JSON |
| Rundlauf | Vitest | `laden(speichern(x))` ergibt `x` für Zufallsstände (gesäter Generator, ohne neue Abhängigkeit) |
| Mit/ohne Modul | Vitest | Spielstand laden mit allen Modulen und nur mit `holz` → beides gültig, ruhende Abschnitte unverändert |
| Echte Ablage | Playwright | speichern → Seite neu laden → Zustand gleich; Export → Import → gleich |
| Vertrag | Vitest | Start-Prüfung (§3) für alle Manifeste: IDs eindeutig, Präfixe, Abhängigkeiten, kein Modul-zu-Modul-Import (Lint) |

## 7. EXPANSION_REGISTRY (Entwurf zur Übernahme durch den Director)

| ID | Art | Version | Abhängigkeiten | Neue Mechanik | Phase | Status |
|---|---|---|---|---|---|---|
| `kern` | kern | 0.1.0 | – | Inventar, Wirtschaft, Aufträge, Skills, Speichern, Prozesse messen/trennen/bohren | 1 | Konzept |
| `holz` | grundmodul | 0.1.0 | kern ^0 | Ablängen mit Bezugsende/Fuge/Drift; später Bohren, Schleifen, Montage | 1–2 | Konzept |
| `metall` | modul | – | kern ^1 | Körnen, Zahnteilung, Drehzahl/Überhitzung, Entgraten | 3 | Konzept |
| `druck` | modul | – | kern ^1 | Ausrichtung/Schichthöhe/Füllgrad, Druck parallel zur Werkstatt | 3 | Konzept |
| `druck-erweitert` | erweiterung → `druck` | – | druck ^1 | Stützstrukturen, Düsen, Profile, PETG | 6 | Konzept |
| `jagd` | modul | – | kern ^1 | Ansprechen, Wind, Schussfeld, Fasan + Ente (stark verkleinert) | 4 | Konzept |
| `jagd-hund-wasserwild` | erweiterung → `jagd` | – | jagd ^1 | Hund (Suchen, Apportieren, Bindung), Boot, weitere Enten | 5+ | Konzept |
| `angeln` | modul | – | kern ^1 | Auswerfen/Einholen, Fischpräferenz | 5+ | Konzept |
| `angeln-fluesse-koeder` | erweiterung → `angeln` | – | angeln ^1 | Strömung, Köderwahl | 6 | Konzept |

Hinweis: `kern` und `holz` starten mit 0.x, solange sich das Format im Vertical Slice noch ändert;
mit MVP (Ende Phase 2) → 1.0.0. `requires: core '^1'` der späteren Module setzt das voraus.
Querbezüge ohne Abhängigkeit (nur über Item-IDs): J4 Lockente (holz → jagd), M5/A5 Bauteile (metall/druck → holz).

## 8. Offene Fragen an den Director

1. Inhalts-IDs deutsch ohne Umlaute (`holz.werkzeug.fuchsschwanz`) statt englisch (`core.wood.…` in Ticket 002)?
2. Ein Spielstand (kein Slot-System) im MVP – einverstanden?
3. Export/Import (§6.5) als eigenes kleines Ticket in Phase 1, oder erst wenn ein Datenverlust auftritt?
4. Wer baut den Szenen-/Ortswechsel im Kern – das erste Outdoor-Modul (Jagd) oder vorab ein Kern-Ticket?
5. Sollen Module per `import()` als eigener Chunk geladen werden? Vorschlag: erst nach Messung des Download-Budgets entscheiden.
