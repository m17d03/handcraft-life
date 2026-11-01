/**
 * Echte Ablage in IndexedDB (ADR 0003): Datenbank `handcraft-life`, Stores `spielstand` (Schlüssel
 * `'aktuell'`) und `sicherung` (Schlüssel `<art>|<ISO-Zeit>|<Nr>`). Ohne Bibliothek.
 * Geprüft wird diese Datei im Browser (Playwright, Ticket 013); Unit-Tests nutzen `SpeicherAblage`.
 */
import { sicherungsSchluessel, zuLoeschendeAutosaves, type Ablage, type Sicherung, type SicherungsArt } from './ablage';

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

export class IndexedDbAblage implements Ablage {
  private db: Promise<IDBDatabase> | null = null;

  constructor(private readonly fabrik: IDBFactory | undefined = (globalThis as { indexedDB?: IDBFactory }).indexedDB) {}

  private verbindung(): Promise<IDBDatabase> {
    if (this.db === null) {
      if (this.fabrik === undefined) return Promise.reject(new Error('IndexedDB nicht verfügbar'));
      this.db = oeffnen(this.fabrik).catch((e: unknown) => {
        this.db = null; // nächster Versuch öffnet neu
        throw e;
      });
    }
    return this.db;
  }

  async lesen(): Promise<string | undefined> {
    const db = await this.verbindung();
    const tx = db.transaction(STORE_SPIELSTAND, 'readonly');
    const wert = await anfrage<unknown>(tx.objectStore(STORE_SPIELSTAND).get(SCHLUESSEL_AKTUELL) as IDBRequest<unknown>);
    return typeof wert === 'string' ? wert : wert === undefined ? undefined : JSON.stringify(wert);
  }

  async schreiben(json: string, zeit: string): Promise<void> {
    const db = await this.verbindung();
    const tx = db.transaction([STORE_SPIELSTAND, STORE_SICHERUNG], 'readwrite');
    const ende = fertig(tx);
    tx.objectStore(STORE_SPIELSTAND).put(json, SCHLUESSEL_AKTUELL);
    const sicherung = tx.objectStore(STORE_SICHERUNG);
    const schluessel = sicherungsSchluessel('autosave', zeit);
    const eintrag: Sicherung = { schluessel, art: 'autosave', zeit, json };
    sicherung.put(eintrag, schluessel);
    const bereich = IDBKeyRange.bound('autosave|', 'autosave|￿');
    const keys = sicherung.getAllKeys(bereich);
    keys.onsuccess = () => {
      for (const k of zuLoeschendeAutosaves(keys.result.map(String))) sicherung.delete(k);
    };
    await ende;
  }

  async sichern(art: Exclude<SicherungsArt, 'autosave'>, json: string, zeit: string): Promise<void> {
    const db = await this.verbindung();
    const tx = db.transaction(STORE_SICHERUNG, 'readwrite');
    const ende = fertig(tx);
    const schluessel = sicherungsSchluessel(art, zeit);
    const eintrag: Sicherung = { schluessel, art, zeit, json };
    tx.objectStore(STORE_SICHERUNG).put(eintrag, schluessel);
    await ende;
  }

  async sicherungen(): Promise<Sicherung[]> {
    const db = await this.verbindung();
    const tx = db.transaction(STORE_SICHERUNG, 'readonly');
    const alle = (await anfrage(tx.objectStore(STORE_SICHERUNG).getAll())) as Sicherung[];
    return alle.sort((a, b) => (a.schluessel < b.schluessel ? -1 : 1));
  }
}
