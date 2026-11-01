// Liegt unter tests/unit/render/, weil der Ticket-Scope (010) nur diesen Testordner vorsieht.
import { describe, expect, it } from 'vitest';
import { FrameStatistik, perzentilNearestRank } from '../../../src/perf/frame-statistik';
import { bytesProPixel, dreieckeJeAufruf } from '../../../src/perf/gl-zaehler';

describe('FrameStatistik (__perf)', () => {
  it('misst fps und Perzentile über das Fenster', () => {
    const s = new FrameStatistik(5000);
    for (let i = 0; i <= 60; i++) {
      s.frameBeginn(i * 20);
      s.frameEnde(i * 20 + 5, { drawCalls: 10, triangles: 100 });
    }
    const a = s.auswerten(1205);
    expect(a.fps).toBeCloseTo(50, 6);
    expect(a.frameTimeMsP95).toBe(20);
    expect(a.drawCalls).toBe(10);
    expect(a.timeToFirstFrameMs).toBe(5);
  });

  it('QA-Befund 005: ohne Frame fallen Draw Calls und Dreiecke auf 0', () => {
    const s = new FrameStatistik(5000, 250);
    s.frameBeginn(0);
    s.frameEnde(1, { drawCalls: 12, triangles: 900 });
    s.frameBeginn(16);
    s.frameEnde(17, { drawCalls: 12, triangles: 900 });
    expect(s.auswerten(20).drawCalls).toBe(12);
    // Schleife steht (z. B. Kontext weg, Tab im Hintergrund)
    expect(s.auswerten(1000).drawCalls).toBe(0);
    expect(s.auswerten(1000).triangles).toBe(0);
    // Frame ohne Zeichenaufrufe (Kontext verloren) meldet 0 statt alter Werte
    s.frameBeginn(1016);
    s.frameEnde(1017, { drawCalls: 0, triangles: 0 });
    expect(s.auswerten(1018).drawCalls).toBe(0);
  });

  it('langsame Frames (Emulation) gelten nicht als "kein Frame"', () => {
    const s = new FrameStatistik(5000, 250);
    s.frameBeginn(0);
    s.frameEnde(10, { drawCalls: 7, triangles: 1 });
    s.frameBeginn(800);
    s.frameEnde(810, { drawCalls: 7, triangles: 1 });
    expect(s.auswerten(1500).drawCalls).toBe(7);
  });

  it('QA-Befund 005: Eingabelatenz erst nach dem Present (Beginn des Folgeframes)', () => {
    const s = new FrameStatistik();
    s.frameBeginn(100);
    s.eingabe(95);
    s.frameEnde(104, { drawCalls: 1, triangles: 1 });
    s.feedbackGezeichnet();
    expect(s.auswerten(105).inputLatencyMsLast).toBeNull(); // noch nicht angezeigt
    s.frameBeginn(116.7);
    expect(s.auswerten(117).inputLatencyMsLast).toBeCloseTo(21.7, 6);
  });

  it('Feedback ohne Eingabe misst nichts; reset leert Fenster und Maximum', () => {
    const s = new FrameStatistik();
    s.frameBeginn(0);
    s.feedbackGezeichnet();
    s.frameBeginn(200);
    expect(s.auswerten(200).inputLatencyMsLast).toBeNull();
    expect(s.auswerten(200).longFrames).toBe(1);
    s.reset();
    expect(s.auswerten(200).frameTimeMsMax).toBe(0);
    expect(s.auswerten(200).longFrames).toBe(0);
  });
});

describe('GL-Zählhilfen', () => {
  it('Dreiecke je Aufruf', () => {
    expect(dreieckeJeAufruf(0x0004, 36)).toBe(12);
    expect(dreieckeJeAufruf(0x0004, 36, 5)).toBe(60);
    expect(dreieckeJeAufruf(0x0005, 6)).toBe(4);
    expect(dreieckeJeAufruf(0x0001, 6)).toBe(0); // LINES
  });

  it('Bytes pro Pixel', () => {
    expect(bytesProPixel(0x8058)).toBe(4);
    expect(bytesProPixel(0x881a)).toBe(8);
    expect(bytesProPixel(0x1908, 0x1401)).toBe(4); // RGBA, UNSIGNED_BYTE
  });

  it('Perzentil Nearest-Rank', () => {
    expect(perzentilNearestRank([], 95)).toBe(0);
    expect(perzentilNearestRank([1, 2, 3, 4], 50)).toBe(2);
    expect(perzentilNearestRank([1, 2, 3, 4], 95)).toBe(4);
  });
});
