/**
 * Wirtschaft (Kern), core-loop §5: Startgeld, Basispreis, Verkaufspreis, Anschreiben.
 */
import type { AuftragVorlage, Inventar, MaterialDef, Stufe } from './typen';
import { preisfaktor } from './qualitaet';

/** Währung „G“. */
export const STARTGELD = 40;
/** Boni (Meistermodus, Stammkunde) sind gedeckelt. */
export const BONI_MAX = 0.2;

/** Basispreis = Materialkosten × Faktor + Arbeitsschritte × Satz; Materialkosten anteilig zur Länge, gerundet. */
export function basispreis(vorlage: AuftragVorlage, material: MaterialDef, sollLaenge_mm: number, schritte: number): number {
  const materialkosten = Math.round((material.preis * sollLaenge_mm) / material.masse_mm.l);
  return Math.round(materialkosten * vorlage.basispreis.material_faktor + schritte * vorlage.basispreis.je_schritt);
}

/** Verkaufspreis = runden(Basispreis × Preisfaktor(Stufe) × (1 + Boni)). */
export function verkaufspreis(basis: number, stufe: Stufe, boni = 0): number {
  return Math.round(basis * preisfaktor(stufe) * (1 + Math.min(Math.max(boni, 0), BONI_MAX)));
}

/** Erlös gutschreiben; offene Schulden (Anschreiben) werden zuerst getilgt. */
export function erloesVerbuchen(inv: Inventar, erloes: number): { inventar: Inventar; getilgt: number } {
  const getilgt = Math.min(inv.schulden, erloes);
  return {
    inventar: { ...inv, schulden: inv.schulden - getilgt, geld: inv.geld + erloes - getilgt },
    getilgt,
  };
}
