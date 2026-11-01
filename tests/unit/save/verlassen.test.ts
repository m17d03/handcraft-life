/**
 * Ticket 017, F7: Verlassen (pagehide / visibilitychange hidden) unmittelbar nach einer Aktion verliert den
 * Stand nicht – der neueste Stand geht sofort in die Ablage, auch wenn ein älterer Schreibvorgang noch läuft.
 * Generationsregel (Ticket 009) bleibt: ein älterer Stand überschreibt nie einen neueren.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexedDbAblage, SpeicherAblage, Spielstand, type Ablage } from '../../../src/core/save';
import { neuerSpielzustand, type Spielzustand } from '../../../src/core/zustand';
import { katalog } from '../core/hilfen';

const stand = (geld: number): Spielzustand => {
  const z = neuerSpielzustand(katalog, 1);
  z.inventar.geld = geld;
  return z;
};
const geldIn = (json: string | undefined): number =>
  (JSON.parse(json ?? '{}') as { kern: { daten: Spielzustand } }).kern.daten.inventar.geld;
const neu = (ablage: Ablage) => new Spielstand({ ablage, module: katalog.module, speicherVerwaltung: undefined });

/**
 * Ablage wie IndexedDB: Aufrufe werden sofort angenommen (Transaktion angelegt), aber erst wirksam, wenn der
 * Test sie freigibt – und dann strikt in Aufrufreihenfolge (eine spätere Transaktion wartet auf die frühere).
 */
class IdbAehnlich extends SpeicherAblage {
  readonly angelegt: string[] = [];
  private freigaben: (() => void)[] = [];
  private ende: Promise<void> = Promise.resolve();
  override schreiben(json: string, zeit: string): Promise<void> {
    this.angelegt.push(json);
    let frei!: () => void;
    const freigegeben = new Promise<void>((r) => {
      frei = r;
    });
    this.freigaben.push(frei);
    const vorher = this.ende;
    const p = Promise.all([vorher, freigegeben]).then(() => super.schreiben(json, zeit));
    this.ende = p.catch(() => undefined);
    return p;
  }
  freigeben(i: number): void {
    this.freigaben[i]?.();
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-01T10:00:00.000Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('F7 – Spielstand: neuester Stand geht sofort in die Ablage', () => {
  it('pagehide während ein älterer Schreibvorgang läuft: neuer Stand wird synchron übergeben', async () => {
    const a = new IdbAehnlich();
    const s = neu(a);
    await s.laden();
    s.speichern(stand(1)); // Aktion A, entprellt
    await vi.advanceTimersByTimeAsync(0); // A läuft (Transaktion angelegt, nicht fertig)
    expect(a.angelegt).toHaveLength(1);
    s.speichern(stand(2)); // Aktion B (Anreissen) – Autosave wartet noch
    const p = s.sofortSpeichern(); // pagehide 0 ms danach, ohne irgendein await dazwischen
    // Entscheidend: B ist bereits bei der Ablage, nicht hinter A eingereiht
    expect(a.angelegt).toHaveLength(2);
    expect(geldIn(a.angelegt[1])).toBe(2);
    expect(s.status().ausstehend).toBe(false);
    a.freigeben(1); // B ist bereit, wartet aber auf A (Anlegereihenfolge)
    await vi.advanceTimersByTimeAsync(0);
    expect(a.schreibvorgaenge).toBe(0);
    a.freigeben(0);
    expect(await p).toBe(true);
    expect(a.schreibvorgaenge).toBe(2);
    expect(geldIn(a.aktuell)).toBe(2);
  });

  it('sofortSpeichern(zustand) mitten in einem Schreibvorgang übergibt synchron', async () => {
    const a = new IdbAehnlich();
    const s = neu(a);
    await s.laden();
    const p1 = s.sofortSpeichern(stand(5));
    expect(a.angelegt).toHaveLength(1);
    const p2 = s.sofortSpeichern(stand(6));
    expect(a.angelegt).toHaveLength(2);
    a.freigeben(0);
    a.freigeben(1);
    expect(await p1).toBe(true);
    expect(await p2).toBe(true);
    expect(geldIn(a.aktuell)).toBe(6);
  });

  it('älterer Vorgang scheitert, neuerer gelingt: kein erneuter Versuch mit dem älteren', async () => {
    const a = new IdbAehnlich();
    const s = neu(a);
    await s.laden();
    s.speichern(stand(1));
    await vi.advanceTimersByTimeAsync(0);
    s.speichern(stand(2));
    const p = s.sofortSpeichern();
    a.stoerung = 'voll'; // der ältere scheitert beim Wirksamwerden
    a.freigeben(0);
    await vi.advanceTimersByTimeAsync(0);
    a.stoerung = null;
    a.freigeben(1);
    expect(await p).toBe(true);
    expect(geldIn(a.aktuell)).toBe(2);
    expect(s.status().ausstehend).toBe(false);
    expect(await s.sofortSpeichern()).toBe(true);
    expect(a.angelegt).toHaveLength(2); // A wurde nicht erneut geschrieben
  });

  it('neuerer Vorgang scheitert: der neueste Stand wartet erneut, nie der ältere', async () => {
    const a = new IdbAehnlich();
    const s = neu(a);
    await s.laden();
    s.speichern(stand(1));
    await vi.advanceTimersByTimeAsync(0);
    s.speichern(stand(2));
    const p = s.sofortSpeichern();
    a.freigeben(0);
    await vi.advanceTimersByTimeAsync(0);
    a.stoerung = 'voll';
    a.freigeben(1);
    expect(await p).toBe(false);
    expect(s.status().ausstehend).toBe(true);
    a.stoerung = null;
    const p2 = s.sofortSpeichern();
    expect(geldIn(a.angelegt[2])).toBe(2);
    a.freigeben(2);
    expect(await p2).toBe(true);
    expect(geldIn(a.aktuell)).toBe(2);
  });

  it('zuletztGespeichert folgt dem neuesten Stand, auch wenn ein älterer später fertig meldet', async () => {
    // Ablage ohne Reihenfolge-Garantie bei der Rückmeldung (nur Zeitstempel geprüft)
    const fertig: (() => void)[] = [];
    const a: Ablage = {
      lesen: () => Promise.resolve(undefined),
      schreiben: () =>
        new Promise<void>((ok) => {
          fertig.push(ok);
        }),
      sichern: () => Promise.resolve(),
      sicherungen: () => Promise.resolve([]),
    };
    const s = neu(a);
    await s.laden();
    void s.sofortSpeichern(stand(1));
    vi.setSystemTime(new Date('2026-11-01T10:00:05.000Z'));
    const p = s.sofortSpeichern(stand(2));
    fertig[1]?.();
    await vi.advanceTimersByTimeAsync(0);
    fertig[0]?.();
    expect(await p).toBe(true);
    expect(s.status().zuletztGespeichert).toBe('2026-11-01T10:00:05.000Z');
  });
});

// ------------------------------------------------------------------ IndexedDbAblage mit IDB-Attrappe

interface AttrappenOptionen {
  /** Läuft als Mikrotask direkt nach dem Öffnen der Verbindung (vor wartenden Fortsetzungen). */
  nachOeffnen?: () => void;
  /** Erste Verbindung meldet beim ersten Schreiben "connection is closing". */
  ersteSchliesst?: boolean;
}

/**
 * Minimale IndexedDB-Attrappe: Transaktionen werden beim Anlegen protokolliert und in Anlegereihenfolge
 * wirksam (wie IndexedDB bei überlappenden readwrite-Stores).
 */
function idbAttrappe(o: AttrappenOptionen = {}) {
  const daten = new Map<string, unknown>();
  const sicherung = new Map<string, unknown>();
  const protokoll: string[] = [];
  let verbindungen = 0;
  let kette = Promise.resolve();
  const fabrik = {
    open: () => {
      const nr = verbindungen++;
      let erstesSchreiben = true;
      const db: Record<string, unknown> = {
        objectStoreNames: { contains: () => true },
        close: vi.fn(),
        transaction: (stores: string | string[]) => {
          if (o.ersteSchliesst === true && nr === 0 && erstesSchreiben) {
            erstesSchreiben = false;
            const e = new Error('The database connection is closing.');
            e.name = 'InvalidStateError';
            throw e;
          }
          const ops: (() => void)[] = [];
          const tx: Record<string, unknown> = {};
          const store = (name: string) => {
            const ziel = name === 'spielstand' ? daten : sicherung;
            return {
              put: (wert: unknown, schluessel: string) => {
                if (name === 'spielstand') protokoll.push(`angelegt:${String(wert)}`);
                ops.push(() => ziel.set(schluessel, wert));
                return {};
              },
              delete: (schluessel: string) => {
                ops.push(() => ziel.delete(schluessel));
                return {};
              },
              getAllKeys: () => {
                const r: Record<string, unknown> = { result: [...ziel.keys()] };
                queueMicrotask(() => {
                  (r.onsuccess as (() => void) | undefined)?.();
                });
                return r;
              },
              get: (schluessel: string) => {
                const r: Record<string, unknown> = { result: ziel.get(schluessel) };
                queueMicrotask(() => {
                  (r.onsuccess as () => void)();
                });
                return r;
              },
            };
          };
          tx.objectStore = store;
          void stores;
          // Wirksam in Anlegereihenfolge, nach allen Anfragen dieser Transaktion
          kette = kette.then(
            () =>
              new Promise<void>((ok) => {
                setTimeout(() => {
                  for (const op of ops) op();
                  (tx.oncomplete as () => void)();
                  ok();
                }, 0);
              }),
          );
          return tx;
        },
      };
      const r: Record<string, unknown> = { result: db };
      queueMicrotask(() => {
        (r.onsuccess as () => void)();
        if (o.nachOeffnen) queueMicrotask(o.nachOeffnen);
      });
      return r;
    },
  };
  return { fabrik: fabrik as unknown as IDBFactory, daten, protokoll };
}

describe('F7 – IndexedDbAblage: Transaktion sofort, Reihenfolge = Aufrufreihenfolge', () => {
  it('bei offener Verbindung wird die Transaktion synchron im Aufruf angelegt', async () => {
    const { fabrik, protokoll, daten } = idbAttrappe();
    const ablage = new IndexedDbAblage(fabrik);
    await ablage.schreiben('"eins"', 'z1');
    void ablage.schreiben('"zwei"', 'z2'); // z. B. noch laufend
    const p = ablage.schreiben('"drei"', 'z3'); // pagehide
    expect(protokoll).toEqual(['angelegt:"eins"', 'angelegt:"zwei"', 'angelegt:"drei"']);
    await vi.advanceTimersByTimeAsync(10);
    await p;
    expect(daten.get('aktuell')).toBe('"drei"');
  });

  it('Aufrufe vor dem Öffnen der Verbindung werden in Aufrufreihenfolge angelegt', async () => {
    const { fabrik, protokoll, daten } = idbAttrappe();
    const ablage = new IndexedDbAblage(fabrik);
    const ps = [ablage.schreiben('"a"', 'z'), ablage.schreiben('"b"', 'z'), ablage.schreiben('"c"', 'z')];
    await vi.advanceTimersByTimeAsync(10);
    await Promise.all(ps);
    expect(protokoll).toEqual(['angelegt:"a"', 'angelegt:"b"', 'angelegt:"c"']);
    expect(daten.get('aktuell')).toBe('"c"');
  });

  it('älterer Aufruf, der erst nach einem neueren anlegen würde, wird übersprungen (nie älter über neuer)', async () => {
    let ablage!: IndexedDbAblage;
    let neuer: Promise<void> | null = null;
    const { fabrik, protokoll, daten } = idbAttrappe({
      // Verbindung ist offen, die Fortsetzung des älteren Aufrufs wartet noch → neuerer kommt synchron zuerst
      nachOeffnen: () => {
        neuer ??= ablage.schreiben('"neu"', 'z2');
      },
    });
    ablage = new IndexedDbAblage(fabrik);
    const aelter = ablage.schreiben('"alt"', 'z1');
    await vi.advanceTimersByTimeAsync(10);
    await aelter;
    await neuer;
    expect(protokoll).toEqual(['angelegt:"neu"']);
    expect(ablage.schreibStatistik).toEqual({ angelegt: 1, uebersprungen: 1 });
    expect(daten.get('aktuell')).toBe('"neu"');
  });

  it('Verbindung schliesst beim Schreiben: einmal neu öffnen, Stand geht nicht verloren', async () => {
    const { fabrik, daten } = idbAttrappe({ ersteSchliesst: true });
    const ablage = new IndexedDbAblage(fabrik);
    await ablage.lesen(); // Verbindung 1 offen
    const p = ablage.schreiben('"x"', 'z');
    await vi.advanceTimersByTimeAsync(10);
    await p;
    expect(ablage.oeffnungen).toBe(2);
    expect(daten.get('aktuell')).toBe('"x"');
  });

  it('Spielstand + IndexedDbAblage: Verlassen 0 ms nach einer Aktion während eines Schreibvorgangs', async () => {
    const { fabrik, protokoll, daten } = idbAttrappe();
    const s = neu(new IndexedDbAblage(fabrik));
    await s.laden();
    await s.sofortSpeichern(stand(1)); // Verbindung offen, erster Stand liegt
    s.speichern(stand(2));
    await vi.advanceTimersByTimeAsync(1000); // entprellter Vorgang läuft …
    const vorher = protokoll.length;
    s.speichern(stand(3)); // … Aktion „Anreissen“
    const p = s.sofortSpeichern(); // pagehide sofort danach
    expect(protokoll.length).toBe(vorher + 1); // Transaktion existiert bereits beim Rücksprung aus dem Handler
    expect(geldIn(protokoll.at(-1)?.slice('angelegt:'.length))).toBe(3);
    await vi.advanceTimersByTimeAsync(10);
    expect(await p).toBe(true);
    expect(geldIn(daten.get('aktuell') as string)).toBe(3);
  });
});
