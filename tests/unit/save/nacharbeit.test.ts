/** Regressionstests QA Ticket 009, Runde 1 (Punkte 1–7). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dateiLesen, IndexedDbAblage, SpeicherAblage, Spielstand, type Ablage } from '../../../src/core/save';
import { neuerSpielzustand, type Spielzustand } from '../../../src/core/zustand';
import { katalog } from '../core/hilfen';

const fixtures = import.meta.glob<string>('../../fixtures/saves/*.json', { query: '?raw', import: 'default', eager: true });
const fixture = (datei: string): string => {
  const e = Object.entries(fixtures).find(([p]) => p.endsWith(`/${datei}`));
  if (e === undefined) throw new Error(datei);
  return e[1];
};
const stand = (geld: number): Spielzustand => {
  const z = neuerSpielzustand(katalog, 1);
  z.inventar.geld = geld;
  return z;
};
const geldIn = (json: string | undefined): number =>
  (JSON.parse(json ?? '{}') as { kern: { daten: Spielzustand } }).kern.daten.inventar.geld;
const neu = (ablage: Ablage) => new Spielstand({ ablage, module: katalog.module, speicherVerwaltung: undefined });

/** Ablage, deren Schreibvorgänge der Test von Hand gelingen oder scheitern lässt. */
class SteuerAblage extends SpeicherAblage {
  offen: { json: string; ok: () => void; nein: (e: Error) => void }[] = [];
  override schreiben(json: string, zeit: string): Promise<void> {
    return new Promise((ok, nein) => {
      this.offen.push({
        json,
        ok: () => {
          void super.schreiben(json, zeit).then(ok);
        },
        nein,
      });
    });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-01T10:00:00.000Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('1 – fehlgeschlagener älterer Stand ersetzt nie einen neueren', () => {
  it('A scheitert nach Start von B, B gelingt → pagehide schreibt nicht A', async () => {
    const a = new SteuerAblage();
    const s = neu(a);
    await s.laden();
    s.speichern(stand(1));
    await vi.advanceTimersByTimeAsync(0); // A läuft
    s.speichern(stand(2));
    const pB = s.sofortSpeichern(); // B eingereiht
    await vi.advanceTimersByTimeAsync(0);
    a.offen[0]?.nein(new Error('vorübergehend'));
    await vi.advanceTimersByTimeAsync(0);
    a.offen[1]?.ok();
    expect(await pB).toBe(true);
    expect(geldIn(a.aktuell)).toBe(2);
    expect(s.status().ausstehend).toBe(false);
    expect(await s.sofortSpeichern()).toBe(true); // pagehide
    expect(a.offen).toHaveLength(2);
    expect(geldIn(a.aktuell)).toBe(2);
  });

  it('der neueste Stand wird nach Fehlschlag erneut versucht', async () => {
    const a = new SteuerAblage();
    const s = neu(a);
    await s.laden();
    const p = s.sofortSpeichern(stand(1));
    await vi.advanceTimersByTimeAsync(0);
    a.offen[0]?.nein(new Error('vorübergehend'));
    expect(await p).toBe(false);
    expect(s.status().ausstehend).toBe(true);
    const p2 = s.sofortSpeichern();
    await vi.advanceTimersByTimeAsync(0);
    a.offen[1]?.ok();
    expect(await p2).toBe(true);
    expect(geldIn(a.aktuell)).toBe(1);
  });
});

describe('2 – IndexedDB: verlorene Verbindung wird neu geöffnet', () => {
  /** Minimale IDB-Attrappe: erste Verbindung meldet "connection is closing", jede weitere liest Text. */
  function fabrik(gespeichert: string) {
    const dbs: Record<string, unknown>[] = [];
    const f = {
      open: () => {
        const nr = dbs.length;
        const db: Record<string, unknown> = {
          objectStoreNames: { contains: () => true },
          close: vi.fn(),
          transaction: () => {
            if (nr === 0) {
              const e = new Error('Failed to execute transaction on IDBDatabase: The database connection is closing.');
              e.name = 'InvalidStateError';
              throw e;
            }
            return {
              objectStore: () => ({
                get: () => {
                  const r: Record<string, unknown> = { result: gespeichert };
                  queueMicrotask(() => {
                    (r.onsuccess as () => void)();
                  });
                  return r;
                },
              }),
            };
          },
        };
        dbs.push(db);
        const r: Record<string, unknown> = { result: db };
        queueMicrotask(() => {
          (r.onsuccess as () => void)();
        });
        return r;
      },
    };
    return { f: f as unknown as IDBFactory, dbs };
  }

  it('InvalidStateError → Verbindung verworfen, genau ein neuer Versuch gelingt', async () => {
    const { f, dbs } = fabrik('"x"');
    const ablage = new IndexedDbAblage(f);
    expect(await ablage.lesen()).toBe('"x"');
    expect(ablage.oeffnungen).toBe(2);
    expect(dbs).toHaveLength(2);
  });

  it('onclose/onversionchange verwerfen die gecachte Verbindung', async () => {
    const { f, dbs } = fabrik('"y"');
    const ablage = new IndexedDbAblage(f);
    await ablage.lesen(); // öffnet 2× (die erste "schliesst")
    await ablage.lesen();
    expect(ablage.oeffnungen).toBe(2); // gecacht
    (dbs[1]?.onclose as () => void)();
    await ablage.lesen();
    expect(ablage.oeffnungen).toBe(3);
    (dbs[2]?.onversionchange as () => void)();
    expect(dbs[2]?.close).toHaveBeenCalled();
    await ablage.lesen();
    expect(ablage.oeffnungen).toBe(4);
  });
});

describe('3 – vor laden() wird nie gespeichert', () => {
  it('speichern()/sofortSpeichern() vor laden() werden verworfen, v1 bleibt', async () => {
    const v1 = fixture('v1.json');
    const a = new SpeicherAblage(v1);
    const s = neu(a);
    expect(s.status().modus).toBe('ungeladen');
    s.speichern(stand(777));
    await vi.advanceTimersByTimeAsync(2000);
    expect(await s.sofortSpeichern(stand(778))).toBe(false);
    expect(a.aktuell).toBe(v1);
    expect(s.status().hinweise.join(' ')).toMatch(/vor dem Laden verworfen/);
    expect((await s.laden()).art).toBe('geladen');
    await s.sofortSpeichern();
    expect(a.aktuell).toBe(v1); // der verworfene Stand wird auch danach nicht nachgeschrieben
  });
});

describe('4 – Sicherungen defekt/zuNeu wachsen nicht', () => {
  it('zu neuer Stand: 5 Starts → genau eine Kopie der Art zuNeu', async () => {
    const zn = fixture('zukunft-kern-schema-999.json');
    const a = new SpeicherAblage(zn);
    for (let i = 0; i < 5; i++) {
      expect((await neu(a).laden()).art).toBe('zuNeu');
    }
    expect((await a.sicherungen()).map((x) => x.art)).toEqual(['zuNeu']);
    expect(a.aktuell).toBe(zn);
  });

  it('verschiedene defekte Inhalte: höchstens 3 Kopien, die neuesten bleiben', async () => {
    const a = new SpeicherAblage();
    for (let i = 1; i <= 5; i++) {
      a.aktuell = `{kaputt ${String(i)}`;
      await neu(a).laden();
    }
    expect((await a.sicherungen()).map((x) => x.json)).toEqual(['{kaputt 3', '{kaputt 4', '{kaputt 5']);
  });
});

describe('5 – Rotation nach Laufnummer, nicht nach Uhr', () => {
  it('Uhr springt zurück: neuester Autosave bleibt', async () => {
    const a = new SpeicherAblage();
    const s = neu(a);
    await s.laden();
    for (let i = 1; i <= 3; i++) {
      await s.sofortSpeichern(stand(i));
      vi.advanceTimersByTime(1000);
    }
    vi.setSystemTime(new Date('2026-10-01T10:00:00.000Z'));
    await s.sofortSpeichern(stand(99));
    const autos = (await a.sicherungen()).filter((x) => x.art === 'autosave').map((x) => geldIn(x.json));
    expect(autos).toEqual([2, 3, 99]);
  });

  it('Laufnummer läuft über Sitzungen weiter', async () => {
    const a = new SpeicherAblage();
    for (let sitzung = 0; sitzung < 3; sitzung++) {
      const s = neu(a);
      await s.laden();
      await s.sofortSpeichern(stand(sitzung));
      await s.sofortSpeichern(stand(sitzung + 10));
    }
    const autos = (await a.sicherungen()).filter((x) => x.art === 'autosave').map((x) => geldIn(x.json));
    expect(autos).toEqual([11, 2, 12]);
  });
});

describe('6/7 – ruhende Abschnitte, __proto__, Hinweistexte', () => {
  it('neuBeginnen im Modus nurLesend: Sicherung zuNeu, unbekannte Modulabschnitte ruhen weiter', async () => {
    const f = JSON.parse(fixture('v1-unbekanntes-modul.json')) as { module: Record<string, { schema: number }> };
    const angeln = JSON.parse(JSON.stringify(f.module['angeln'])) as unknown;
    const holz = f.module['holz'];
    if (holz === undefined) throw new Error('holz');
    holz.schema = 999;
    const roh = JSON.stringify(f);
    const a = new SpeicherAblage(roh);
    const s = neu(a);
    expect((await s.laden()).art).toBe('geladen');
    expect(s.status().modus).toBe('nurLesend');
    expect(await s.sofortSpeichern(stand(6))).toBe(false);
    expect(a.aktuell).toBe(roh);

    expect(await s.neuBeginnen()).toBe(true);
    expect(await s.sofortSpeichern(stand(7))).toBe(true);
    const neuDatei = JSON.parse(a.aktuell ?? '') as { module: Record<string, unknown> };
    expect(neuDatei.module['angeln']).toEqual(angeln);
    expect(neuDatei.module['holz']).toEqual({ modulVersion: '0.1.0', schema: 1, aktiv: true, daten: {} });
    expect((await a.sicherungen()).filter((x) => x.art === 'zuNeu').map((x) => x.json)).toEqual([roh]);
  });

  it('Modul-ID __proto__ bleibt als eigener Abschnitt erhalten (keine Prototyp-Änderung)', () => {
    const roh = fixture('v1.json').replace('"module": {', '"module": {"__proto__": {"schema": 1, "daten": {"x": 1}},');
    expect(roh).toContain('__proto__');
    const e = dateiLesen(roh, katalog.module);
    if (e.art !== 'ok') throw new Error(e.art);
    expect(Object.keys(e.module)).toContain('__proto__');
    expect(Object.getPrototypeOf(e.module)).toBe(Object.prototype);
    expect(JSON.stringify(e.module)).toContain('"x":1');
  });

  it('Hinweise ohne doppelten Punkt', async () => {
    const a = new SpeicherAblage();
    const s = neu(a);
    await s.laden();
    a.schreiben = () => Promise.reject(new Error('Speicher erschöpft.'));
    await s.sofortSpeichern(stand(1));
    expect(s.status().hinweise.some((h) => h.includes('..'))).toBe(false);
    expect(s.status().hinweise.join(' ')).toMatch(/Speicher erschöpft\. Spiel läuft weiter/);
  });
});
