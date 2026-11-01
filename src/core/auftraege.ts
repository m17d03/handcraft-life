/**
 * Aufträge aus Vorlagen erzeugen (modul-vertrag §4.4). Erster Auftrag mit Startwerten, danach endlos neue
 * Masse im Raster der Vorlage (holz-brett-zuschnitt §0).
 */
import type { Katalog } from './modul';
import type { Auftrag, AuftragVorlage, Zufall } from './typen';
import { basispreis } from './wirtschaft';

export const SOLL_LAENGE = 'laenge_mm';

export function auftragErzeugen(
  katalog: Katalog,
  vorlage: AuftragVorlage,
  id: string,
  zufall: Zufall,
  start: boolean,
): Auftrag {
  const soll: Record<string, number> = {};
  for (const [schluessel, [min, max]] of Object.entries(vorlage.soll)) {
    const startwert = vorlage.start[schluessel];
    if (start && startwert !== undefined) {
      soll[schluessel] = startwert;
      continue;
    }
    const raster = vorlage.raster[schluessel] ?? 1;
    const stufen = Math.floor((max - min) / raster);
    soll[schluessel] = min + Math.floor(zufall() * (stufen + 1)) * raster;
  }
  const material = katalog.materialien[vorlage.materialId];
  const produkt = katalog.produkte[vorlage.produktId];
  if (material === undefined || produkt === undefined) {
    throw new Error(`Auftragsvorlage ${vorlage.id}: Material oder Produkt fehlt im Katalog`);
  }
  return {
    id,
    vorlageId: vorlage.id,
    soll,
    toleranz: { ...vorlage.toleranz },
    basispreis: basispreis(vorlage, material, soll[SOLL_LAENGE] ?? 0, produkt.schritte.length),
    kundeId: 'laufkunde',
    status: 'angeboten',
  };
}
