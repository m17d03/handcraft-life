import { describe, expect, it } from 'vitest';
import { FpsMeter, isDebugEnabled } from '../../src/debug/fps';

describe('FpsMeter', () => {
  it('liefert 0 ohne genug Frames', () => {
    const m = new FpsMeter();
    expect(m.fps).toBe(0);
    m.tick(0);
    expect(m.fps).toBe(0);
  });

  it('misst 60 fps bei 16,67-ms-Abständen', () => {
    const m = new FpsMeter();
    for (let i = 0; i <= 60; i++) m.tick(i * (1000 / 60));
    expect(m.fps).toBeCloseTo(60, 0);
  });

  it('misst 30 fps und vergisst Frames ausserhalb des Fensters', () => {
    const m = new FpsMeter(1000);
    for (let i = 0; i <= 120; i++) m.tick(i * (1000 / 60)); // 2 s mit 60 fps
    for (let i = 1; i <= 31; i++) m.tick(2000 + i * (1000 / 30)); // gut 1 s mit 30 fps
    expect(m.fps).toBeCloseTo(30, 0);
  });

  it('meldet den längsten Frame', () => {
    const m = new FpsMeter();
    [0, 16, 32, 132, 148].forEach((t) => { m.tick(t); });
    expect(m.worstFrameMs).toBe(100);
  });
});

describe('isDebugEnabled', () => {
  it.each([
    ['?debug=1', true],
    ['?debug', true],
    ['?x=1&debug=true', true],
    ['', false],
    ['?debug=0', false],
    ['?debug=false', false],
  ])('%s → %s', (search, expected) => {
    expect(isDebugEnabled(search)).toBe(expected);
  });
});

describe('FpsMeter Hänger', () => {
  it('meldet Hänger, die länger als das Fenster sind', () => {
    const m = new FpsMeter(1000);
    for (let i = 0; i <= 60; i++) m.tick(i * 16);
    m.tick(960 + 1500);
    m.tick(960 + 1516);
    expect(m.worstFrameMs).toBe(1500);
  });
});
