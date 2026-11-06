/**
 * Ticket 020: Sicherungs-Rotation robust bei Transaktionsabbruch (A1) und mehreren Tabs (A2).
 * IndexedDbAblage gegen die IDB-Attrappe (Anlegereihenfolge, Atomarität, Abbruch, Bereichs-Löschen).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexedDbAblage } from '../../../src/core/save';
import { laufnummer, vergleicheSchluessel, zuLoeschende } from '../../../src/core/save/ablage';
import type { SicherungsKanal } from '../../../src/core/save/indexeddb';
import { autosaves, idbAttrappe, keyRangeEinsetzen } from './idb-attrappe';

beforeEach(() => {
  keyRangeEinsetzen();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Deterministischer Zufall (mulberry32). */
function zufall(saat: number): () => number {
  let a = saat >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** In-Prozess-Kanal wie BroadcastChannel: Zustellung an alle anderen, asynchron (Zeitgeber). */
function kanalNetz() {
  const alle: SicherungsKanal[] = [];
  return (): SicherungsKanal => {
    const k: SicherungsKanal = {
      onmessage: null,
      postMessage: (data) => {
        for (const ziel of alle) {
          if (ziel !== k)
            setTimeout(() => {
              ziel.onmessage?.({ data });
            }, 0);
        }
      },
    };
    alle.push(k);
    return k;
  };
}

const ruhe = () => vi.advanceTimersByTimeAsync(50);
const wertVon = (sicherung: Map<string, unknown>, k: string): unknown => (sicherung.get(k) as { json: string }).json;

describe('Schlüssel und Ordnung', () => {
  it('Tab-Kennung: Laufnummer bleibt lesbar, Textordnung = Rotationsordnung', () => {
    expect(laufnummer('autosave|0000000012.abc123|2026-11-06T10:00:00.000Z')).toBe(12);
    expect(laufnummer('autosave|0000000012|2026-11-06T10:00:00.000Z')).toBe(12);
    const ks = ['autosave|0000000003.zzzzzz|z', 'autosave|0000000002|z', 'autosave|0000000003.aaaaaa|z', 'autosave|0000000010.b|z'];
    expect([...ks].sort(vergleicheSchluessel)).toEqual([...ks].sort());
    expect(zuLoeschende('autosave', ks)).toEqual(['autosave|0000000002|z']);
  });
});

describe('A1 – Abbruch einer Transaktion hinterlässt keine überzähligen Autosaves', () => {
  it('Abbruch, während Folge-Transaktionen schon angelegt sind: höchstens 3, nach drei Schreibvorgängen genau die letzten 3', async () => {
    let abbrechen = -1;
    const { fabrik, sicherung, statistik } = idbAttrappe({ abbrechen: ({ nr }) => nr === abbrechen });
    const ablage = new IndexedDbAblage(fabrik, { kanal: null, tabId: 't1' });
    for (let i = 1; i <= 3; i++) {
      const p = ablage.schreiben(`"${String(i)}"`, `z${String(i)}`);
      await ruhe();
      await p;
    }
    // Nächste Schreib-Transaktion bricht ab; zwei weitere sind bereits angelegt (Phantom-Schlüssel im Cache)
    abbrechen = statistik.transaktionen;
    const ps = [4, 5, 6].map((i) => ablage.schreiben(`"${String(i)}"`, `z${String(i)}`).catch((e: unknown) => e));
    await ruhe();
    await Promise.all(ps);
    expect(statistik.abgebrochen).toBe(1);
    expect(autosaves(sicherung).length).toBeLessThanOrEqual(3);
    for (let i = 7; i <= 9; i++) {
      const p = ablage.schreiben(`"${String(i)}"`, `z${String(i)}`);
      await ruhe();
      await p;
    }
    expect(autosaves(sicherung).map((k) => wertVon(sicherung, k))).toEqual(['"7"', '"8"', '"9"']);
  });

  it('Abbruch des Bereichs-Löschens: alte Schlüssel, die der Cache für gelöscht hielt, werden trotzdem entfernt', async () => {
    const abbruchNr = new Set<number>();
    const { fabrik, sicherung, statistik } = idbAttrappe({ abbrechen: ({ nr }) => abbruchNr.has(nr) });
    const ablage = new IndexedDbAblage(fabrik, { kanal: null, tabId: 't1' });
    for (let i = 1; i <= 3; i++) {
      const p = ablage.schreiben(`"${String(i)}"`, 'z');
      await ruhe();
      await p;
    }
    // Speichertransaktion 4 und ihre Aufräum-Transaktion brechen ab
    abbruchNr.add(statistik.transaktionen);
    abbruchNr.add(statistik.transaktionen + 1);
    const p4 = ablage.schreiben('"4"', 'z').catch((e: unknown) => e);
    const p5 = ablage.schreiben('"5"', 'z');
    const p6 = ablage.schreiben('"6"', 'z');
    await ruhe();
    await Promise.all([p4, p5, p6]);
    // Schlüssel 1 (Löschen in der abgebrochenen Transaktion) ist trotzdem weg; vorübergehend eine Kopie weniger
    expect(autosaves(sicherung).map((k) => wertVon(sicherung, k))).toEqual(['"5"', '"6"']);
    const p7 = ablage.schreiben('"7"', 'z');
    await ruhe();
    await p7;
    expect(autosaves(sicherung).map((k) => wertVon(sicherung, k))).toEqual(['"5"', '"6"', '"7"']);
  });
});

describe('Navigation weg bleibt sicher (Ticket 017)', () => {
  it('direkt nach einem Abbruch: aktuell + Sicherung synchron mit commit(), Abbau verliert nichts', async () => {
    let abbrechen = -1;
    const { fabrik, daten, sicherung, anfragen, seite, statistik } = idbAttrappe({ abbrechen: ({ nr }) => nr === abbrechen });
    const ablage = new IndexedDbAblage(fabrik, { kanal: null });
    for (let i = 1; i <= 4; i++) {
      const p = ablage.schreiben(`"${String(i)}"`, 'z');
      await ruhe();
      await p;
    }
    abbrechen = statistik.transaktionen;
    const p5 = ablage.schreiben('"5"', 'z').catch((e: unknown) => e);
    await ruhe();
    expect(await p5).toBeInstanceOf(Error);
    anfragen.length = 0;
    const p6 = ablage.schreiben('"6"', 'z'); // pagehide
    const bisCommit = anfragen.slice(0, anfragen.indexOf('commit') + 1);
    expect(bisCommit[0]).toBe('put spielstand aktuell');
    expect(bisCommit.some((a) => a.startsWith('put sicherung autosave|'))).toBe(true);
    seite.beendet = true;
    await ruhe();
    await p6;
    expect(daten.get('aktuell')).toBe('"6"');
    expect(autosaves(sicherung).length).toBeLessThanOrEqual(3);
    expect(autosaves(sicherung).map((k) => wertVon(sicherung, k)).at(-1)).toBe('"6"');
  });

  it('Rückfall (Schlüssel nicht lesbar) + Abbau: aktuell liegt, Sicherung folgt beim nächsten Mal', async () => {
    const { fabrik, daten, sicherung, seite } = idbAttrappe({ schluesselFehler: true });
    const ablage = new IndexedDbAblage(fabrik, { kanal: null });
    const p = ablage.schreiben('"r"', 'z');
    await vi.advanceTimersByTimeAsync(0); // Verbindung offen, Transaktionen angelegt
    seite.beendet = true; // Rückfall-Transaktion setzt erst im Rückruf ab → wird verworfen
    await ruhe();
    await p;
    expect(daten.get('aktuell')).toBe('"r"');
    expect(seite.verworfen).toBe(1);
    expect(autosaves(sicherung)).toHaveLength(0);
    // Neue Seite: Sicherungen wieder vollständig
    seite.beendet = false;
    const neu = new IndexedDbAblage(fabrik, { kanal: null });
    const q = neu.schreiben('"s"', 'z');
    await ruhe();
    await q;
    expect(autosaves(sicherung).map((k) => wertVon(sicherung, k))).toEqual(['"s"']);
  });
});

describe('A1 – Fuzz: Folgen mit Abbrüchen (ein Tab)', () => {
  it('2000 Folgen: immer ≤ 3 Autosaves, Laufnummern eindeutig, aktuell nie rückwärts, vor-migration bleibt', async () => {
    const FOLGEN = 2000;
    let verstoesse = 0;
    let abbrueche = 0;
    for (let saat = 1; saat <= FOLGEN; saat++) {
      const r = zufall(saat);
      const fehler: string[] = [];
      let letztesAktuell = -1;
      const pruefen = (): void => {
        const auto = autosaves(sicherung);
        if (auto.length > 3) fehler.push(`${String(auto.length)} Autosaves`);
        const defekt = [...sicherung.keys()].filter((k) => k.startsWith('defekt|'));
        if (defekt.length > 3) fehler.push(`${String(defekt.length)} defekt`);
        const a = Number(JSON.parse((daten.get('aktuell') as string | undefined) ?? '-1'));
        if (a < letztesAktuell) fehler.push(`aktuell rückwärts ${String(letztesAktuell)} → ${String(a)}`);
        letztesAktuell = a;
      };
      let abbruchQuote = 0.05 + r() * 0.3;
      const { fabrik, sicherung, daten, anfragen, statistik } = idbAttrappe({
        abbrechen: () => r() < abbruchQuote,
        nachUebernahme: () => {
          pruefen();
        },
      });
      const ablage = new IndexedDbAblage(fabrik, { kanal: null, tabId: 'tab1' });
      const migrationOk: Promise<boolean>[] = [];
      const laenge = 8 + Math.floor(r() * 20);
      const offen: Promise<unknown>[] = [];
      for (let i = 1; i <= laenge; i++) {
        const w = r();
        if (w < 0.06) migrationOk.push(ablage.sichern('vor-migration', `"roh${String(i)}"`, `z${String(i)}`).then(() => true, () => false));
        else if (w < 0.12) offen.push(ablage.sichern('defekt', `"d${String(i)}"`, `z${String(i)}`).catch(() => undefined));
        else offen.push(ablage.schreiben(JSON.stringify(i), `z${String(i)}`).catch(() => undefined));
        const pause = r();
        if (pause < 0.4) await vi.advanceTimersByTimeAsync(Math.floor(r() * 3));
      }
      await ruhe();
      await Promise.all(offen);
      const migrationen = (await Promise.all(migrationOk)).filter(Boolean).length;
      abbrueche += statistik.abgebrochen;
      // Laufnummern aller je abgesetzten Sicherungen eindeutig
      const nummern = anfragen.filter((a) => a.startsWith('put sicherung ')).map((a) => laufnummer(a.slice('put sicherung '.length)));
      if (new Set(nummern).size !== nummern.length) fehler.push('doppelte Laufnummer');
      if ([...sicherung.keys()].filter((k) => k.startsWith('vor-migration|')).length !== migrationen) fehler.push('vor-migration fehlt');
      // Selbstheilung: drei Schreibvorgänge ohne Abbruch → genau die letzten 3
      abbruchQuote = 0;
      for (let i = 1; i <= 3; i++) {
        const p = ablage.schreiben(JSON.stringify(1000 + i), 'z');
        await ruhe();
        await p.catch(() => undefined);
      }
      const werte = autosaves(sicherung).map((k) => wertVon(sicherung, k));
      if (werte.join() !== '1001,1002,1003') fehler.push(`Ende: ${werte.join()}`);
      if (fehler.length > 0) {
        verstoesse += 1;
        if (verstoesse <= 3) console.error(`Saat ${String(saat)}: ${fehler.join('; ')}`);
      }
    }
    expect(abbrueche).toBeGreaterThan(1000);
    expect(verstoesse).toBe(0);
  }, 120_000);
});

describe('A2 – zwei Tabs auf derselben Datenbank', () => {
  async function abwechselnd(mitKanal: boolean, n: number) {
    const { fabrik, sicherung, daten } = idbAttrappe();
    const netz = kanalNetz();
    const tabs = [
      new IndexedDbAblage(fabrik, { tabId: 'aaaaaa', kanal: mitKanal ? netz() : null }),
      new IndexedDbAblage(fabrik, { tabId: 'zzzzzz', kanal: mitKanal ? netz() : null }),
    ];
    for (let i = 1; i <= n; i++) {
      const p = tabs[i % 2]?.schreiben(JSON.stringify(i), `z${String(i)}`);
      await ruhe();
      await p;
    }
    return { sicherung, daten };
  }

  it('ohne Kanal: nach 12 abwechselnden Speichervorgängen genau 3 Autosaves, eindeutig geordnet', async () => {
    const { sicherung, daten } = await abwechselnd(false, 12);
    const auto = autosaves(sicherung);
    expect(auto).toHaveLength(3);
    expect(new Set(auto.map((k) => k.split('|')[1])).size).toBe(3);
    expect(daten.get('aktuell')).toBe('12');
    // Der neueste Stand ist immer dabei
    expect(auto.map((k) => wertVon(sicherung, k))).toContain('12');
  });

  it('mit Kanal (BroadcastChannel): genau die letzten 3 in Speicher-Reihenfolge, Laufnummern ohne Doppel', async () => {
    const { sicherung } = await abwechselnd(true, 12);
    const auto = autosaves(sicherung);
    expect(auto.map((k) => wertVon(sicherung, k))).toEqual(['10', '11', '12']);
    expect(new Set(auto.map(laufnummer)).size).toBe(3);
  });

  it('Fuzz 500 Folgen, zwei Tabs, überlappend, mit Abbrüchen: nach Ruhe ≤ 3 Autosaves, Schlüssel eindeutig', async () => {
    let verstoesse = 0;
    for (let saat = 1; saat <= 500; saat++) {
      const r = zufall(10_000 + saat);
      const { fabrik, sicherung, anfragen } = idbAttrappe({ abbrechen: () => r() < 0.15 });
      const netz = kanalNetz();
      const mitKanal = r() < 0.5;
      const tabs = [0, 1].map((t) => new IndexedDbAblage(fabrik, { tabId: `tab${String(t)}`, kanal: mitKanal ? netz() : null }));
      const offen: Promise<unknown>[] = [];
      const laenge = 6 + Math.floor(r() * 20);
      for (let i = 1; i <= laenge; i++) {
        const tab = tabs[r() < 0.5 ? 0 : 1];
        if (tab) offen.push(tab.schreiben(JSON.stringify(i), `z${String(i)}`).catch(() => undefined));
        if (r() < 0.5) await vi.advanceTimersByTimeAsync(Math.floor(r() * 3));
      }
      await ruhe();
      await Promise.all(offen);
      const auto = autosaves(sicherung);
      const puts = anfragen.filter((a) => a.startsWith('put sicherung ')).map((a) => a.split('|')[1]);
      if (auto.length > 3 || new Set(puts).size !== puts.length) {
        verstoesse += 1;
        if (verstoesse <= 3) console.error(`Saat ${String(saat)}: ${auto.join(' ')}`);
      }
    }
    expect(verstoesse).toBe(0);
  }, 60_000);
});
