/**
 * Öffentliche Schnittstelle Spielstand (Ticket 009, ADR 0003).
 *
 * Einbindung (Ticket 013):
 *   const spielstand = new Spielstand({ ablage: new IndexedDbAblage(), module: katalog.module, spielVersion });
 *   const a = await spielstand.laden();   // 'neu' | 'geladen' | 'defekt' | 'zuNeu' | 'lesefehler'
 *   spielstand.speichern(zustand);         // nach jeder Aktion, entprellt
 *   document.addEventListener('visibilitychange', () => { if (document.hidden) void spielstand.sofortSpeichern(); });
 *   addEventListener('pagehide', () => void spielstand.sofortSpeichern());
 */
export { AUTOSAVES_BEHALTEN, SpeicherAblage, type Ablage, type Sicherung, type SicherungsArt } from './ablage';
export { dauerhaftAnfordern, type DauerhaftErgebnis, type SpeicherVerwaltung } from './dauerhaft';
export {
  DATEI_FORMAT,
  dateiErstellen,
  dateiLesen,
  HUELLE,
  migrieren,
  neueModulAbschnitte,
  type LadeErgebnis,
  type ModulAbschnitt,
  type SpielstandDatei,
} from './datei';
export { IndexedDbAblage } from './indexeddb';
export { istKernSpeicher, KERN_SCHEMA, kernMigrationen, type KernSpeicher } from './kern-schema';
export { Spielstand, type LadeAusgang, type SpeicherModus, type SpeicherStatus, type SpielstandOptionen } from './spielstand';
