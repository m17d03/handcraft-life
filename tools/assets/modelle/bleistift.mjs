// Sechskant-Bleistift 175 mm, Schlüsselweite 7 mm, Kanten leicht gefast, gespitzt (Zedernholz-Kegel
// mit gewellter Lackkante, Graphitmine Ø 2 mm). Ursprung = Griffpunkt 35 mm hinter der Spitze;
// Spitze zeigt nach −Z.
import { GlbBau } from '../lib/gltf.mjs';
import { THREE, geknickt, teil, zusammen, dreieckAnzahl } from '../lib/geometrie.mjs';
import { kodiereSatz } from '../lib/ktx2.mjs';
import { bleistiftAtlas } from '../texturen/werkzeug.mjs';

const LAENGE = 175;
const GRIFF = 35; // mm hinter der Spitze
const SW = 7; // Schlüsselweite
const FASE = 0.45; // Kantenfase
const KEGEL = 20; // Kegellänge Spitze → voller Querschnitt
const MINE_R = 1.0;
const KAPPE = 3; // Tauchkappe am Ende

// Querschnitt: 12-Eck (6 Flächen + 6 Fasen), Flächen zusätzlich unterteilt für die Lackwellen.
function querschnitt() {
  const apo = SW / 2;
  const pts = [];
  for (let f = 0; f < 6; f++) {
    const w = (f * Math.PI) / 3;
    const n = [Math.cos(w), Math.sin(w)];
    const t = [-Math.sin(w), Math.cos(w)];
    const halb = apo * Math.tan(Math.PI / 6) - FASE;
    for (let j = 0; j <= 2; j++) {
      const s = -halb + halb * j;
      pts.push([n[0] * apo + t[0] * s, n[1] * apo + t[1] * s]);
    }
  }
  return pts.map(([x, y]) => ({ x, y, r: Math.hypot(x, y), w: Math.atan2(y, x) }));
}

export function bleistiftGeometrie() {
  const q = querschnitt();
  const rMax = Math.max(...q.map((p) => p.r));
  const kegel = (d) => (d / KEGEL) * rMax; // Kegelradius d mm hinter der Spitze
  const dMine = (MINE_R / rMax) * KEGEL;
  const dLackMin = ((SW / 2) / rMax) * KEGEL;
  // Ringe: Minengrenze, Kegel, dichter im Bereich der Lackwellen, Kappe, Endfase.
  // Materialgrenzen entstehen über die UV je Dreieck (Schwerpunkt), nicht über doppelte Ringe.
  const ringe = [dMine, 10];
  for (let d = dLackMin - 0.5; d < KEGEL + 0.35; d += 0.7) ringe.push(d);
  ringe.push(KEGEL + 0.05, LAENGE - KAPPE, LAENGE - 0.35); // ab KEGEL nur noch Prisma (Lack)
  const z = (d) => (d - GRIFF) / 1000;
  const ring = (d) => q.map((p) => {
    const r = Math.min(p.r, kegel(d));
    const s = r / p.r;
    return [(p.x * s) / 1000, (p.y * s) / 1000, z(d)];
  });
  const tris = [];
  const n = q.length;
  const spitze = [0, 0, z(0)];
  const r0 = ring(ringe[0]);
  for (let j = 0; j < n; j++) tris.push([spitze, r0[(j + 1) % n], r0[j]]);
  for (let i = 0; i + 1 < ringe.length; i++) {
    const a = ring(ringe[i]);
    const b = ring(ringe[i + 1]);
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      tris.push([a[j], a[k], b[k]], [a[j], b[k], b[j]]);
    }
  }
  // Ende: kleine Fase und Deckel
  const letzte = ring(ringe[ringe.length - 1]);
  const ende = q.map((p) => {
    const s = (p.r - 0.35) / p.r;
    return [(p.x * s) / 1000, (p.y * s) / 1000, z(LAENGE)];
  });
  for (let j = 0; j < n; j++) {
    const k = (j + 1) % n;
    tris.push([letzte[j], letzte[k], ende[k]], [letzte[j], ende[k], ende[j]]);
  }
  const mitte = [0, 0, z(LAENGE)];
  for (let j = 0; j < n; j++) tris.push([mitte, ende[j], ende[(j + 1) % n]]);
  // Wicklung nach aussen: radial bzw. am Deckel nach +z
  const pos = [];
  for (const [A, B, C] of tris) {
    const va = new THREE.Vector3(...A);
    const nrm = new THREE.Vector3(...B).sub(va).cross(new THREE.Vector3(...C).sub(va));
    const m = new THREE.Vector3(...A).add(new THREE.Vector3(...B)).add(new THREE.Vector3(...C)).divideScalar(3);
    const aussen = m.z > z(LAENGE) - 1e-5 ? new THREE.Vector3(0, 0, 1) : m.z < z(0.7) ? new THREE.Vector3(m.x, m.y, -0.001) : new THREE.Vector3(m.x, m.y, 0);
    if (nrm.dot(aussen) < 0) pos.push(...A, ...C, ...B);
    else pos.push(...A, ...B, ...C);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const gk = geknickt(g, 25);
  // UV: Lack/Holz-Grenze über den Abstand Kegel ↔ Prisma (scharf in der Textur, nicht in der Geometrie)
  const uvFn = (_n, p, s) => {
    const dS = s.z * 1000 + GRIFF;
    if (dS < dMine) return [0.5, 0.625];
    if (dS > LAENGE - KAPPE) return [0.5, 0.875];
    const d = p.z * 1000 + GRIFF;
    const w = Math.atan2(p.y, p.x);
    // Prismaradius in Richtung w: Vertices liegen auf den Strahlen der Querschnittspunkte
    let rP = rMax;
    let best = Infinity;
    for (const s of q) {
      const dw = Math.abs(Math.atan2(Math.sin(w - s.w), Math.cos(w - s.w)));
      if (dw < best) {
        best = dw;
        rP = s.r;
      }
    }
    const t = Math.max(-0.45, Math.min(0.45, (kegel(d) - rP) * 2.5));
    return [0.5 + t, 0.25];
  };
  return zusammen([teil(gk, uvFn)]);
}

export async function baueBleistift(seed) {
  const bau = new GlbBau('Bleistift');
  const at = bleistiftAtlas(256, seed);
  const s = await kodiereSatz(at.k, { normal: false });
  const m = bau.material('Bleistift', {
    farbe: bau.textur('Bleistift_Farbe', s.farbe, 256, 256),
    orm: bau.textur('Bleistift_ORM', s.orm, 256, 256),
  });
  const g = bleistiftGeometrie();
  const wurzel = bau.knoten('Bleistift');
  bau.knoten('Koerper', { mesh: bau.mesh('Bleistift', [{ geometrie: g, material: m }]), eltern: wurzel });
  bau.knoten('Minenspitze', { position: [0, 0, -GRIFF / 1000], eltern: wurzel });
  return { name: 'bleistift', bau, teile: { Koerper: dreieckAnzahl(g) }, knoten: 'Bleistift › Koerper, Minenspitze (Hilfsknoten)' };
}
