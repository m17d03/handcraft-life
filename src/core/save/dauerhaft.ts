/**
 * `navigator.storage.persist()` versuchen (modul-vertrag §6.5). Wirkung auf iOS ist unsicher [H]:
 * Ergebnis nur anzeigen (Debug-Overlay), nie darauf verlassen.
 */

export type DauerhaftErgebnis = 'gewaehrt' | 'abgelehnt' | 'nicht-verfuegbar' | 'fehler';

/** Teil von `StorageManager`, den wir brauchen – injizierbar für Tests. */
export interface SpeicherVerwaltung {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
}

export function standardSpeicherVerwaltung(): SpeicherVerwaltung | undefined {
  const nav = (globalThis as { navigator?: { storage?: SpeicherVerwaltung } }).navigator;
  return nav?.storage;
}

export async function dauerhaftAnfordern(
  verwaltung: SpeicherVerwaltung | undefined,
): Promise<DauerhaftErgebnis> {
  if (verwaltung?.persist === undefined) return 'nicht-verfuegbar';
  try {
    if (verwaltung.persisted !== undefined && (await verwaltung.persisted())) return 'gewaehrt';
    return (await verwaltung.persist()) ? 'gewaehrt' : 'abgelehnt';
  } catch {
    return 'fehler';
  }
}
