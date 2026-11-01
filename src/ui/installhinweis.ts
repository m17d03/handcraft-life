// Installationshinweis (Ticket 014): bittet Safari-Spieler auf dem iPhone einmal, das Spiel zum
// Home-Bildschirm hinzuzufügen. Grund: WebKit löscht Website-Speicher nach 7 Tagen ohne Nutzung,
// Home-Bildschirm-Apps sind ausgenommen (ADR 0003).
// Aufruf aus dem Spiel (Ticket 013), z. B. nach jeder Ablieferung:
//   installHinweisPruefen({ ersterAuftragAbgeliefert: true });
// Entscheidung und Erkennung sind reine Funktionen (tests/unit/ui/installhinweis.test.ts),
// die DOM-Darstellung wird in tests/e2e/pwa.spec.ts geprüft.

export const INSTALL_HINWEIS_SCHLUESSEL = 'hcl.installhinweis.geschlossen.v1';

/** Was der Hinweis über den Browser wissen muss – im Test frei vorgebbar. */
export interface Umgebung {
  userAgent: string;
  maxTouchPoints: number;
  /** `navigator.standalone` (nur iOS Safari, true = vom Home-Bildschirm gestartet). */
  navigatorStandalone: boolean | undefined;
  /** `(display-mode: standalone)` oder `(display-mode: fullscreen)` trifft zu. */
  displayModeApp: boolean;
}

/** Minimaler Ausschnitt von `Storage`, damit Tests ohne Browser laufen. */
export interface Speicher {
  getItem(schluessel: string): string | null;
  setItem(schluessel: string, wert: string): void;
}

export type HinweisEntscheid = 'zeigen' | 'kein-ios-safari' | 'schon-installiert' | 'auftrag-fehlt' | 'geschlossen';

// Andere Browser und In-App-Ansichten auf iOS (alle WebKit, aber ohne "Zum Home-Bildschirm" wie in Safari).
const FREMDE_IOS_BROWSER =
  /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|YaBrowser|Ddg\/|DuckDuckGo|GSA\/|FBAN|FBAV|FBIOS|Instagram|Line\/|Snapchat|Twitter|WhatsApp|LinkedInApp|MicroMessenger/;

/** iPhone, iPod oder iPad (iPadOS meldet sich als Mac, hat aber Touch). */
export function istIosGeraet(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPod|iPad/.test(userAgent)) return true;
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

/** Echtes Safari auf iOS/iPadOS – nicht Chrome, Firefox, Edge oder eine In-App-Ansicht. */
export function istIosSafari(userAgent: string, maxTouchPoints: number): boolean {
  if (!istIosGeraet(userAgent, maxTouchPoints)) return false;
  if (FREMDE_IOS_BROWSER.test(userAgent)) return false;
  return /Version\/[\d.]+.*Safari\//.test(userAgent);
}

/** Läuft das Spiel bereits als Home-Bildschirm-App? */
export function istStandalone(u: Pick<Umgebung, 'navigatorStandalone' | 'displayModeApp'>): boolean {
  return u.navigatorStandalone === true || u.displayModeApp;
}

export function wurdeGeschlossen(speicher: Speicher | null): boolean {
  if (!speicher) return false;
  try {
    return speicher.getItem(INSTALL_HINWEIS_SCHLUESSEL) !== null;
  } catch {
    return false;
  }
}

export function merkeGeschlossen(speicher: Speicher | null, jetzt: Date = new Date()): void {
  if (!speicher) return;
  try {
    speicher.setItem(INSTALL_HINWEIS_SCHLUESSEL, jetzt.toISOString());
  } catch {
    // Speicher voll oder gesperrt: Hinweis erscheint dann beim nächsten Start erneut – unschädlich.
  }
}

/** Reine Entscheidung, Reihenfolge = Begründung im Rückgabewert. */
export function hinweisEntscheiden(e: {
  iosSafari: boolean;
  standalone: boolean;
  ersterAuftragAbgeliefert: boolean;
  geschlossen: boolean;
}): HinweisEntscheid {
  if (e.standalone) return 'schon-installiert';
  if (!e.iosSafari) return 'kein-ios-safari';
  if (!e.ersterAuftragAbgeliefert) return 'auftrag-fehlt';
  if (e.geschlossen) return 'geschlossen';
  return 'zeigen';
}

/** Liest die Umgebung aus dem echten Browser. */
export function leseUmgebung(): Umgebung {
  const nav = navigator as Navigator & { standalone?: boolean };
  const mm = (q: string): boolean => typeof matchMedia === 'function' && matchMedia(q).matches;
  return {
    userAgent: nav.userAgent,
    maxTouchPoints: nav.maxTouchPoints,
    navigatorStandalone: nav.standalone,
    displayModeApp: mm('(display-mode: standalone)') || mm('(display-mode: fullscreen)'),
  };
}

function standardSpeicher(): Speicher | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export interface InstallHinweisOptionen {
  ersterAuftragAbgeliefert: boolean;
  /** Nur für Tests: sonst `leseUmgebung()`. */
  umgebung?: Umgebung;
  /** Nur für Tests: sonst `localStorage`. */
  speicher?: Speicher | null;
  /** Element, in das der Hinweis gehängt wird (Standard: `document.body`). */
  wurzel?: HTMLElement;
  beiSchliessen?: () => void;
}

/**
 * Prüft, ob der Hinweis fällig ist, und zeigt ihn dann an (höchstens einmal gleichzeitig).
 * Rückgabe: Entscheidung samt Grund, z. B. für das Debug-Overlay.
 */
export function installHinweisPruefen(opt: InstallHinweisOptionen): HinweisEntscheid {
  const u = opt.umgebung ?? leseUmgebung();
  const speicher = opt.speicher === undefined ? standardSpeicher() : opt.speicher;
  const entscheid = hinweisEntscheiden({
    iosSafari: istIosSafari(u.userAgent, u.maxTouchPoints),
    standalone: istStandalone(u),
    ersterAuftragAbgeliefert: opt.ersterAuftragAbgeliefert,
    geschlossen: wurdeGeschlossen(speicher),
  });
  if (entscheid === 'zeigen') {
    const wurzel = opt.wurzel ?? document.body;
    if (!wurzel.querySelector('.install-hinweis')) {
      zeigeInstallHinweis(wurzel, () => {
        merkeGeschlossen(speicher);
        opt.beiSchliessen?.();
      });
    }
  }
  return entscheid;
}

/**
 * Bittet den Browser, den Speicher nicht automatisch zu löschen. Wirkung auf iOS ungewiss (ADR 0003 [H]);
 * das Ergebnis soll im Debug-Overlay sichtbar werden.
 */
export async function speicherPersistenzAnfragen(
  sm: Pick<StorageManager, 'persist' | 'persisted'> | undefined = typeof navigator === 'undefined' ? undefined : navigator.storage,
): Promise<'dauerhaft' | 'nicht-dauerhaft' | 'nicht-unterstuetzt'> {
  if (!sm || typeof sm.persist !== 'function') return 'nicht-unterstuetzt';
  try {
    if (await sm.persisted()) return 'dauerhaft';
    return (await sm.persist()) ? 'dauerhaft' : 'nicht-dauerhaft';
  } catch {
    return 'nicht-unterstuetzt';
  }
}

// ---------- Darstellung (Stil A, gleiche Farben wie das HUD aus Ticket 011) ----------

const STIL_ID = 'install-hinweis-stil';
const STIL = `
.install-hinweis {
  --sal: env(safe-area-inset-left, 0px); --sar: env(safe-area-inset-right, 0px); --sat: env(safe-area-inset-top, 0px);
  position: fixed; z-index: 40; top: calc(var(--sat) + 12px); left: 50%; transform: translateX(-50%);
  width: min(480px, calc(100vw - var(--sal) - var(--sar) - 48px));
  display: flex; gap: 12px; align-items: flex-start; padding: 12px 8px 12px 16px;
  color: #f3e9dc; background: rgb(31 26 21 / 94%); border: 1.5px solid #d9a35b; border-radius: 14px;
  box-shadow: 0 6px 24px rgb(0 0 0 / 45%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 15px; line-height: 1.3;
  -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent;
  animation: install-hinweis-ein 180ms ease-out;
}
@keyframes install-hinweis-ein { from { opacity: 0; transform: translate(-50%, -8px); } }
.install-hinweis-text { flex: 1; min-width: 0; }
.install-hinweis-text strong { display: block; font-size: 16px; color: #ffd08a; margin-bottom: 2px; }
.install-hinweis-text p { margin: 4px 0 0; }
.install-hinweis-teilen { display: inline-block; width: 18px; height: 18px; vertical-align: -3px; }
.install-hinweis-zu {
  flex: none; width: 48px; height: 48px; display: grid; place-items: center; padding: 0;
  font: inherit; font-size: 22px; line-height: 1; color: #f3e9dc; background: transparent;
  border: 1.5px solid rgb(217 163 91 / 75%); border-radius: 12px;
  touch-action: manipulation; transition: transform 60ms ease-out, background-color 60ms;
}
.install-hinweis-zu.gedrueckt, .install-hinweis-zu:active { transform: scale(0.92); background: #4a3826; border-color: #ffd08a; }
.install-hinweis.zu { opacity: 0; transform: translate(-50%, -8px); transition: opacity 160ms, transform 160ms; }
`;

// iOS-Teilen-Symbol (Kasten mit Pfeil nach oben), eigene Zeichnung.
const TEILEN_SVG =
  '<svg class="install-hinweis-teilen" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#ffd08a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M8 10H5.5v10.5h13V10H16"/></svg>';

/** Baut den Hinweis in `wurzel` ein. Schliessen: Feedback sofort bei Berührung, dann ausblenden. */
export function zeigeInstallHinweis(wurzel: HTMLElement, beiSchliessen: () => void): HTMLElement {
  const doc = wurzel.ownerDocument;
  if (!doc.getElementById(STIL_ID)) {
    const stil = doc.createElement('style');
    stil.id = STIL_ID;
    stil.textContent = STIL;
    doc.head.appendChild(stil);
  }
  const el = doc.createElement('div');
  el.className = 'install-hinweis';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'false');
  el.setAttribute('aria-labelledby', 'install-hinweis-titel');
  el.innerHTML = `
    <div class="install-hinweis-text">
      <strong id="install-hinweis-titel">Spielstand sichern</strong>
      <p>Safari löscht Daten von Webseiten, die 7 Tage nicht geöffnet wurden. Als App auf dem Home-Bildschirm bleibt deine Werkstatt erhalten.</p>
      <p>So geht's: ${TEILEN_SVG} <b>Teilen</b> tippen → <b>„Zum Home-Bildschirm“</b>.</p>
    </div>
    <button type="button" class="install-hinweis-zu" aria-label="Hinweis schliessen">✕</button>`;
  const zu = el.querySelector<HTMLButtonElement>('.install-hinweis-zu');
  if (zu) {
    const loslassen = (): void => {
      zu.classList.remove('gedrueckt');
    };
    zu.addEventListener('pointerdown', () => {
      zu.classList.add('gedrueckt');
    });
    zu.addEventListener('pointerup', loslassen);
    zu.addEventListener('pointercancel', loslassen);
    zu.addEventListener('pointerleave', loslassen);
    zu.addEventListener(
      'click',
      () => {
        beiSchliessen();
        el.classList.add('zu');
        setTimeout(() => {
          el.remove();
        }, 180);
      },
      { once: true },
    );
  }
  wurzel.appendChild(el);
  return el;
}
