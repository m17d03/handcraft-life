/**
 * Modulvertrag (ADR 0002, modul-vertrag §3): Manifest-Typ, Start-Prüfung und Katalog der Stammdaten.
 * Der Kern kennt kein konkretes Modul; die Liste der Module übergibt `src/modules/index.ts`.
 */
import type {
  AuftragVorlage,
  ErzeugungsRegel,
  InhaltsId,
  MaterialDef,
  MaterialRegel,
  ModulId,
  ProduktDef,
  WerkzeugDef,
} from './typen';

/** Version des Kerns (Semver). Module prüfen nur die Hauptversion. */
export const KERN_VERSION = '0.1.0';

/** Stammdaten eines Moduls. Im Slice als typisierte TS-Konstanten (siehe Abschlussbericht 008). */
export interface ModulDaten {
  materialien?: MaterialDef[];
  werkzeuge?: WerkzeugDef[];
  produkte?: ProduktDef[];
  auftraege?: AuftragVorlage[];
  /** Klartexte für Text-/Merkmal-IDs (Ergebniskarte). `{wert}` wird ersetzt. */
  texte?: Record<InhaltsId, string>;
}

/** Code-Haken eines Moduls: kleine Material-Regeln (modul-vertrag §4.3). */
export interface ModulLogik {
  regeln?: MaterialRegel[];
  erzeugung?: ErzeugungsRegel[];
}

/** Versionierter Speicherabschnitt eines Moduls (ADR 0003). Laden/Migrieren baut Ticket 009. */
export interface ModulSpeicher<T> {
  schemaVersion: number;
  defaults(): T;
  migrations: Record<number, (alt: unknown) => unknown>;
  validate(data: unknown): data is T;
}

export interface ModuleManifest {
  id: ModulId;
  art: 'kern' | 'grundmodul' | 'modul' | 'erweiterung';
  version: string;
  requires: { core: string; modules?: Record<ModulId, string> };
  extends?: ModulId;
  provides: {
    materials?: InhaltsId[];
    tools?: InhaltsId[];
    processes?: InhaltsId[];
    products?: InhaltsId[];
    jobs?: InhaltsId[];
    items?: InhaltsId[];
    skills?: InhaltsId[];
    places?: InhaltsId[];
  };
  /** Welche neue Entscheidung das Modul bringt (Pflicht, ≥ 1). */
  mechanics: string[];
  assets: { glb: string[]; ktx2: string[]; audio: string[]; budgetMB: number };
  daten: ModulDaten;
  logik?: ModulLogik;
  /** Fehlt nur beim Kern: dessen Abschnitt `kern` der SpielstandDatei verwaltet Ticket 009. */
  save?: ModulSpeicher<unknown>;
  tests: string[];
}

export interface ModulFehler {
  modul: ModulId;
  grund: string;
}

const MODUL_ID = /^[a-z][a-z0-9-]*$/;
const INHALTS_ID = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.[a-z0-9][a-z0-9-]*$/;

/** Hauptversion aus `'1.2.3'` oder `'^1.2'`; `null`, wenn unlesbar. */
export function hauptversion(v: string): number | null {
  const m = /^\^?(\d+)(\.\d+){0,2}$/.exec(v.trim());
  return m?.[1] === undefined ? null : Number(m[1]);
}

function datenIds(d: ModulDaten): InhaltsId[] {
  return [
    ...(d.materialien ?? []).map((x) => x.id),
    ...(d.werkzeuge ?? []).map((x) => x.id),
    ...(d.produkte ?? []).map((x) => x.id),
    ...(d.auftraege ?? []).map((x) => x.id),
  ];
}

/** Statische Prüfung eines einzelnen Manifests (ohne Abhängigkeiten). */
function eigenePruefung(m: ModuleManifest, kernVersion: string): string[] {
  const fehler: string[] = [];
  if (!MODUL_ID.test(m.id)) fehler.push(`Modul-ID "${m.id}" ungültig`);
  if (hauptversion(m.version) === null) fehler.push(`Version "${m.version}" ungültig`);
  if (hauptversion(m.requires.core) !== hauptversion(kernVersion)) {
    fehler.push(`braucht Kern ${m.requires.core}, vorhanden ${kernVersion}`);
  }
  if (m.mechanics.length === 0) fehler.push('mechanics leer');
  if (m.art === 'erweiterung' && m.extends === undefined) fehler.push('Erweiterung ohne extends');
  const vorhanden = new Set(datenIds(m.daten));
  const angegeben = [
    ...(m.provides.materials ?? []),
    ...(m.provides.tools ?? []),
    ...(m.provides.products ?? []),
    ...(m.provides.jobs ?? []),
  ];
  for (const id of angegeben) {
    if (!vorhanden.has(id)) fehler.push(`provides ${id} fehlt in daten`);
  }
  const alle = [...vorhanden, ...Object.values(m.provides).flat(), ...Object.keys(m.daten.texte ?? {})];
  for (const id of alle) {
    if (!INHALTS_ID.test(id)) fehler.push(`Inhalts-ID "${id}" ungültig`);
    else if (!id.startsWith(`${m.id}.`)) fehler.push(`Inhalts-ID "${id}" hat fremdes Präfix`);
  }
  return fehler;
}

/**
 * Start-Prüfung (modul-vertrag §3): IDs eindeutig · Präfixe passen · requires/extends erfüllt und
 * zyklenfrei · jede Inhalts-ID in `provides` existiert in `daten`. Fehlerhafte Module werden deaktiviert,
 * der Rest läuft weiter.
 */
export function pruefeModule(
  manifeste: readonly ModuleManifest[],
  kernVersion: string = KERN_VERSION,
): { aktiv: ModuleManifest[]; fehler: ModulFehler[] } {
  const fehler: ModulFehler[] = [];
  const kandidaten = new Map<ModulId, ModuleManifest>();
  const inhaltsBesitzer = new Map<InhaltsId, ModulId>();

  for (const m of manifeste) {
    if (kandidaten.has(m.id)) {
      fehler.push({ modul: m.id, grund: 'Modul-ID doppelt' });
      continue;
    }
    const eigene = eigenePruefung(m, kernVersion);
    for (const id of datenIds(m.daten)) {
      const besitzer = inhaltsBesitzer.get(id);
      if (besitzer !== undefined) eigene.push(`Inhalts-ID ${id} doppelt (auch in ${besitzer})`);
    }
    if (eigene.length > 0) {
      for (const grund of eigene) fehler.push({ modul: m.id, grund });
      continue;
    }
    for (const id of datenIds(m.daten)) inhaltsBesitzer.set(id, m.id);
    kandidaten.set(m.id, m);
  }

  // Abhängigkeiten: so lange deaktivieren, bis alles erfüllt ist. Zyklen fallen über die Tiefensuche heraus.
  const abhaengigkeiten = (m: ModuleManifest): [ModulId, string][] => {
    const deps = Object.entries(m.requires.modules ?? {});
    if (m.extends !== undefined && !deps.some(([id]) => id === m.extends)) deps.push([m.extends, '']);
    return deps;
  };
  const imZyklus = (start: ModulId): boolean => {
    const besucht = new Set<ModulId>();
    const stapel: ModulId[] = [start];
    while (stapel.length > 0) {
      const id = stapel.pop();
      const m = id === undefined ? undefined : kandidaten.get(id);
      if (m === undefined) continue;
      for (const [dep] of abhaengigkeiten(m)) {
        if (dep === start) return true;
        if (!besucht.has(dep)) {
          besucht.add(dep);
          stapel.push(dep);
        }
      }
    }
    return false;
  };
  for (const id of [...kandidaten.keys()]) {
    if (imZyklus(id)) fehler.push({ modul: id, grund: 'Abhängigkeitszyklus' });
  }
  for (const f of fehler) if (f.grund === 'Abhängigkeitszyklus') kandidaten.delete(f.modul);

  let geaendert = true;
  while (geaendert) {
    geaendert = false;
    for (const m of [...kandidaten.values()]) {
      for (const [dep, version] of abhaengigkeiten(m)) {
        const ziel = kandidaten.get(dep);
        const passt =
          ziel !== undefined && (version === '' || hauptversion(version) === hauptversion(ziel.version));
        if (!passt) {
          fehler.push({ modul: m.id, grund: `Abhängigkeit ${dep} ${version} fehlt oder passt nicht` });
          kandidaten.delete(m.id);
          geaendert = true;
          break;
        }
      }
    }
  }

  return { aktiv: manifeste.filter((m) => kandidaten.get(m.id) === m), fehler };
}

/** Zusammengeführte Stammdaten und Regeln aller aktiven Module. Keine Spielstand-Daten. */
export interface Katalog {
  module: ModuleManifest[];
  fehler: ModulFehler[];
  materialien: Record<InhaltsId, MaterialDef>;
  werkzeuge: Record<InhaltsId, WerkzeugDef>;
  produkte: Record<InhaltsId, ProduktDef>;
  auftragVorlagen: Record<InhaltsId, AuftragVorlage>;
  texte: Record<InhaltsId, string>;
  regeln: MaterialRegel[];
  erzeugung: ErzeugungsRegel[];
}

export function katalogErstellen(manifeste: readonly ModuleManifest[], kernVersion: string = KERN_VERSION): Katalog {
  const { aktiv, fehler } = pruefeModule(manifeste, kernVersion);
  const k: Katalog = {
    module: aktiv,
    fehler,
    materialien: {},
    werkzeuge: {},
    produkte: {},
    auftragVorlagen: {},
    texte: {},
    regeln: [],
    erzeugung: [],
  };
  for (const m of aktiv) {
    for (const x of m.daten.materialien ?? []) k.materialien[x.id] = x;
    for (const x of m.daten.werkzeuge ?? []) k.werkzeuge[x.id] = x;
    for (const x of m.daten.produkte ?? []) k.produkte[x.id] = x;
    for (const x of m.daten.auftraege ?? []) k.auftragVorlagen[x.id] = x;
    Object.assign(k.texte, m.daten.texte ?? {});
    k.regeln.push(...(m.logik?.regeln ?? []));
    k.erzeugung.push(...(m.logik?.erzeugung ?? []));
  }
  return k;
}

/** Klartext zu einer Text-/Merkmal-ID; `{wert}` wird mit deutschem Dezimalkomma ersetzt. */
export function textFuer(katalog: Katalog, id: InhaltsId, wert?: number): string {
  const vorlage = katalog.texte[id] ?? id;
  if (wert === undefined) return vorlage;
  const zahl = String(Math.round(wert * 10) / 10).replace('.', ',');
  return vorlage.replace('{wert}', wert > 0 ? `+${zahl}` : zahl);
}
