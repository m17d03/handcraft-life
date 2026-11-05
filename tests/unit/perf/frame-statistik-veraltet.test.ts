// Ticket 018: Wann `__perf()` Draw Calls/Dreiecke als veraltet (0) meldet – bei sehr langsamen, unregelmässigen Frames.
import { describe, expect, it } from 'vitest';
import { FrameStatistik } from '../../../src/perf/frame-statistik';

const Z = { drawCalls: 19, triangles: 8390 };

function frame(s: FrameStatistik, t: number): void {
  s.frameBeginn(t);
  s.frameEnde(t + 5, Z);
}

describe('FrameStatistik – Veraltet-Grenze', () => {
  it('kurzer Frame nach langen: Grenze richtet sich nach dem längsten Abstand im Fenster', () => {
    const s = new FrameStatistik(5000, 250);
    frame(s, 0);
    frame(s, 3000); // 3 s
    frame(s, 3400); // dann 0,4 s
    // 2 s nach dem letzten Frame: früher (3 × 0,4 s) schon „veraltet“, jetzt läuft das Bild noch
    expect(s.auswerten(5400).triangles).toBe(8390);
  });

  it('Abstände länger als das Fenster zählen über den letzten Abstand', () => {
    const s = new FrameStatistik(5000, 250);
    frame(s, 0);
    frame(s, 8000); // 8 s, altert nach 5 s aus dem Fenster
    expect(s.auswerten(14_000).drawCalls).toBe(19);
  });

  it('steht die Schleife wirklich, fällt die Anzeige nach 3 × Abstand auf 0', () => {
    const s = new FrameStatistik(5000, 250);
    frame(s, 0);
    frame(s, 8000);
    expect(s.auswerten(8005 + 3 * 8000 + 1).drawCalls).toBe(0);
  });

  it('nach __perfReset gelten alte lange Abstände nicht mehr', () => {
    const s = new FrameStatistik(5000, 250);
    frame(s, 0);
    frame(s, 60_000); // 60 s Lücke (z. B. Hintergrund)
    s.reset();
    // ohne Rücksetzen wäre die Grenze 180 s
    expect(s.auswerten(61_000).drawCalls).toBe(0);
  });

  it('schnelle Frames: Grenze bleibt veraltetMs', () => {
    const s = new FrameStatistik(5000, 250);
    for (let i = 0; i < 10; i++) frame(s, i * 16);
    expect(s.auswerten(144 + 5 + 249).drawCalls).toBe(19);
    expect(s.auswerten(144 + 5 + 251).drawCalls).toBe(0);
  });
});
