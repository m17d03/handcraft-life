// Ticket 018: Notbremse, Pause, Erholung bei 30/60 Hz, G3-Untergrenze, Software-Erkennung, ?aa=0, Ladefrist.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mitFrist } from '../../../src/render/assets';
import {
  aufloesungsGrenzen,
  DynamischeAufloesung,
  GERAET_MIN_DICHTE,
  istSoftwareRenderer,
  leseAufloesungsParameter,
  NOTBREMSE_FRAMES,
} from '../../../src/render/aufloesung';

/** Meldet `n` gleiche Frame-Zeiten; true, wenn sich der Faktor dabei mindestens einmal geändert hat. */
function frames(d: DynamischeAufloesung, ms: number, n: number): boolean {
  let geaendert = false;
  for (let i = 0; i < n; i++) geaendert = d.messe(ms) || geaendert;
  return geaendert;
}

describe('Auflösungsgrenzen (G3)', () => {
  it('auf Geräten nie unter 1,5; tiefer nur, wenn der Deckel es verlangt', () => {
    expect(GERAET_MIN_DICHTE).toBe(1.5);
    expect(aufloesungsGrenzen(3)).toEqual({ min: 1.5, max: 2 });
    expect(aufloesungsGrenzen(2)).toEqual({ min: 1.5, max: 2 });
    expect(aufloesungsGrenzen(1)).toEqual({ min: 1, max: 1 }); // dpr-1-Gerät: max ist kleiner
    expect(aufloesungsGrenzen(3, 1)).toEqual({ min: 1, max: 1 }); // Software-Renderer (Deckel 1)
    expect(aufloesungsGrenzen(3, 0.5)).toEqual({ min: 0.5, max: 0.5 }); // ?dpr=0.5
  });
});

describe('Notbremse', () => {
  it(`${String(NOTBREMSE_FRAMES)} Frames > 250 ms in Folge → sofort Minimum`, () => {
    const d = new DynamischeAufloesung(1.5, 2);
    expect(d.messe(400)).toBe(false);
    expect(d.messe(400)).toBe(false);
    expect(d.messe(400)).toBe(true);
    expect(d.faktor).toBe(1.5);
  });

  it('ein schneller Frame dazwischen setzt die Folge zurück', () => {
    const d = new DynamischeAufloesung(1.5, 2);
    frames(d, 400, 2);
    d.messe(16);
    frames(d, 400, 2);
    expect(d.faktor).toBe(2);
  });

  it('Hintergrund-Lücke: nach pause() zählt die nächste Lücke nicht, alte Folge ist vergessen', () => {
    const d = new DynamischeAufloesung(1.5, 2);
    frames(d, 400, 2); // zwei lange Frames vor dem App-Wechsel
    d.pause();
    expect(d.messe(60_000)).toBe(false); // Rückkehr nach 60 s
    expect(d.messe(400)).toBe(false); // erst 1 langer Frame seit der Pause
    expect(d.faktor).toBe(2);
  });

  it('ohne Pause-Meldung löst eine einzelne Riesenlücke nichts aus und verfälscht das Mittel nicht', () => {
    const d = new DynamischeAufloesung(1.5, 2, 33.3, 10);
    expect(d.messe(60_000)).toBe(false);
    frames(d, 16.7, 10);
    expect(d.faktor).toBe(2);
  });

  it('pause() leert eine angefangene Stichprobe', () => {
    const d = new DynamischeAufloesung(1.5, 2, 33.3, 10);
    frames(d, 60, 9);
    d.pause();
    d.messe(60_000);
    expect(frames(d, 16.7, 9)).toBe(false); // ohne Pause wären hier 10 Frames mit Mittel ~38 ms erreicht
    expect(d.faktor).toBe(2);
  });
});

describe('Erholung', () => {
  it('60 Hz: nach der Notbremse wieder bis max', () => {
    const d = new DynamischeAufloesung(1.5, 2, 33.3, 30);
    frames(d, 400, 3);
    expect(d.faktor).toBe(1.5);
    frames(d, 16.7, 30 * 2);
    expect(d.faktor).toBe(2);
  });

  it('30 Hz (Low Power Mode): Frames im Takt der Anzeige heben ebenfalls', () => {
    const d = new DynamischeAufloesung(1.5, 2, 33.3, 30);
    frames(d, 400, 3);
    expect(d.faktor).toBe(1.5);
    // 33,3 ms ± Zittern – das alte Kriterium (< 23,3 ms) wäre nie erreicht worden
    for (let i = 0; i < 60; i++) d.messe(i % 2 === 0 ? 32.9 : 33.8);
    expect(d.faktor).toBe(2);
  });

  it('Hänger in der Stichprobe verhindern das Heben', () => {
    const d = new DynamischeAufloesung(1.5, 2, 33.3, 30);
    frames(d, 400, 3);
    for (let i = 0; i < 30; i++) d.messe(i === 10 ? 70 : 33.3);
    expect(d.faktor).toBe(1.5);
  });

  it('Pendeln (heben → zu langsam → senken) sperrt das nächste Heben für mehrere Stichproben', () => {
    const d = new DynamischeAufloesung(1.5, 2, 33.3, 10);
    frames(d, 60, 10); // 2 → 1,75
    frames(d, 30, 10); // im Takt → 2
    expect(d.faktor).toBe(2);
    frames(d, 60, 10); // zu langsam → 1,75, Sperre
    expect(d.faktor).toBe(1.75);
    frames(d, 30, 10);
    expect(d.faktor).toBe(1.75); // gesperrt
    frames(d, 30, 20);
    expect(d.faktor).toBe(2); // Sperre abgelaufen
  });
});

describe('Software-Renderer', () => {
  it.each([
    ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)', true],
    ['llvmpipe (LLVM 15.0.7, 256 bits)', true],
    ['Mesa softpipe', true],
    ['Microsoft Basic Render Driver', true],
    ['Apple GPU', false],
    ['ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)', false],
    ['ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)', false],
    ['', false],
  ])('%s → %s', (name, erwartet) => {
    expect(istSoftwareRenderer(name)).toBe(erwartet);
  });
});

describe('URL-Schalter ?aa', () => {
  it('MSAA standardmässig an, ?aa=0/false schaltet ab', () => {
    expect(leseAufloesungsParameter('').msaa).toBe(true);
    expect(leseAufloesungsParameter('?aa=1').msaa).toBe(true);
    expect(leseAufloesungsParameter('?aa=0').msaa).toBe(false);
    expect(leseAufloesungsParameter('?aa=false&dpr=0.5')).toEqual({ dynamisch: true, pixeldichteDeckel: 0.5, msaa: false });
  });
});

describe('mitFrist', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('liefert das Ergebnis, wenn es rechtzeitig kommt', async () => {
    await expect(mitFrist(Promise.resolve(7), 1000, 'x')).resolves.toBe(7);
  });

  it('reicht Fehler weiter (auch Nicht-Error-Werte als Error)', async () => {
    await expect(mitFrist(Promise.reject(new Error('kaputt')), 1000, 'x')).rejects.toThrow('kaputt');
    await expect(mitFrist(Promise.reject(new Error('404')), 1000, 'x')).rejects.toBeInstanceOf(Error);
  });

  it('verwirft nach Ablauf der Frist mit verständlicher Meldung; das Original läuft weiter', async () => {
    vi.useFakeTimers();
    let aufloesen: (v: number) => void = () => undefined;
    const langsam = new Promise<number>((r) => {
      aufloesen = r;
    });
    const befristet = mitFrist(langsam, 20_000, 'Modelle laden');
    const pruefung = expect(befristet).rejects.toThrow('Modelle laden: keine Antwort nach 20 s');
    await vi.advanceTimersByTimeAsync(20_000);
    await pruefung;
    aufloesen(3);
    await expect(langsam).resolves.toBe(3);
  });
});
