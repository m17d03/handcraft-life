// HUD-Testseite (Ticket 011): bedienbares HUD mit Fake-Werten, ohne 3D und ohne Spiellogik.
// Die „Regeln“ hier sind Attrappen, nur damit sich der Ablauf durchklicken lässt.
// ?notch=1 simuliert Safe Areas, ?log=1 zeigt die letzten Befehle, ?debug=1 das Debug-Overlay.

import { isDebugEnabled } from '../debug/fps';
import { installDebugOverlay } from '../debug/overlay';
import type { Befehl } from '../input/befehle';
import { erstelleHud } from '../ui/hud';
import type { DemoZustand } from './demo-api';

const params = new URLSearchParams(window.location.search);
if (isDebugEnabled(window.location.search)) installDebugOverlay();

const SOLL = 450;
const ZUEGE = 8;
const z: DemoZustand = {
  geld: 40,
  mm: 0,
  markeMm: null,
  versatzMm: 0,
  zug: 0,
  stuetzen: false,
  blick: { x: 0, y: 0 },
  gang: { x: 0, z: 0 },
};
const befehle: Befehl[] = [];
let letzterPreis = 0;

const szene = document.querySelector<HTMLElement>('#szene');
const brett = document.querySelector<HTMLElement>('#brett');
const log = document.querySelector<HTMLElement>('#log');
if (!szene || !brett || !log) throw new Error('HUD-Demo: Grundgerüst fehlt');
if (params.has('log')) log.hidden = false;

let hinweisTimer = 0;
const kurzHinweis = (text: string, ms = 1400): void => {
  hud.hinweis(text);
  window.clearTimeout(hinweisTimer);
  hinweisTimer = window.setTimeout(() => {
    hud.hinweis(null);
  }, ms);
};

const runde = (v: number, r: number): number => Math.round(v / r) * r;
const mmText = (v: number): string => `${v.toFixed(1).replace('.', ',')} mm`;

function szeneZeichnen(): void {
  if (!szene) return;
  szene.style.backgroundPosition = `${String(-z.blick.x - z.gang.x)}px ${String(-z.blick.y * 0.5)}px`;
}

function messen(): void {
  hud.modus('werkbank-messen');
  hud.messwertAnzeigen(z.mm);
  hud.hinweis(`Massband-Griff ziehen, mit ±0,5 fein einstellen. Ziel ${String(SOLL)} mm`);
  if (brett) brett.hidden = false;
}

function auswerten(): void {
  const istMm = (z.markeMm ?? 0) + z.versatzMm - 0.8;
  const dl = Math.abs(istMm - SOLL);
  const q = Math.max(0, Math.round(100 - dl * 9 - (z.stuetzen ? 0 : 5)));
  const [stufe, faktor] =
    q >= 90 ? ['A – Meisterhaft', 1.3] : q >= 75 ? ['B – Sauber', 1] : q >= 55 ? ['C – Brauchbar', 0.7] : q >= 35 ? ['D – Mangelhaft', 0.4] : ['Ausschuss', 0];
  letzterPreis = Math.round(14 * faktor);
  hud.modus('ergebnis');
  hud.ergebnisKarte({
    stufe,
    q,
    hauptursache: dl <= 0.5 ? 'Länge sitzt (Demo-Werte).' : `Länge ${mmText(istMm)} statt ${String(SOLL)} mm (Demo-Werte).`,
    preis: letzterPreis,
  });
  hud.hinweis(null);
}

function befehl(b: Befehl): void {
  befehle.push(b);
  if (befehle.length > 500) befehle.shift();
  if (log && !log.hidden && b.art !== 'bewegen') {
    log.textContent = [JSON.stringify(b), ...log.textContent.split('\n')].slice(0, 6).join('\n');
  }
  switch (b.art) {
    case 'bewegen':
      z.gang.x += b.seitwaerts * 4;
      z.gang.z += b.vorwaerts * 4;
      szeneZeichnen();
      break;
    case 'umschauen':
      z.blick.x += b.dxPx;
      z.blick.y = Math.max(-80, Math.min(80, z.blick.y + b.dyPx));
      szeneZeichnen();
      break;
    case 'tippen':
      kurzHinweis(`Getippt bei ${String(Math.round(b.xCss))} / ${String(Math.round(b.yCss))}`);
      break;
    case 'halten':
      kurzHinweis('Gehalten: hier käme das Kontextmenü');
      break;
    case 'massband':
      z.mm = Math.max(0, Math.min(1000, runde(z.mm + b.deltaMm, 0.5)));
      hud.messwertAnzeigen(z.mm);
      if (z.mm === SOLL) kurzHinweis('✓ passt – jetzt anreissen');
      break;
    case 'massbandSetzen': {
      const w = window.innerWidth;
      z.mm = Math.max(0, Math.min(1000, runde(((b.xCss - w * 0.1) / (w * 0.8)) * 1000, 0.5)));
      hud.messwertAnzeigen(z.mm);
      break;
    }
    case 'blattVersatz':
      z.versatzMm = runde(z.versatzMm + b.deltaMm, 0.1);
      break;
    case 'sägezug': {
      z.zug += 1;
      const tempoOk = b.tempo <= 1.5;
      hud.saegeFortschritt(z.zug, ZUEGE, tempoOk);
      if (z.zug >= ZUEGE) auswerten();
      break;
    }
    case 'stuetzen':
      z.stuetzen = b.an;
      break;
    case 'aktion':
      aktion(b.id);
      break;
  }
}

function aktion(id: string): void {
  switch (id) {
    case 'werkbank':
      z.mm = 0;
      messen();
      break;
    case 'zurueck':
      hud.modus('erkunden');
      hud.hinweis(null);
      if (brett) brett.hidden = true;
      break;
    case 'anreissen':
      z.markeMm = z.mm;
      z.versatzMm = 0;
      hud.modus('werkbank-ansetzen');
      hud.hinweis(`Angerissen bei ${mmText(z.mm)} – Blatt an die Abfallseite setzen`);
      break;
    case 'weiter':
      z.zug = 0;
      hud.modus('werkbank-saegen');
      hud.saegeFortschritt(0, ZUEGE, true);
      hud.hinweis('Rechts auf der Spur auf und ab wischen, links „Abfall stützen“ halten');
      break;
    case 'abliefern': {
      z.geld += letzterPreis;
      hud.geldAnzeigen(z.geld);
      hud.ergebnisKarte(null);
      hud.modus('erkunden');
      if (brett) brett.hidden = true;
      kurzHinweis('Abgeliefert');
      break;
    }
    case 'neuesBrett':
      hud.ergebnisKarte(null);
      z.mm = 0;
      messen();
      break;
  }
}

const hud = erstelleHud(document.body, { emit: befehl, canvas: szene, safeAreaSimulieren: params.has('notch') });
hud.geldAnzeigen(z.geld);
hud.auftragAnzeigen(`Auftrag: Regalbrett ${String(SOLL)} mm · Lohn 14 G`);
hud.aktionstaste({ id: 'werkbank', text: 'Werkbank benutzen' });
window.__hudDemo = { befehle, hud, zustand: () => ({ ...z }) };
document.body.dataset['state'] = 'ready';
