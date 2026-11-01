// Prozedurale Holztexturen, kachelbar, Stil A „Honigwerkstatt“.
// Holzarten unterscheiden sich über Helligkeit und Maserung, nicht nur über den Farbton
// (Gegenmittel gegen „alles orange“, siehe docs/art/stil-varianten.md).
import { erzeugeRauschen, frac, glatt, hash01, klemmen } from '../lib/rauschen.mjs';
import { hex, jedesPixel, kanaele, mischFarbe, setzeFarbe } from '../lib/bild.mjs';

/**
 * Jahrring-Profil: t = Position im Ring (0 = Beginn Frühholz, 1 = Ende Spätholz).
 * Frühholz geht allmählich ins Spätholz über und bricht am Ringende scharf ab.
 */
function spaetholz(t, anteil) {
  return glatt(1 - anteil - 0.12, 1 - anteil, t) * (1 - glatt(0.975, 1, t));
}

/**
 * Fichte, Längsholz (Brettfläche). 1 Kachel = 500 × 500 mm, Fasern entlang U.
 * Palette: Fichte hell #E3C08D.
 */
export function fichteLaengs(N, seed) {
  const k = kanaele(N, N);
  const r = erzeugeRauschen(seed);
  const frueh = hex('#E8C899');
  const spaet = hex('#C9965A');
  const ringe = 30;
  jedesPixel(k, (x, y, i, u, v) => {
    const warp = r.fbm(u, v, 2, 3, 4) * 2.2 + r.fbm(u, v, 1, 7, 3) * 0.7 + r.fbm(u, v, 5, 2, 2) * 0.25;
    // ungleich breite Jahrringe: Dichte schwankt periodisch quer zur Faser
    const dichte = Math.sin(2 * Math.PI * v * 2 + 0.7) * 1.6 + Math.sin(2 * Math.PI * v * 5 + 2.1) * 0.5;
    const rr = v * ringe + warp + dichte;
    const id = ((Math.floor(rr) % ringe) + ringe) % ringe;
    const t = frac(rr);
    const anteil = 0.05 + 0.1 * hash01(id, seed);
    const sp = spaetholz(t, anteil);
    const faser = r.fbm(u, v, 4, 420, 3);
    const flecken = r.fbm(u, v, 3, 5, 3);
    let c = mischFarbe(frueh, spaet, sp * (0.75 + 0.2 * hash01(id + 99, seed)));
    const hell = 1 + faser * 0.05 + flecken * 0.05 + (hash01(id + 7, seed) - 0.5) * 0.04;
    c = c.map((ch) => ch * hell);
    setzeFarbe(k, i, c);
    k.hoehe[i] = sp * 0.025 + faser * 0.012;
    k.rauheit[i] = klemmen(0.72 - sp * 0.1 + faser * 0.04);
  });
  return { k, mmProPixel: 500 / N };
}

/**
 * Fichte, Hirnholz (Sägeschnitt quer zur Faser). 1 Kachel = 150 × 150 mm.
 * Dunkler und poriger als Längsholz, Jahrringe als flache Bögen, matter.
 */
export function fichteHirn(N, seed) {
  const k = kanaele(N, N);
  const r = erzeugeRauschen(seed);
  const frueh = hex('#C99D68');
  const spaet = hex('#8F6036');
  const ringe = 40;
  jedesPixel(k, (x, y, i, u, v) => {
    const bogen = Math.cos(2 * Math.PI * u) * 1.6;
    const warp = r.fbm(u, v, 3, 3, 4) * 0.8;
    const rr = v * ringe + bogen + warp;
    const id = ((Math.floor(rr) % ringe) + ringe) % ringe;
    const t = frac(rr);
    const sp = spaetholz(t, 0.16 + 0.14 * hash01(id, seed));
    const zellen = r.fbm(u, v, 160, 160, 2);
    const strahlen = r.fbm(u, v, 220, 6, 2);
    const saege = r.fbm(u, v, 3, 90, 3);
    let c = mischFarbe(frueh, spaet, sp * 0.85);
    const hell = 1 + zellen * 0.09 + strahlen * 0.04 + saege * 0.05;
    c = c.map((ch) => ch * hell);
    setzeFarbe(k, i, c);
    k.hoehe[i] = sp * 0.02 + zellen * 0.012 + saege * 0.04;
    k.rauheit[i] = klemmen(0.86 - sp * 0.06 + zellen * 0.05);
  });
  return { k, mmProPixel: 150 / N };
}

/**
 * Eiche, verleimte Werkbankplatte: 5 Lamellen à 100 mm quer (V), Fasern entlang U.
 * 1 Kachel = 500 × 500 mm. Palette: Eiche #C58F55; geölt (Rauheit ~0,6).
 */
export function eicheLamellen(N, seed) {
  const k = kanaele(N, N);
  const r = erzeugeRauschen(seed);
  const basis = hex('#C9935A');
  const spaet = hex('#A06A3A');
  const pore = hex('#5E3E22');
  const spiegel = hex('#DDB27A');
  const lamellen = 5;
  jedesPixel(k, (x, y, i, u, v) => {
    const lam = Math.min(lamellen - 1, Math.floor(v * lamellen));
    const vl = v * lamellen - lam;
    const s = seed + lam * 31;
    const stehend = hash01(lam, seed) < 0.4; // stehende Jahrringe: gerade Linien + Spiegel
    const ringe = stehend ? 26 : 9 + Math.floor(hash01(lam + 5, seed) * 6);
    const warpAmp = stehend ? 0.6 : 2.4;
    const warp = r.fbm(u, v, 2, 10, 4) * warpAmp + r.fbm(u, v, 1, 5, 2) * warpAmp * 0.5 + hash01(lam + 11, s) * 10;
    const rr = vl * ringe + warp;
    const t = frac(rr);
    const id = Math.floor(rr);
    const sp = spaetholz(t, 0.45 + 0.15 * hash01(id, s));
    // Frühholzporen: gestreckte dunkle Rinnen nahe Ringbeginn
    const porenBand = 1 - glatt(0.12, 0.32, t);
    const poren = glatt(0.18, 0.5, r.fbm(u, v, 24, 520, 2)) * porenBand;
    const feinPoren = glatt(0.35, 0.7, r.fbm(u, v, 40, 700, 1)) * 0.5;
    const markstrahl = stehend ? glatt(0.2, 0.55, r.fbm(u, v, 18, 140, 2)) : 0;
    const ton = 1 + (hash01(lam + 3, seed) - 0.5) * 0.12 + r.fbm(u, v, 3, 4, 3) * 0.05;
    let c = mischFarbe(basis, spaet, sp * 0.7);
    c = mischFarbe(c, spiegel, markstrahl * 0.55);
    c = mischFarbe(c, pore, klemmen(poren * 0.8 + feinPoren * 0.25));
    c = c.map((ch) => ch * ton);
    // Leimfuge zwischen Lamellen
    const fuge = 1 - glatt(0, 0.006, Math.min(vl, 1 - vl));
    c = mischFarbe(c, hex('#6B4527'), fuge * 0.6);
    setzeFarbe(k, i, c);
    k.hoehe[i] = -poren * 0.06 - feinPoren * 0.015 + sp * 0.01 - fuge * 0.05;
    k.rauheit[i] = klemmen(0.6 + poren * 0.18 - markstrahl * 0.1 + r.fbm(u, v, 6, 6, 3) * 0.05);
  });
  return { k, mmProPixel: 500 / N };
}

/**
 * Atlas für den Sägegriff (1024²): oben Buche lackiert (unikat, Kachel = 209 mm, ~4,9 px/mm),
 * unten ein Streifen Messing für die Griffschrauben.
 * Grenze Holz/Messing bei v = HOLZ_V.
 */
export const GRIFF_HOLZ_V = 832 / 1024;
export const GRIFF_MM = 209; // physische Breite der ganzen Atlas-Textur in mm
export function griffAtlas(N, seed) {
  const k = kanaele(N, N);
  const r = erzeugeRauschen(seed);
  const frueh = hex('#B57A45');
  const spaet = hex('#93592C');
  const messing = hex('#D2AE62');
  jedesPixel(k, (x, y, i, u, v) => {
    if (v < GRIFF_HOLZ_V) {
      const warp = r.fbm(u, v, 2, 3, 4) * 1.6 + r.fbm(u, v, 1, 2, 2) * 1.2;
      const rr = v * 34 + warp;
      const sp = spaetholz(frac(rr), 0.22);
      const flecken = glatt(0.3, 0.6, r.fbm(u, v, 30, 90, 2)); // Buchen-Markstrahlen
      const faser = r.fbm(u, v, 4, 200, 3);
      let c = mischFarbe(frueh, spaet, sp * 0.4);
      c = mischFarbe(c, hex('#7A4A26'), flecken * 0.35);
      c = c.map((ch) => ch * (1 + faser * 0.05));
      setzeFarbe(k, i, c);
      k.hoehe[i] = faser * 0.008 - flecken * 0.006;
      k.rauheit[i] = klemmen(0.42 + faser * 0.04 + flecken * 0.05); // seidenmatt lackiert
    } else {
      const gebuerstet = r.fbm(u, v, 2, 160, 2);
      setzeFarbe(k, i, messing.map((ch) => ch * (1 + gebuerstet * 0.05)));
      k.hoehe[i] = gebuerstet * 0.004;
      k.metall[i] = 1;
      k.rauheit[i] = klemmen(0.34 + gebuerstet * 0.06);
    }
  });
  return { k, mmProPixel: GRIFF_MM / N };
}
