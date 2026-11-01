/**
 * Schmale Schnittstelle zur Ablage (modul-vertrag §6.2). Der Spielstand-Dienst kennt nur dieses Interface;
 * die echte IndexedDB-Ablage steht in `indexeddb.ts`, Tests nutzen `SpeicherAblage` (In-Memory).
 *
 * Gespeichert wird der JSON-Text der SpielstandDatei – derselbe Text, den ein späterer Export liefert.
 */

/** Art einer Sicherung im Store `sicherung`. Nur `autosave` rotiert; alle anderen werden nie gelöscht. */
export type SicherungsArt = 'autosave' | 'vor-migration' | 'defekt';

export interface Sicherung {
  /** Schlüssel `<art>|<ISO-Zeit>|<laufende Nr.>` – innerhalb einer Art zeitlich sortierbar. */
  schluessel: string;
  art: SicherungsArt;
  zeit: string;
  json: string;
}

/** Anzahl rotierender Autosave-Kopien (ADR 0003). */
export const AUTOSAVES_BEHALTEN = 3;

export interface Ablage {
  /** JSON-Text unter `spielstand/'aktuell'` oder `undefined`, wenn noch nichts gespeichert ist. */
  lesen(): Promise<string | undefined>;
  /**
   * In EINER Transaktion: `aktuell` ersetzen, Kopie als Autosave in `sicherung`, Autosaves über
   * `AUTOSAVES_BEHALTEN` hinaus löschen. Scheitert die Transaktion, bleibt alles wie vorher.
   */
  schreiben(json: string, zeit: string): Promise<void>;
  /** Legt eine nicht rotierende Sicherung an (Rohkopie vor Migration, defekter Stand). */
  sichern(art: Exclude<SicherungsArt, 'autosave'>, json: string, zeit: string): Promise<void>;
  /** Alle Sicherungen, nach Schlüssel sortiert. */
  sicherungen(): Promise<Sicherung[]>;
}

let laufendeNr = 0;

export function sicherungsSchluessel(art: SicherungsArt, zeit: string): string {
  laufendeNr = (laufendeNr + 1) % 1_000_000;
  return `${art}|${zeit}|${String(laufendeNr).padStart(6, '0')}`;
}

/** Autosave-Schlüssel, die nach dem Hinzufügen von `neu` gelöscht werden müssen (älteste zuerst). */
export function zuLoeschendeAutosaves(vorhandeneSchluessel: readonly string[]): string[] {
  const autosaves = vorhandeneSchluessel.filter((k) => k.startsWith('autosave|')).sort();
  return autosaves.slice(0, Math.max(0, autosaves.length - AUTOSAVES_BEHALTEN));
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
      const schluessel = sicherungsSchluessel('autosave', zeit);
      tx.sicherung.set(schluessel, { schluessel, art: 'autosave', zeit, json });
      for (const k of zuLoeschendeAutosaves([...tx.sicherung.keys()])) tx.sicherung.delete(k);
    });
  }

  sichern(art: Exclude<SicherungsArt, 'autosave'>, json: string, zeit: string): Promise<void> {
    return this.transaktion((tx) => {
      const schluessel = sicherungsSchluessel(art, zeit);
      tx.sicherung.set(schluessel, { schluessel, art, zeit, json });
    });
  }

  sicherungen(): Promise<Sicherung[]> {
    return Promise.resolve([...this.sicherungStore.values()].sort((a, b) => (a.schluessel < b.schluessel ? -1 : 1)));
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

/** Fehler mit `name` wie eine DOMException (die es in Node nicht überall gibt). */
class DOMExceptionLike extends Error {
  constructor(name: string, message: string) {
    super(message);
    this.name = name;
  }
}
