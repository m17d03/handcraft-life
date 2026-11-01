/**
 * S6/S7 mit Fixtures aus `tests/fixtures/saves/` (ADR 0003, modul-vertrag §6.6).
 * Fixtures sind schreibgeschützt: nie ändern, nur hinzufügen (eine pro Schema-Erhöhung, erzeugt mit dem alten Stand).
 */
import { describe, expect, it } from 'vitest';
import { dateiLesen, istKernSpeicher, KERN_SCHEMA, SpeicherAblage, Spielstand } from '../../../src/core/save';
import { holzModul } from '../../../src/modules/holz/module';
import { neuerSpielzustand } from '../../../src/core/zustand';
import { katalog } from '../core/hilfen';

const neuerStand = () => neuerSpielzustand(katalog, 1);

const fixtures = import.meta.glob<string>('../../fixtures/saves/*.json', { query: '?raw', import: 'default', eager: true });
const name = (pfad: string): string => pfad.split('/').pop() ?? pfad;
const fixture = (datei: string): string => {
  const eintrag = Object.entries(fixtures).find(([p]) => name(p) === datei);
  if (eintrag === undefined) throw new Error(`Fixture ${datei} fehlt`);
  return eintrag[1];
};
const versionsFixtures = Object.entries(fixtures).filter(([p]) => /^v\d+.*\.json$/.test(name(p)));

describe('S6 – alte Spielstände laden', () => {
  it('es gibt Fixtures für jede Kern-Schema-Version bis zur aktuellen', () => {
    for (let v = 1; v <= KERN_SCHEMA; v++) {
      expect(versionsFixtures.some(([p]) => name(p).startsWith(`v${String(v)}`))).toBe(true);
    }
  });

  it.each(versionsFixtures.map(([p, inhalt]) => [name(p), inhalt]))('%s migriert und besteht die Schema-Prüfung', (_, inhalt) => {
    const e = dateiLesen(inhalt, katalog.module);
    expect(e.art).toBe('ok');
    if (e.art !== 'ok') return;
    expect(istKernSpeicher(e.zustand)).toBe(true);
    expect(e.nurLesend).toBe(false);
    expect(holzModul.save?.validate(e.module['holz']?.daten)).toBe(true);
  });

  it('v1.json: Kernfelder (Geld, Werkstücke, Reststück mit Endriss, offener Auftrag, Skill-XP)', () => {
    const e = dateiLesen(fixture('v1.json'), katalog.module);
    if (e.art !== 'ok') throw new Error(e.art);
    const z = e.zustand;
    expect(z.inventar.geld).toBe(46);
    expect(z.inventar.werkstuecke).toHaveLength(1);
    const rest = z.inventar.werkstuecke[0];
    expect(rest?.herkunft).toBe('rest');
    const merkmale = [...(rest?.enden.a.merkmale ?? []), ...(rest?.enden.b.merkmale ?? [])];
    expect(merkmale.some((m) => m.laenge_mm === 73)).toBe(true);
    expect(z.auftraege.map((a) => a.status)).toEqual(['abgeliefert', 'angeboten']);
    expect(Object.values(z.skills)[0]?.xp).toBe(8);
    expect(e.hinweise).toEqual([]);
  });

  it('v1.json lädt über den Dienst (Ablage → Migration → Zustand)', async () => {
    const ablage = new SpeicherAblage(fixture('v1.json'));
    const s = new Spielstand({ ablage, module: katalog.module, speicherVerwaltung: undefined });
    const a = await s.laden();
    expect(a.art).toBe('geladen');
    expect(s.status().modus).toBe('normal');
  });

  it('unbekannter Modulabschnitt und fremde Inventar-IDs bleiben unverändert erhalten', async () => {
    const roh = fixture('v1-unbekanntes-modul.json');
    const original = (JSON.parse(roh) as { module: Record<string, unknown> }).module['angeln'];
    const e = dateiLesen(roh, katalog.module);
    if (e.art !== 'ok') throw new Error(e.art);
    expect(e.module['angeln']).toEqual(original);
    expect(e.zustand.inventar.gegenstaende).toContainEqual({ itemId: 'angeln.item.koeder', anzahl: 3 });
    expect(e.hinweise.some((h) => h.includes('angeln'))).toBe(true);

    // … und auch nach erneutem Speichern.
    const ablage = new SpeicherAblage(roh);
    const s = new Spielstand({ ablage, module: katalog.module, speicherVerwaltung: undefined });
    const a = await s.laden();
    if (a.art !== 'geladen') throw new Error(a.art);
    expect(await s.sofortSpeichern(a.zustand)).toBe(true);
    const neu = JSON.parse(ablage.aktuell ?? '') as { module: Record<string, unknown> };
    expect(neu.module['angeln']).toEqual(original);
  });
});

describe('S7 – defekter oder zukünftiger Spielstand', () => {
  it('Kern-Schema 999: nicht lesbar, nie überschrieben, Rohkopie in sicherung, Neustart nach Bestätigung', async () => {
    const roh = fixture('zukunft-kern-schema-999.json');
    expect(dateiLesen(roh, katalog.module).art).toBe('zuNeu');
    const ablage = new SpeicherAblage(roh);
    const s = new Spielstand({ ablage, module: katalog.module, speicherVerwaltung: undefined });
    const a = await s.laden();
    expect(a.art).toBe('zuNeu');
    expect(s.status().modus).toBe('gesperrt');
    expect(s.status().hinweise.join(' ')).toMatch(/neueren Version/);

    // Spiel läuft weiter, aber Speichern überschreibt nichts.
    expect(await s.sofortSpeichern(neuerStand())).toBe(false);
    s.speichern(neuerStand());
    await s.sofortSpeichern();
    expect(ablage.aktuell).toBe(roh);

    // Neustart erst nach Bestätigung; der alte Stand liegt in sicherung.
    expect(await s.neuBeginnen()).toBe(true);
    expect(await s.sofortSpeichern(neuerStand())).toBe(true);
    expect(ablage.aktuell).not.toBe(roh);
    const sicherungen = await ablage.sicherungen();
    expect(sicherungen.filter((x) => x.art === 'zuNeu').some((x) => x.json === roh)).toBe(true);
  });

  it('kaputtes JSON: defekt, Rohdaten in sicherung, kein stilles Überschreiben', async () => {
    const roh = fixture('kaputt.json');
    const e = dateiLesen(roh, katalog.module);
    expect(e.art).toBe('defekt');
    const ablage = new SpeicherAblage(roh);
    const s = new Spielstand({ ablage, module: katalog.module, speicherVerwaltung: undefined });
    expect((await s.laden()).art).toBe('defekt');
    s.speichern(neuerStand());
    await s.sofortSpeichern();
    expect(ablage.aktuell).toBe(roh);
    expect((await ablage.sicherungen()).some((x) => x.art === 'defekt' && x.json === roh)).toBe(true);
  });
});
