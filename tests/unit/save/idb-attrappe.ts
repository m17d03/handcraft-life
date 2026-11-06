/**
 * IndexedDB-Attrappe für Unit-Tests der `IndexedDbAblage` (Ticket 017/020). Bildet ab, was für Speichern und
 * Rotation zählt:
 * - Transaktionen werden in Anlegereihenfolge nacheinander ausgeführt (je ein Zeitgeber-Schritt), atomar:
 *   Änderungen erst beim Abschluss übernommen, bei Abbruch verworfen.
 * - Anfragen einer Transaktion laufen der Reihe nach; `getAllKeys`/`get`/`getAll` sehen den Stand inkl. der
 *   früheren Anfragen derselben Transaktion; ihr `onsuccess` darf weitere Anfragen absetzen.
 * - `delete` mit Schlüsselbereich (`IDBKeyRange`, als Global eingesetzt über `keyRangeAttrappe`).
 * - `commit()`: danach keine Anfragen mehr.
 * - Seitenabbau (`seite.beendet`): Transaktionen, die danach noch Anfragen absetzen, werden ganz verworfen.
 * - Abbruch: `abbrechen(info)` entscheidet je Transaktion beim Abschluss.
 * Mehrere `IndexedDbAblage` auf derselben Attrappe = mehrere Tabs auf derselben Datenbank.
 */
import { vi } from 'vitest';

export interface BereichAttrappe {
  lower: string;
  upper: string;
  lowerOpen: boolean;
  upperOpen: boolean;
  includes(k: string): boolean;
}

/** Minimales `IDBKeyRange` (nur `bound`), Textvergleich wie IndexedDB bei String-Schlüsseln. */
export const keyRangeAttrappe = {
  bound(lower: string, upper: string, lowerOpen = false, upperOpen = false): BereichAttrappe {
    return {
      lower,
      upper,
      lowerOpen,
      upperOpen,
      includes: (k: string) =>
        (lowerOpen ? k > lower : k >= lower) && (upperOpen ? k < upper : k <= upper),
    };
  },
};

export function keyRangeEinsetzen(): void {
  vi.stubGlobal('IDBKeyRange', keyRangeAttrappe);
}

export interface AttrappenOptionen {
  /** Läuft als Mikrotask direkt nach dem Öffnen der Verbindung (vor wartenden Fortsetzungen). */
  nachOeffnen?: () => void;
  /** Erste Verbindung meldet beim ersten Schreiben "connection is closing". */
  ersteSchliesst?: boolean;
  /** Lesen der Sicherungsschlüssel ausserhalb von Schreib-Transaktionen scheitert (Rückfall-Pfad). */
  schluesselFehler?: boolean;
  /** Entscheidet beim Abschluss jeder Schreib-Transaktion, ob sie abbricht (Fuzz, Ticket 020). */
  abbrechen?: (info: { nr: number; stores: string[] }) => boolean;
  /** Wird nach jeder übernommenen Transaktion aufgerufen (Invarianten prüfen). */
  nachUebernahme?: () => void;
}

type Anfrage = { art: 'put' | 'delete' | 'lesen'; lauf: (s: Stand) => void };
interface Stand {
  daten: Map<string, unknown>;
  sicherung: Map<string, unknown>;
}

export function idbAttrappe(o: AttrappenOptionen = {}) {
  const daten = new Map<string, unknown>();
  const sicherung = new Map<string, unknown>();
  /** `angelegt:<json>` je put auf `spielstand` (beim Absetzen). */
  const protokoll: string[] = [];
  /** Alle put/delete/commit in Reihenfolge des Absetzens. */
  const anfragen: string[] = [];
  const seite = { beendet: false, verworfen: 0 };
  const statistik = { transaktionen: 0, abgebrochen: 0, uebernommen: 0 };
  let verbindungen = 0;
  let txNr = 0;
  let kette = Promise.resolve();

  const fabrik = {
    open: () => {
      const vnr = verbindungen++;
      let erstesSchreiben = true;
      const db: Record<string, unknown> = {
        objectStoreNames: { contains: () => true },
        close: vi.fn(),
        transaction: (stores: string | string[], modus?: string) => {
          if (o.ersteSchliesst === true && vnr === 0 && erstesSchreiben && modus === 'readwrite') {
            erstesSchreiben = false;
            const e = new Error('The database connection is closing.');
            e.name = 'InvalidStateError';
            throw e;
          }
          const nr = txNr++;
          statistik.transaktionen += 1;
          const storeListe = typeof stores === 'string' ? [stores] : stores;
          const queue: Anfrage[] = [];
          const tx: Record<string, unknown> = {};
          let spaet = false;
          let committed = false;
          const absetzen = (text: string | null, a: Anfrage): void => {
            if (committed) {
              const e = new Error('Transaktion bereits abgeschlossen');
              e.name = 'TransactionInactiveError';
              throw e;
            }
            if (a.art !== 'lesen' && seite.beendet) spaet = true;
            if (text !== null) anfragen.push(text);
            queue.push(a);
          };
          tx.commit = () => {
            committed = true;
            anfragen.push('commit');
          };
          const leseAnfrage = (f: (s: Stand) => unknown): Record<string, unknown> => {
            const r: Record<string, unknown> = {};
            absetzen(null, {
              art: 'lesen',
              lauf: (s) => {
                r.result = f(s);
                (r.onsuccess as (() => void) | undefined)?.();
              },
            });
            return r;
          };
          tx.objectStore = (name: string) => {
            const ziel = (s: Stand) => (name === 'spielstand' ? s.daten : s.sicherung);
            return {
              put: (wert: unknown, schluessel: string) => {
                if (name === 'spielstand') protokoll.push(`angelegt:${String(wert)}`);
                absetzen(`put ${name} ${schluessel}`, { art: 'put', lauf: (s) => ziel(s).set(schluessel, wert) });
                return {};
              },
              delete: (schluessel: string | BereichAttrappe) => {
                const text = typeof schluessel === 'string' ? schluessel : `[${schluessel.lower},${schluessel.upper})`;
                absetzen(`delete ${name} ${text}`, {
                  art: 'delete',
                  lauf: (s) => {
                    const m = ziel(s);
                    if (typeof schluessel === 'string') m.delete(schluessel);
                    else for (const k of [...m.keys()]) if (schluessel.includes(k)) m.delete(k);
                  },
                });
                return {};
              },
              getAllKeys: () => {
                if (o.schluesselFehler === true && modus !== 'readwrite') throw new Error('getAllKeys gestört (Test)');
                return leseAnfrage((s) => [...ziel(s).keys()].sort());
              },
              getAll: () => leseAnfrage((s) => [...ziel(s).entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, v]) => v)),
              get: (schluessel: string) => leseAnfrage((s) => ziel(s).get(schluessel)),
            };
          };
          if (modus !== 'readwrite') {
            // Lesend: sofort (Mikrotask) auf dem übernommenen Stand – wie bisher, ohne Zeitgeber
            queueMicrotask(() => {
              const s: Stand = { daten, sicherung };
              for (let i = 0; i < queue.length; i++) queue[i]?.lauf(s);
              committed = true;
              (tx.oncomplete as (() => void) | undefined)?.();
            });
            return tx;
          }
          kette = kette.then(
            () =>
              new Promise<void>((ok) => {
                setTimeout(() => {
                  const s: Stand = { daten: new Map(daten), sicherung: new Map(sicherung) };
                  // Anfragen der Reihe nach; Rückrufe dürfen weitere anhängen
                  for (let i = 0; i < queue.length; i++) queue[i]?.lauf(s);
                  committed = true;
                  const abbruch = (e: Error): void => {
                    (tx as { error?: Error }).error = e;
                    (tx.onabort as (() => void) | undefined)?.();
                  };
                  if (spaet) {
                    seite.verworfen += 1;
                    const e = new Error('Seite abgebaut: Transaktion verworfen (Test)');
                    e.name = 'AbortError';
                    abbruch(e);
                  } else if (o.abbrechen?.({ nr, stores: storeListe }) === true) {
                    statistik.abgebrochen += 1;
                    const e = new Error('Transaktion abgebrochen (Test)');
                    e.name = 'AbortError';
                    abbruch(e);
                  } else {
                    daten.clear();
                    for (const [k, v] of s.daten) daten.set(k, v);
                    sicherung.clear();
                    for (const [k, v] of s.sicherung) sicherung.set(k, v);
                    statistik.uebernommen += 1;
                    o.nachUebernahme?.();
                    (tx.oncomplete as (() => void) | undefined)?.();
                  }
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
  return { fabrik: fabrik as unknown as IDBFactory, daten, sicherung, protokoll, anfragen, seite, statistik };
}

/** Autosave-Schlüssel im Store, sortiert. */
export const autosaves = (sicherung: Map<string, unknown>): string[] =>
  [...sicherung.keys()].filter((k) => k.startsWith('autosave|')).sort();
