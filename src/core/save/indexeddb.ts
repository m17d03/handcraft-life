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

/**
 * Sicherung mit bekannten Schlüsseln einfügen und rotieren – alle Anfragen synchron (Ticket 017, QA Runde 1):
 * Beim Abbau der Seite (Navigation, iOS beendet) verwirft der Browser eine Transaktion, die noch auf einen
 * Callback wartet, samt `aktuell`. Liefert die Schlüssel nach der Transaktion.
 */
function sicherungSofort(store: IDBObjectStore, art: SicherungsArt, zeit: string, json: string, vorhanden: readonly string[]): string[] {
  const schluessel = naechsterSchluessel(art, zeit, vorhanden);
  const eintrag: Sicherung = { schluessel, art, zeit, json };
  store.put(eintrag, schluessel);
  const weg = zuLoeschende(art, [...vorhanden, schluessel]);
  for (const k of weg) store.delete(k);
  return [...vorhanden, schluessel].filter((k) => !weg.includes(k));
}

/** Transaktion sofort abschliessen (keine weiteren Anfragen folgen) – wo verfügbar (Safari ≥ 15, Chromium ≥ 76). */
function abschliessen(tx: IDBTransaction): void {
  const t = tx as IDBTransaction & { commit?: () => void };
  if (typeof t.commit === 'function') t.commit();
}

/** Rückfall ohne bekannte Schlüssel: Laufnummer aus `getAllKeys` innerhalb der Transaktion. */
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

/** Alle Schlüssel im Store `sicherung`; `null`, wenn das nicht gelingt (dann Rückfall beim Schreiben). */
async function schluesselLesen(db: IDBDatabase): Promise<string[] | null> {
  try {
    const tx = db.transaction(STORE_SICHERUNG, 'readonly');
    return (await anfrage(tx.objectStore(STORE_SICHERUNG).getAllKeys())).map(String);
  } catch {
    return null;
  }
}

export class IndexedDbAblage implements Ablage {
  private db: Promise<IDBDatabase> | null = null;
  /** Geöffnete Verbindung, sobald `db` erfüllt ist – erlaubt Transaktionen ohne Warten (Ticket 017, F7). */
  private offen: IDBDatabase | null = null;
  /** Laufnummer des letzten `schreiben()`-Aufrufs bzw. der zuletzt angelegten Schreib-Transaktion. */
  private schreibNr = 0;
  private angelegtNr = 0;
  /**
   * Schlüssel im Store `sicherung`, wie sie nach allen angelegten Transaktionen sein werden (beim Öffnen
   * gelesen, danach mitgeführt). `null` = unbekannt (Lesefehler, abgebrochene Transaktion) → Rückfall.
   */
  private schluessel: string[] | null = null;
  /** Anzahl angelegter Schreib-Transaktionen (Schreiben und Sichern) – erkennt veraltete Schlüssel-Lesungen. */
  private txZaehler = 0;
  /** Zähler geöffneter Verbindungen (Diagnose/Test). */
  oeffnungen = 0;
  /** Angelegte Schreib-Transaktionen und übersprungene ältere Aufrufe (Diagnose/Test). */
  readonly schreibStatistik = { angelegt: 0, uebersprungen: 0, sofort: 0 };

  constructor(private readonly fabrik: IDBFactory | undefined = (globalThis as { indexedDB?: IDBFactory }).indexedDB) {}

  private verbindung(): Promise<IDBDatabase> {
    if (this.db === null) {
      if (this.fabrik === undefined) return Promise.reject(new Error('IndexedDB nicht verfügbar'));
      this.oeffnungen += 1;
      const verwerfen = (): void => {
        if (this.db === verbindung) {
          this.db = null;
          this.offen = null;
        }
      };
      const verbindung: Promise<IDBDatabase> = oeffnen(this.fabrik).then(
        async (db) => {
          this.schluessel = await schluesselLesen(db);
          // Vom Browser geschlossen oder neue DB-Version in anderem Tab → beim nächsten Zugriff neu öffnen.
          db.onclose = verwerfen;
          db.onversionchange = () => {
            db.close();
            verwerfen();
          };
          if (this.db === verbindung) this.offen = db;
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

  /**
   * Führt `f` aus; ist die Verbindung verloren, wird sie verworfen und `f` genau einmal wiederholt.
   * Ist die Verbindung schon offen, läuft `f` noch im selben Aufruf (synchron) – wichtig für `pagehide`:
   * die Transaktion existiert dann, bevor der Browser die Seite einfriert oder beendet.
   */
  private mitDb<T>(f: (db: IDBDatabase) => Promise<T>): Promise<T> {
    const offen = this.offen;
    if (offen !== null) {
      const nochmal = (e: unknown): Promise<T> => {
        if (!verbindungVerloren(e)) return Promise.reject(e instanceof Error ? e : new Error(String(e)));
        if (this.offen === offen) {
          this.offen = null;
          this.db = null;
        }
        return this.verbindung().then(f);
      };
      try {
        return f(offen).catch(nochmal);
      } catch (e) {
        return nochmal(e);
      }
    }
    return this.mitDbWarten(f);
  }

  private async mitDbWarten<T>(f: (db: IDBDatabase) => Promise<T>): Promise<T> {
    const versuch = this.verbindung();
    try {
      return await f(await versuch);
    } catch (e) {
      if (!verbindungVerloren(e)) throw e;
      if (this.db === versuch) {
        this.db = null;
        this.offen = null;
      }
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

  /**
   * Schreib-Transaktionen auf denselben Stores führt IndexedDB in der Reihenfolge ihres Anlegens aus. Darum
   * gilt: Aufrufreihenfolge = Anlegereihenfolge = Ergebnis. Ein älterer Aufruf, dessen Transaktion erst nach
   * einer neueren angelegt würde (Warten auf die Verbindung, Wiederholung nach Verbindungsverlust), wird
   * übersprungen – der neuere Stand ist schon eingereiht und darf nie überschrieben werden.
   */
  schreiben(json: string, zeit: string): Promise<void> {
    this.schreibNr += 1;
    const nr = this.schreibNr;
    return this.mitDb((db) => {
      if (nr < this.angelegtNr) {
        this.schreibStatistik.uebersprungen += 1;
        return Promise.resolve();
      }
      const tx = db.transaction([STORE_SPIELSTAND, STORE_SICHERUNG], 'readwrite');
      this.angelegtNr = nr;
      this.txZaehler += 1;
      this.schreibStatistik.angelegt += 1;
      const ende = this.beobachten(tx);
      tx.objectStore(STORE_SPIELSTAND).put(json, SCHLUESSEL_AKTUELL);
      this.sicherungAnfragen(tx, 'autosave', zeit, json);
      return ende;
    });
  }

  sichern(art: Exclude<SicherungsArt, 'autosave'>, json: string, zeit: string): Promise<void> {
    return this.mitDb((db) => {
      const tx = db.transaction(STORE_SICHERUNG, 'readwrite');
      this.txZaehler += 1;
      const ende = this.beobachten(tx);
      this.sicherungAnfragen(tx, art, zeit, json);
      return ende;
    });
  }

  /** Sicherung in `tx`: mit bekannten Schlüsseln synchron + `commit()`, sonst über `getAllKeys`. */
  private sicherungAnfragen(tx: IDBTransaction, art: SicherungsArt, zeit: string, json: string): void {
    const store = tx.objectStore(STORE_SICHERUNG);
    if (this.schluessel === null) {
      sicherungEinfuegen(store, art, zeit, json);
      return;
    }
    this.schluessel = sicherungSofort(store, art, zeit, json, this.schluessel);
    this.schreibStatistik.sofort += 1;
    abschliessen(tx);
  }

  /** Ende der Transaktion; scheitert sie, sind die mitgeführten Schlüssel unsicher → beim nächsten Mal neu lesen. */
  private beobachten(tx: IDBTransaction): Promise<void> {
    return fertig(tx).then(
      () => {
        if (this.schluessel === null && this.offen !== null) {
          const db = this.offen;
          const stand = this.txZaehler;
          // Nur übernehmen, wenn seither keine Schreib-Transaktion angelegt wurde (sonst wäre die Liste veraltet)
          void schluesselLesen(db).then((k) => {
            if (this.offen === db && this.schluessel === null && this.txZaehler === stand) this.schluessel = k;
          });
        }
      },
      (e: unknown) => {
        this.schluessel = null;
        throw e;
      },
    );
  }

  sicherungen(): Promise<Sicherung[]> {
    return this.mitDb(async (db) => {
      const tx = db.transaction(STORE_SICHERUNG, 'readonly');
      const alle = (await anfrage(tx.objectStore(STORE_SICHERUNG).getAll())) as Sicherung[];
      return alle.sort(nachLaufnummer);
    });
  }
}
