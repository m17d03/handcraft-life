import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUTOSAVES_BEHALTEN,
  dauerhaftAnfordern,
  IndexedDbAblage,
  SpeicherAblage,
  Spielstand,
  type SpielstandOptionen,
} from '../../../src/core/save';
import { kernModul } from '../../../src/core/kern-modul';
import { holzModul } from '../../../src/modules/holz/module';
import { neuerSpielzustand, type Spielzustand } from '../../../src/core/zustand';
import { bereit, folge, katalog, zuege } from '../core/hilfen';

const stand = (geld: number): Spielzustand => {
  const z = neuerSpielzustand(katalog, 1);
  z.inventar.geld = geld;
  return z;
};
const geldIn = (json: string | undefined): number =>
  (JSON.parse(json ?? '{}') as { kern: { daten: Spielzustand } }).kern.daten.inventar.geld;

function dienst(ablage = new SpeicherAblage(), extra: Partial<SpielstandOptionen> = {}) {
  const s = new Spielstand({ ablage, module: katalog.module, speicherVerwaltung: undefined, ...extra });
  return { s, ablage };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-01T10:00:00.000Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Autosave – speichern() entprellt (≤ 1×/s)', () => {
  it('viele Aufrufe in 1 s → ein Schreibvorgang mit dem neuesten Stand', async () => {
    const { s, ablage } = dienst();
    await s.laden();
    s.speichern(stand(1));
    await vi.advanceTimersByTimeAsync(0);
    expect(ablage.schreibvorgaenge).toBe(1);
    for (let i = 2; i <= 50; i++) {
      s.speichern(stand(i));
      await vi.advanceTimersByTimeAsync(10);
    }
    expect(ablage.schreibvorgaenge).toBe(1);
    expect(s.status().ausstehend).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(ablage.schreibvorgaenge).toBe(2);
    expect(geldIn(ablage.aktuell)).toBe(50);
  });

  it('über 10 s Dauerfeuer höchstens 11 Schreibvorgänge', async () => {
    const { s, ablage } = dienst();
    for (let t = 0; t < 10_000; t += 50) {
      s.speichern(stand(t));
      await vi.advanceTimersByTimeAsync(50);
    }
    await vi.advanceTimersByTimeAsync(1000);
    expect(ablage.schreibvorgaenge).toBeLessThanOrEqual(11);
    expect(geldIn(ablage.aktuell)).toBe(9950);
  });

  it('sofortSpeichern() schreibt Wartendes ohne Verzögerung (visibilitychange/pagehide)', async () => {
    const { s, ablage } = dienst();
    s.speichern(stand(1));
    await vi.advanceTimersByTimeAsync(0);
    s.speichern(stand(2));
    expect(await s.sofortSpeichern()).toBe(true);
    expect(geldIn(ablage.aktuell)).toBe(2);
    expect(s.status().ausstehend).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    expect(ablage.schreibvorgaenge).toBe(2); // Timer wurde aufgehoben
    expect(s.status().zuletztGespeichert).toBe('2026-11-01T10:00:00.000Z');
  });

  it('sofortSpeichern(zustand) ohne Wartendes schreibt den übergebenen Stand', async () => {
    const { s, ablage } = dienst();
    expect(await s.sofortSpeichern(stand(9))).toBe(true);
    expect(geldIn(ablage.aktuell)).toBe(9);
  });
});

describe('Sicherungen', () => {
  it(`rotiert die letzten ${String(AUTOSAVES_BEHALTEN)} Autosaves`, async () => {
    const { s, ablage } = dienst();
    for (let i = 1; i <= 6; i++) {
      await s.sofortSpeichern(stand(i));
      vi.advanceTimersByTime(1000);
    }
    const autos = (await ablage.sicherungen()).filter((x) => x.art === 'autosave');
    expect(autos.map((x) => geldIn(x.json))).toEqual([4, 5, 6]);
  });

  it('Rohkopie vor Migration, wird nie wegrotiert', async () => {
    const z = stand(5);
    const alt = JSON.stringify({
      format: 'handcraft-life-save',
      huelle: 1,
      spielVersion: 'alt',
      gespeichert: 'x',
      kern: { schema: 1, daten: z },
      module: { holz: { modulVersion: '0.0.1', schema: 1, aktiv: true, daten: { zahl: 1 } } },
    });
    const probe = {
      ...holzModul,
      id: 'holz',
      save: {
        schemaVersion: 2,
        defaults: () => ({}),
        migrations: { 2: () => ({}) },
        validate: (d: unknown): d is object => typeof d === 'object',
      },
    };
    const { s, ablage } = dienst(new SpeicherAblage(alt), { module: [kernModul, probe] });
    expect((await s.laden()).art).toBe('geladen');
    for (let i = 0; i < 5; i++) {
      await s.sofortSpeichern(z);
      vi.advanceTimersByTime(1000);
    }
    const vorMigration = (await ablage.sicherungen()).filter((x) => x.art === 'vor-migration');
    expect(vorMigration.map((x) => x.json)).toEqual([alt]);
  });

  it('Sicherung vor Migration scheitert → nur lesend, nichts überschrieben', async () => {
    const alt = JSON.stringify({
      format: 'handcraft-life-save',
      huelle: 1,
      spielVersion: 'alt',
      gespeichert: 'x',
      kern: { schema: 1, daten: stand(5) },
      module: { holz: { modulVersion: '0.0.1', schema: 1, aktiv: true, daten: {} } },
    });
    const probe = {
      ...holzModul,
      save: { schemaVersion: 2, defaults: () => ({}), migrations: { 2: () => ({}) }, validate: (d: unknown): d is object => d !== undefined },
    };
    const ablage = new SpeicherAblage(alt);
    ablage.stoerung = 'voll';
    const { s } = dienst(ablage, { module: [kernModul, probe] });
    expect((await s.laden()).art).toBe('geladen');
    expect(s.status().modus).toBe('nurLesend');
    ablage.stoerung = null;
    s.speichern(stand(1));
    await s.sofortSpeichern();
    expect(ablage.aktuell).toBe(alt);
  });
});

describe('S3 – atomar: alt oder neu, nie Mischung', () => {
  it('Abbruch der Transaktion → aktuell und Sicherungen unverändert', async () => {
    const { s, ablage } = dienst();
    await s.sofortSpeichern(stand(1));
    const vorher = ablage.aktuell;
    const sicherVorher = await ablage.sicherungen();

    ablage.stoerung = 'abbruch';
    expect(await s.sofortSpeichern(stand(2))).toBe(false);
    expect(ablage.aktuell).toBe(vorher);
    expect(await ablage.sicherungen()).toEqual(sicherVorher);

    // Nach dem Abbruch ist der Stand weiter vollständig ladbar.
    const neu = new Spielstand({ ablage, module: katalog.module, speicherVerwaltung: undefined });
    ablage.stoerung = null;
    const a = await neu.laden();
    if (a.art !== 'geladen') throw new Error(a.art);
    expect(a.zustand.inventar.geld).toBe(1);
  });

  it('Neuladen mitten im Sägen: Brett ungeschnitten, Markierung bleibt (nachNeuladen)', async () => {
    const z = folge(bereit(), [
      { art: 'zuschnittBeginnen', werkstueckId: 'ws_test' },
      { art: 'bezugsendeWaehlen', ende: 'a' },
      { art: 'markierungSetzen', mm: 600 },
      { art: 'anreissen' },
      { art: 'blattVersatzSetzen', mm: 0.8 },
      ...zuege(3),
    ]).zustand;
    expect(z.arbeit?.phase).toBe('saegen');
    const { s, ablage } = dienst();
    await s.sofortSpeichern(z);
    const a = await new Spielstand({ ablage, module: katalog.module, speicherVerwaltung: undefined }).laden();
    if (a.art !== 'geladen') throw new Error(a.art);
    expect(a.zustand.arbeit?.phase).toBe('ansetzen');
    expect(a.zustand.arbeit?.zuege).toEqual([]);
    expect(a.zustand.arbeit?.markierung_mm).toBe(600);
    expect(a.zustand.inventar.werkstuecke).toEqual(z.inventar.werkstuecke);
  });
});

describe('S8 – Speicher nicht verfügbar: Hinweis, Spiel läuft weiter', () => {
  it('Kontingent voll: kein Wurf, Hinweis, nächster Versuch schreibt nach', async () => {
    const { s, ablage } = dienst();
    ablage.stoerung = 'voll';
    s.speichern(stand(3));
    await vi.advanceTimersByTimeAsync(0);
    expect(s.status().letzterFehler).toMatch(/Speicher voll/);
    expect(s.status().hinweise.join(' ')).toMatch(/Spiel läuft weiter/);
    expect(s.status().ausstehend).toBe(true);
    ablage.stoerung = null;
    expect(await s.sofortSpeichern()).toBe(true);
    expect(geldIn(ablage.aktuell)).toBe(3);
    expect(s.status().letzterFehler).toBeNull();
  });

  it('Lesefehler: neuer Start, Speichern gesperrt (nichts Unbekanntes überschreiben)', async () => {
    const ablage = new SpeicherAblage(JSON.stringify({ irgendwas: 1 }));
    ablage.stoerung = 'lesen';
    const { s } = dienst(ablage);
    expect((await s.laden()).art).toBe('lesefehler');
    expect(s.status().modus).toBe('gesperrt');
    expect(await s.sofortSpeichern(stand(1))).toBe(false);
    expect(await s.neuBeginnen()).toBe(false); // weiterhin nicht lesbar → bleibt gesperrt
    ablage.stoerung = null;
    expect(await s.neuBeginnen()).toBe(true);
    expect((await ablage.sicherungen()).some((x) => x.art === 'defekt')).toBe(true);
  });

  it('IndexedDB fehlt ganz (z. B. Node, gesperrter Speicher): Hinweis statt Absturz', async () => {
    const s = new Spielstand({ ablage: new IndexedDbAblage(undefined), module: katalog.module, speicherVerwaltung: undefined });
    expect((await s.laden()).art).toBe('lesefehler');
    expect(s.status().hinweise.join(' ')).toMatch(/IndexedDB nicht verfügbar/);
  });

  it('IndexedDB-Öffnen scheitert: Fehler wird zum Hinweis', async () => {
    const fabrik = {
      open: () => {
        const r: Record<string, unknown> = { error: new Error('SecurityError') };
        setTimeout(() => {
          (r.onerror as () => void)();
        }, 0);
        return r;
      },
    } as unknown as IDBFactory;
    const s = new Spielstand({ ablage: new IndexedDbAblage(fabrik), module: katalog.module, speicherVerwaltung: undefined });
    const laden = s.laden();
    await vi.advanceTimersByTimeAsync(0);
    expect((await laden).art).toBe('lesefehler');
    expect(s.status().letzterFehler).toMatch(/SecurityError/);
  });
});

describe('navigator.storage.persist()', () => {
  it('Ergebnisse: gewährt, abgelehnt, nicht verfügbar, Fehler, schon dauerhaft', async () => {
    expect(await dauerhaftAnfordern({ persist: () => Promise.resolve(true) })).toBe('gewaehrt');
    expect(await dauerhaftAnfordern({ persist: () => Promise.resolve(false) })).toBe('abgelehnt');
    expect(await dauerhaftAnfordern(undefined)).toBe('nicht-verfuegbar');
    expect(await dauerhaftAnfordern({})).toBe('nicht-verfuegbar');
    expect(await dauerhaftAnfordern({ persist: () => Promise.reject(new Error('x')) })).toBe('fehler');
    const persist = vi.fn(() => Promise.resolve(false));
    expect(await dauerhaftAnfordern({ persist, persisted: () => Promise.resolve(true) })).toBe('gewaehrt');
    expect(persist).not.toHaveBeenCalled();
  });

  it('wird beim ersten erfolgreichen Speichern einmal versucht; Ergebnis in status()', async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    const { s } = dienst(new SpeicherAblage(), { speicherVerwaltung: { persist } });
    expect(s.status().dauerhaft).toBeNull();
    await s.sofortSpeichern(stand(1));
    await vi.advanceTimersByTimeAsync(0);
    await s.sofortSpeichern(stand(2));
    expect(persist).toHaveBeenCalledTimes(1);
    expect(s.status().dauerhaft).toBe('gewaehrt');
  });
});
