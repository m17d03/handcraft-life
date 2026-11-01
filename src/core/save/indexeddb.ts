/**
 * Echte Ablage in IndexedDB (ADR 0003): Datenbank `handcraft-life`, Stores `spielstand` (Schlüssel
 * `'aktuell'`) und `sicherung` (Schlüssel `<art>|<Laufnummer>|<ISO-Zeit>`). Ohne Bibliothek.
 * Geprüft wird diese Datei im Browser (Playwright, Ticket 013); Unit-Tests nutzen `SpeicherAblage`.
 */
import { nachLaufnummer, naechsterSchluessel, zuLoeschende, type Ablage, type Sicherung, type SicherungsArt } from './ablage';

export const DB_NAME = 'handcraft-life';
export const DB_VERSION = 1;
const STORE_SPIELSTAND = 'spielstand';
const STORE_SICHERUNG = 'sicherung';
const SCHLUESSEL_AKTUELL = 'aktuell';

function anfrage<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((ok, fehler) => {
    r.onsuccess = () => {
      ok(r.result);
    };
    r.onerror = () => {
      fehler(r.error ?? new Error('IndexedDB-Anfrage fehlgeschlagen'));
    };
  });
}

function fertig(tx: IDBTransaction): Promise<void> {
  return new Promise((ok, fehler) => {
    tx.oncomplete = () => {
      ok();
    };
    tx.onabort = () => {
      fehler(tx.error ?? new Error('IndexedDB-Transaktion abgebrochen'));
    };
    tx.onerror = () => {
      fehler(tx.error ?? new Error('IndexedDB-Transaktion fehlgeschlagen'));
    };
  });
}

function oeffnen(fabrik: IDBFactory): Promise<IDBDatabase> {
  return new Promise((ok, fehler) => {
    const r = fabrik.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(STORE_SPIELSTAND)) db.createObjectStore(STORE_SPIELSTAND);
      if (!db.objectStoreNames.contains(STORE_SICHERUNG)) db.createObjectStore(STORE_SICHERUNG);
    };
    r.onsuccess = () => {
      ok(r.result);
    };
    r.onerror = () => {
      fehler(r.error ?? new Error('IndexedDB lässt sich nicht öffnen'));
    };
    r.onblocked = () => {
      fehler(new Error('IndexedDB blockiert (anderer Tab mit alter Version offen)'));
    };
  });
}

/**
 * Fehler, nach denen die Verbindung unbrauchbar ist (Safari schliesst sie z. B. nach App-Wechsel oder unter
 * Speicherdruck: "InvalidStateError … connection is closing"). Dann: Verbindung verwerfen, einmal neu öffnen.
 */
export function verbindungVerloren(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const { name, message } = e as { name?: unknown; message?: unknown };
  return (
    name === 'InvalidStateError' ||
    name === 'UnknownError' ||
    (typeof message === 'string' && /clos(ing|ed)/i.test(message))
  );
}

/** Sicherung innerhalb einer laufenden Transaktion einfügen und rotieren (Laufnummer aus vorhandenen Schlüsseln). */
function sicherungEinfuegen(store: IDBObjectStore, art: SicherungsArt, zeit: string, json: string): void {
  const keys = store.getAllKeys();
  keys.onsuccess = () => {
    const vorhanden = keys.result.map(String);
    const schluessel = naechsterSchluessel(art, zeit, vorhanden);
    const eintrag: Sicherung = { schluessel, art, zeit, json };
    store.put(eintrag, schluessel);
    for (const k of zuLoeschende(art, [...vorhanden, schluessel])) store.delete(k);
  };
}

export class IndexedDbAblage implements Ablage {
  private db: Promise<IDBDatabase> | null = null;
  /** Zähler geöffneter Verbindungen (Diagnose/Test). */
  oeffnungen = 0;

  constructor(private readonly fabrik: IDBFactory | undefined = (globalThis as { indexedDB?: IDBFactory }).indexedDB) {}

  private verbindung(): Promise<IDBDatabase> {
    if (this.db === null) {
      if (this.fabrik === undefined) return Promise.reject(new Error('IndexedDB nicht verfügbar'));
      this.oeffnungen += 1;
      const verwerfen = (): void => {
        if (this.db === verbindung) this.db = null;
      };
      const verbindung: Promise<IDBDatabase> = oeffnen(this.fabrik).then(
        (db) => {
          // Vom Browser geschlossen oder neue DB-Version in anderem Tab → beim nächsten Zugriff neu öffnen.
          db.onclose = verwerfen;
          db.onversionchange = () => {
            db.close();
            verwerfen();
          };
          return db;
        },
        (e: unknown) => {
          verwerfen(); // nächster Versuch öffnet neu
          throw e;
        },
      );
      this.db = verbindung;
    }
    return this.db;
  }

  /** Führt `f` aus; ist die Verbindung verloren, wird sie verworfen und `f` genau einmal wiederholt. */
  private async mitDb<T>(f: (db: IDBDatabase) => Promise<T>): Promise<T> {
    const versuch = this.verbindung();
    try {
      return await f(await versuch);
    } catch (e) {
      if (!verbindungVerloren(e)) throw e;
      if (this.db === versuch) this.db = null;
      return f(await this.verbindung());
    }
  }

  lesen(): Promise<string | undefined> {
    return this.mitDb(async (db) => {
      const tx = db.transaction(STORE_SPIELSTAND, 'readonly');
      const wert = await anfrage<unknown>(tx.objectStore(STORE_SPIELSTAND).get(SCHLUESSEL_AKTUELL) as IDBRequest<unknown>);
      return typeof wert === 'string' ? wert : wert === undefined ? undefined : JSON.stringify(wert);
    });
  }

  schreiben(json: string, zeit: string): Promise<void> {
    return this.mitDb((db) => {
      const tx = db.transaction([STORE_SPIELSTAND, STORE_SICHERUNG], 'readwrite');
      const ende = fertig(tx);
      tx.objectStore(STORE_SPIELSTAND).put(json, SCHLUESSEL_AKTUELL);
      sicherungEinfuegen(tx.objectStore(STORE_SICHERUNG), 'autosave', zeit, json);
      return ende;
    });
  }

  sichern(art: Exclude<SicherungsArt, 'autosave'>, json: string, zeit: string): Promise<void> {
    return this.mitDb((db) => {
      const tx = db.transaction(STORE_SICHERUNG, 'readwrite');
      const ende = fertig(tx);
      sicherungEinfuegen(tx.objectStore(STORE_SICHERUNG), art, zeit, json);
      return ende;
    });
  }

  sicherungen(): Promise<Sicherung[]> {
    return this.mitDb(async (db) => {
      const tx = db.transaction(STORE_SICHERUNG, 'readonly');
      const alle = (await anfrage(tx.objectStore(STORE_SICHERUNG).getAll())) as Sicherung[];
      return alle.sort(nachLaufnummer);
    });
  }
}
