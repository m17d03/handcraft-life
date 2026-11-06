/**
 * Ticket 017, F7: Verlassen (pagehide / visibilitychange hidden) unmittelbar nach einer Aktion verliert den
 * Stand nicht – der neueste Stand geht sofort in die Ablage, auch wenn ein älterer Schreibvorgang noch läuft.
 * Generationsregel (Ticket 009) bleibt: ein älterer Stand überschreibt nie einen neueren.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexedDbAblage, SpeicherAblage, Spielstand, type Ablage } from '../../../src/core/save';
import { neuerSpielzustand, type Spielzustand } from '../../../src/core/zustand';
import { katalog } from '../core/hilfen';
import { idbAttrappe, keyRangeEinsetzen } from './idb-attrappe';

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
  keyRangeEinsetzen();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-01T10:00:00.000Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
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

describe('F7 – IndexedDbAblage: Transaktion sofort, Reihenfolge = Aufrufreihenfolge', () => {
  it('bei offener Verbindung wird die Transaktion synchron im Aufruf angelegt', async () => {
    const { fabrik, protokoll, daten } = idbAttrappe();
    const ablage = new IndexedDbAblage(fabrik);
    const p0 = ablage.schreiben('"eins"', 'z1');
    await vi.advanceTimersByTimeAsync(10);
    await p0;
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
    const { fabrik, protokoll, daten } = idbAttrappe();
    const ablage = new IndexedDbAblage(fabrik);
    // Sobald die Verbindung offen ist (und bevor die Fortsetzung des älteren, wartenden Aufrufs läuft),
    // kommt ein neuerer Aufruf – er legt seine Transaktion synchron an.
    const ref: { neuer?: Promise<void> | undefined } = {};
    let wert: unknown = null;
    Object.defineProperty(ablage, 'offen', {
      configurable: true,
      get: () => wert,
      set: (v: unknown) => {
        wert = v;
        if (v !== null) ref.neuer ??= ablage.schreiben('"neu"', 'z2');
      },
    });
    const aelter = ablage.schreiben('"alt"', 'z1');
    await vi.advanceTimersByTimeAsync(10);
    await aelter;
    expect(ref.neuer).toBeDefined();
    await ref.neuer;
    expect(protokoll).toEqual(['angelegt:"neu"']);
    expect(ablage.schreibStatistik).toMatchObject({ angelegt: 1, uebersprungen: 1 });
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
    const p0 = s.sofortSpeichern(stand(1));
    await vi.advanceTimersByTimeAsync(10);
    expect(await p0).toBe(true); // Verbindung offen, erster Stand liegt
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

  it('Navigation weg direkt nach dem Schreiben: alle Anfragen synchron + commit(), nichts geht verloren (QA 017 R1)', async () => {
    const { fabrik, daten, sicherung, anfragen, seite } = idbAttrappe();
    const s = neu(new IndexedDbAblage(fabrik));
    await s.laden();
    const p0 = s.sofortSpeichern(stand(1));
    await vi.advanceTimersByTimeAsync(10);
    expect(await p0).toBe(true);
    anfragen.length = 0;
    const p = s.sofortSpeichern(stand(7)); // pagehide bei Navigation
    // Noch im selben Aufruf: aktuell, Sicherung und commit sind abgesetzt
    expect(anfragen[0]).toBe('put spielstand aktuell');
    expect(anfragen.some((a) => a.startsWith('put sicherung autosave|'))).toBe(true);
    expect(anfragen.at(-1)).toBe('commit');
    seite.beendet = true; // Seite wird abgebaut
    await vi.advanceTimersByTimeAsync(10);
    expect(await p).toBe(true);
    expect(seite.verworfen).toBe(0);
    expect(geldIn(daten.get('aktuell') as string)).toBe(7);
    expect([...sicherung.keys()].filter((k) => k.startsWith('autosave|'))).toHaveLength(2);
  });

  it('Rotation mit mitgeführten Schlüsseln: höchstens 3 Autosaves, Laufnummer steigt, vor-migration bleibt', async () => {
    const { fabrik, sicherung } = idbAttrappe();
    const ablage = new IndexedDbAblage(fabrik);
    await Promise.all([ablage.sichern('vor-migration', '"roh"', 'z0'), vi.advanceTimersByTimeAsync(10)]);
    for (let i = 1; i <= 6; i++) {
      const p = ablage.schreiben(`"${String(i)}"`, `z${String(i)}`);
      await vi.advanceTimersByTimeAsync(10);
      await p;
    }
    const keys = [...sicherung.keys()].sort();
    expect(keys.filter((k) => k.startsWith('vor-migration|'))).toHaveLength(1);
    const auto = keys.filter((k) => k.startsWith('autosave|'));
    expect(auto.map((k) => Number.parseInt(k.split('|')[1] ?? '', 10))).toEqual([5, 6, 7]);
    expect(ablage.schreibStatistik.sofort).toBe(7);
  });

  it('Schlüssel nicht lesbar: Rückfall über getAllKeys funktioniert (ohne Abbau)', async () => {
    const { fabrik, daten, sicherung } = idbAttrappe({ schluesselFehler: true });
    const ablage = new IndexedDbAblage(fabrik);
    const p = ablage.schreiben('"r"', 'z');
    await vi.advanceTimersByTimeAsync(10);
    await p;
    expect(daten.get('aktuell')).toBe('"r"');
    expect([...sicherung.keys()]).toHaveLength(1);
    expect(ablage.schreibStatistik.sofort).toBe(0);
  });

  it('abgebrochene Transaktion: danach weiter synchron, aktuell bleibt beim älteren Stand bis zum nächsten Erfolg', async () => {
    const { fabrik, daten, seite } = idbAttrappe();
    const ablage = new IndexedDbAblage(fabrik);
    const p1 = ablage.schreiben('"a"', 'z1');
    await vi.advanceTimersByTimeAsync(10);
    await p1;
    // Rückfall-Pfad erzwingen: Abbruch → Schlüssel unbekannt
    seite.beendet = true;
    const p2 = ablage.schreiben('"b"', 'z2').catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10);
    expect(await p2).toBeInstanceOf(Error);
    seite.beendet = false;
    expect(daten.get('aktuell')).toBe('"a"');
    const p3 = ablage.schreiben('"c"', 'z3');
    await vi.advanceTimersByTimeAsync(10);
    await p3;
    const vorher = ablage.schreibStatistik.sofort;
    const p4 = ablage.schreiben('"d"', 'z4');
    await vi.advanceTimersByTimeAsync(10);
    await p4;
    expect(ablage.schreibStatistik.sofort).toBe(vorher + 1);
    expect(daten.get('aktuell')).toBe('"d"');
  });
});
