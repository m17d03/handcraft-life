// Werkzeugtexturen: Sägeblatt (Zahnung als Alpha), Massband-Skala, Atlanten für Gehäuse und Bleistift.
import { erzeugeRauschen, glatt, hash01, klemmen } from '../lib/rauschen.mjs';
import { hex, jedesPixel, kanaele, mischFarbe, setzeFarbe } from '../lib/bild.mjs';

// ---------------------------------------------------------------------------------------------
// Sägeblatt
// ---------------------------------------------------------------------------------------------

/** Masse des Fuchsschwanz-Blatts in mm (auch von modelle/saege.mjs genutzt). */
export const BLATT = {
  laenge: 595, // davon ~550 mm frei sichtbar vor dem Griff
  hoeheFerse: 118,
  hoeheSpitze: 62,
  teilung: 3.6, // ≈ 7 Zähne pro Zoll
  zahnHoehe: 3.1, // 60°-Zahn
  streifen: 6, // Höhe des Zahnstreifens in mm (eigener, dichter Texturbereich)
  streifenV: 0.75, // Texturbereich: v ∈ [0, 0.75] Blatt, v ∈ [0.75, 1] Zahnstreifen (v = 1 Zahnspitzen)
};

/**
 * Blatt-Albedo mit Alpha (Zahnung). U = entlang des Blatts (0 = Ferse im Griff, 1 = Spitze),
 * V: 0 = Rücken bei der Ferse … 0.75 = Oberkante Zahnstreifen … 1 = Zahnspitzen.
 */
export function saegeblatt(W, H, seed) {
  const k = kanaele(W, H);
  const r = erzeugeRauschen(seed);
  const stahl = hex('#B9C0C4');
  const stahlDunkel = hex('#9AA3A8');
  const gehaertet = hex('#4F5862');
  const blank = hex('#D4D9DC');
  const { laenge, teilung, zahnHoehe, streifen, streifenV } = BLATT;
  const pxProMmU = W / laenge;
  jedesPixel(k, (x, y, i, u, v) => {
    const a = u * laenge; // mm ab Ferse
    const gebuerstet = r.fbm(u, v, 6, 3, 2) * 0.4 + r.fbm(u, v, 3, 220, 2) * 0.6;
    if (v < streifenV) {
      const t = v / streifenV; // 0 Rücken, 1 Streifenkante
      let c = mischFarbe(stahl, stahlDunkel, 0.25 + gebuerstet * 0.35 + (1 - t) * 0.1);
      // Härtezone reicht ~1 mm über den Streifen hinaus
      c = mischFarbe(c, gehaertet, glatt(0.97, 1, t) * 0.35);
      setzeFarbe(k, i, c);
      k.rauheit[i] = klemmen(0.4 + gebuerstet * 0.08);
      k.metall[i] = 1;
      return;
    }
    const h = (1 - (v - streifenV) / (1 - streifenV)) * streifen; // mm über Zahnspitze
    const zahn = Math.floor(a / teilung);
    const phase = a / teilung - zahn; // 0..1
    const halb = Math.min(1, h / zahnHoehe) * (teilung / 2);
    const abstand = halb - Math.abs(phase - 0.5) * teilung; // >0 innen, mm
    k.alpha[i] = h >= zahnHoehe ? 1 : klemmen(0.5 + abstand * pxProMmU * 0.9);
    // Geschränkte Zähne: wechselseitig angeschliffene Fase, blank und glatter
    const links = zahn % 2 === 0;
    const kanteAbstand = Math.max(0, abstand);
    const fase = (1 - glatt(0.15, 0.7, kanteAbstand)) * (h < zahnHoehe ? 1 : 0) * ((phase < 0.5) === links ? 1 : 0.35);
    let c = mischFarbe(stahlDunkel, gehaertet, 0.75 + 0.1 * hash01(zahn, seed));
    c = mischFarbe(c, blank, fase * 0.8);
    setzeFarbe(k, i, c);
    k.rauheit[i] = klemmen(0.42 - fase * 0.2 + gebuerstet * 0.05);
    k.metall[i] = 1;
  });
  return { k };
}

// ---------------------------------------------------------------------------------------------
// Massband
// ---------------------------------------------------------------------------------------------

// Ziffern als Strichzüge in einer Box 1 × 1.6 (x rechts, y unten).
const ellipse = (cx, cy, rx, ry, n = 20) => Array.from({ length: n + 1 }, (_, j) => [cx + rx * Math.cos((j / n) * Math.PI * 2), cy + ry * Math.sin((j / n) * Math.PI * 2)]);
const sechs = [[0.85, 0.12], [0.55, 0], [0.25, 0.12], [0.08, 0.55], [0.06, 1.1], [0.2, 1.48], [0.5, 1.6], [0.8, 1.48], [0.94, 1.12], [0.82, 0.8], [0.5, 0.7], [0.2, 0.8], [0.07, 1.05]];
const ZIFFERN = {
  1: [[[0.25, 0.35], [0.6, 0], [0.6, 1.6]]],
  2: [[[0.08, 0.38], [0.18, 0.1], [0.45, 0], [0.75, 0.06], [0.9, 0.32], [0.84, 0.62], [0.06, 1.6], [0.95, 1.6]]],
  3: [
    [[0.1, 0.12], [0.42, 0], [0.78, 0.1], [0.88, 0.36], [0.72, 0.64], [0.4, 0.74]],
    [[0.4, 0.74], [0.78, 0.84], [0.94, 1.14], [0.84, 1.46], [0.5, 1.6], [0.08, 1.48]],
  ],
  4: [[[0.72, 1.6], [0.72, 0], [0.02, 1.1], [0.98, 1.1]]],
  5: [[[0.9, 0], [0.18, 0], [0.12, 0.72], [0.45, 0.62], [0.8, 0.72], [0.95, 1.08], [0.85, 1.46], [0.5, 1.6], [0.08, 1.5]]],
  6: [sechs],
  7: [[[0.02, 0], [0.98, 0], [0.35, 1.6]]],
  8: [ellipse(0.5, 0.4, 0.36, 0.38), ellipse(0.5, 1.17, 0.44, 0.43)],
  9: [sechs.map(([px, py]) => [1 - px, 1.6 - py])],
};

function segAbstand(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = klemmen(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

/** Abstand eines Punkts (in Ziffern-Einheiten) zur Ziffer. */
function zifferAbstand(z, px, py) {
  let d = Infinity;
  for (const zug of ZIFFERN[z]) {
    for (let j = 0; j + 1 < zug.length; j++) d = Math.min(d, segAbstand(px, py, zug[j][0], zug[j][1], zug[j + 1][0], zug[j + 1][1]));
  }
  return d;
}

export const BAND = {
  kachelMm: 100, // eine Texturkachel entlang U = 100 mm
  breiteMm: 19,
  vorderV: 0.8, // v ∈ [0, 0.8] Skalenseite, v ∈ [0.84, 1] Rückseite
  rueckV: 0.9,
};

/**
 * Massband-Skala, Kachel 0–100 mm (u = 0 am Haken bzw. bei jedem vollen Dezimeter).
 * mm-Striche, 5-mm- und cm-Striche, Ziffern 1–9 je cm, roter Dezimeter-Strich mit Marke.
 * Kachelt entlang U (REPEAT); V wird geklemmt.
 */
export function bandSkala(W, H, seed) {
  const k = kanaele(W, H);
  const r = erzeugeRauschen(seed);
  const gelb = hex('#E8C23F');
  const rueck = hex('#CDB26A');
  const schwarz = hex('#1C1A17');
  const rot = hex('#B8322A');
  const { kachelMm, breiteMm, vorderV } = BAND;
  const pxProMm = W / kachelMm;
  const pxProMmV = (H * vorderV) / breiteMm;
  const zifferH = 5.6; // mm
  const einheit = zifferH / 1.6;
  const strich = 0.17; // Strichstärke in Ziffern-Einheiten
  jedesPixel(k, (x, y, i, u, v) => {
    const ok = r.fbm(u, v, 8, 2, 2) * 0.03;
    if (v >= vorderV) {
      setzeFarbe(k, i, v < 0.84 ? hex('#8A7A50') : rueck.map((c) => c * (1 + ok)));
      k.rauheit[i] = 0.5;
      return;
    }
    const a = u * kachelMm; // mm entlang
    const q = (v / vorderV) * breiteMm; // mm quer, 0 = obere Kante
    let tinte = 0;
    let roteTinte = 0;
    // Striche: Länge abhängig von mm / 5 mm / cm
    const mm = Math.round(a);
    const dx = Math.abs(a - mm); // mm
    const breite = mm % 10 === 0 ? 0.32 : mm % 5 === 0 ? 0.26 : 0.2;
    const laenge = mm % 10 === 0 ? 6.2 : mm % 5 === 0 ? 4.4 : 2.8;
    const aufStrich = klemmen(0.5 + (breite / 2 - dx) * pxProMm) * klemmen(0.5 + (laenge - q) * pxProMmV);
    // kurze mm-Striche auch an der unteren Kante
    const untenLaenge = mm % 10 === 0 ? 3.2 : mm % 5 === 0 ? 2.2 : 1.4;
    const aufUnten = klemmen(0.5 + (breite / 2 - dx) * pxProMm) * klemmen(0.5 + (q - (breiteMm - untenLaenge)) * pxProMmV);
    if (mm % 100 === 0) roteTinte = Math.max(aufStrich, aufUnten);
    else tinte = Math.max(aufStrich, aufUnten);
    // Ziffern 1–9 mittig unter dem cm-Strich
    const cm = Math.round(a / 10);
    const z = ((cm % 10) + 10) % 10;
    if (z !== 0) {
      const px = (a - cm * 10) / einheit + 0.5;
      const py = (q - 7.2) / einheit;
      if (px > -0.3 && px < 1.3 && py > -0.3 && py < 1.9) {
        const d = (zifferAbstand(z, px, py) - strich / 2) * einheit; // mm
        tinte = Math.max(tinte, klemmen(0.5 - d * pxProMm * 0.9));
      }
    } else {
      // Dezimeter-Marke: rotes Dreieck unter dem Strich
      const ax = Math.abs(a - cm * 10);
      const qy = q - 7.2;
      if (qy > 0 && qy < 4.5) roteTinte = Math.max(roteTinte, klemmen(0.5 + (qy * 0.45 - ax) * pxProMm));
    }
    let c = gelb.map((ch) => ch * (1 + ok));
    c = mischFarbe(c, schwarz, tinte);
    c = mischFarbe(c, rot, roteTinte);
    setzeFarbe(k, i, c);
    k.rauheit[i] = klemmen(0.38 + tinte * 0.1);
  });
  return { k };
}

/**
 * Gehäuse-Atlas 512² in 4 Feldern: A Kunststoff tannengrün, B Gummi, C Stahl, D Bernstein-Taste.
 * Feldgrenzen bei u, v = 0.5.
 */
export const GEHAEUSE_FELD = { kunststoff: [0, 0], gummi: [0.5, 0], stahl: [0, 0.5], taste: [0.5, 0.5] };
export function gehaeuseAtlas(N, seed) {
  const k = kanaele(N, N);
  const r = erzeugeRauschen(seed);
  jedesPixel(k, (x, y, i, u, v) => {
    const n = r.fbm(u, v, 32, 32, 3);
    const fein = hash01(i, seed) - 0.5;
    if (u < 0.5 && v < 0.5) {
      setzeFarbe(k, i, hex('#2F5A4A').map((c) => c * (1 + n * 0.05 + fein * 0.02)));
      k.rauheit[i] = klemmen(0.42 + n * 0.05);
      k.hoehe[i] = fein * 0.004;
    } else if (v < 0.5) {
      setzeFarbe(k, i, hex('#2A2623').map((c) => c * (1 + n * 0.08 + fein * 0.06)));
      k.rauheit[i] = klemmen(0.86 + fein * 0.08);
      k.hoehe[i] = fein * 0.03;
    } else if (u < 0.5) {
      const b = r.fbm(u, v, 4, 120, 2);
      setzeFarbe(k, i, hex('#C6CBCE').map((c) => c * (1 + b * 0.04)));
      k.rauheit[i] = klemmen(0.3 + b * 0.06);
      k.metall[i] = 1;
    } else {
      setzeFarbe(k, i, hex('#D9A35B').map((c) => c * (1 + n * 0.04)));
      k.rauheit[i] = 0.4;
    }
  });
  return { k };
}

/**
 * Bleistift-Atlas 256²: v < 0.5 Übergangsstreifen (u < 0.5 Zedernholz, u ≥ 0.5 Lack tannengrün),
 * 0.5–0.75 Graphit, 0.75–1 Tauchkappe cremeweiss.
 */
export function bleistiftAtlas(N, seed) {
  const k = kanaele(N, N);
  const r = erzeugeRauschen(seed);
  jedesPixel(k, (x, y, i, u, v) => {
    const n = r.fbm(u, v, 8, 8, 3);
    if (v < 0.5) {
      if (u < 0.5) {
        const faser = r.fbm(u, v, 40, 4, 2);
        setzeFarbe(k, i, hex('#D9A877').map((c) => c * (1 + faser * 0.08)));
        k.rauheit[i] = 0.78;
      } else {
        setzeFarbe(k, i, hex('#2F5A4A').map((c) => c * (1 + n * 0.03)));
        k.rauheit[i] = 0.3;
      }
    } else if (v < 0.75) {
      setzeFarbe(k, i, hex('#3A3A3E').map((c) => c * (1 + n * 0.05)));
      k.rauheit[i] = 0.42;
      k.metall[i] = 0.3;
    } else {
      setzeFarbe(k, i, hex('#ECE2CC'));
      k.rauheit[i] = 0.32;
    }
  });
  return { k };
}
