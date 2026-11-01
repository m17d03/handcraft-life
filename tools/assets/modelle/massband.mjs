// Massband 5 m / 19 mm: Gehäuse ~70 × 70 × 38 mm, Band als eigenes Mesh (1 m lang, über scale.z
// ausziehbar), Haken als eigener Knoten. Ursprung = Gehäusemitte (Griffpunkt). Band zeigt nach −Z.
import { GlbBau } from '../lib/gltf.mjs';
import { THREE, extrudiert, drehteil, gefasterQuader, hauptachse, mat, teil, zusammen, dreieckAnzahl } from '../lib/geometrie.mjs';
import { kodiereKtx2, kodiereSatz } from '../lib/ktx2.mjs';
import { albedoRgba, ormRgba } from '../lib/bild.mjs';
import { BAND, GEHAEUSE_FELD, bandSkala, gehaeuseAtlas } from '../texturen/werkzeug.mjs';

const mm = (v) => v / 1000;
// Gehäuse-Koordinaten in mm: a = nach vorn (−Z), b = oben, x = Dicke.
const P = (a, b, x) => [mm(x), mm(b), -mm(a)];
const zuModell = new THREE.Matrix4().set(0, 0, 0.001, 0, 0, 0.001, 0, 0, -0.001, 0, 0, 0, 0, 0, 0, 1);

/** Austritt des Bands (Unterseite Band, Mitte) relativ zum Ursprung. */
export const MUND = { a: 36, b: -29.5 };

/** Planare Abbildung in ein Atlasfeld (Feldgrösse 0.5; Rand 0.05 gegen Mip-Übersprechen). */
function feldUv(feld, spanneMm = 80) {
  const [u0, v0] = GEHAEUSE_FELD[feld];
  const k = (w) => 0.05 + 0.4 * Math.min(1, Math.max(0, w / spanneMm + 0.5));
  return (n, p) => {
    const q = [p.x * 1000, p.y * 1000, p.z * 1000];
    const ach = hauptachse(n);
    const [i, j] = ach === 0 ? [2, 1] : ach === 1 ? [0, 2] : [0, 1];
    return [u0 + k(q[i]), v0 + k(q[j])];
  };
}

function gerundetesRechteck(w, h, r, rVorneUnten) {
  const s = new THREE.Shape();
  const x0 = -w / 2;
  const x1 = w / 2;
  const y0 = -h / 2;
  const y1 = h / 2;
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - rVorneUnten, y0);
  s.quadraticCurveTo(x1, y0, x1, y0 + rVorneUnten);
  s.lineTo(x1, y1 - r);
  s.quadraticCurveTo(x1, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

function gehaeuse() {
  const teile = [];
  // Schale: 62 × 62 mm Form + 3,5 mm Fase rundum ≈ 69 × 69 mm, Dicke 38 mm
  const schale = extrudiert(gerundetesRechteck(62, 62, 13, 3), { depth: 30, bevelEnabled: true, bevelThickness: 4, bevelSize: 3.5, bevelSegments: 3, curveSegments: 8 }, 40);
  schale.translate(0, 0, -15);
  teile.push(teil(schale, feldUv('kunststoff'), zuModell));
  // Gummi-Griffflächen auf beiden Seiten
  for (const seite of [1, -1]) {
    const kreis = new THREE.Shape();
    kreis.absarc(0, 0, 24, 0, Math.PI * 2, false);
    const pad = extrudiert(kreis, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 1.2, bevelSegments: 2, curveSegments: 28 }, 40);
    pad.translate(-3, 3, seite > 0 ? 18.4 : -19);
    teile.push(teil(pad, feldUv('gummi'), zuModell));
  }
  // Gürtelclip (Stahl) auf −x
  const clip = gefasterQuader(1.4, 46, 13, 0.5);
  teile.push(teil(clip, feldUv('stahl'), mat.kette(mat.verschiebung(-20.6, 4, 10), new THREE.Matrix4().makeScale(0.001, 0.001, 0.001))));
  const clipKopf = gefasterQuader(4, 6, 13, 0.6);
  teile.push(teil(clipKopf, feldUv('stahl'), mat.kette(mat.verschiebung(-19.5, 26, 10), new THREE.Matrix4().makeScale(0.001, 0.001, 0.001))));
  // Bandführung (Stahl) vorne unten
  const fuehrung = gefasterQuader(26, 5, 4, 0.6);
  teile.push(teil(fuehrung, feldUv('stahl'), mat.kette(mat.verschiebung(0, MUND.b - 2.4, -(MUND.a - 2.5)), new THREE.Matrix4().makeScale(0.001, 0.001, 0.001))));
  // Feststelltaste (Bernstein) oben vorne
  const taste = gefasterQuader(12, 5, 15, 1.2);
  teile.push(teil(taste, feldUv('taste'), mat.kette(mat.verschiebung(0, 35, -14), new THREE.Matrix4().makeScale(0.001, 0.001, 0.001))));
  // Mittelschraube im Gummi (Stahl), beide Seiten
  for (const seite of [1, -1]) {
    const s = drehteil([[4, -0.5], [4, 0.6], [3.2, 1.3], [0, 1.5]], 14, 40);
    const m = mat.kette(mat.drehungZ(-seite * Math.PI / 2), mat.verschiebung(seite * 19.6, 3, 3), new THREE.Matrix4().makeScale(0.001, 0.001, 0.001));
    teile.push(teil(s, feldUv('stahl'), m));
  }
  return zusammen(teile);
}

/**
 * Band: 1 m lang von z = 0 (Austritt) bis z = −1 (Haken), 19 mm breit, gewölbt (Ränder 1,6 mm hoch).
 * UV.u in Kacheln à 100 mm, u = 0 am Hakenende; Skala liest sich von oben.
 */
function band() {
  const B = BAND.breiteMm;
  const segs = 6;
  const dicke = 0.13;
  const pos = [];
  const uv = [];
  const wolbung = (x) => 1.6 * (x / (B / 2)) ** 2;
  const vVorne = (x) => BAND.vorderV * ((B / 2 - x) / B);
  const tri = (a, b, c) => pos.push(...a, ...b, ...c);
  const punkt = (x, y, z) => [mm(x), mm(y), z];
  for (let i = 0; i < segs; i++) {
    const xa = -B / 2 + (B * i) / segs;
    const xb = -B / 2 + (B * (i + 1)) / segs;
    // Oberseite (Normale +y): u = (1 + z) / 0.1
    const o = [punkt(xa, wolbung(xa), 0), punkt(xb, wolbung(xb), 0), punkt(xb, wolbung(xb), -1), punkt(xa, wolbung(xa), -1)];
    const ouv = [[10, vVorne(xa)], [10, vVorne(xb)], [0, vVorne(xb)], [0, vVorne(xa)]];
    // Wicklung: Normale nach +y
    for (const r of [[0, 1, 2], [0, 2, 3]]) {
      tri(...r.map((j) => o[j]));
      uv.push(...r.flatMap((j) => ouv[j]));
    }
    const u = [punkt(xa, wolbung(xa) - dicke, 0), punkt(xb, wolbung(xb) - dicke, 0), punkt(xb, wolbung(xb) - dicke, -1), punkt(xa, wolbung(xa) - dicke, -1)];
    const uuv = [[10, BAND.rueckV], [10, BAND.rueckV + 0.02], [0, BAND.rueckV + 0.02], [0, BAND.rueckV]];
    for (const r of [[0, 2, 1], [0, 3, 2]]) {
      tri(...r.map((j) => u[j]));
      uv.push(...r.flatMap((j) => uuv[j]));
    }
  }
  // Seitenkanten
  for (const x of [-B / 2, B / 2]) {
    const y = wolbung(x);
    const q = [punkt(x, y, 0), punkt(x, y - dicke, 0), punkt(x, y - dicke, -1), punkt(x, y, -1)];
    const quv = [[10, 0.82], [10, 0.82], [0, 0.82], [0, 0.82]];
    const r0 = x > 0 ? [[0, 1, 2], [0, 2, 3]] : [[0, 2, 1], [0, 3, 2]];
    for (const r of r0) {
      tri(...r.map((j) => q[j]));
      uv.push(...r.flatMap((j) => quv[j]));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return zusammen([g]);
}

/** Haken am Bandende: Ursprung = Bandende (Unterkante Band, Mitte); Lasche zeigt nach +Z ins Band. */
function haken() {
  const s = new THREE.Matrix4().makeScale(0.001, 0.001, 0.001);
  const stahl = feldUv('stahl', 40);
  const teile = [];
  const lasche = gefasterQuader(20, 0.8, 14, 0.25);
  teile.push(teil(lasche, stahl, mat.kette(mat.verschiebung(0, 2.0, 7), s)));
  const lippe = gefasterQuader(22, 11, 1.0, 0.3);
  teile.push(teil(lippe, stahl, mat.kette(mat.verschiebung(0, -3.2, -0.5), s)));
  for (const x of [-5, 5]) {
    const niet = drehteil([[1.6, -0.2], [1.6, 0.3], [1.1, 0.7], [0, 0.8]], 10, 40);
    teile.push(teil(niet, stahl, mat.kette(mat.verschiebung(x, 2.3, 9), s)));
  }
  return zusammen(teile);
}

export async function baueMassband(seed) {
  const bau = new GlbBau('Massband');
  const ga = gehaeuseAtlas(512, seed);
  const gs = await kodiereSatz(ga.k, { normal: false });
  const mGeh = bau.material('Massband_Gehaeuse', {
    farbe: bau.textur('Massband_Gehaeuse_Farbe', gs.farbe, 512, 512),
    orm: bau.textur('Massband_Gehaeuse_ORM', gs.orm, 512, 512),
  });
  const sk = bandSkala(2048, 256, seed).k;
  const mBand = bau.material('Massband_Band', {
    farbe: bau.textur('Massband_Band_Farbe', await kodiereKtx2(albedoRgba(sk), 2048, 256, 'farbe-uastc'), 2048, 256),
    orm: bau.textur('Massband_Band_ORM', await kodiereKtx2(ormRgba(sk), 2048, 256, 'linear'), 2048, 256),
    metall: 0,
    wrapU: 'kachel',
  });
  const gG = gehaeuse();
  const gB = band();
  const gH = haken();
  const wurzel = bau.knoten('Massband');
  bau.knoten('Gehaeuse', { mesh: bau.mesh('Gehaeuse', [{ geometrie: gG, material: mGeh }]), eltern: wurzel });
  const mund = P(MUND.a, MUND.b, 0);
  bau.knoten('Band', { mesh: bau.mesh('Band', [{ geometrie: gB, material: mBand }]), position: mund, eltern: wurzel });
  bau.knoten('Haken', { mesh: bau.mesh('Haken', [{ geometrie: gH, material: mGeh }]), position: mund, eltern: wurzel });
  bau.knoten('Bandaustritt', { position: mund, eltern: wurzel });
  return {
    name: 'massband',
    bau,
    teile: { Gehaeuse: dreieckAnzahl(gG), Band: dreieckAnzahl(gB), Haken: dreieckAnzahl(gH) },
    knoten: 'Massband › Gehaeuse, Band (scale.z = mm/1000), Haken (z = Bandaustritt.z − mm/1000), Bandaustritt',
  };
}
