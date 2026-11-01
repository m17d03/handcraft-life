/**
 * Manifest des Kerns (Art `kern`). Liefert die materialunabhängigen Prozesse, das Messwerkzeug und die
 * Texte der Kern-Ursachen. Der Kern importiert nie aus `src/modules/`.
 */
import { KERN_VERSION, type ModuleManifest } from './modul';
import { PROZESS_MESSEN, PROZESS_TRENNEN } from './prozesse';
import { URSACHE_SAUBER } from './qualitaet';
import type { WerkzeugDef } from './typen';

export const MASSBAND: WerkzeugDef = {
  id: 'kern.werkzeug.massband',
  prozesse: [PROZESS_MESSEN],
  materialKlassen: ['holz', 'metall', 'kunststoff'],
  werte: { raster_mm: 0.5 },
  preis: 0,
};

export const kernModul: ModuleManifest = {
  id: 'kern',
  art: 'kern',
  version: KERN_VERSION,
  requires: { core: `^${KERN_VERSION}` },
  provides: { tools: [MASSBAND.id], processes: [PROZESS_MESSEN, PROZESS_TRENNEN] },
  mechanics: ['Messen vom Bezugsende (Raster), Trennen mit Fuge, Drift und Tempo; Qualität, Aufträge, Wirtschaft'],
  assets: { glb: [], ktx2: [], audio: [], budgetMB: 0 },
  daten: {
    werkzeuge: [MASSBAND],
    texte: {
      [URSACHE_SAUBER]: 'Sauber gearbeitet.',
      'kern.text.falsch-gemessen': 'Falsch gemessen: {wert} mm',
      'kern.text.blatt-auf-linie': 'Blatt lag auf der Linie: {wert} mm',
      'kern.text.blatt-werkstueckseite': 'Blatt lag auf der Werkstückseite: {wert} mm',
      'kern.text.blatt-zu-weit-im-abfall': 'Blatt zu weit im Abfall: {wert} mm',
      'kern.text.schiefes-bezugsende': 'Vom schiefen Werksende gemessen: {wert} mm',
      'kern.text.schief-gesaegt': 'Schief gesägt: {wert}°',
      'kern.text.zu-kurz': 'Zu kurz: {wert} mm – Ausschuss für diesen Auftrag',
    },
  },
  tests: ['Start-Prüfung aller Manifeste', 'Kern läuft ohne weitere Module (kein Absturz)'],
};
