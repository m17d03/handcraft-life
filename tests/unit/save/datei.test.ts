import { describe, expect, it } from 'vitest';
import type { ModuleManifest, ModulSpeicher } from '../../../src/core/modul';
import {
  dateiErstellen,
  dateiLesen,
  istKernSpeicher,
  migrieren,
  neueModulAbschnitte,
  type SpielstandDatei,
} from '../../../src/core/save';
import { ausfuehren, type Aktion } from '../../../src/core/zuschnitt';
import { zufallsquelle } from '../../../src/core/zufall';
import { neuerSpielzustand, type Spielzustand } from '../../../src/core/zustand';
import { kernModul } from '../../../src/core/kern-modul';
import { holzModul } from '../../../src/modules/holz/module';
import { katalog } from '../core/hilfen';

const INFO = { spielVersion: 'test', gespeichert: '2026-11-01T00:00:00.000Z' };
const datei = (z: Spielzustand = neuerSpielzustand(katalog, 3)): SpielstandDatei =>
  dateiErstellen(z, neueModulAbschnitte(katalog.module), INFO);

/** Testmodul mit Schema 3 und Migrationen 1→2→3. */
function testModul(opt: Partial<ModulSpeicher<unknown>> = {}): ModuleManifest {
  const save: ModulSpeicher<{ n: number; name: string }> = {
    schemaVersion: 3,
    defaults: () => ({ n: 0, name: 'neu' }),
    migrations: {
      2: (alt) => ({ n: (alt as { zahl: number }).zahl }),
      3: (alt) => ({ ...(alt as object), name: 'migriert' }),
    },
    validate: (d): d is { n: number; name: string } =>
      typeof d === 'object' && d !== null && typeof (d as { n: unknown }).n === 'number',
  };
  return { ...holzModul, id: 'probe', provides: {}, daten: {}, save: { ...save, ...opt } };
}

describe('Hülle und Abschnitte', () => {
  it('neue Datei: Hülle, Kern-Schema, Abschnitt je Modul mit save (Kern hat keinen)', () => {
    const d = datei();
    expect(d.format).toBe('handcraft-life-save');
    expect(d.huelle).toBe(1);
    expect(d.kern.schema).toBe(1);
    expect(Object.keys(d.module)).toEqual(['holz']);
    expect(d.module['holz']).toEqual({ modulVersion: '0.1.0', schema: 1, aktiv: true, daten: {} });
  });

  it('Rundlauf: lesen(erstellen(x)) ergibt x – für Zufallsstände aus echten Aktionen', () => {
    const vielfalt = { arbeit: 0, saegen: 0, werkstuecke: 0 };
    for (let saat = 1; saat <= 60; saat++) {
      const z = zufallsStand(saat);
      if (z.arbeit !== null) vielfalt.arbeit++;
      if (z.arbeit?.zuege.length) vielfalt.saegen++;
      if (z.inventar.werkstuecke.length > 1) vielfalt.werkstuecke++;
      const e = dateiLesen(JSON.stringify(datei(z)), katalog.module);
      if (e.art !== 'ok') throw new Error(`${String(saat)}: ${e.art}`);
      expect(e.zustand).toEqual(z);
      expect(e.migriert).toBe(false);
    }
    // Die Stände decken laufende Arbeit, Sägezüge und mehrere Werkstücke ab.
    expect(vielfalt.arbeit).toBeGreaterThan(0);
    expect(vielfalt.saegen).toBeGreaterThan(0);
    expect(vielfalt.werkstuecke).toBeGreaterThan(0);
  });

  it('Eingabe wird nicht verändert (auch als Objekt)', () => {
    const d = datei();
    const kopie = JSON.parse(JSON.stringify(d)) as unknown;
    dateiLesen(d, katalog.module);
    expect(d).toEqual(kopie);
  });

  it.each([
    ['leer', undefined, 'leer'],
    ['fremdes Format', { format: 'x' }, 'defekt'],
    ['Hülle 2', { ...datei(), huelle: 2 }, 'zuNeu'],
    ['Kern fehlt', { ...datei(), kern: undefined }, 'defekt'],
    ['Kern ungültig', { ...datei(), kern: { schema: 1, daten: { inventar: {} } } }, 'defekt'],
    ['Kern-Schema 0', { ...datei(), kern: { schema: 0, daten: {} } }, 'defekt'],
  ] as const)('%s → %s', (_, roh, art) => {
    expect(dateiLesen(roh, katalog.module).art).toBe(art);
  });
});

describe('Migrationskette', () => {
  it('wendet n-1 → n lückenlos in Reihenfolge an', () => {
    const m = { 2: (x: unknown) => [...(x as number[]), 2], 3: (x: unknown) => [...(x as number[]), 3] };
    expect(migrieren([1], 1, 3, m)).toEqual([1, 2, 3]);
    expect(migrieren([1], 3, 3, m)).toEqual([1]);
    expect(() => migrieren([1], 0, 3, m)).toThrow(/0 → 1 fehlt/);
  });

  it('Modulabschnitt Schema 1 wird auf 3 migriert und validiert → migriert=true', () => {
    const d = datei();
    d.module['probe'] = { modulVersion: '0.0.1', schema: 1, aktiv: true, daten: { zahl: 7 } };
    const e = dateiLesen(d, [...katalog.module, testModul()]);
    if (e.art !== 'ok') throw new Error(e.art);
    expect(e.migriert).toBe(true);
    expect(e.module['probe']).toEqual({ modulVersion: '0.1.0', schema: 3, aktiv: true, daten: { n: 7, name: 'migriert' } });
  });

  it('fehlender Abschnitt eines neuen Moduls → defaults()', () => {
    const e = dateiLesen(datei(), [...katalog.module, testModul()]);
    if (e.art !== 'ok') throw new Error(e.art);
    expect(e.module['probe']?.daten).toEqual({ n: 0, name: 'neu' });
    expect(e.migriert).toBe(false);
  });

  it('Migration/validate schlägt fehl → Modul deaktiviert, Rohdaten bleiben, Kern lädt', () => {
    const d = datei();
    const roh = { modulVersion: '0.0.1', schema: 1, aktiv: true, daten: { kaputt: true } };
    d.module['probe'] = roh;
    const e = dateiLesen(d, [...katalog.module, testModul()]);
    if (e.art !== 'ok') throw new Error(e.art);
    expect(e.deaktiviert).toEqual(['probe']);
    expect(e.module['probe']).toEqual(roh);
    expect(e.nurLesend).toBe(false);
  });

  it('Modulabschnitt neuer als der Code → nur lesend, Abschnitt unverändert', () => {
    const d = datei();
    d.module['holz'] = { modulVersion: '0.9.0', schema: 999, aktiv: true, daten: { zukunft: 1 } };
    const e = dateiLesen(d, katalog.module);
    if (e.art !== 'ok') throw new Error(e.art);
    expect(e.nurLesend).toBe(true);
    expect(e.module['holz']?.daten).toEqual({ zukunft: 1 });
  });
});

describe('Mit und ohne Modul', () => {
  it('Spielstand mit holz lädt auch nur mit dem Kern; holz ruht unverändert und kommt zurück', () => {
    const d = datei(zufallsStand(5));
    const nurKern = dateiLesen(d, [kernModul]);
    if (nurKern.art !== 'ok') throw new Error(nurKern.art);
    expect(nurKern.module['holz']).toEqual(d.module['holz']);
    expect(istKernSpeicher(nurKern.zustand)).toBe(true);

    const wieder = dateiLesen(dateiErstellen(nurKern.zustand, nurKern.module, INFO), katalog.module);
    if (wieder.art !== 'ok') throw new Error(wieder.art);
    expect(wieder.module['holz']).toEqual(d.module['holz']);
    expect(wieder.zustand).toEqual(nurKern.zustand);
  });
});

/** Gesäter Zufallsstand: zufällige gültige Aktionen ab einem neuen Spiel (ohne neue Abhängigkeit). */
function zufallsStand(saat: number): Spielzustand {
  const rng = zufallsquelle(saat);
  let z = neuerSpielzustand(katalog, saat);
  const r = (): number => rng.zufall();
  const kandidaten = (): Aktion[] => [
    { art: 'auftragAnnehmen', auftragId: z.auftraege.at(-1)?.id ?? 'af_1' },
    { art: 'materialKaufen', materialId: 'holz.material.fichte-brett-2000' },
    { art: 'zuschnittBeginnen', werkstueckId: z.inventar.werkstuecke.at(-1)?.id ?? 'x' },
    { art: 'bezugsendeWaehlen', ende: r() < 0.5 ? 'a' : 'b' },
    { art: 'markierungSetzen', mm: 300 + Math.round(r() * 1200) },
    { art: 'anreissen' },
    { art: 'blattVersatzSetzen', mm: Math.round(r() * 20) / 10 },
    { art: 'stuetzen', an: r() < 0.5 },
    { art: 'saegezug', seitenabweichung: r() * 2 - 1, tempo: r() * 2 },
    { art: 'saegezug', seitenabweichung: 0, tempo: 1 },
    { art: 'abliefern' },
    { art: 'weiter' },
  ];
  for (let i = 0; i < 60; i++) {
    const liste = kandidaten();
    const aktion = liste[Math.floor(r() * liste.length)];
    if (aktion !== undefined) z = ausfuehren(katalog, z, aktion).zustand;
  }
  return z;
}
