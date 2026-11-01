import { describe, expect, it } from 'vitest';
import {
  INSTALL_HINWEIS_SCHLUESSEL,
  hinweisEntscheiden,
  installHinweisPruefen,
  istIosGeraet,
  istIosSafari,
  istStandalone,
  merkeGeschlossen,
  speicherPersistenzAnfragen,
  wurdeGeschlossen,
  type Speicher,
  type Umgebung,
} from '../../../src/ui/installhinweis';

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  ipadSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.119 Mobile/15E148 Safari/604.1',
  iphoneFirefox:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/141.0 Mobile/15E148 Safari/605.1.15',
  iphoneInstagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 390.0.0.28.85',
  iphoneWebView: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
};

class TestSpeicher implements Speicher {
  daten = new Map<string, string>();
  getItem(k: string): string | null {
    return this.daten.get(k) ?? null;
  }
  setItem(k: string, w: string): void {
    this.daten.set(k, w);
  }
}

const kaputterSpeicher: Speicher = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

describe('Safari-iOS-Erkennung', () => {
  it('iPhone-Safari ja', () => {
    expect(istIosSafari(UA.iphoneSafari, 5)).toBe(true);
  });
  it('iPadOS (meldet sich als Mac, hat Touch) ja', () => {
    expect(istIosGeraet(UA.ipadSafari, 5)).toBe(true);
    expect(istIosSafari(UA.ipadSafari, 5)).toBe(true);
  });
  it('Mac-Safari ohne Touch nein', () => {
    expect(istIosSafari(UA.macSafari, 0)).toBe(false);
  });
  it('Chrome, Firefox, In-App-Ansichten auf iOS nein', () => {
    expect(istIosSafari(UA.iphoneChrome, 5)).toBe(false);
    expect(istIosSafari(UA.iphoneFirefox, 5)).toBe(false);
    expect(istIosSafari(UA.iphoneInstagram, 5)).toBe(false);
    expect(istIosSafari(UA.iphoneWebView, 5)).toBe(false);
  });
  it('Android nein', () => {
    expect(istIosSafari(UA.androidChrome, 5)).toBe(false);
  });
});

describe('Standalone-Erkennung', () => {
  it('navigator.standalone oder display-mode', () => {
    expect(istStandalone({ navigatorStandalone: true, displayModeApp: false })).toBe(true);
    expect(istStandalone({ navigatorStandalone: undefined, displayModeApp: true })).toBe(true);
    expect(istStandalone({ navigatorStandalone: false, displayModeApp: false })).toBe(false);
    expect(istStandalone({ navigatorStandalone: undefined, displayModeApp: false })).toBe(false);
  });
});

describe('Schliessen merken', () => {
  it('speichert Zeitpunkt unter festem Schlüssel', () => {
    const s = new TestSpeicher();
    expect(wurdeGeschlossen(s)).toBe(false);
    merkeGeschlossen(s, new Date('2026-11-01T10:00:00Z'));
    expect(s.getItem(INSTALL_HINWEIS_SCHLUESSEL)).toBe('2026-11-01T10:00:00.000Z');
    expect(wurdeGeschlossen(s)).toBe(true);
  });
  it('ohne oder mit gesperrtem Speicher kein Absturz', () => {
    expect(wurdeGeschlossen(null)).toBe(false);
    expect(wurdeGeschlossen(kaputterSpeicher)).toBe(false);
    expect(() => {
      merkeGeschlossen(null);
      merkeGeschlossen(kaputterSpeicher);
    }).not.toThrow();
  });
});

describe('Entscheidung', () => {
  const basis = { iosSafari: true, standalone: false, ersterAuftragAbgeliefert: true, geschlossen: false };
  it('zeigen nur wenn alles passt', () => {
    expect(hinweisEntscheiden(basis)).toBe('zeigen');
  });
  it('Gründe', () => {
    expect(hinweisEntscheiden({ ...basis, standalone: true })).toBe('schon-installiert');
    expect(hinweisEntscheiden({ ...basis, iosSafari: false })).toBe('kein-ios-safari');
    expect(hinweisEntscheiden({ ...basis, ersterAuftragAbgeliefert: false })).toBe('auftrag-fehlt');
    expect(hinweisEntscheiden({ ...basis, geschlossen: true })).toBe('geschlossen');
  });
});

describe('installHinweisPruefen (ohne DOM, nur Fälle ohne Anzeige)', () => {
  const safari: Umgebung = { userAgent: UA.iphoneSafari, maxTouchPoints: 5, navigatorStandalone: false, displayModeApp: false };
  it('vor dem ersten Auftrag nichts', () => {
    expect(installHinweisPruefen({ ersterAuftragAbgeliefert: false, umgebung: safari, speicher: new TestSpeicher() })).toBe('auftrag-fehlt');
  });
  it('vom Home-Bildschirm gestartet nichts', () => {
    expect(
      installHinweisPruefen({ ersterAuftragAbgeliefert: true, umgebung: { ...safari, navigatorStandalone: true }, speicher: null }),
    ).toBe('schon-installiert');
  });
  it('nach Schliessen nichts mehr', () => {
    const s = new TestSpeicher();
    merkeGeschlossen(s);
    expect(installHinweisPruefen({ ersterAuftragAbgeliefert: true, umgebung: safari, speicher: s })).toBe('geschlossen');
  });
  it('Chrome auf iPhone nichts', () => {
    expect(
      installHinweisPruefen({ ersterAuftragAbgeliefert: true, umgebung: { ...safari, userAgent: UA.iphoneChrome }, speicher: null }),
    ).toBe('kein-ios-safari');
  });
});

describe('Speicher-Persistenz', () => {
  it('nicht unterstützt', async () => {
    expect(await speicherPersistenzAnfragen(undefined)).toBe('nicht-unterstuetzt');
  });
  it('schon dauerhaft', async () => {
    expect(await speicherPersistenzAnfragen({ persisted: () => Promise.resolve(true), persist: () => Promise.resolve(false) })).toBe(
      'dauerhaft',
    );
  });
  it('gewährt / abgelehnt / Fehler', async () => {
    expect(await speicherPersistenzAnfragen({ persisted: () => Promise.resolve(false), persist: () => Promise.resolve(true) })).toBe(
      'dauerhaft',
    );
    expect(await speicherPersistenzAnfragen({ persisted: () => Promise.resolve(false), persist: () => Promise.resolve(false) })).toBe(
      'nicht-dauerhaft',
    );
    expect(await speicherPersistenzAnfragen({ persisted: () => Promise.reject(new Error('x')), persist: () => Promise.resolve(true) })).toBe(
      'nicht-unterstuetzt',
    );
  });
});
