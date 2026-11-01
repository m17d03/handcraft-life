// HUD (Ticket 011): DOM-Oberfläche über dem Canvas, Steuerungskonzept B (ADR 0004, Querformat).
// Zeigt nur an, was das Spiel ihm sagt, und meldet Gesten als abstrakte Befehle (src/input/befehle.ts).
// Kein three, keine Spiellogik.

import './hud.css';
import { AKTIONEN, type Befehl, type BefehlsEmpfaenger } from '../input/befehle';
import type { BildschirmPos, ErgebnisDaten, Hud, HudModus } from './hud-typen';
import {
  BLATT_RASTER_MM,
  BLATT_VERSATZ_MAX_MM,
  MASSBAND_RASTER_MM,
  KEINE_SAFE_AREA,
  aufRaster,
  begrenze,
  rasterDelta,
  type SafeArea,
} from '../input/gesten';
import { SAEGEZUG_STANDARD, saegezugEnde, saegezugSchritt, saegezugStart, SAEGEZUG_LEER, type SaegePunkt, type SaegezugOptionen } from '../input/saegezug';
import {
  bindeHaltetaste,
  bindeSpielflaeche,
  bindeWiederholtaste,
  bindeZiehen,
  sperreBrowserGesten,
  type Bindung,
  type FlaechenModus,
} from '../input/touch-eingabe';

export type { BildschirmPos, ErgebnisDaten, Hud, HudModus } from './hud-typen';

export interface HudOptionen {
  emit: BefehlsEmpfaenger;
  /** Canvas der 3D-Szene: bekommt touch-action:none / user-select:none (U6). */
  canvas?: HTMLElement;
  /** Desktop-Test: Safe Areas eines iPhone 15 quer simulieren (Notch 59 pt, Home-Leiste 21 pt). */
  safeAreaSimulieren?: boolean;
  waehrung?: string;
}

const LUPE_PX_PRO_MM = 8;
const LUPE_DURCHMESSER = 132;
const BLATT_PX_PRO_MM = 20; // Ansetzen: 1 mm = 20 pt in der Vergrösserung
const FUGE_MM = 1.6;
const STANDARD_PX_PRO_MM = 0.62; // 1000 mm über ~620 pt (Steuerung §4)

const zahl = (v: number, nachkomma = 1): string => v.toFixed(nachkomma).replace('.', ',');
const vorzeichen = (v: number): string => (v > 0 ? '+' : v < 0 ? '−' : '±') + zahl(Math.abs(v));

const HTML = `
<div class="hud-flaeche" data-touch="spielflaeche"></div>
<div class="hud-feedback"></div>
<div class="hud-fadenkreuz" data-nur="erkunden"></div>
<div class="hud-zonenhinweis links" data-nur="erkunden">Links ziehen: gehen</div>
<div class="hud-zonenhinweis rechts" data-nur="erkunden">Rechts ziehen: umsehen</div>

<div class="hud-oben">
  <div class="hud-oben-links">
    <button type="button" class="hud-zurueck" data-nur="werkbank-messen werkbank-ansetzen werkbank-saegen" data-aktion="${AKTIONEN.zurueck}">‹ Zurück</button>
  </div>
  <div class="hud-oben-mitte">
    <div class="hud-schritte" data-nur="werkbank-messen werkbank-ansetzen werkbank-saegen ergebnis">
      <span data-schritt="werkbank-messen">1 Messen</span><span data-schritt="werkbank-ansetzen">2 Ansetzen</span><span data-schritt="werkbank-saegen">3 Sägen</span>
    </div>
    <div class="hud-auftrag" hidden></div>
  </div>
  <div class="hud-oben-rechts"><div class="hud-geld" aria-label="Geld" hidden></div></div>
</div>
<div class="hud-hinweis" role="status" aria-live="polite" hidden></div>

<button type="button" class="hud-aktionstaste" data-nur="erkunden" hidden></button>

<div class="hud-massband-griff" data-nur="werkbank-messen" data-touch="massband" role="slider" aria-label="Massband ziehen"><span>⇆</span></div>
<div class="hud-lupe" aria-hidden="true"><div class="hud-lupe-skala"></div><div class="hud-lupe-zahlen"></div><div class="hud-lupe-nadel"></div><div class="hud-lupe-wert"></div></div>
<div class="hud-messwert" data-nur="werkbank-messen werkbank-ansetzen" hidden></div>

<div class="hud-leiste links" data-nur="werkbank-messen">
  <button type="button" class="hud-fein" data-fein="-0.5" aria-label="0,5 mm kürzer">−0,5</button>
  <button type="button" class="hud-fein" data-fein="0.5" aria-label="0,5 mm länger">+0,5</button>
</div>
<div class="hud-leiste rechts" data-nur="werkbank-messen">
  <button type="button" class="hud-primaer hud-anreissen" data-aktion="${AKTIONEN.anreissen}">✎ Anreissen</button>
</div>

<div class="hud-ansetzen" data-nur="werkbank-ansetzen" data-touch="blatt" aria-label="Blatt seitlich ziehen">
  <span class="seite links">Werkstück</span><span class="seite rechts">Abfall</span>
  <div class="hud-strich"></div>
  <div class="hud-blatt"><div class="hud-fuge"></div></div>
  <div class="hud-ansetzen-text">↔ Blatt seitlich ziehen</div>
</div>
<div class="hud-leiste rechts" data-nur="werkbank-ansetzen">
  <button type="button" class="hud-primaer" data-aktion="${AKTIONEN.weiter}">Sägen ›</button>
</div>

<div class="hud-saegespur" data-nur="werkbank-saegen" data-touch="saegespur" aria-label="Führungsspur: auf und ab wischen">
  <div class="hud-spur-mitte"></div>
  <div class="hud-spur-daumen"></div>
  <div class="hud-spur-text">↕ auf und ab wischen = sägen<br>↔ seitlich = gegensteuern</div>
</div>
<button type="button" class="hud-stuetzen" data-nur="werkbank-saegen" aria-pressed="false">Abfall<br>stützen</button>
<div class="hud-saegeanzeige" data-nur="werkbank-saegen">
  <div class="zeile"><span class="hud-zug">Zug 0</span><div class="balken"><i></i></div></div>
  <div class="hud-tempo">Tempo –</div>
</div>

<div class="hud-ergebnis" role="dialog" aria-label="Ergebnis" hidden>
  <div class="hud-stufe"></div>
  <div class="hud-q"></div>
  <p class="hud-ursache"></p>
  <p class="hud-preis"></p>
  <div class="zeile">
    <button type="button" class="hud-primaer hud-abliefern" data-aktion="${AKTIONEN.abliefern}">Abliefern</button>
    <button type="button" data-aktion="${AKTIONEN.neuesBrett}">Neues Brett</button>
  </div>
</div>

<div class="hud-drehen" role="alert">
  <div class="telefon"></div>
  <h2>Bitte quer halten</h2>
  <p>Handcraft Life wird mit beiden Daumen im Querformat gespielt. Ist die Ausrichtungssperre aktiv, bitte im Kontrollzentrum lösen.</p>
</div>`;

function q(root: Element, sel: string): HTMLElement {
  const el = root.querySelector<HTMLElement>(sel);
  if (!el) throw new Error(`HUD: ${sel} fehlt`);
  return el;
}

function qTaste(root: Element, sel: string): HTMLButtonElement {
  const el = root.querySelector<HTMLButtonElement>(sel);
  if (!el) throw new Error(`HUD: ${sel} fehlt`);
  return el;
}

function liesSafeArea(probe: HTMLElement): SafeArea {
  const cs = getComputedStyle(probe);
  const px = (v: string): number => Number.parseFloat(v) || 0;
  return { oben: px(cs.paddingTop), rechts: px(cs.paddingRight), unten: px(cs.paddingBottom), links: px(cs.paddingLeft) };
}

export function erstelleHud(container: HTMLElement, opt: HudOptionen): Hud {
  const waehrung = opt.waehrung ?? 'G';
  const root = document.createElement('div');
  root.className = 'hud';
  if (opt.safeAreaSimulieren) root.classList.add('hud-sim-notch');
  root.innerHTML = HTML;
  container.append(root);
  const aufraeumen: (() => void)[] = [];

  if (opt.canvas) {
    opt.canvas.style.touchAction = 'none';
    opt.canvas.style.userSelect = 'none';
    opt.canvas.style.setProperty('-webkit-user-select', 'none');
    opt.canvas.style.setProperty('-webkit-touch-callout', 'none');
  }
  aufraeumen.push(sperreBrowserGesten());
  /** Alle Gesten-Bindungen, die von aussen abgebrochen werden können (Drehen, App-Wechsel). */
  const bindungen: Bindung[] = [];
  const merke = (b: Bindung): void => {
    bindungen.push(b);
    aufraeumen.push(() => {
      b.dispose();
    });
  };

  const probe = document.createElement('div');
  probe.className = 'hud-safe-probe';
  root.append(probe);
  let safeCache: SafeArea = KEINE_SAFE_AREA;
  const safeArea = (): SafeArea => (safeCache = liesSafeArea(probe));

  // Hochformat: Hinweis deckt alles ab, hinter ihm entstehen keine Befehle (QA B2).
  const hochformat = window.matchMedia('(orientation: portrait)');
  let gesperrt = hochformat.matches;
  const emit = (b: Befehl): void => {
    if (!gesperrt) opt.emit(b);
  };

  // Druck-Feedback für alle HUD-Tasten sofort beim Aufsetzen (U2), nicht erst bei :active/click.
  const druck = (e: Event): void => {
    const t = e.target;
    if (t instanceof Element) t.closest('button')?.classList.add('gedrueckt');
  };
  const los = (): void => {
    for (const b of root.querySelectorAll('button.gedrueckt')) b.classList.remove('gedrueckt');
  };
  root.addEventListener('pointerdown', druck);
  document.addEventListener('pointerup', los);
  document.addEventListener('pointercancel', los);
  aufraeumen.push(() => {
    document.removeEventListener('pointerup', los);
    document.removeEventListener('pointercancel', los);
  });

  // Aktionstasten (click: kommt auf iOS nach touchend, auch per Tastatur/Bedienhilfe)
  root.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const b = t.closest<HTMLButtonElement>('button[data-aktion]');
    if (!b || b.disabled) return;
    const id = b.dataset['aktion'];
    if (id) emit({ art: 'aktion', id });
  });

  let modus: HudModus = 'erkunden';
  let messwert: number | null = null;
  let lupeExtern: BildschirmPos | null = null;
  let lupeTimer = 0;
  let ziehtMassband = false;
  let griffPos: (BildschirmPos & { pxProMm?: number }) | null = null;
  let versatzMm = 0;
  let ergebnis: ErgebnisDaten | null = null;

  // ---------- Spielfläche ----------
  const flaechenModus = (): FlaechenModus =>
    modus === 'erkunden' ? 'erkunden' : modus === 'ergebnis' ? 'aus' : 'werkbank';
  const flaeche = bindeSpielflaeche({
    flaeche: q(root, '.hud-flaeche'),
    ebene: q(root, '.hud-feedback'),
    emit,
    safeArea,
    modus: flaechenModus,
    werkbankTippen: (x, y) =>
      modus === 'werkbank-messen' ? { art: 'massbandSetzen', xCss: x, yCss: y } : { art: 'tippen', xCss: x, yCss: y },
    beiBeruehrung: (zone) => {
      q(root, `.hud-zonenhinweis.${zone}`).classList.add('benutzt');
    },
  });
  aufraeumen.push(() => {
    flaeche.dispose();
  });

  // ---------- Lupe ----------
  const lupeEl = q(root, '.hud-lupe');
  const lupeSkala = q(root, '.hud-lupe-skala');
  const lupeZahlen = q(root, '.hud-lupe-zahlen');
  const lupeWert = q(root, '.hud-lupe-wert');

  const lupeInhalt = (): void => {
    const mm = messwert ?? 0;
    const mitte = LUPE_DURCHMESSER / 2;
    lupeSkala.style.backgroundPositionX = `${String(mitte - mm * LUPE_PX_PRO_MM)}px`;
    const sichtbarMm = mitte / LUPE_PX_PRO_MM;
    let zahlen = '';
    for (let d = Math.ceil((mm - sichtbarMm) / 10) * 10; d <= mm + sichtbarMm; d += 10) {
      if (d < 0) continue;
      zahlen += `<span style="left:${String(mitte + (d - mm) * LUPE_PX_PRO_MM)}px">${String(d)}</span>`;
    }
    lupeZahlen.innerHTML = zahlen;
    lupeWert.textContent = messwert === null ? '' : `${zahl(mm)} mm`;
  };

  const lupeZeigen = (pos: BildschirmPos | null): void => {
    if (!pos) {
      lupeEl.classList.remove('sichtbar');
      return;
    }
    const s = safeCache;
    const r = LUPE_DURCHMESSER / 2;
    // Seitlich neben dem Daumen (links), damit der Finger sie nicht verdeckt; am linken Rand nach rechts.
    let x = pos.xCss - 110;
    if (x - r < s.links + 8) x = pos.xCss + 110;
    const y = begrenze(pos.yCss - 90, s.oben + r + 4, window.innerHeight - s.unten - r - 4);
    lupeEl.style.left = `${String(x)}px`;
    lupeEl.style.top = `${String(y)}px`;
    lupeInhalt();
    lupeEl.classList.add('sichtbar');
  };

  const lupeKurz = (ms = 700): void => {
    const g = griffMitte();
    lupeZeigen(g);
    window.clearTimeout(lupeTimer);
    lupeTimer = window.setTimeout(() => {
      if (!ziehtMassband) lupeZeigen(lupeExtern);
    }, ms);
  };

  // ---------- Massband ----------
  const griff = q(root, '.hud-massband-griff');
  const griffMitte = (): BildschirmPos => {
    const b = griff.getBoundingClientRect();
    return { xCss: b.left + b.width / 2, yCss: b.top + b.height / 2 };
  };
  const griffSetzen = (x: number, y: number): void => {
    griff.style.left = `${String(x)}px`;
    griff.style.top = `${String(y)}px`;
  };
  const griffStandard = (): void => {
    if (griffPos) griffSetzen(griffPos.xCss, griffPos.yCss);
    else griffSetzen(window.innerWidth * 0.3, window.innerHeight * 0.48);
  };
  griffStandard();
  let zieh = { x0: 0, gemeldetMm: 0, griffX0: 0 };
  merke(
    bindeZiehen(griff, {
      start: (e) => {
        ziehtMassband = true;
        zieh = { x0: e.clientX, gemeldetMm: 0, griffX0: griffMitte().xCss };
        lupeZeigen({ xCss: e.clientX, yCss: e.clientY });
      },
      bewege: (e) => {
        const wegPx = e.clientX - zieh.x0;
        const s = safeCache;
        griffSetzen(begrenze(zieh.griffX0 + wegPx, s.links + 28, window.innerWidth - s.rechts - 28), griffMitte().yCss);
        const delta = rasterDelta(wegPx, griffPos?.pxProMm ?? STANDARD_PX_PRO_MM, zieh.gemeldetMm, MASSBAND_RASTER_MM);
        if (delta !== 0) {
          zieh.gemeldetMm = aufRaster(zieh.gemeldetMm + delta, MASSBAND_RASTER_MM);
          emit({ art: 'massband', deltaMm: delta });
        }
        lupeZeigen({ xCss: e.clientX, yCss: e.clientY });
      },
      ende: () => {
        ziehtMassband = false;
        lupeKurz(500);
        if (griffPos) griffSetzen(griffPos.xCss, griffPos.yCss);
      },
    }),
  );
  for (const b of root.querySelectorAll<HTMLButtonElement>('[data-fein]')) {
    const d = Number(b.dataset['fein']);
    merke(
      bindeWiederholtaste(b, () => {
        emit({ art: 'massband', deltaMm: d });
        lupeKurz();
      }),
    );
  }

  // ---------- Blatt ansetzen ----------
  const ansetzen = q(root, '.hud-ansetzen');
  const blatt = q(root, '.hud-blatt');
  q(root, '.hud-fuge').style.width = `${String(FUGE_MM * BLATT_PX_PRO_MM)}px`;
  const versatzZeichnen = (): void => {
    blatt.style.transform = `translateX(${String(versatzMm * BLATT_PX_PRO_MM)}px)`;
    q(root, '.hud-ansetzen-text').textContent = `Versatz ${vorzeichen(versatzMm)} mm · ↔ seitlich ziehen`;
  };
  versatzZeichnen();
  let blattZieh = { x0: 0, start: 0 };
  merke(
    bindeZiehen(ansetzen, {
      start: (e) => {
        blattZieh = { x0: e.clientX, start: versatzMm };
      },
      bewege: (e) => {
        const ziel = begrenze(
          aufRaster(blattZieh.start + (e.clientX - blattZieh.x0) / BLATT_PX_PRO_MM, BLATT_RASTER_MM),
          -BLATT_VERSATZ_MAX_MM,
          BLATT_VERSATZ_MAX_MM,
        );
        const delta = aufRaster(ziel - versatzMm, BLATT_RASTER_MM);
        if (delta === 0) return;
        versatzMm = ziel;
        versatzZeichnen();
        emit({ art: 'blattVersatz', deltaMm: delta });
      },
      ende: () => undefined,
    }),
  );

  // ---------- Sägen ----------
  const spur = q(root, '.hud-saegespur');
  const daumen = q(root, '.hud-spur-daumen');
  let saege = SAEGEZUG_LEER;
  let saegeOpt: SaegezugOptionen = { ...SAEGEZUG_STANDARD, mitteQuer: 0, halbeBreiteQuer: 1 };
  const punkt = (e: PointerEvent): SaegePunkt => ({ laengs: e.clientY, quer: e.clientX, t: e.timeStamp });
  const daumenZeigen = (e: PointerEvent): void => {
    const b = spur.getBoundingClientRect();
    daumen.style.transform = `translate(${String(e.clientX - b.left)}px, ${String(e.clientY - b.top)}px)`;
  };
  const zugGemeldet = (z: { seitenabweichung: number; tempo: number } | null): void => {
    if (!z) return;
    emit({ art: 'sägezug', seitenabweichung: Math.round(z.seitenabweichung * 1000) / 1000, tempo: Math.round(z.tempo * 1000) / 1000 });
    spur.classList.remove('zug');
    spur.getBoundingClientRect(); // Reflow → Animation startet neu
    spur.classList.add('zug');
  };
  merke(
    bindeZiehen(spur, {
      start: (e) => {
        const b = spur.getBoundingClientRect();
        saegeOpt = { ...SAEGEZUG_STANDARD, mitteQuer: b.left + b.width / 2, halbeBreiteQuer: b.width / 2 };
        saege = saegezugStart(punkt(e));
        daumenZeigen(e);
      },
      bewege: (e) => {
        daumenZeigen(e);
        const s = saegezugSchritt(saege, punkt(e), saegeOpt);
        saege = s.zustand;
        zugGemeldet(s.zug);
      },
      ende: (e, abgebrochen) => {
        if (!e) {
          saege = SAEGEZUG_LEER;
          return;
        }
        const s = saegezugEnde(saege, punkt(e), saegeOpt);
        saege = s.zustand;
        if (!abgebrochen) zugGemeldet(s.zug);
      },
    }),
  );
  const stuetzen = q(root, '.hud-stuetzen');
  const stuetzTaste = bindeHaltetaste(stuetzen, (an) => {
    emit({ art: 'stuetzen', an });
  });
  aufraeumen.push(() => {
    stuetzTaste.dispose();
  });

  // ---------- Modus ----------
  const sichtbarkeit = (): void => {
    for (const el of root.querySelectorAll<HTMLElement>('[data-nur]')) {
      const nur = (el.dataset['nur'] ?? '').split(' ');
      el.classList.toggle('aus', !nur.includes(modus));
    }
    for (const s of root.querySelectorAll<HTMLElement>('[data-schritt]')) {
      const reihenfolge = ['werkbank-messen', 'werkbank-ansetzen', 'werkbank-saegen', 'ergebnis'];
      const i = reihenfolge.indexOf(s.dataset['schritt'] ?? '');
      const jetzt = reihenfolge.indexOf(modus);
      s.classList.toggle('jetzt', i === jetzt);
      s.classList.toggle('erledigt', i < jetzt);
    }
    q(root, '.hud-messwert').hidden = messwert === null;
    q(root, '.hud-ergebnis').hidden = ergebnis === null;
  };

  const hud: Hud = {
    element: root,
    modus(m) {
      if (m === modus) return;
      flaeche.abbrechen();
      for (const b of bindungen) b.abbrechen();
      if (m !== 'werkbank-saegen') stuetzTaste.loesen();
      if (m === 'werkbank-ansetzen') {
        versatzMm = 0;
        versatzZeichnen();
      }
      if (m !== 'werkbank-messen') lupeZeigen(null);
      saege = SAEGEZUG_LEER;
      modus = m;
      root.dataset['modus'] = m;
      griffStandard();
      sichtbarkeit();
    },
    auftragAnzeigen(text) {
      const el = q(root, '.hud-auftrag');
      el.hidden = text === null;
      el.textContent = text ?? '';
    },
    messwertAnzeigen(mm) {
      messwert = mm;
      const el = q(root, '.hud-messwert');
      el.textContent = mm === null ? '' : `${zahl(mm)} mm`;
      qTaste(root, '.hud-anreissen').disabled = mm === null;
      if (lupeEl.classList.contains('sichtbar')) lupeInhalt();
      sichtbarkeit();
    },
    lupe(pos) {
      lupeExtern = pos;
      if (!ziehtMassband) lupeZeigen(pos);
    },
    saegeFortschritt(zug, von, tempoOk) {
      q(root, '.hud-zug').textContent = `Zug ${String(zug)} / ${String(von)}`;
      q(root, '.hud-saegeanzeige .balken i').style.width = `${String(von > 0 ? Math.min(100, (zug / von) * 100) : 0)}%`;
      const t = q(root, '.hud-tempo');
      t.textContent = tempoOk ? 'Tempo gut' : 'Zu schnell – langsamer';
      t.classList.toggle('schlecht', !tempoOk);
    },
    ergebnisKarte(d) {
      ergebnis = d;
      if (d) {
        q(root, '.hud-stufe').textContent = d.stufe;
        q(root, '.hud-q').textContent = `Qualität ${String(Math.round(d.q))} / 100`;
        q(root, '.hud-ursache').textContent = d.hauptursache;
        const abliefern = qTaste(root, '.hud-abliefern');
        abliefern.disabled = d.preis <= 0;
        q(root, '.hud-preis').textContent =
          d.preis > 0 ? `Preis ${String(d.preis)} ${waehrung}` : 'Kein Preis – Abliefern nicht möglich';
      }
      sichtbarkeit();
    },
    geldAnzeigen(g) {
      const el = q(root, '.hud-geld');
      el.hidden = false;
      el.textContent = `${String(g)} ${waehrung}`;
    },
    hinweis(text) {
      const el = q(root, '.hud-hinweis');
      el.hidden = text === null;
      el.textContent = text ?? '';
    },
    aktionstaste(taste) {
      const b = qTaste(root, '.hud-aktionstaste');
      b.hidden = taste === null;
      if (taste) {
        b.dataset['aktion'] = taste.id;
        b.textContent = taste.text;
      } else delete b.dataset['aktion'];
      q(root, '.hud-fadenkreuz').classList.toggle('ziel', taste !== null);
    },
    massbandGriff(pos) {
      griffPos = pos;
      if (!ziehtMassband) griffStandard(); // null = Standardplatz (Demo ohne 3D)
    },
    blattVersatzAnzeigen(mm) {
      versatzMm = begrenze(mm, -BLATT_VERSATZ_MAX_MM, BLATT_VERSATZ_MAX_MM);
      versatzZeichnen();
    },
    dispose() {
      window.clearTimeout(lupeTimer);
      for (const a of aufraeumen) a();
      root.remove();
    },
  };

  const beiGroesse = (): void => {
    safeArea();
    if (!ziehtMassband) griffStandard();
  };
  window.addEventListener('resize', beiGroesse);
  aufraeumen.push(() => {
    window.removeEventListener('resize', beiGroesse);
  });

  // Drehen, App-Wechsel, Fokusverlust: laufende Gesten sauber beenden (QA B2). Die Abbruch-Befehle
  // (bewegen 0/0, stuetzen false) gehen noch hinaus, danach sperrt das Hochformat alle Befehle.
  const allesAbbrechen = (): void => {
    flaeche.abbrechen();
    for (const b of bindungen) b.abbrechen();
    stuetzTaste.loesen();
  };
  const beiAusrichtung = (): void => {
    if (hochformat.matches === gesperrt) return;
    if (hochformat.matches) {
      gesperrt = false;
      allesAbbrechen();
      gesperrt = true;
    } else gesperrt = false;
  };
  const beiSichtbarkeit = (): void => {
    if (document.visibilityState === 'hidden') allesAbbrechen();
  };
  hochformat.addEventListener('change', beiAusrichtung);
  window.addEventListener('resize', beiAusrichtung);
  window.addEventListener('blur', allesAbbrechen);
  window.addEventListener('pagehide', allesAbbrechen);
  document.addEventListener('visibilitychange', beiSichtbarkeit);
  aufraeumen.push(() => {
    hochformat.removeEventListener('change', beiAusrichtung);
    window.removeEventListener('resize', beiAusrichtung);
    window.removeEventListener('blur', allesAbbrechen);
    window.removeEventListener('pagehide', allesAbbrechen);
    document.removeEventListener('visibilitychange', beiSichtbarkeit);
  });

  root.dataset['modus'] = modus;
  safeArea();
  sichtbarkeit();
  hud.messwertAnzeigen(null);
  return hud;
}
