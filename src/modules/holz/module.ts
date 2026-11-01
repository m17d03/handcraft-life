/**
 * Grundmodul Holz (ADR 0002): Ablängen eines Rohbretts mit Bezugsende, Fuge, Drift und Tempo.
 * Importiert nur aus `src/core/`, nie aus anderen Modulen.
 */
import type { ModuleManifest, ModulSpeicher } from '../../core/modul';
import { AUFTRAG_REGALBRETT, FICHTE_BRETT, FUCHSSCHWANZ, holzDaten, REGALBRETT } from './data/stammdaten';
import { ausrissRegel, rohbrettFehlerRegel } from './logic/regeln';

/** Speicherabschnitt `module.holz` – im Slice noch leer (alles Gemeinsame liegt im Kern). */
export type HolzSpeicher = Record<string, never>;

export const holzSpeicher: ModulSpeicher<HolzSpeicher> = {
  schemaVersion: 1,
  defaults: () => ({}),
  migrations: {},
  validate: (data: unknown): data is HolzSpeicher =>
    typeof data === 'object' && data !== null && !Array.isArray(data) && Object.keys(data).length === 0,
};

export const holzModul: ModuleManifest = {
  id: 'holz',
  art: 'grundmodul',
  version: '0.1.0',
  requires: { core: '^0.1.0' },
  provides: {
    materials: [FICHTE_BRETT.id],
    tools: [FUCHSSCHWANZ.id],
    products: [REGALBRETT.id],
    jobs: [AUFTRAG_REGALBRETT.id],
  },
  mechanics: [
    'Bezugsende wählen (Endriss, schiefes Werksende)',
    'Blatt auf der Abfallseite ansetzen (Fuge)',
    'Gegenlenken in den ersten Zügen, Tempo am Ende (Ausriss)',
  ],
  assets: { glb: [], ktx2: [], audio: [], budgetMB: 0 },
  daten: holzDaten,
  logik: { regeln: [ausrissRegel], erzeugung: [rohbrettFehlerRegel] },
  save: holzSpeicher,
  tests: [
    'Rechenbeispiele holz-brett-zuschnitt §4.2 (Q und Stufe)',
    'Blattposition 0 / −0,8 / −1,6 mm',
    'Endriss im Werkstück → Ausschuss',
    'Kern startet ohne Modul holz',
  ],
};
