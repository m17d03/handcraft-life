/**
 * SpielstandDatei (ADR 0003, modul-vertrag §6): Hülle + Abschnitt `kern` + Abschnitte `module[id]`,
 * je mit eigener `schema`-Version. Erstellen, Lesen und Migrieren sind reine Funktionen auf JSON.
 */
import type { ModuleManifest } from '../modul';
import type { ModulId } from '../typen';
import { istKernSpeicher, KERN_SCHEMA, kernMigrationen, type KernSpeicher } from './kern-schema';

export const DATEI_FORMAT = 'handcraft-life-save';
export const HUELLE = 1;

export interface ModulAbschnitt {
  modulVersion: string;
  schema: number;
  aktiv: boolean;
  daten: unknown;
}

export interface SpielstandDatei {
  format: typeof DATEI_FORMAT;
  huelle: typeof HUELLE;
  /** Spielversion beim Speichern, nur Info. */
  spielVersion: string;
  /** ISO-Zeit. */
  gespeichert: string;
  kern: { schema: number; daten: KernSpeicher };
  module: Record<ModulId, ModulAbschnitt>;
}

export type LadeErgebnis =
  /** Kein Spielstand vorhanden. */
  | { art: 'leer' }
  /** JSON kaputt, Hülle unbekannt oder Kern nicht migrier-/prüfbar. Nichts überschreiben ohne Bestätigung. */
  | { art: 'defekt'; grund: string }
  /** Hülle oder Kern stammt aus einer neueren Spielversion: nicht lesbar, nie überschreiben. */
  | { art: 'zuNeu'; grund: string }
  | {
      art: 'ok';
      zustand: KernSpeicher;
      /** Abschnitte aller Module (bekannte migriert, ruhende unverändert) – so wird weitergespeichert. */
      module: Record<ModulId, ModulAbschnitt>;
      /** Mindestens ein Abschnitt ist neuer als der Code → nur lesend (S7). */
      nurLesend: boolean;
      /** Es wurde mindestens eine Migration ausgeführt (→ Rohkopie vorher sichern). */
      migriert: boolean;
      /** Bekannte Module, deren Abschnitt nicht lesbar/migrierbar war: für diesen Spielstand aus. */
      deaktiviert: ModulId[];
      hinweise: string[];
    };

type Obj = Record<string, unknown>;
const istObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const istSchema = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 1;

/** Tiefe Kopie über JSON – stellt zugleich sicher, dass nur JSON-Werte gespeichert werden. */
export function jsonKopie<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

/** Module, die einen eigenen Speicherabschnitt haben (der Kern hat keinen `save`). */
function speicherModule(module: readonly ModuleManifest[]): ModuleManifest[] {
  return module.filter((m) => m.save !== undefined);
}

/** Abschnitte für einen neuen Spielstand: `defaults()` jedes Moduls (freischaltung gibt es im Slice nicht → aktiv). */
export function neueModulAbschnitte(module: readonly ModuleManifest[]): Record<ModulId, ModulAbschnitt> {
  const ergebnis: Record<ModulId, ModulAbschnitt> = {};
  for (const m of speicherModule(module)) {
    if (m.save === undefined) continue;
    ergebnis[m.id] = { modulVersion: m.version, schema: m.save.schemaVersion, aktiv: true, daten: m.save.defaults() };
  }
  return ergebnis;
}

export function dateiErstellen(
  zustand: KernSpeicher,
  module: Record<ModulId, ModulAbschnitt>,
  info: { spielVersion: string; gespeichert: string },
): SpielstandDatei {
  return jsonKopie({
    format: DATEI_FORMAT,
    huelle: HUELLE,
    spielVersion: info.spielVersion,
    gespeichert: info.gespeichert,
    kern: { schema: KERN_SCHEMA, daten: zustand },
    module,
  });
}

/** Wendet `migrationen[von+1] … migrationen[bis]` an. Wirft bei Lücke in der Kette. */
export function migrieren(
  daten: unknown,
  von: number,
  bis: number,
  migrationen: Readonly<Record<number, (alt: unknown) => unknown>>,
): unknown {
  let x = daten;
  for (let v = von + 1; v <= bis; v++) {
    const schritt = migrationen[v];
    if (schritt === undefined) throw new Error(`Migration ${String(v - 1)} → ${String(v)} fehlt`);
    x = schritt(x);
  }
  return x;
}

const fehlerText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * Liest einen gespeicherten Spielstand (JSON-Text oder bereits geparstes Objekt) und migriert ihn auf den
 * Stand des Codes. Verändert die Eingabe nicht. Ablauf nach modul-vertrag §6.3/§6.4.
 */
export function dateiLesen(roh: unknown, module: readonly ModuleManifest[]): LadeErgebnis {
  if (roh === undefined || roh === null) return { art: 'leer' };
  let doc: unknown;
  if (typeof roh === 'string') {
    try {
      doc = JSON.parse(roh);
    } catch (e) {
      return { art: 'defekt', grund: `JSON kaputt: ${fehlerText(e)}` };
    }
  } else {
    doc = jsonKopie(roh);
  }

  if (!istObj(doc) || doc.format !== DATEI_FORMAT) return { art: 'defekt', grund: 'unbekanntes Format' };
  if (!istSchema(doc.huelle)) return { art: 'defekt', grund: 'Hülle ohne gültige Version' };
  if (doc.huelle > HUELLE) return { art: 'zuNeu', grund: `Hülle ${String(doc.huelle)} ist neuer als ${String(HUELLE)}` };

  const kern = doc.kern;
  if (!istObj(kern) || !istSchema(kern.schema)) return { art: 'defekt', grund: 'Abschnitt kern fehlt' };
  if (kern.schema > KERN_SCHEMA) {
    return { art: 'zuNeu', grund: `Kern-Schema ${String(kern.schema)} ist neuer als ${String(KERN_SCHEMA)}` };
  }
  let migriert = kern.schema < KERN_SCHEMA;
  let kernDaten: unknown;
  try {
    kernDaten = migrieren(kern.daten, kern.schema, KERN_SCHEMA, kernMigrationen);
  } catch (e) {
    return { art: 'defekt', grund: `Kern-Migration: ${fehlerText(e)}` };
  }
  if (!istKernSpeicher(kernDaten)) return { art: 'defekt', grund: 'Kern-Abschnitt ungültig' };

  const hinweise: string[] = [];
  let nurLesend = false;
  const alt = istObj(doc.module) ? doc.module : {};
  if (!istObj(doc.module)) hinweise.push('Abschnitt module fehlte – neu angelegt');
  const ergebnis: Record<ModulId, ModulAbschnitt> = {};
  const bekannt = new Set<ModulId>();
  const deaktiviert: ModulId[] = [];

  for (const m of speicherModule(module)) {
    const save = m.save;
    if (save === undefined) continue;
    bekannt.add(m.id);
    const a = alt[m.id];
    if (a === undefined) {
      ergebnis[m.id] = { modulVersion: m.version, schema: save.schemaVersion, aktiv: true, daten: save.defaults() };
      hinweise.push(`Modul ${m.id}: Abschnitt fehlte – Standardwerte`);
      continue;
    }
    if (!istObj(a) || !istSchema(a.schema)) {
      // Unlesbar: unverändert als ruhend behalten, Modul für diesen Spielstand deaktiviert.
      ergebnis[m.id] = a as ModulAbschnitt;
      deaktiviert.push(m.id);
      hinweise.push(`Modul ${m.id}: Abschnitt unlesbar – deaktiviert, Daten bleiben erhalten`);
      continue;
    }
    if (a.schema > save.schemaVersion) {
      ergebnis[m.id] = a as unknown as ModulAbschnitt;
      nurLesend = true;
      hinweise.push(`Modul ${m.id}: Schema ${String(a.schema)} neuer als ${String(save.schemaVersion)} – nur lesend`);
      continue;
    }
    try {
      const daten = migrieren(a.daten, a.schema, save.schemaVersion, save.migrations);
      if (!save.validate(daten)) throw new Error('validate fehlgeschlagen');
      if (a.schema < save.schemaVersion) migriert = true;
      ergebnis[m.id] = {
        modulVersion: m.version,
        schema: save.schemaVersion,
        aktiv: typeof a.aktiv === 'boolean' ? a.aktiv : true,
        daten,
      };
    } catch (e) {
      ergebnis[m.id] = a as unknown as ModulAbschnitt;
      deaktiviert.push(m.id);
      hinweise.push(`Modul ${m.id}: ${fehlerText(e)} – deaktiviert, Daten bleiben erhalten`);
    }
  }

  // Unbekannte Abschnitte (Modul nicht im Code): unverändert mitspeichern ("ruhend"), nie löschen.
  for (const [id, a] of Object.entries(alt)) {
    if (bekannt.has(id)) continue;
    ergebnis[id] = a as ModulAbschnitt;
    hinweise.push(`Modul ${id}: nicht im Code – Abschnitt ruht unverändert`);
  }

  return { art: 'ok', zustand: kernDaten, module: ergebnis, nurLesend, migriert, deaktiviert, hinweise };
}
