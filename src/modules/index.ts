/**
 * Einzige Stelle, die alle Module kennt (ADR 0002). Neue Module hier eintragen.
 */
import { kernModul } from '../core/kern-modul';
import { katalogErstellen, type Katalog, type ModuleManifest } from '../core/modul';
import { holzModul } from './holz/module';

export const alleModule: readonly ModuleManifest[] = [kernModul, holzModul];

/** Katalog aller aktiven Module; Fehler stehen in `katalog.fehler` (für das Debug-Overlay). */
export function standardKatalog(): Katalog {
  return katalogErstellen(alleModule);
}
