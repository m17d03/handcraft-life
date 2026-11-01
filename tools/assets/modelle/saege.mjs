// Fuchsschwanz: Blatt 595 mm (≈ 550 mm frei), Zahnung als Alpha-Textur, geschlossener Buchengriff
// mit drei Messing-Griffschrauben. Ursprung = Mitte der Griffhand; Blatt zeigt nach −Z, Zähne nach −Y.
import { GlbBau } from '../lib/gltf.mjs';
import { THREE, extrudiert, drehteil, hauptachse, mat, teil, zusammen, dreieckAnzahl } from '../lib/geometrie.mjs';
import { kodiereKtx2, kodiereSatz } from '../lib/ktx2.mjs';
import { albedoRgba, ormRgba } from '../lib/bild.mjs';
import { BLATT, saegeblatt } from '../texturen/werkzeug.mjs';
import { GRIFF_HOLZ_V, GRIFF_MM, griffAtlas } from '../texturen/holz.mjs';

// 2D-Griffkoordinaten (mm): a = nach vorn (Blattrichtung), b = nach oben. A0 = Griffmitte.
const A0 = -13;
const ZAHN_B = -55; // Zahnspitzen
const BLATT_A0 = 50; // Ferse (im Griff)
const DICKE_GRIFF = 24;
const DICKE_BLATT = 0.9;

/** (a, b, x) in mm → Modellkoordinaten in m. */
const P = (a, b, x) => [x / 1000, b / 1000, -(a - A0) / 1000];
const zuA = (p) => A0 - p.z * 1000;

function griffForm() {
  const s = new THREE.Shape();
  s.moveTo(92, -46);
  s.lineTo(40, -52);
  s.quadraticCurveTo(5, -56, -12, -70);
  s.quadraticCurveTo(-28, -80, -34, -64);
  s.bezierCurveTo(-30, -30, -26, 10, -30, 40);
  s.quadraticCurveTo(-34, 62, -22, 72);
  s.quadraticCurveTo(-8, 80, 5, 70);
  s.bezierCurveTo(25, 60, 50, 74, 70, 74);
  s.quadraticCurveTo(88, 74, 94, 60);
  s.bezierCurveTo(100, 30, 96, -10, 98, -30);
  s.quadraticCurveTo(99, -44, 92, -46);
  const loch = new THREE.Path();
  loch.moveTo(10, -40);
  loch.quadraticCurveTo(32, -48, 38, -30);
  loch.bezierCurveTo(42, 0, 40, 35, 26, 52);
  loch.quadraticCurveTo(14, 58, 8, 45);
  loch.bezierCurveTo(2, 20, 2, -15, 10, -40);
  s.holes.push(loch);
  return s;
}

// Basis: Extrusion liegt in (X = a, Y = b, Z = Dicke) → Modell (x = Dicke, y = b, z = −(a − A0)).
const zuModell = new THREE.Matrix4().set(0, 0, 0.001, 0, 0, 0.001, 0, 0, -0.001, 0, 0, A0 * 0.001, 0, 0, 0, 1);

function griff() {
  const fase = 4;
  const g = extrudiert(
    griffForm(),
    { depth: DICKE_GRIFF - 2 * fase, bevelEnabled: true, bevelThickness: fase, bevelSize: 3.5, bevelSegments: 3, curveSegments: 10 },
    40,
  );
  g.translate(0, 0, -(DICKE_GRIFF - 2 * fase) / 2);
  const aMin = -40;
  const bMax = 84;
  const holzUv = (n, p) => {
    const a = zuA(p);
    const b = p.y * 1000;
    const x = p.x * 1000;
    const ach = hauptachse(n);
    if (ach === 0) return [(a - aMin) / GRIFF_MM, (bMax - b) / GRIFF_MM];
    if (ach === 1) return [(a - aMin) / GRIFF_MM, 0.3 + (x + 12) / GRIFF_MM];
    return [(bMax - b) / GRIFF_MM, 0.45 + (x + 12) / GRIFF_MM];
  };
  const holz = teil(g, holzUv, zuModell);
  // Griffschrauben (Messing), je Seite drei, mit Ringnut
  const profil = [
    [6.5, -0.6],
    [6.5, 0.5],
    [6.1, 1.15],
    [4.9, 1.6],
    [3.1, 1.75],
    [2.7, 1.5],
    [2.3, 1.75],
    [0, 1.85],
  ];
  const messingUv = (n, p) => {
    const a = zuA(p);
    const b = p.y * 1000;
    return [0.05 + ((a + 50) / 200) * 0.9, GRIFF_HOLZ_V + 0.02 + ((b + 80) / 200) * (1 - GRIFF_HOLZ_V - 0.04)];
  };
  const schrauben = [];
  for (const [a, b] of [
    [64, 40],
    [80, 6],
    [66, -27],
  ]) {
    for (const seite of [1, -1]) {
      const kopf = drehteil(profil, 16, 40);
      const m = mat.kette(
        mat.drehungZ(-seite * Math.PI / 2),
        mat.verschiebung((seite * DICKE_GRIFF) / 2, b, -(a - A0)),
        new THREE.Matrix4().makeScale(0.001, 0.001, 0.001),
      );
      schrauben.push(teil(kopf, messingUv, m));
    }
  }
  return zusammen([holz, ...schrauben]);
}

function blatt() {
  const { laenge, hoeheFerse, hoeheSpitze, streifen, streifenV } = BLATT;
  const a0 = BLATT_A0;
  const a1 = BLATT_A0 + laenge;
  const bS = ZAHN_B + streifen; // Oberkante Zahnstreifen
  const rueckenB = (a) => ZAHN_B + hoeheFerse + ((a - a0) / laenge) * (hoeheSpitze - hoeheFerse);
  const h = DICKE_BLATT / 2;
  const tris = [];
  const uvs = [];
  const uvKoerper = (a, b) => [(a - a0) / laenge, streifenV * (1 - (b - bS) / (hoeheFerse - streifen))];
  const uvStreifen = (a, b) => [(a - a0) / laenge, streifenV + (1 - streifenV) * (1 - (b - ZAHN_B) / streifen)];
  const quad = (pts, uvFn, x) => {
    const v = pts.map(([a, b]) => P(a, b, x));
    const t = pts.map(([a, b]) => uvFn(a, b));
    for (const r of [[0, 1, 2], [0, 2, 3]]) {
      tris.push(r.map((j) => v[j]));
      uvs.push(r.map((j) => t[j]));
    }
  };
  for (const x of [h, -h]) {
    quad([[a0, bS], [a1, bS], [a1, rueckenB(a1)], [a0, rueckenB(a0)]], uvKoerper, x);
    quad([[a0, ZAHN_B], [a1, ZAHN_B], [a1, bS], [a0, bS]], uvStreifen, x);
  }
  // Rücken und Spitze als schmale Kantenflächen (Stahlton aus dem Blattbereich)
  const kante = (p1, p2) => {
    const v = [P(p1[0], p1[1], -h), P(p2[0], p2[1], -h), P(p2[0], p2[1], h), P(p1[0], p1[1], h)];
    const t = [uvKoerper(p1[0], p1[1] - 2), uvKoerper(p2[0], p2[1] - 2), uvKoerper(p2[0], p2[1] - 2), uvKoerper(p1[0], p1[1] - 2)];
    for (const r of [[0, 1, 2], [0, 2, 3]]) {
      tris.push(r.map((j) => v[j]));
      uvs.push(r.map((j) => t[j]));
    }
  };
  kante([a1, rueckenB(a1)], [a0, rueckenB(a0)]);
  kante([a1, bS], [a1, rueckenB(a1)]);
  // Wicklung nach aussen richten (Seitenflächen nach ±x, Kanten weg von der Blattmitte)
  const pos = [];
  const uv = [];
  tris.forEach((tri, i) => {
    const [A, B, C] = tri.map((p) => new THREE.Vector3(...p));
    const n = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(C, A));
    const mitte = A.clone().add(B).add(C).divideScalar(3);
    const bezug = new THREE.Vector3(mitte.x, mitte.y - P((a0 + a1) / 2, ZAHN_B + 40, 0)[1], mitte.z - P((a0 + a1) / 2, 0, 0)[2]);
    const reihenfolge = n.dot(bezug) < 0 ? [0, 2, 1] : [0, 1, 2];
    for (const j of reihenfolge) {
      pos.push(...tri[j]);
      uv.push(...uvs[i][j]);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals(); // flach: Blatt ist eben
  return zusammen([g]);
}

export async function baueSaege(seed) {
  const bau = new GlbBau('Saege');
  // Blatt: Albedo + Alpha 4096 × 256 (UASTC, scharfe Zahnkanten), ORM 2048 × 128 (ETC1S)
  const bk = saegeblatt(4096, 256, seed).k;
  const bo = saegeblatt(2048, 128, seed).k;
  const blattFarbe = bau.textur('Saege_Blatt_Farbe', await kodiereKtx2(albedoRgba(bk), 4096, 256, 'farbe-uastc'), 4096, 256);
  const blattOrm = bau.textur('Saege_Blatt_ORM', await kodiereKtx2(ormRgba(bo), 2048, 128, 'linear'), 2048, 128);
  const ga = griffAtlas(1024, seed + 1);
  const gs = await kodiereSatz(ga.k, { mmProPixel: ga.mmProPixel, normalStaerke: 3 });
  const mBlatt = bau.material('Saege_Blatt', { farbe: blattFarbe, orm: blattOrm, alphaMaske: 0.5 });
  const mGriff = bau.material('Saege_Griff', {
    farbe: bau.textur('Saege_Griff_Farbe', gs.farbe, 1024, 1024),
    normal: bau.textur('Saege_Griff_Normal', gs.normal, 1024, 1024),
    orm: bau.textur('Saege_Griff_ORM', gs.orm, 1024, 1024),
  });
  const gBlatt = blatt();
  const gGriff = griff();
  const wurzel = bau.knoten('Saege');
  bau.knoten('Blatt', { mesh: bau.mesh('Blatt', [{ geometrie: gBlatt, material: mBlatt }]), eltern: wurzel });
  bau.knoten('Griff', { mesh: bau.mesh('Griff', [{ geometrie: gGriff, material: mGriff }]), eltern: wurzel });
  const mitte = BLATT_A0 + BLATT.laenge / 2;
  bau.knoten('Zahnlinie_Mitte', { position: P(mitte, ZAHN_B, 0), eltern: wurzel });
  bau.knoten('Blattspitze', { position: P(BLATT_A0 + BLATT.laenge, ZAHN_B, 0), eltern: wurzel });
  return {
    name: 'saege',
    bau,
    teile: { Blatt: dreieckAnzahl(gBlatt), Griff: dreieckAnzahl(gGriff) },
    knoten: 'Saege › Blatt (Mesh), Griff (Mesh), Zahnlinie_Mitte, Blattspitze (Hilfsknoten)',
  };
}
