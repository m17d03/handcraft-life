/**
 * Schmale Schnittstelle zur Ablage (modul-vertrag §6.2). Der Spielstand-Dienst kennt nur dieses Interface;
 * die echte IndexedDB-Ablage steht in `indexeddb.ts`, Tests nutzen `SpeicherAblage` (In-Memory).
 *
 * Gespeichert wird der JSON-Text der SpielstandDatei – derselbe Text, den ein späterer Export liefert.
 */

/**
 * Art einer Sicherung im Store `sicherung`. `vor-migration` wird nie gelöscht; die anderen Arten rotieren
 * (siehe `BEHALTEN`).
 */
export type SicherungsArt = 'autosave' | 'vor-migration' | 'defekt' | 'zuNeu';

export interface Sicherung {
  /**
   * Schlüssel `<art>|<Laufnummer, 10-stellig>|<ISO-Zeit>`. Die Laufnummer steigt über alle Sicherungen und
   * Sitzungen (max. vorhandene + 1); Rotation richtet sich nach ihr, nie nach der Uhr.
   */
  schluessel: string;
  art: SicherungsArt;
  zeit: string;
  json: string;
}

/** Anzahl rotierender Autosave-Kopien (ADR 0003). */
export const AUTOSAVES_BEHALTEN = 3;

/** Höchstzahl je Art; ältere (kleinere Laufnummer) werden beim Einfügen gelöscht. */
export const BEHALTEN: Readonly<Record<SicherungsArt, number>> = {
  autosave: AUTOSAVES_BEHALTEN,
  'vor-migration': Number.POSITIVE_INFINITY,
  defekt: 3,
  zuNeu: 3,
};

export interface Ablage {
  /** JSON-Text unter `spielstand/'aktuell'` oder `undefined`, wenn noch nichts gespeichert ist. */
  lesen(): Promise<string | undefined>;
  /**
   * In EINER Transaktion: `aktuell` ersetzen, Kopie als Autosave in `sicherung`, Autosaves über
   * `AUTOSAVES_BEHALTEN` hinaus löschen. Scheitert die Transaktion, bleibt alles wie vorher.
   *
   * Reihenfolge (Ticket 017, F7): Der Spielstand-Dienst ruft `schreiben` sofort auf, auch wenn ein früherer
   * Aufruf noch läuft. Die Ablage muss Aufrufe in Aufrufreihenfolge übernehmen – ein früherer Aufruf darf
   * nie nach einem späteren wirksam werden (IndexedDB: Transaktionen in Anlegereihenfolge).
   */
  schreiben(json: string, zeit: string): Promise<void>;
  /** Legt eine Sicherung an (Rohkopie vor Migration, defekter/zu neuer Stand); rotiert nach `BEHALTEN`. */
  sichern(art: Exclude<SicherungsArt, 'autosave'>, json: string, zeit: string): Promise<void>;
  /** Alle Sicherungen, nach Laufnummer sortiert (älteste zuerst). */
  sicherungen(): Promise<Sicherung[]>;
}

function laufnummer(schluessel: string): number {
  const nr = Number(schluessel.split('|')[1]);
  return Number.isFinite(nr) ? nr : 0;
}

export const nachLaufnummer = (a: Sicherung, b: Sicherung): number => laufnummer(a.schluessel) - laufnummer(b.schluessel);

/** Nächster Schlüssel: Laufnummer = grösste vorhandene + 1 (unabhängig von der Uhr). */
export function naechsterSchluessel(art: SicherungsArt, zeit: string, vorhandene: readonly string[]): string {
  const nr = vorhandene.reduce((max, k) => Math.max(max, laufnummer(k)), 0) + 1;
  return `${art}|${String(nr).padStart(10, '0')}|${zeit}`;
}

/** Schlüssel der Art `art`, die über `BEHALTEN[art]` hinausgehen (kleinste Laufnummern zuerst). */
export function zuLoeschende(art: SicherungsArt, vorhandene: readonly string[]): string[] {
  const eigene = vorhandene.filter((k) => k.startsWith(`${art}|`)).sort((a, b) => laufnummer(a) - laufnummer(b));
  return eigene.slice(0, Math.max(0, eigene.length - BEHALTEN[art]));
}

/**
 * In-Memory-Ablage für Tests und als Rückfall, wenn IndexedDB fehlt. Transaktionen arbeiten auf einer Kopie
 * und werden erst am Ende übernommen. `stoerung` simuliert Fehler (S3/S8):
 * - `'abbruch'`: Transaktion bricht nach allen Teil-Schreibvorgängen, vor dem Übernehmen ab
 * - `'voll'`: Kontingent voll (QuotaExceededError), bevor geschrieben wird
 * - `'lesen'`: Lesen schlägt fehl
 */
export class SpeicherAblage implements Ablage {
  aktuell: string | undefined;
  readonly sicherungStore = new Map<string, Sicherung>();
  stoerung: 'abbruch' | 'voll' | 'lesen' | null = null;
  /** Anzahl erfolgreich übernommener Transaktionen. */
  schreibvorgaenge = 0;

  constructor(start?: string) {
    this.aktuell = start;
  }

  lesen(): Promise<string | undefined> {
    if (this.stoerung === 'lesen') return Promise.reject(new Error('Lesefehler (simuliert)'));
    return Promise.resolve(this.aktuell);
  }

  schreiben(json: string, zeit: string): Promise<void> {
    return this.transaktion((tx) => {
      tx.aktuell = json;
      einfuegen(tx.sicherung, 'autosave', zeit, json);
    });
  }

  sichern(art: Exclude<SicherungsArt, 'autosave'>, json: string, zeit: string): Promise<void> {
    return this.transaktion((tx) => {
      einfuegen(tx.sicherung, art, zeit, json);
    });
  }

  sicherungen(): Promise<Sicherung[]> {
    return Promise.resolve([...this.sicherungStore.values()].sort(nachLaufnummer));
  }

  private transaktion(
    arbeit: (tx: { aktuell: string | undefined; sicherung: Map<string, Sicherung> }) => void,
  ): Promise<void> {
    if (this.stoerung === 'voll') {
      return Promise.reject(new DOMExceptionLike('QuotaExceededError', 'Kontingent voll (simuliert)'));
    }
    const tx = { aktuell: this.aktuell, sicherung: new Map(this.sicherungStore) };
    arbeit(tx);
    if (this.stoerung === 'abbruch') return Promise.reject(new DOMExceptionLike('AbortError', 'Transaktion abgebrochen (simuliert)'));
    this.aktuell = tx.aktuell;
    this.sicherungStore.clear();
    for (const [k, v] of tx.sicherung) this.sicherungStore.set(k, v);
    this.schreibvorgaenge += 1;
    return Promise.resolve();
  }
}

function einfuegen(store: Map<string, Sicherung>, art: SicherungsArt, zeit: string, json: string): void {
  const schluessel = naechsterSchluessel(art, zeit, [...store.keys()]);
  store.set(schluessel, { schluessel, art, zeit, json });
  for (const k of zuLoeschende(art, [...store.keys()])) store.delete(k);
}

/** Fehler mit `name` wie eine DOMException (die es in Node nicht überall gibt). */
class DOMExceptionLike extends Error {
  constructor(name: string, message: string) {
    super(message);
    this.name = name;
  }
}
