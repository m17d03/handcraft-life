// Geometrie-Bausteine auf Basis von three (läuft in Node ohne DOM).
// Einheiten: Meter. Alle Teile bekommen Fasen, damit Kanten auf kleinen Displays Licht fangen.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export { THREE };

/**
 * Quader mit gefasten Kanten (eine 45°-Fase je Kante, Dreiecksecken). Mittelpunkt im Ursprung.
 * Flache Normalen: Fasen bleiben scharf abgesetzt.
 */
export function gefasterQuader(bx, by, bz, fase) {
  const h = [bx / 2, by / 2, bz / 2];
  const f = Math.min(fase, h[0] * 0.45, h[1] * 0.45, h[2] * 0.45);
  // Punkt einer Ecke (s = Vorzeichen) auf der Fläche mit Normale entlang Achse a
  const P = (s, a) => s.map((si, k) => si * (k === a ? h[k] : h[k] - f));
  const dreiecke = [];
  const quad = (a, b, c, d) => {
    dreiecke.push([a, b, c], [a, c, d]);
  };
  const vz = [-1, 1];
  // 6 Hauptflächen
  for (let a = 0; a < 3; a++) {
    const [b, c] = [0, 1, 2].filter((k) => k !== a);
    for (const sa of vz) {
      const ecke = (sb, sc) => {
        const s = [0, 0, 0];
        s[a] = sa;
        s[b] = sb;
        s[c] = sc;
        return P(s, a);
      };
      quad(ecke(-1, -1), ecke(1, -1), ecke(1, 1), ecke(-1, 1));
    }
  }
  // 12 Kantenfasen: Kante entlang Achse a, zwischen Flächen b und c
  for (let a = 0; a < 3; a++) {
    const [b, c] = [0, 1, 2].filter((k) => k !== a);
    for (const sb of vz) {
      for (const sc of vz) {
        const s0 = [0, 0, 0];
        s0[a] = -1;
        s0[b] = sb;
        s0[c] = sc;
        const s1 = [...s0];
        s1[a] = 1;
        quad(P(s0, b), P(s1, b), P(s1, c), P(s0, c));
      }
    }
  }
  // 8 Eckdreiecke
  for (const sx of vz) for (const sy of vz) for (const sz of vz) dreiecke.push([P([sx, sy, sz], 0), P([sx, sy, sz], 1), P([sx, sy, sz], 2)]);
  return ausDreiecken(dreiecke, true);
}

/**
 * Konvexe Dreiecksliste → nicht indizierte Geometrie; Wicklung wird nach aussen (vom Ursprung weg) gedreht.
 */
export function ausDreiecken(dreiecke, konvex) {
  const pos = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (const [p, q, r] of dreiecke) {
    a.fromArray(p);
    b.fromArray(q);
    c.fromArray(r);
    n.subVectors(b, a).cross(c.clone().sub(a));
    const mitte = a.clone().add(b).add(c).divideScalar(3);
    if (konvex && n.dot(mitte) < 0) pos.push(...p, ...r, ...q);
    else pos.push(...p, ...q, ...r);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Drehteil um die Y-Achse aus Profil [[radius, y], ...]; Knickwinkel trennt Fasen von runden Flächen. */
export function drehteil(profil, segmente, knickGrad = 40) {
  const g = new THREE.LatheGeometry(
    profil.map(([r, y]) => new THREE.Vector2(r, y)),
    segmente,
  );
  return toCreasedNormals(g, THREE.MathUtils.degToRad(knickGrad));
}

/** Extrudierte 2D-Form (Fasen über bevel*) mit geknickten Normalen. */
export function extrudiert(form, optionen, knickGrad = 40) {
  const g = new THREE.ExtrudeGeometry(form, optionen);
  return toCreasedNormals(g, THREE.MathUtils.degToRad(knickGrad));
}

export function geknickt(g, knickGrad) {
  return toCreasedNormals(g, THREE.MathUtils.degToRad(knickGrad));
}

/**
 * Abschluss eines Teils: Transformation anwenden, UV je Dreieck über uvFn(flächenNormale, position, schwerpunkt)
 * setzen, entartete Dreiecke entfernen. Ergebnis bleibt nicht indiziert (zum Zusammenfügen).
 */
export function teil(g, uvFn, matrix) {
  let geo = g.index ? g.toNonIndexed() : g.clone();
  if (matrix) geo.applyMatrix4(matrix);
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  const neuPos = [];
  const neuNor = [];
  const neuUv = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const fn = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    fn.subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b));
    if (fn.length() < 1e-12) continue;
    fn.normalize();
    const schwerpunkt = new THREE.Vector3().add(a).add(b).add(c).divideScalar(3);
    for (let k = 0; k < 3; k++) {
      const p = new THREE.Vector3().fromBufferAttribute(pos, i + k);
      neuPos.push(p.x, p.y, p.z);
      neuNor.push(nor.getX(i + k), nor.getY(i + k), nor.getZ(i + k));
      const uv = uvFn(fn, p, schwerpunkt);
      neuUv.push(uv[0], uv[1]);
    }
  }
  geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(neuPos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(neuNor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(neuUv, 2));
  return geo;
}

/** Teile zu einem indizierten Mesh verschweissen (gleiche Attribute → ein Vertex). */
export function zusammen(teile) {
  const g = mergeGeometries(teile, false);
  const m = mergeVertices(g, 1e-6);
  m.normalizeNormals();
  return m;
}

export const dreieckAnzahl = (g) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;

export const mat = {
  verschiebung: (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z),
  drehungX: (w) => new THREE.Matrix4().makeRotationX(w),
  drehungY: (w) => new THREE.Matrix4().makeRotationY(w),
  drehungZ: (w) => new THREE.Matrix4().makeRotationZ(w),
  /** Produkt von links nach rechts angewendet: kette(A, B) = erst A, dann B. */
  kette: (...ms) => ms.reduce((acc, m) => m.clone().multiply(acc), new THREE.Matrix4()),
};

/** Dominante Achse einer Normalen: 0 = x, 1 = y, 2 = z. */
export function hauptachse(n) {
  const ax = Math.abs(n.x);
  const ay = Math.abs(n.y);
  const az = Math.abs(n.z);
  return ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2;
}
