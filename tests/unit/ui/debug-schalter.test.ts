import { describe, expect, it } from 'vitest';
import { DEBUG_SCHALTER, MehrfachTipp, debugInSitzung, debugInSitzungMerken } from '../../../src/debug/schalter';

// Ticket 016: 5× schnell auf die Geldanzeige → Debug-Overlay an/aus; versehentliches Auslösen ausgeschlossen.
const folge = (z: MehrfachTipp, zeiten: number[], dauer = 80, weg = 0): boolean[] => zeiten.map((t) => z.tipp(t, dauer, weg));

describe('MehrfachTipp (Debug-Schalter)', () => {
  it('löst beim fünften schnellen Tipp aus, danach beginnt die Zählung neu', () => {
    const z = new MehrfachTipp();
    expect(folge(z, [0, 250, 500, 750, 1000])).toEqual([false, false, false, false, true]);
    expect(z.gezaehlt).toBe(0);
    expect(folge(z, [1300, 1550, 1800, 2050, 2300])).toEqual([false, false, false, false, true]);
  });

  it('vier Tipps reichen nicht', () => {
    expect(folge(new MehrfachTipp(), [0, 200, 400, 600])).not.toContain(true);
  });

  it('eine Pause > 400 ms setzt zurück (normales gelegentliches Antippen)', () => {
    const z = new MehrfachTipp();
    expect(folge(z, [0, 300, 600, 900, 1301, 1600, 1900, 2200])).not.toContain(true);
    expect(z.tipp(2500, 80, 0)).toBe(true); // 1301 … 2500 = fünf schnelle
  });

  it('langes Halten oder Ziehen (Umschauen beginnt auf der Anzeige) zählt nicht und setzt zurück', () => {
    const z = new MehrfachTipp();
    folge(z, [0, 200, 400, 600]);
    expect(z.tipp(800, DEBUG_SCHALTER.maxDauerMs + 1, 0)).toBe(false);
    expect(z.gezaehlt).toBe(0);
    folge(z, [1000, 1200, 1400, 1600]);
    expect(z.tipp(1800, 80, DEBUG_SCHALTER.maxWegPt + 1)).toBe(false);
    expect(z.gezaehlt).toBe(0);
  });
});

describe('Debug-Zustand in der Sitzung', () => {
  it('merkt an/aus, ohne Eintrag null', () => {
    const m = new Map<string, string>();
    const speicher = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    expect(debugInSitzung(speicher)).toBeNull();
    debugInSitzungMerken(true, speicher);
    expect(debugInSitzung(speicher)).toBe(true);
    debugInSitzungMerken(false, speicher);
    expect(debugInSitzung(speicher)).toBe(false);
  });

  it('ohne Speicher (privater Modus) kein Fehler', () => {
    expect(debugInSitzung(null)).toBeNull();
    expect(() => {
      debugInSitzungMerken(true, {
        setItem: () => {
          throw new Error('QuotaExceeded');
        },
      });
    }).not.toThrow();
  });
});
