/**
 * Echte Ablage in IndexedDB (ADR 0003): Datenbank `handcraft-life`, Stores `spielstand` (Schlüssel
 * `'aktuell'`) und `sicherung` (Schlüssel `<art>|<Laufnummer>[.<Tab>]|<ISO-Zeit>`). Ohne Bibliothek.
 * Geprüft wird diese Datei im Browser (Playwright, Ticket 013/020) und mit einer IDB-Attrappe (Unit-Tests).
 */
import {
  artVon,
  BEHALTEN,
  laufnummer,
  nachLaufnummer,
  ROTIERENDE_ARTEN,
  schluesselFuer,
  vergleicheSchluessel,
  zuLoeschende,
  type Ablage,
  type Sicherung,
  type SicherungsArt,
} from './ablage';

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

/** Transaktion sofort abschliessen (keine weiteren Anfragen folgen) – wo verfügbar (Safari ≥ 15, Chromium ≥ 76). */
function abschliessen(tx: IDBTransaction): void {
  const t = tx as IDBTransaction & { commit?: () => void };
  if (typeof t.commit === 'function') t.commit();
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

/** Was über BroadcastChannel geht: nur der Schlüssel einer gerade geschriebenen Sicherung (Beschleuniger, Ticket 020). */
interface KanalNachricht {
  typ: 'sicherung';
  schluessel: string;
}

/** Teil von `BroadcastChannel`, den wir brauchen – injizierbar für Tests. */
export interface SicherungsKanal {
  postMessage(nachricht: KanalNachricht): void;
  onmessage: ((e: { data: unknown }) => void) | null;
}

export interface IndexedDbOptionen {
  /** Kennung dieses Tabs (Teil der Laufnummer). Standard: zufällig je Ablage. */
  tabId?: string;
  /** Kanal zu anderen Tabs; Standard: `BroadcastChannel` im Browser, sonst keiner. `null` = keiner. */
  kanal?: SicherungsKanal | null;
}

export const KANAL_NAME = 'handcraft-life-sicherung';

function standardKanal(): SicherungsKanal | null {
  const g = globalThis as { BroadcastChannel?: new (name: string) => SicherungsKanal; document?: unknown };
  if (g.BroadcastChannel === undefined || g.document === undefined) return null;
  try {
    return new g.BroadcastChannel(KANAL_NAME);
  } catch {
    return null;
  }
}

function zufallsKennung(): string {
  return Math.random().toString(36).slice(2, 8).padEnd(6, '0');
}

/** Schlüsselbereich „Art `art`, kleiner als `grenze`“ (Textordnung = Rotationsordnung, siehe `vergleicheSchluessel`). */
function unterhalb(art: SicherungsArt, grenze: string): IDBKeyRange {
  return IDBKeyRange.bound(`${art}|`, grenze, false, true);
}

const rotiert = (art: string): art is SicherungsArt => (ROTIERENDE_ARTEN as readonly string[]).includes(art);

/**
 * Sicherungs-Rotation (Ticket 020):
 * - Jede Speichertransaktion setzt alle Anfragen synchron ab und schliesst mit `commit()` (Ticket 017): `aktuell`,
 *   die neue Sicherung und ein Bereichs-Löschen „alles dieser Art unterhalb der drittneuesten bekannten“. Das
 *   Bereichs-Löschen trifft auch Schlüssel, die dieser Tab nicht kennt oder für schon gelöscht hält (A1).
 * - `bekannt` ist eine Obermenge der vorhandenen Schlüssel (dieser Tab): eigene Einträge, alles Gelesene. Nur
 *   abgebrochene eigene Einträge werden entfernt, gelöschte erst nach erfolgreichem Abschluss. Darum bleiben
 *   nach jeder Transaktion höchstens `BEHALTEN` je Art – auch wenn eine frühere Transaktion abbricht.
 * - Danach folgt eine eigene Aufräum-Transaktion (`getAllKeys` → löschen, was über `BEHALTEN` hinausgeht). Sie
 *   räumt Sicherungen anderer Tabs mit auf (A2) und darf beim Abbau der Seite verloren gehen – `aktuell` steckt
 *   in der schon abgeschlossenen Speichertransaktion; aufgeräumt wird dann beim nächsten Mal.
 * - Laufnummer = grösste bekannte + 1, mit Tab-Kennung eindeutig; andere Tabs melden ihre Schlüssel per
 *   BroadcastChannel (nur Beschleuniger – richtig bleibt es auch ohne).
 */
export class IndexedDbAblage implements Ablage {
  private db: Promise<IDBDatabase> | null = null;
  /** Geöffnete Verbindung, sobald `db` erfüllt ist – erlaubt Transaktionen ohne Warten (Ticket 017, F7). */
  private offen: IDBDatabase | null = null;
  /** Laufnummer des letzten `schreiben()`-Aufrufs bzw. der zuletzt angelegten Schreib-Transaktion. */
  private schreibNr = 0;
  private angelegtNr = 0;
  /** Grösste bekannte Sicherungs-Laufnummer; `null` = nie gelesen (Lesefehler) → Rückfall über `getAllKeys`. */
  private maxNr: number | null = null;
  /** Obermenge der vorhandenen Sicherungsschlüssel je rotierender Art (siehe Klassenkommentar). */
  private readonly bekannt = new Map<SicherungsArt, Set<string>>();
  readonly tabId: string;
  private readonly kanal: SicherungsKanal | null;
  /** Zähler geöffneter Verbindungen (Diagnose/Test). */
  oeffnungen = 0;
  /**
   * Diagnose/Test: angelegte Schreib-Transaktionen, übersprungene ältere Aufrufe, Sicherungen synchron in der
   * Speichertransaktion (`sofort`) bzw. über den Rückfall, in Aufräum-Transaktionen gelöschte Schlüssel.
   */
  readonly schreibStatistik = { angelegt: 0, uebersprungen: 0, sofort: 0, rueckfall: 0, aufgeraeumt: 0 };

  constructor(
    private readonly fabrik: IDBFactory | undefined = (globalThis as { indexedDB?: IDBFactory }).indexedDB,
    optionen: IndexedDbOptionen = {},
  ) {
    this.tabId = optionen.tabId ?? zufallsKennung();
    this.kanal = optionen.kanal === undefined ? standardKanal() : optionen.kanal;
    if (this.kanal !== null) {
      this.kanal.onmessage = (e) => {
        const n = e.data as Partial<KanalNachricht> | null;
        if (n?.typ === 'sicherung' && typeof n.schluessel === 'string' && this.maxNr !== null) this.merken([n.schluessel]);
      };
    }
  }

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
          const k = await schluesselLesen(db);
          if (k !== null) this.merken(k);
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
      this.schreibStatistik.angelegt += 1;
      // `aktuell` zuerst und unabhängig von allem Weiteren
      tx.objectStore(STORE_SPIELSTAND).put(json, SCHLUESSEL_AKTUELL);
      if (this.maxNr === null) {
        // Rückfall: Speichertransaktion nur mit `aktuell`; die Sicherung folgt in eigener Transaktion
        abschliessen(tx);
        const ende = fertig(tx);
        this.rueckfall(db, 'autosave', zeit, json).catch(() => undefined);
        return ende;
      }
      const ende = this.sicherungSofort(tx, 'autosave', zeit, json);
      void this.aufraeumen(db);
      return ende;
    });
  }

  sichern(art: Exclude<SicherungsArt, 'autosave'>, json: string, zeit: string): Promise<void> {
    return this.mitDb((db) => {
      if (this.maxNr === null) return this.rueckfall(db, art, zeit, json);
      const tx = db.transaction(STORE_SICHERUNG, 'readwrite');
      const ende = this.sicherungSofort(tx, art, zeit, json);
      if (rotiert(art)) void this.aufraeumen(db);
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

  // ------------------------------------------------------------------ Sicherungen

  /** Schlüssel übernehmen (gelesen oder von einem anderen Tab gemeldet): `bekannt` ergänzen, Laufnummer anheben. */
  private merken(schluessel: readonly string[]): void {
    let max = this.maxNr ?? 0;
    for (const k of schluessel) {
      max = Math.max(max, laufnummer(k));
      const art = artVon(k);
      if (rotiert(art)) this.menge(art).add(k);
    }
    this.maxNr = max;
  }

  private menge(art: SicherungsArt): Set<string> {
    let m = this.bekannt.get(art);
    if (m === undefined) {
      m = new Set();
      this.bekannt.set(art, m);
    }
    return m;
  }

  private vergessen(schluessel: readonly string[]): void {
    for (const k of schluessel) {
      const art = artVon(k);
      if (rotiert(art)) this.bekannt.get(art)?.delete(k);
    }
  }

  private neuerSchluessel(art: SicherungsArt, zeit: string): string {
    this.maxNr = (this.maxNr ?? 0) + 1;
    return schluesselFuer(art, this.maxNr, zeit, this.tabId);
  }

  /**
   * Sicherung in `tx` – alle Anfragen synchron, dann `commit()` (Ticket 017). Löscht per Schlüsselbereich alles
   * dieser Art unterhalb der `BEHALTEN`-neuesten bekannten Schlüssel (inkl. des neuen).
   */
  private sicherungSofort(tx: IDBTransaction, art: SicherungsArt, zeit: string, json: string): Promise<void> {
    const store = tx.objectStore(STORE_SICHERUNG);
    const schluessel = this.neuerSchluessel(art, zeit);
    const eintrag: Sicherung = { schluessel, art, zeit, json };
    store.put(eintrag, schluessel);
    let grenze: string | undefined;
    if (rotiert(art)) {
      const m = this.menge(art);
      m.add(schluessel);
      const behalten = BEHALTEN[art];
      if (m.size >= behalten) {
        grenze = [...m].sort(vergleicheSchluessel)[m.size - behalten];
        if (grenze !== undefined) store.delete(unterhalb(art, grenze));
      }
    }
    this.schreibStatistik.sofort += 1;
    abschliessen(tx);
    return fertig(tx).then(
      () => {
        // Was unterhalb der Grenze lag, ist jetzt sicher weg
        if (grenze !== undefined) {
          const g = grenze;
          this.vergessen([...this.menge(art)].filter((k) => vergleicheSchluessel(k, g) < 0));
        }
        this.kanal?.postMessage({ typ: 'sicherung', schluessel });
      },
      (e: unknown) => {
        // Abgebrochen: der neue Schlüssel existiert nicht (Phantom); alles andere blieb, wie es war
        this.vergessen([schluessel]);
        throw e;
      },
    );
  }

  /**
   * Eigene Transaktion: alle Schlüssel lesen, je rotierender Art über `BEHALTEN` hinaus löschen (auch Sicherungen
   * anderer Tabs), Laufnummer und `bekannt` nachführen. Geht sie verloren (Abbau, Abbruch), holt die nächste sie nach.
   */
  private aufraeumen(db: IDBDatabase): Promise<void> {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE_SICHERUNG, 'readwrite');
    } catch {
      return Promise.resolve();
    }
    const store = tx.objectStore(STORE_SICHERUNG);
    const weg: string[] = [];
    const r = store.getAllKeys();
    r.onsuccess = () => {
      const alle = r.result.map(String);
      this.merken(alle);
      for (const art of ROTIERENDE_ARTEN) weg.push(...zuLoeschende(art, alle));
      for (const k of weg) store.delete(k);
      abschliessen(tx);
    };
    return fertig(tx).then(
      () => {
        this.vergessen(weg);
        this.schreibStatistik.aufgeraeumt += weg.length;
      },
      () => undefined,
    );
  }

  /**
   * Rückfall, wenn die Schlüssel nie gelesen werden konnten: Laufnummer aus `getAllKeys` in eigener Transaktion,
   * dann einfügen und rotieren. `aktuell` steckt (bei `schreiben`) schon in der vorher abgeschlossenen Transaktion.
   */
  private rueckfall(db: IDBDatabase, art: SicherungsArt, zeit: string, json: string): Promise<void> {
    const tx = db.transaction(STORE_SICHERUNG, 'readwrite');
    const store = tx.objectStore(STORE_SICHERUNG);
    let schluessel: string | null = null;
    const weg: string[] = [];
    const r = store.getAllKeys();
    r.onsuccess = () => {
      const alle = r.result.map(String);
      this.merken(alle);
      const k = this.neuerSchluessel(art, zeit);
      schluessel = k;
      if (rotiert(art)) this.menge(art).add(k);
      const eintrag: Sicherung = { schluessel: k, art, zeit, json };
      store.put(eintrag, k);
      for (const a of ROTIERENDE_ARTEN) weg.push(...zuLoeschende(a, a === art ? [...alle, k] : alle));
      for (const x of weg) store.delete(x);
      abschliessen(tx);
    };
    this.schreibStatistik.rueckfall += 1;
    return fertig(tx).then(
      () => {
        this.vergessen(weg);
        if (schluessel !== null) this.kanal?.postMessage({ typ: 'sicherung', schluessel });
      },
      (e: unknown) => {
        if (schluessel !== null) this.vergessen([schluessel]);
        throw e;
      },
    );
  }
}
