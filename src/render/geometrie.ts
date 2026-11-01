/**
 * Prozedurale Geometrie ohne Engine (testbar): Quader mit Fase (Stil A: jede Werkstückkante mit
 * kleiner Fase, ein Segment, fängt das Licht) und zusammengeführte Flächen (Dielenboden).
 * Flache Normalen, Front-Faces gegen den Uhrzeigersinn. UVs in Metern / uvMeter, u entlang der
 * Faserrichtung. Vertex-Farbe dunkelt Stirnholz ab (eine Textur, ein Draw Call).
 */
import { add, cross, dot, normalize, scale, sub, type Vec3 } from './mathe';

export interface MeshDaten {
  readonly positionen: Float32Array; // xyz
  readonly normalen: Float32Array; // xyz
  readonly uvs: Float32Array; // uv
  readonly farben: Float32Array; // rgb (linear, Multiplikator)
  readonly indizes: Uint16Array;
}

type Achse = 0 | 1 | 2;

export interface FasenQuaderOptionen {
  /** Kantenlängen in m (x, y, z) */
  readonly groesse: Vec3;
  /** Fase in m (> 0, kleiner als die halbe kürzeste Kante) */
  readonly fase: number;
  /** Faserrichtung: Achse, entlang der u läuft; Flächen quer dazu sind Stirnholz */
  readonly faser?: Achse;
  readonly uvMeter?: number;
  /** Vertex-Farbe für Stirnholz-Flächen (linear), Standard dunkler und wärmer */
  readonly stirnFarbe?: Vec3;
  /** Versatz der UVs (z. B. damit nicht jedes Teil gleich gemasert ist) */
  readonly uvVersatz?: readonly [number, number];
}

class Puffer {
  readonly p: number[] = [];
  readonly n: number[] = [];
  readonly uv: number[] = [];
  readonly c: number[] = [];
  readonly i: number[] = [];

  /** Konvexes Polygon (Punkte beliebig sortiert), flache Normale `nrm`. */
  polygon(punkte: readonly Vec3[], nrm: Vec3, uvVon: (p: Vec3) => readonly [number, number], farbe: Vec3): void {
    const n = normalize(nrm);
    const mitte = scale(punkte.reduce<Vec3>((a, b) => add(a, b), [0, 0, 0]), 1 / punkte.length);
    const hilf: Vec3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const t1 = normalize(cross(hilf, n));
    const t2 = cross(n, t1);
    // t1 × t2 = n → aufsteigender Winkel ist gegen den Uhrzeigersinn, von aussen gesehen
    const sortiert = [...punkte].sort((a, b) => {
      const da = sub(a, mitte);
      const db = sub(b, mitte);
      return Math.atan2(dot(da, t2), dot(da, t1)) - Math.atan2(dot(db, t2), dot(db, t1));
    });
    const basis = this.p.length / 3;
    for (const q of sortiert) {
      this.p.push(q[0], q[1], q[2]);
      this.n.push(n[0], n[1], n[2]);
      const [u, v] = uvVon(q);
      this.uv.push(u, v);
      this.c.push(farbe[0], farbe[1], farbe[2]);
    }
    for (let k = 1; k + 1 < sortiert.length; k++) this.i.push(basis, basis + k, basis + k + 1);
  }

  fertig(): MeshDaten {
    return {
      positionen: new Float32Array(this.p),
      normalen: new Float32Array(this.n),
      uvs: new Float32Array(this.uv),
      farben: new Float32Array(this.c),
      indizes: new Uint16Array(this.i),
    };
  }
}

const VORZEICHEN = [-1, 1] as const;
const EINS: Vec3 = [1, 1, 1];
const STIRN: Vec3 = [0.5, 0.42, 0.36];

/** Quader um den Ursprung mit einer Fase an allen 12 Kanten und 8 Ecken (44 Dreiecke). */
export function fasenQuader(o: FasenQuaderOptionen): MeshDaten {
  const h: Vec3 = [o.groesse[0] / 2, o.groesse[1] / 2, o.groesse[2] / 2];
  const f = Math.min(o.fase, h[0] * 0.49, h[1] * 0.49, h[2] * 0.49);
  if (!(f > 0)) throw new Error('fasenQuader: Fase muss > 0 sein');
  const faser: Achse = o.faser ?? 0;
  const uvM = o.uvMeter ?? 1;
  const [du, dv] = o.uvVersatz ?? [0, 0];
  const stirn = o.stirnFarbe ?? STIRN;
  const buf = new Puffer();

  /** Eckpunkt der Ecke s auf der Fläche der Achse a (Koordinate a voll, die anderen um f eingerückt). */
  const ecke = (s: Vec3, a: Achse): Vec3 => {
    const q: [number, number, number] = [0, 0, 0];
    for (let k = 0; k < 3; k++) q[k] = s[k as Achse] * (k === a ? h[k] : h[k as Achse] - f);
    return q;
  };
  /** UV: u entlang Faser, v entlang der Achse, die weder Normale noch Faser ist. */
  const uvFuer = (normAchse: Achse) => (p: Vec3): readonly [number, number] => {
    if (normAchse === faser) {
      const rest = ([0, 1, 2] as Achse[]).filter((k) => k !== faser);
      return [(p[rest[0] ?? 1] / uvM) * 4 + du, (p[rest[1] ?? 2] / uvM) * 4 + dv];
    }
    const v = ([0, 1, 2] as Achse[]).find((k) => k !== faser && k !== normAchse) ?? 1;
    return [p[faser] / uvM + du, p[v] / uvM + dv];
  };
  const dominant = (n: Vec3): Achse => {
    const ax = Math.abs(n[0]);
    const ay = Math.abs(n[1]);
    const az = Math.abs(n[2]);
    return ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2;
  };
  const ecken: Vec3[] = [];
  for (const sx of VORZEICHEN) for (const sy of VORZEICHEN) for (const sz of VORZEICHEN) ecken.push([sx, sy, sz]);

  // 6 Hauptflächen
  for (const a of [0, 1, 2] as Achse[]) {
    for (const sa of VORZEICHEN) {
      const pkt = ecken.filter((s) => s[a] === sa).map((s) => ecke(s, a));
      const n: [number, number, number] = [0, 0, 0];
      n[a] = sa;
      buf.polygon(pkt, n, uvFuer(a), a === faser ? stirn : EINS);
    }
  }
  // 12 Kantenfasen zwischen Achse a und b (entlang c)
  for (const [a, b] of [[0, 1], [0, 2], [1, 2]] as [Achse, Achse][]) {
    for (const sa of VORZEICHEN) {
      for (const sb of VORZEICHEN) {
        const auswahl = ecken.filter((s) => s[a] === sa && s[b] === sb);
        const pkt = auswahl.flatMap((s) => [ecke(s, a), ecke(s, b)]);
        const n: [number, number, number] = [0, 0, 0];
        n[a] = sa;
        n[b] = sb;
        const d = dominant(n) === faser ? (a === faser ? b : a) : dominant(n);
        buf.polygon(pkt, n, uvFuer(d), EINS);
      }
    }
  }
  // 8 Eckdreiecke
  for (const s of ecken) {
    buf.polygon([ecke(s, 0), ecke(s, 1), ecke(s, 2)], s, uvFuer(faser === 1 ? 0 : 1), EINS);
  }
  return buf.fertig();
}

/** Dielenboden: `anzahl` Dielen entlang x nebeneinander (Faser entlang z), eine Geometrie. */
export function dielenBoden(breite: number, tiefe: number, anzahl: number, fuge: number): MeshDaten {
  const buf = new Puffer();
  const dB = breite / anzahl;
  let zufall = 7;
  const rnd = (): number => {
    zufall = (zufall * 1664525 + 1013904223) >>> 0;
    return zufall / 4294967296;
  };
  for (let k = 0; k < anzahl; k++) {
    const x0 = -breite / 2 + k * dB + fuge / 2;
    const x1 = x0 + dB - fuge;
    const ton = 0.82 + rnd() * 0.3;
    const farbe: Vec3 = [ton, ton * (0.96 + rnd() * 0.06), ton * (0.92 + rnd() * 0.08)];
    const du = rnd() * 7;
    const dv = rnd();
    buf.polygon(
      [[x0, 0, -tiefe / 2], [x1, 0, -tiefe / 2], [x1, 0, tiefe / 2], [x0, 0, tiefe / 2]],
      [0, 1, 0],
      (p) => [p[2] / 1.5 + du, (p[0] - x0) / 1.5 + dv],
      farbe,
    );
  }
  return buf.fertig();
}

export const dreiecke = (m: MeshDaten): number => m.indizes.length / 3;

/** Prüfhilfe: Windung des Dreiecks zeigt in Richtung der gespeicherten Normale. */
export function windungPasst(m: MeshDaten, tri: number): boolean {
  const idx = (k: number): number => m.indizes[tri * 3 + k] ?? 0;
  const p = (i: number): Vec3 => [m.positionen[i * 3] ?? 0, m.positionen[i * 3 + 1] ?? 0, m.positionen[i * 3 + 2] ?? 0];
  const a = p(idx(0));
  const b = p(idx(1));
  const c = p(idx(2));
  const fn = cross(sub(b, a), sub(c, a));
  const i0 = idx(0);
  const n: Vec3 = [m.normalen[i0 * 3] ?? 0, m.normalen[i0 * 3 + 1] ?? 0, m.normalen[i0 * 3 + 2] ?? 0];
  return dot(fn, n) > 0;
}
