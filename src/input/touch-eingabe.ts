// Touch-Eingabe (Ticket 011): bindet Pointer-Events an DOM-Elemente und gibt abstrakte Befehle aus.
// Kennt weder Engine noch Spielregeln. Sichtbares Feedback entsteht synchron im pointerdown-Handler
// (also im selben Frame wie die Berührung, U2 ≤ 100 ms).

import type { Befehl, BefehlsEmpfaenger } from './befehle';
import {
  HALTEN_MS,
  RANDZONE_PT,
  istOhneBewegung,
  stickWert,
  zoneFuer,
  type SafeArea,
} from './gesten';

type Aufraeumen = () => void;

function fangen(el: Element, id: number): void {
  // Synthetische Pointer (Tests) haben keinen aktiven Zeiger → setPointerCapture wirft; dann ohne Capture.
  try {
    el.setPointerCapture(id);
  } catch {
    /* ohne Capture weiter */
  }
}

function an(el: EventTarget, typ: string, fn: (e: PointerEvent) => void, liste: Aufraeumen[]): void {
  const h = (e: Event): void => {
    fn(e as PointerEvent);
  };
  el.addEventListener(typ, h);
  liste.push(() => {
    el.removeEventListener(typ, h);
  });
}

/** Unterdrückt Seiten-Zoom (Pinch, Doppeltipp), Gummiband-Scrollen und Kontextmenüs. */
export function sperreBrowserGesten(ziel: Document = document): Aufraeumen {
  const weg = (e: Event): void => {
    e.preventDefault();
  };
  const scroll = (e: Event): void => {
    const t = e.target;
    if (t instanceof Element && t.closest('[data-scroll]')) return;
    e.preventDefault();
  };
  const typen = ['gesturestart', 'gesturechange', 'gestureend', 'dblclick', 'contextmenu'];
  for (const t of typen) ziel.addEventListener(t, weg, { passive: false });
  ziel.addEventListener('touchmove', scroll, { passive: false });
  return () => {
    for (const t of typen) ziel.removeEventListener(t, weg);
    ziel.removeEventListener('touchmove', scroll);
  };
}

// ---------------------------------------------------------------------------
// Spielfläche: Erkunden (Stick links, Umschauen rechts, Tippen/Halten) und Werkbank (nur Tippen)

export type FlaechenModus = 'erkunden' | 'werkbank' | 'aus';

export interface SpielflaechenOptionen {
  flaeche: HTMLElement;
  /** Ebene für Feedback-Elemente (Stick, Finger-Punkt, Halte-Ring). */
  ebene: HTMLElement;
  emit: BefehlsEmpfaenger;
  safeArea: () => SafeArea;
  modus: () => FlaechenModus;
  /** Befehl für ein Tippen im Werkbank-Modus (z. B. massbandSetzen beim Messen). */
  werkbankTippen: (xCss: number, yCss: number) => Befehl;
  /** Wird bei jeder neuen Berührung aufgerufen (z. B. Zonen-Hinweis ausblenden). */
  beiBeruehrung?: (zone: 'links' | 'rechts') => void;
  randPt?: number;
}

interface Finger {
  id: number;
  rolle: 'stick' | 'schauen' | 'tippen';
  x0: number;
  y0: number;
  x: number;
  y: number;
  bewegt: boolean;
  gehalten: boolean;
  el: HTMLElement;
  knopf: HTMLElement | null;
  ring: HTMLElement | null;
  timer: number;
}

function feedbackEl(ebene: HTMLElement, klasse: string, x: number, y: number): HTMLElement {
  const el = document.createElement('div');
  el.className = klasse;
  el.style.left = `${String(x)}px`;
  el.style.top = `${String(y)}px`;
  ebene.append(el);
  return el;
}

export interface Spielflaeche {
  /** Laufende Berührungen abbrechen (z. B. beim Moduswechsel). */
  abbrechen(): void;
  dispose(): void;
}

export function bindeSpielflaeche(o: SpielflaechenOptionen): Spielflaeche {
  const weg: Aufraeumen[] = [];
  const finger = new Map<number, Finger>();
  let stick: Finger | null = null;
  let stickWertAktuell = { vorwaerts: 0, seitwaerts: 0 };
  let raf = 0;

  const frame = (): void => {
    if (!stick) {
      raf = 0;
      return;
    }
    o.emit({ art: 'bewegen', ...stickWertAktuell });
    raf = requestAnimationFrame(frame);
  };

  const tippRing = (x: number, y: number): void => {
    const el = feedbackEl(o.ebene, 'hud-tipp', x, y);
    window.setTimeout(() => {
      el.remove();
    }, 450);
  };

  const beende = (f: Finger, abgebrochen: boolean): void => {
    window.clearTimeout(f.timer);
    f.ring?.remove();
    f.el.remove();
    finger.delete(f.id);
    if (f === stick) {
      stick = null;
      stickWertAktuell = { vorwaerts: 0, seitwaerts: 0 };
      o.emit({ art: 'bewegen', vorwaerts: 0, seitwaerts: 0 });
    }
    if (abgebrochen || f.bewegt || f.gehalten) return;
    tippRing(f.x, f.y);
    if (f.rolle === 'tippen') o.emit(o.werkbankTippen(f.x, f.y));
    else o.emit({ art: 'tippen', xCss: f.x, yCss: f.y });
  };

  an(o.flaeche, 'pointerdown', (e) => {
    e.preventDefault();
    const modus = o.modus();
    if (modus === 'aus') return;
    const zone = zoneFuer(e.clientX, window.innerWidth, o.safeArea(), o.randPt ?? RANDZONE_PT);
    if (zone === 'rand') return; // gehört Safaris Wischgesten
    let rolle: Finger['rolle'];
    if (modus === 'werkbank') rolle = 'tippen';
    else if (zone === 'links') {
      if (stick) return;
      rolle = 'stick';
    } else {
      if ([...finger.values()].some((f) => f.rolle === 'schauen')) return; // ein Umschau-Finger genügt
      rolle = 'schauen';
    }
    fangen(o.flaeche, e.pointerId);
    const x = e.clientX;
    const y = e.clientY;
    const f: Finger = {
      id: e.pointerId,
      rolle,
      x0: x,
      y0: y,
      x,
      y,
      bewegt: false,
      gehalten: false,
      el: feedbackEl(o.ebene, rolle === 'stick' ? 'hud-stick' : 'hud-finger', x, y),
      knopf: null,
      ring: null,
      timer: 0,
    };
    if (rolle === 'stick') {
      f.knopf = document.createElement('div');
      f.knopf.className = 'hud-stick-knopf';
      f.el.append(f.knopf);
      stick = f;
      stickWertAktuell = { vorwaerts: 0, seitwaerts: 0 };
      if (!raf) raf = requestAnimationFrame(frame);
    }
    if (rolle === 'schauen') {
      // Halte-Ring füllt sich ab dem ersten Frame (CSS-Animation 300 ms) → Halten ist sichtbar.
      f.ring = feedbackEl(o.ebene, 'hud-haltering', x, y);
      f.timer = window.setTimeout(() => {
        if (f.bewegt || !finger.has(f.id)) return;
        f.gehalten = true;
        f.ring?.classList.add('fertig');
        o.emit({ art: 'halten', xCss: f.x, yCss: f.y });
      }, HALTEN_MS);
    }
    finger.set(f.id, f);
    if (rolle !== 'tippen') o.beiBeruehrung?.(rolle === 'stick' ? 'links' : 'rechts');
  }, weg);

  an(o.flaeche, 'pointermove', (e) => {
    const f = finger.get(e.pointerId);
    if (!f) return;
    const dx = e.clientX - f.x;
    const dy = e.clientY - f.y;
    f.x = e.clientX;
    f.y = e.clientY;
    const warBewegt = f.bewegt;
    if (!f.bewegt && !istOhneBewegung(f.x - f.x0, f.y - f.y0)) {
      f.bewegt = true;
      window.clearTimeout(f.timer);
      f.ring?.remove();
      f.ring = null;
    }
    if (f.rolle === 'stick' && f.knopf) {
      const s = stickWert(f.x - f.x0, f.y - f.y0);
      stickWertAktuell = { vorwaerts: s.vorwaerts, seitwaerts: s.seitwaerts };
      f.knopf.style.transform = `translate(${String(s.knopfX)}px, ${String(s.knopfY)}px)`;
      return;
    }
    if (f.rolle === 'schauen') {
      f.el.style.left = `${String(f.x)}px`;
      f.el.style.top = `${String(f.y)}px`;
      // Auch nach einem Halten darf weiter umgeschaut werden (stillhalten, dann ziehen ist normal).
      if (!f.bewegt) return;
      // Beim ersten Überschreiten der Toleranz den ganzen Weg seit dem Aufsetzen melden.
      if (!warBewegt) o.emit({ art: 'umschauen', dxPx: f.x - f.x0, dyPx: f.y - f.y0 });
      else o.emit({ art: 'umschauen', dxPx: dx, dyPx: dy });
    }
  }, weg);

  const hoch = (e: PointerEvent): void => {
    const f = finger.get(e.pointerId);
    if (f) beende(f, e.type === 'pointercancel');
  };
  an(o.flaeche, 'pointerup', hoch, weg);
  an(o.flaeche, 'pointercancel', hoch, weg);

  const abbrechen = (): void => {
    for (const f of [...finger.values()]) beende(f, true);
  };
  return {
    abbrechen,
    dispose: () => {
      abbrechen();
      cancelAnimationFrame(raf);
      for (const w of weg) w();
    },
  };
}

// ---------------------------------------------------------------------------
// Ziehen mit einem Finger (Massband-Griff, Blatt ansetzen, Sägespur)

export interface ZiehHandler {
  start(e: PointerEvent): void;
  bewege(e: PointerEvent): void;
  ende(e: PointerEvent, abgebrochen: boolean): void;
}

export function bindeZiehen(el: HTMLElement, h: ZiehHandler): Aufraeumen {
  const weg: Aufraeumen[] = [];
  let aktiv: number | null = null;
  an(el, 'pointerdown', (e) => {
    e.preventDefault();
    if (aktiv !== null) return;
    aktiv = e.pointerId;
    fangen(el, e.pointerId);
    el.classList.add('aktiv');
    h.start(e);
  }, weg);
  an(el, 'pointermove', (e) => {
    if (e.pointerId === aktiv) h.bewege(e);
  }, weg);
  const ende = (e: PointerEvent): void => {
    if (e.pointerId !== aktiv) return;
    aktiv = null;
    el.classList.remove('aktiv');
    h.ende(e, e.type === 'pointercancel');
  };
  an(el, 'pointerup', ende, weg);
  an(el, 'pointercancel', ende, weg);
  return () => {
    for (const w of weg) w();
  };
}

/** Taste, die nur wirkt, solange sie gehalten wird (z. B. „Abfall stützen“, linker Daumen). */
export interface Haltetaste {
  /** Halten von aussen beenden (z. B. Moduswechsel); meldet `false`, falls gehalten wurde. */
  loesen(): void;
  dispose(): void;
}

export function bindeHaltetaste(el: HTMLElement, beiWechsel: (an: boolean) => void): Haltetaste {
  const weg: Aufraeumen[] = [];
  const aktiv = new Set<number>();
  an(el, 'pointerdown', (e) => {
    e.preventDefault();
    fangen(el, e.pointerId);
    aktiv.add(e.pointerId);
    if (aktiv.size === 1) {
      el.classList.add('gehalten');
      el.setAttribute('aria-pressed', 'true');
      beiWechsel(true);
    }
  }, weg);
  const los = (e: PointerEvent): void => {
    if (!aktiv.delete(e.pointerId) || aktiv.size > 0) return;
    el.classList.remove('gehalten');
    el.setAttribute('aria-pressed', 'false');
    beiWechsel(false);
  };
  an(el, 'pointerup', los, weg);
  an(el, 'pointercancel', los, weg);
  return {
    loesen: () => {
      if (aktiv.size === 0) return;
      aktiv.clear();
      el.classList.remove('gehalten');
      el.setAttribute('aria-pressed', 'false');
      beiWechsel(false);
    },
    dispose: () => {
      for (const w of weg) w();
    },
  };
}

/** Taste mit Sofortauslösung beim Aufsetzen und Wiederholung beim Halten (Feintasten ±0,5 mm). */
export function bindeWiederholtaste(el: HTMLElement, ausloesen: () => void, verzoegerungMs = 450, intervallMs = 100): Aufraeumen {
  const weg: Aufraeumen[] = [];
  let timer = 0;
  let aktiv: number | null = null;
  const stopp = (): void => {
    window.clearTimeout(timer);
    aktiv = null;
  };
  const wiederhole = (): void => {
    ausloesen();
    timer = window.setTimeout(wiederhole, intervallMs);
  };
  an(el, 'pointerdown', (e) => {
    e.preventDefault();
    if (aktiv !== null) return;
    aktiv = e.pointerId;
    fangen(el, e.pointerId);
    ausloesen();
    timer = window.setTimeout(wiederhole, verzoegerungMs);
  }, weg);
  const los = (e: PointerEvent): void => {
    if (e.pointerId === aktiv) stopp();
  };
  an(el, 'pointerup', los, weg);
  an(el, 'pointercancel', los, weg);
  // Tastatur/Bedienhilfen: click ohne vorheriges pointerdown (detail 0)
  const klick = (e: MouseEvent): void => {
    if (e.detail === 0) ausloesen();
  };
  el.addEventListener('click', klick);
  weg.push(() => {
    el.removeEventListener('click', klick);
    stopp();
  });
  return () => {
    for (const w of weg) w();
  };
}
