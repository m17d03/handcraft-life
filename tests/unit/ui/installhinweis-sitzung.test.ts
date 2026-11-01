import { describe, expect, it } from 'vitest';
import { INSTALL_HINWEIS_SCHLUESSEL, merkeGeschlossen, speicherMitSitzungsMerker, wurdeGeschlossen, type Speicher } from '../../../src/ui/installhinweis';

const gesperrt: Speicher = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
};

describe('Installationshinweis: Sitzungsmerker (Ticket 013)', () => {
  it('localStorage gesperrt → Schliessen gilt bis zum Neuladen', () => {
    const s = speicherMitSitzungsMerker(gesperrt);
    expect(wurdeGeschlossen(s)).toBe(false);
    merkeGeschlossen(s);
    expect(wurdeGeschlossen(s)).toBe(true);
  });

  it('kein localStorage (null) → ebenfalls Sitzungsmerker', () => {
    const sitzung = new Map<string, string>();
    merkeGeschlossen(speicherMitSitzungsMerker(null, sitzung));
    expect(sitzung.has(INSTALL_HINWEIS_SCHLUESSEL)).toBe(true);
    expect(wurdeGeschlossen(speicherMitSitzungsMerker(null, sitzung))).toBe(true);
  });

  it('funktionierender Speicher wird weiter dauerhaft beschrieben und gelesen', () => {
    const daten = new Map<string, string>();
    const dauerhaft: Speicher = { getItem: (k) => daten.get(k) ?? null, setItem: (k, v) => void daten.set(k, v) };
    merkeGeschlossen(speicherMitSitzungsMerker(dauerhaft));
    expect(daten.has(INSTALL_HINWEIS_SCHLUESSEL)).toBe(true);
    // neue Sitzung (leerer Merker) liest aus dem dauerhaften Speicher
    expect(wurdeGeschlossen(speicherMitSitzungsMerker(dauerhaft))).toBe(true);
  });
});
