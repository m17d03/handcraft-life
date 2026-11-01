import { describe, expect, it } from 'vitest';
import { kernModul } from '../../../src/core/kern-modul';
import { hauptversion, katalogErstellen, pruefeModule, textFuer, type ModuleManifest } from '../../../src/core/modul';
import { ausfuehren } from '../../../src/core/zuschnitt';
import { neuerSpielzustand } from '../../../src/core/zustand';
import { zufallsquelle, zwischen } from '../../../src/core/zufall';
import { alleModule, standardKatalog } from '../../../src/modules';
import { holzModul } from '../../../src/modules/holz/module';

function modul(id: string, aenderung: Partial<ModuleManifest> = {}): ModuleManifest {
  return {
    id,
    art: 'modul',
    version: '1.0.0',
    requires: { core: '^0.1.0' },
    provides: {},
    mechanics: ['Test'],
    assets: { glb: [], ktx2: [], audio: [], budgetMB: 0 },
    daten: {},
    tests: [],
    ...aenderung,
  };
}

const gruende = (ms: ModuleManifest[]) => pruefeModule([kernModul, ...ms]).fehler.map((f) => `${f.modul}: ${f.grund}`);

describe('Modulvertrag – Start-Prüfung', () => {
  it('Registry: kern + holz sind gültig und aktiv', () => {
    const k = standardKatalog();
    expect(k.fehler).toEqual([]);
    expect(k.module.map((m) => m.id)).toEqual(['kern', 'holz']);
    expect(alleModule).toHaveLength(2);
    expect(Object.keys(k.materialien)).toEqual(['holz.material.fichte-brett-2000']);
    expect(Object.keys(k.werkzeuge).sort()).toEqual(['holz.werkzeug.fuchsschwanz', 'kern.werkzeug.massband']);
    expect(k.regeln).toHaveLength(1);
    expect(k.erzeugung).toHaveLength(1);
  });

  it('Kern läuft ohne Modul holz (kein Auftrag, kein Absturz)', () => {
    const k = katalogErstellen([kernModul]);
    expect(k.fehler).toEqual([]);
    const z = neuerSpielzustand(k, 1);
    expect(z.auftraege).toEqual([]);
    expect(z.inventar.werkzeuge).toEqual([{ werkzeugId: 'kern.werkzeug.massband' }]);
    expect(ausfuehren(k, z, { art: 'materialKaufen', materialId: 'holz.material.fichte-brett-2000' }).grund).toBe(
      'material-unbekannt',
    );
  });

  it('fremdes Präfix, ungültige ID und fehlende Daten deaktivieren das Modul', () => {
    expect(gruende([modul('metall', { provides: { materials: ['holz.material.x'] } })])).toEqual([
      'metall: provides holz.material.x fehlt in daten',
      'metall: Inhalts-ID "holz.material.x" hat fremdes Präfix',
    ]);
    expect(gruende([modul('Metall')])).toEqual(['Metall: Modul-ID "Metall" ungültig']);
    expect(gruende([modul('metall', { daten: { texte: { 'metall.Text': 'x' } } })])).toEqual([
      'metall: Inhalts-ID "metall.Text" ungültig',
    ]);
  });

  it('doppelte Modul- und Inhalts-IDs werden erkannt', () => {
    expect(gruende([holzModul, holzModul])).toEqual(['holz: Modul-ID doppelt']);
    const kopie = modul('holz2', { daten: { werkzeuge: holzModul.daten.werkzeuge ?? [] } });
    expect(gruende([holzModul, kopie])).toContain(
      'holz2: Inhalts-ID holz.werkzeug.fuchsschwanz doppelt (auch in holz)',
    );
  });

  it('Kern-Hauptversion, Version, mechanics und extends werden geprüft', () => {
    expect(gruende([modul('metall', { requires: { core: '^1.0.0' } })])).toEqual([
      'metall: braucht Kern ^1.0.0, vorhanden 0.1.0',
    ]);
    expect(gruende([modul('metall', { version: 'eins' })])).toEqual(['metall: Version "eins" ungültig']);
    expect(gruende([modul('metall', { mechanics: [] })])).toEqual(['metall: mechanics leer']);
    expect(gruende([modul('angeln-x', { art: 'erweiterung' })])).toEqual(['angeln-x: Erweiterung ohne extends']);
  });

  it('fehlende Abhängigkeit deaktiviert auch abhängige Module, der Rest läuft', () => {
    const jagd = modul('jagd', { requires: { core: '^0.1.0', modules: { holz: '^0.1.0' } } });
    const hund = modul('jagd-hund', { art: 'erweiterung', extends: 'jagd' });
    const r = pruefeModule([kernModul, jagd, hund]);
    expect(r.aktiv.map((m) => m.id)).toEqual(['kern']);
    expect(r.fehler.map((f) => f.modul)).toEqual(['jagd', 'jagd-hund']);
    expect(pruefeModule([kernModul, holzModul, jagd, hund]).aktiv.map((m) => m.id)).toEqual([
      'kern',
      'holz',
      'jagd',
      'jagd-hund',
    ]);
    const falscheVersion = modul('jagd', { requires: { core: '^0.1.0', modules: { holz: '^2.0.0' } } });
    expect(pruefeModule([kernModul, holzModul, falscheVersion]).fehler).toHaveLength(1);
  });

  it('Abhängigkeitszyklen werden erkannt', () => {
    const a = modul('a', { requires: { core: '^0.1.0', modules: { b: '^1' } } });
    const b = modul('b', { requires: { core: '^0.1.0', modules: { a: '^1' } } });
    const r = pruefeModule([kernModul, a, b]);
    expect(r.aktiv.map((m) => m.id)).toEqual(['kern']);
    expect(r.fehler.filter((f) => f.grund === 'Abhängigkeitszyklus').map((f) => f.modul)).toEqual(['a', 'b']);
  });

  it('hauptversion() liest Semver und ^-Bereiche', () => {
    expect(hauptversion('1.2.3')).toBe(1);
    expect(hauptversion('^0.1.0')).toBe(0);
    expect(hauptversion('^2')).toBe(2);
    expect(hauptversion('x')).toBeNull();
  });

  it('textFuer() setzt Wert mit Vorzeichen und Dezimalkomma ein', () => {
    const k = standardKatalog();
    expect(textFuer(k, 'kern.text.blatt-auf-linie', -0.8)).toBe('Blatt lag auf der Linie: -0,8 mm');
    expect(textFuer(k, 'kern.text.falsch-gemessen', 3)).toBe('Falsch gemessen: +3 mm');
    expect(textFuer(k, 'holz.merkmal.ast')).toBe('Ast im Werkstück (nur optisch)');
    expect(textFuer(k, 'unbekannt.text.x')).toBe('unbekannt.text.x');
  });
});

describe('Gesäter Zufall', () => {
  it('ist deterministisch und liegt in [0, 1)', () => {
    const a = zufallsquelle(99);
    const b = zufallsquelle(99);
    const folgeA = Array.from({ length: 50 }, () => a.zufall());
    expect(Array.from({ length: 50 }, () => b.zufall())).toEqual(folgeA);
    expect(folgeA.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(a.saat()).toBe(b.saat());
    expect(zufallsquelle(a.saat()).zufall()).toBe(b.zufall());
    expect(zwischen(() => 0.5, -2, 2)).toBe(0);
  });
});
