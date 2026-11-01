// Raumtexturen (Wand, Boden), kachelbar, Stil A. Hintergrundflächen: 1 mm/px reicht.
import { erzeugeRauschen, frac, glatt, hash01, klemmen } from '../lib/rauschen.mjs';
import { hex, jedesPixel, kanaele, mischFarbe, setzeFarbe } from '../lib/bild.mjs';

/** Kalkputz, warm gebrochenes Weiss. 1 Kachel = 1000 × 1000 mm. */
export function wandPutz(N, seed) {
  const k = kanaele(N, N);
  const r = erzeugeRauschen(seed);
  const basis = hex('#D6C3A6');
  const hell = hex('#E6D7BF');
  const dunkel = hex('#B9A385');
  jedesPixel(k, (x, y, i, u, v) => {
    const wolke = r.fbm(u, v, 3, 3, 5);
    const kelle = r.fbm(u, v, 5, 4, 4, 0.55);
    const sand = r.fbm(u, v, 128, 128, 2);
    const korn = hash01(i, seed) - 0.5;
    let c = mischFarbe(basis, wolke > 0 ? hell : dunkel, Math.abs(wolke) * 0.7);
    c = c.map((ch) => ch * (1 + sand * 0.04 + korn * 0.03));
    setzeFarbe(k, i, c);
    k.hoehe[i] = kelle * 0.9 + sand * 0.12;
    k.rauheit[i] = klemmen(0.9 + sand * 0.04 - Math.max(0, kelle) * 0.08);
  });
  return { k, mmProPixel: 1000 / N };
}

/**
 * Dielenboden, dunkel geölt und abgelaufen. 1 Kachel = 900 × 900 mm:
 * 6 Dielen à 150 mm (V), Fasern entlang U, je Reihe ein versetzter Stoss.
 * Palette: Dunkles Holz, Boden #3B2A1C.
 */
export function bodenDielen(N, seed) {
  const k = kanaele(N, N);
  const r = erzeugeRauschen(seed);
  const reihen = 6;
  const fugeMm = 1.2;
  const kachelMm = 900;
  jedesPixel(k, (x, y, i, u, v) => {
    const reihe = Math.min(reihen - 1, Math.floor(v * reihen));
    const vl = v * reihen - reihe;
    const stoss = hash01(reihe, seed);
    const ul = frac(u - stoss); // 0 am Stoss
    const ton = 0.88 + hash01(reihe + 17, seed) * 0.24;
    const warp = r.fbm(u, v, 2, 12, 4) * 2 + hash01(reihe + 3, seed) * 20;
    const rr = vl * (6 + Math.floor(hash01(reihe + 5, seed) * 4)) + warp;
    const t = frac(rr);
    const sp = glatt(0.55, 0.85, t) * (1 - glatt(0.97, 1, t));
    const faser = r.fbm(u, v, 6, 360, 3);
    const abrieb = glatt(-0.1, 0.5, r.fbm(u, v, 4, 6, 4));
    let c = mischFarbe(hex('#47331F'), hex('#2C1F14'), sp * 0.8);
    c = mischFarbe(c, hex('#6A5038'), abrieb * 0.35);
    c = c.map((ch) => ch * ton * (1 + faser * 0.06));
    // Fugen (längs) und Stoss (quer), leicht gerundete Dielenkante
    const dV = Math.min(vl, 1 - vl) * (kachelMm / reihen);
    const dU = Math.min(ul, 1 - ul) * kachelMm;
    const d = Math.min(dV, dU);
    const fuge = 1 - glatt(fugeMm * 0.5, fugeMm, d);
    const kante = 1 - glatt(fugeMm, fugeMm + 2.5, d);
    c = mischFarbe(c, hex('#140D08'), fuge);
    setzeFarbe(k, i, c);
    k.hoehe[i] = -fuge * 0.8 - kante * kante * 0.35 + faser * 0.02 + sp * 0.015;
    k.rauheit[i] = klemmen(0.68 + abrieb * 0.14 + fuge * 0.15 + faser * 0.03);
    k.ao[i] = 1 - fuge * 0.6;
  });
  return { k, mmProPixel: kachelMm / N };
}
