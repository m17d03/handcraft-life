/**
 * Werkstatt-Szene Stil A „Honigwerkstatt“ (docs/art/stil-varianten.md).
 *
 * Mit Assets aus Ticket 012 (GLB + KTX2, `assets.ts`) werden Werkbank, Säge, Massband, Bleistift und die
 * Wand-/Boden-/Fichtentexturen verwendet; ohne Assets (Ladefehler) fällt die Szene auf die prozeduralen
 * Platzhalter aus Ticket 010 zurück. Jedes austauschbare Objekt ist eine benannte Gruppe
 * (`werkbank`, `brett`, `reststueck`, `saege`, `massband`, `bleistift`); Materialnamen beginnen mit der
 * Objekt-ID (`saege.blatt`, `massband.band`, …), damit `hervorheben` nur das Zielobjekt trifft.
 *
 * Licht (Ticket 013, QA-Rest 010): Die tiefstehende Nachmittagssonne fällt als weicher Lichtkegel durch das
 * Fenster auf die Werkbank (Spot mit Halbschatten, Schatten nur dort) – der helle Fleck liegt auf der Bank,
 * nicht auf der Wand; flacher Einfall ergibt lange, weiche Schatten von Brett und Werkzeug. Dazu eine
 * schwache Sonnen-Aufhellung ohne Schatten, kühle Himmels-/warme Bodenaufhellung und schwache
 * Umgebungsreflexion; ACES-Tonemapping im Renderer.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { instanz, KACHEL_M, knoten, texturKopie, type KachelMaps, type KachelName, type WerkstattAssets } from './assets';
import { brettStuecke, hauptLaengeMm, mmNachWelt, bezug, type BrettLage } from './brett-koordinaten';
import { dielenBoden, fasenQuader, type FasenQuaderOptionen, type MeshDaten } from './geometrie';
import type { HolzTexturen } from './holztextur';
import { normalize, type Aabb, type Vec3 } from './mathe';
import type { PickZiel } from './picking';
import { holzMaps, MASSBAND_TEXTUR_MM, massbandTextur, weichesRechteck } from './texturen';
import { BRETT, BRETT_OBEN_Y, RAUM, WERKBANK, WERKBANK_AABB } from './werkstatt-layout';

/** Palette Stil A (sRGB). Holz-Töne sind Multiplikatoren auf die Fichtentextur. */
export const PALETTE = {
  tiefe: '#1f1a15',
  eicheTon: '#a08068', // ergibt mit Fichtentextur ≈ Eiche #C58F55
  nussTon: '#86685a', // ≈ Nussbaum #8E5D33
  bodenTon: '#45342a', // dunkles Holz ≈ #3B2A1C
  deckeTon: '#5a4434',
  wand: '#857c72',
  wandPutz: '#b3a99e', // Multiplikator auf die Putztextur (warm gebrochenes Weiss → ruhiger Mittelton)
  stahl: '#7d8a8f',
  bernstein: '#d9a35b',
  hellAkzent: '#ffd08a',
  tanne: '#2f5a4a',
  graphit: '#2b2724',
  fuge: '#1a130d',
  riss: '#22160d',
  sonne: '#ffcf9c', // ca. 3500 K
  himmel: '#8ea2bd', // kühle Schattenseite
  bodenLicht: '#4a3a30',
  fenster: '#fff0d6',
} as const;

const HERVORHEBUNG = { farbe: '#ffb35c', staerke: 0.45 } as const;

/** Fenster in der linken Wand (Mitte), Quelle des Sonnenkegels. */
const FENSTER = { z: -1.15, y: 1.7, breite: 1.3, hoehe: 1.0 } as const;
/** Sonnenkegel: vom Fenster flach (≈ 15°) auf die Werkbank, Ziel leicht links der Mitte. */
const SONNE_ZIEL: Vec3 = [-0.15, WERKBANK.hoehe, WERKBANK.z + 0.05];
const SONNE_QUELLE: Vec3 = [-RAUM.breite / 2 + 0.35, FENSTER.y + 0.05, FENSTER.z - 0.05];

/** Säge (Modell): Punkt auf der Zahnlinie, der an der Brett-Hinterkante sitzt (m, Modellkoordinaten). */
const SAEGE_ANSATZ_Z = -0.5;
const SAEGE_ZAHN_Y = -0.055;

export interface SaegeZustand {
  readonly versatzMm: number;
  readonly tiefe01: number;
  readonly driftGrad: number;
}

/** Endrisse je Brettende (Länge in mm ab dem Ende), null = kein Riss. */
export interface EndRisse {
  readonly a: number | null;
  readonly b: number | null;
}

/** Winkelfehler der Werksenden a/b in Grad (Vorzeichen wie `Ende.winkel_grad` im Kern). */
export interface EndWinkel {
  readonly a: number;
  readonly b: number;
}

/**
 * Überzeichnung der Endwinkel in der Darstellung (Director-Entscheid Ticket 013, QA F1): echte Fehler von
 * 1–2 mm auf 140 mm Breite wären aus der Arbeitsansicht unsichtbar. Dreifach gezeichnet bleibt ein schiefes
 * Ende als schräge Kante erkennbar; die Spielregeln rechnen mit dem echten Winkel.
 */
export const ENDWINKEL_UEBERZEICHNUNG = 3;

/**
 * Brett-Quader schräg abschneiden: Punkte nahe dem linken (−x) bzw. rechten (+x) Ende werden um tan(Winkel)·z
 * verschoben. Positiver Winkel = die Kante, an der der Massband-Haken greift (Hinterkante, z < 0), steht vor.
 */
export function endenScheren(positionen: Float32Array, winkelLinksGrad: number, winkelRechtsGrad: number): void {
  const kl = Math.tan((winkelLinksGrad * ENDWINKEL_UEBERZEICHNUNG * Math.PI) / 180);
  const kr = Math.tan((winkelRechtsGrad * ENDWINKEL_UEBERZEICHNUNG * Math.PI) / 180);
  for (let i = 0; i < positionen.length; i += 3) {
    const x = positionen[i] ?? 0;
    const z = positionen[i + 2] ?? 0;
    positionen[i] = x + (x < 0 ? kl * z : -kr * z);
  }
}

export interface SzenenZustand {
  readonly lage: BrettLage;
  readonly markierungMm: number | null;
  readonly massbandMm: number | null;
  readonly saege: SaegeZustand | null;
  readonly hervorgehoben: string | null;
  readonly risse: EndRisse;
  readonly winkel: EndWinkel;
}

function geometrie(m: MeshDaten): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.positionen, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normalen, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(m.uvs, 2));
  g.setAttribute('color', new THREE.BufferAttribute(m.farben, 3));
  g.setIndex(new THREE.BufferAttribute(m.indizes, 1));
  return g;
}

const quader = (o: FasenQuaderOptionen, pos: Vec3): THREE.BufferGeometry => geometrie(fasenQuader(o)).translate(pos[0], pos[1], pos[2]);

/**
 * Brett-Geometrie mit zwei Materialgruppen: 0 = Fläche/Kanten (Fichte längs), 1 = Stirnseiten (Hirnholz).
 * Stirn = Dreiecke, deren ursprüngliche Normale entlang x zeigt. Normalen danach neu (Enden sind geschert).
 */
function mitHirnGruppe(g: THREE.BufferGeometry, m: MeshDaten): THREE.BufferGeometry {
  const flaeche: number[] = [];
  const stirn: number[] = [];
  for (let t = 0; t < m.indizes.length; t += 3) {
    const i0 = m.indizes[t] ?? 0;
    const tri = [i0, m.indizes[t + 1] ?? 0, m.indizes[t + 2] ?? 0];
    (Math.abs(m.normalen[i0 * 3] ?? 0) > 0.9 ? stirn : flaeche).push(...tri);
  }
  g.setIndex([...flaeche, ...stirn]);
  g.clearGroups();
  g.addGroup(0, flaeche.length, 0);
  g.addGroup(flaeche.length, stirn.length, 1);
  g.computeVertexNormals();
  return g;
}

interface HolzKarten {
  readonly albedo: THREE.Texture;
  readonly orm: THREE.Texture;
  readonly normal: THREE.Texture;
}

/** Bewegliche Teile des Massband-Modells (Knoten laut assets-phase1.md). */
interface MassbandModell {
  readonly band: THREE.Object3D;
  readonly haken: THREE.Object3D;
  readonly austrittZ: number;
  readonly bandKarten: THREE.Texture[];
  /** Höhe Gehäusemitte über der Auflage (m). */
  readonly gehaeuseHalbeHoehe: number;
  /** Höhe der Bandunterseite über der Gehäusemitte (m, negativ). */
  readonly bandY: number;
}

export class WerkstattSzene {
  readonly szene = new THREE.Scene();
  /** true, wenn die Modelle/Texturen aus Ticket 012 eingebaut sind (sonst Platzhalter). */
  readonly mitAssets: boolean;
  private readonly entsorgen: { dispose(): void }[] = [];
  private readonly hervorMat = new Map<string, THREE.MeshStandardMaterial[]>();
  private readonly gruppen = new Map<string, THREE.Object3D>();
  private readonly brettMat: THREE.MeshStandardMaterial;
  private readonly hirnMat: THREE.MeshStandardMaterial;
  private readonly brettKontakt: { brett: THREE.Mesh; reststueck: THREE.Mesh };
  private readonly restMat: THREE.MeshStandardMaterial;
  private readonly brett: THREE.Mesh;
  private readonly rest: THREE.Mesh;
  private readonly bezugsMarke: THREE.Mesh;
  private readonly markierung: THREE.Mesh;
  private readonly fuge: THREE.Mesh;
  private readonly risse: { a: THREE.Mesh; b: THREE.Mesh };
  private readonly saege: THREE.Group;
  private readonly massband: THREE.Group;
  // Platzhalter-Massband (ohne Assets)
  private platzhalterBand: {
    band: THREE.Mesh;
    textur: THREE.CanvasTexture;
    texturRueck: THREE.CanvasTexture;
    mat: THREE.MeshStandardMaterial;
    haken: THREE.Mesh;
    gehaeuse: THREE.Mesh;
  } | null = null;
  private massbandModell: MassbandModell | null = null;
  private brettSchluessel = '';
  private hervor: string | null = null;
  private umgebung: THREE.WebGLRenderTarget | null = null;

  constructor(holz: HolzTexturen | null, anisotropie: number, assets: WerkstattAssets | null = null) {
    const s = this.szene;
    s.background = new THREE.Color(PALETTE.tiefe);
    this.mitAssets = assets !== null;
    const kopien = new Map<THREE.Texture, THREE.Texture>();
    /** Eigene Kopie einer Kacheltextur mit Wiederholung `wdh` (Kachelgrösse ↔ UV-Einheit der Geometrie). */
    const kachel = (name: KachelName, uvMeter: number): HolzKarten => {
      if (!assets) throw new Error('kachel() ohne Assets');
      const m: KachelMaps = assets.texturen[name];
      const wdh = uvMeter / KACHEL_M[name];
      const k = (t: THREE.Texture): THREE.Texture => {
        const c = texturKopie(t, kopien);
        c.repeat.set(wdh, wdh);
        c.anisotropy = anisotropie;
        c.needsUpdate = true;
        this.merke(c);
        return c;
      };
      // eigene Kopien je Wiederholung (Textur-Objekte tragen die Wiederholung)
      kopien.clear();
      return { albedo: k(m.farbe), orm: k(m.orm), normal: k(m.normal) };
    };
    let maps: HolzKarten;
    if (assets) {
      // Fichte längs (Kachel 0,5 m); Geometrie-UVs laufen in 1,2-m-Einheiten (uvMeter des Bretts)
      maps = kachel('fichte-laengs', 1.2);
    } else {
      if (!holz) throw new Error('WerkstattSzene: weder Assets noch prozedurale Holztextur');
      const h = holzMaps(holz, anisotropie);
      this.merke(h.albedo, h.orm, h.normal);
      maps = h;
    }

    const holzMat = (name: string, ton: string): THREE.MeshStandardMaterial =>
      this.mat(name, {
        color: ton,
        map: maps.albedo,
        roughnessMap: maps.orm,
        normalMap: maps.normal,
        normalScale: new THREE.Vector2(0.55, 0.55),
        roughness: 1,
        metalness: 0,
        vertexColors: true,
      });

    // ---- Raum
    const { breite: W, tiefe: D, hoehe: H, wand: T } = RAUM;
    if (assets) {
      const b = kachel('boden-dielen', 1);
      const bodenGeo = new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2);
      for (const t of [b.albedo, b.orm, b.normal]) t.repeat.set(W / KACHEL_M['boden-dielen'], D / KACHEL_M['boden-dielen']);
      this.mesh(
        'boden',
        bodenGeo,
        this.mat('boden', { color: '#d9cfc4', map: b.albedo, roughnessMap: b.orm, aoMap: b.orm, normalMap: b.normal, roughness: 1, metalness: 0 }),
        { empfaengt: false },
      );
    } else {
      const bodenMat = holzMat('boden', PALETTE.bodenTon);
      bodenMat.normalScale.set(0.35, 0.35);
      this.mesh('boden', geometrie(dielenBoden(W, D, 14, 0.004)), bodenMat, { empfaengt: false });
    }
    const wandMat = assets
      ? (() => {
          const w = kachel('wand-putz', 2);
          return this.mat('wand', { color: PALETTE.wandPutz, map: w.albedo, roughnessMap: w.orm, normalMap: w.normal, roughness: 1, metalness: 0, vertexColors: true });
        })()
      : this.mat('wand', { color: PALETTE.wand, roughness: 0.95, metalness: 0, vertexColors: true });
    const wand = (g: Vec3, p: Vec3): THREE.BufferGeometry => quader({ groesse: g, fase: 0.01, uvMeter: 2 }, p);
    this.mesh(
      'raum.waende',
      mergeGeometries([
        wand([W + 2 * T, H, T], [0, H / 2, -D / 2 - T / 2]),
        wand([W + 2 * T, H, T], [0, H / 2, D / 2 + T / 2]),
        wand([T, H, D], [-W / 2 - T / 2, H / 2, 0]),
        wand([T, H, D], [W / 2 + T / 2, H / 2, 0]),
      ]),
      wandMat,
      { empfaengt: false },
    );
    const deckeMat = holzMat('decke', PALETTE.deckeTon);
    const balken: THREE.BufferGeometry[] = [quader({ groesse: [W, 0.04, D], fase: 0.005, faser: 2, uvMeter: 2 }, [0, H + 0.02, 0])];
    for (const z of [-1.6, 0, 1.6]) balken.push(quader({ groesse: [W, 0.16, 0.12], fase: 0.008, uvMeter: 1.5, uvVersatz: [z, 0.3] }, [0, H - 0.08, z]));
    this.mesh('raum.decke', mergeGeometries(balken), deckeMat, { empfaengt: false });
    const leisteMat = holzMat('raum.leisten', PALETTE.nussTon);
    this.mesh(
      'raum.leisten',
      mergeGeometries([
        quader({ groesse: [W, 0.08, 0.015], fase: 0.003 }, [0, 0.04, -D / 2 + 0.0075]),
        quader({ groesse: [W, 0.08, 0.015], fase: 0.003 }, [0, 0.04, D / 2 - 0.0075]),
        quader({ groesse: [0.015, 0.08, D], fase: 0.003, faser: 2 }, [-W / 2 + 0.0075, 0.04, 0]),
        quader({ groesse: [0.015, 0.08, D], fase: 0.003, faser: 2 }, [W / 2 - 0.0075, 0.04, 0]),
      ]),
      leisteMat,
      { empfaengt: false },
    );

    const weich = weichesRechteck();
    this.merke(weich);

    // ---- Fenster (linke Wand): leuchtende Scheibe + Rahmen + Fensterbank
    const { z: fz, y: fy, breite: fb, hoehe: fh } = FENSTER;
    const scheibe = new THREE.Mesh(
      new THREE.PlaneGeometry(fb, fh).rotateY(Math.PI / 2).translate(-W / 2 + 0.004, fy, fz),
      this.basis('fenster.scheibe', { color: new THREE.Color(PALETTE.fenster).multiplyScalar(2.2) }),
    );
    scheibe.name = 'fenster.scheibe';
    this.merke(scheibe.geometry);
    s.add(scheibe);
    const rahmen: THREE.BufferGeometry[] = [];
    const rb = 0.06;
    rahmen.push(quader({ groesse: [0.05, rb, fb + rb], fase: 0.004, faser: 2 }, [-W / 2 + 0.025, fy + fh / 2, fz]));
    rahmen.push(quader({ groesse: [0.05, rb, fb + rb], fase: 0.004, faser: 2 }, [-W / 2 + 0.025, fy - fh / 2, fz]));
    rahmen.push(quader({ groesse: [0.05, fh, rb], fase: 0.004, faser: 1 }, [-W / 2 + 0.025, fy, fz - fb / 2]));
    rahmen.push(quader({ groesse: [0.05, fh, rb], fase: 0.004, faser: 1 }, [-W / 2 + 0.025, fy, fz + fb / 2]));
    rahmen.push(quader({ groesse: [0.04, fh, 0.035], fase: 0.003, faser: 1 }, [-W / 2 + 0.02, fy, fz]));
    rahmen.push(quader({ groesse: [0.04, 0.035, fb], fase: 0.003, faser: 2 }, [-W / 2 + 0.02, fy, fz]));
    rahmen.push(quader({ groesse: [0.16, 0.03, fb + 0.2], fase: 0.004, faser: 2 }, [-W / 2 + 0.08, fy - fh / 2 - 0.045, fz]));
    this.mesh('fenster.rahmen', mergeGeometries(rahmen), holzMat('fenster.rahmen', PALETTE.nussTon), { empfaengt: false });

    // ---- Werkbank
    const moebel = holzMat('moebel', PALETTE.nussTon);
    const { x: bx, z: bz, laenge: bl, tiefe: bt, hoehe: bh, platte: bp } = WERKBANK;
    const werkbank = new THREE.Group();
    werkbank.name = 'werkbank';
    if (assets) {
      const wb = this.modell(assets, 'werkbank', { Werkbank_Platte: 'werkbank.platte', Werkbank_Gestell: 'werkbank.gestell' });
      // Eichenplatte etwas dunkler: mehr Kontrast zum hellen Fichtenbrett (QA-Stil Ticket 013)
      for (const m of this.hervorMat.get('werkbank') ?? []) if (m.name === 'werkbank.platte') m.color.multiplyScalar(0.8);
      // Modell 1,5 × 0,6 m → Layout (Plattenoberkante bleibt bei 0,9 m)
      wb.scale.set(bl / 1.5, 1, bt / 0.6);
      wb.position.set(bx, 0, bz);
      knoten(wb, 'Platte').traverse((o) => {
        if (o instanceof THREE.Mesh) o.receiveShadow = true;
      });
      werkbank.add(wb);
    } else {
      const eiche = holzMat('werkbank.platte', PALETTE.eicheTon);
      const nuss = holzMat('werkbank.gestell', PALETTE.nussTon);
      this.hervorMat.set('werkbank', [eiche, nuss]);
      this.mesh(
        'werkbank.platte',
        quader({ groesse: [bl, bp, bt], fase: 0.003, uvMeter: 3.2, uvVersatz: [0.37, 0.61] }, [bx, bh - bp / 2, bz]),
        eiche,
        { empfaengt: true, eltern: werkbank },
      );
      const beinH = bh - bp;
      const gestell: THREE.BufferGeometry[] = [];
      const lx = bl / 2 - 0.12;
      const lz = bt / 2 - 0.09;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          gestell.push(quader({ groesse: [0.09, beinH, 0.09], fase: 0.003, faser: 1, uvVersatz: [sx * 0.3, sz * 0.2] }, [bx + sx * lx, beinH / 2, bz + sz * lz]));
        }
        gestell.push(quader({ groesse: [0.07, 0.07, bt - 0.12], fase: 0.003, faser: 2 }, [bx + sx * lx, 0.22, bz]));
      }
      for (const sz of [-1, 1]) gestell.push(quader({ groesse: [bl - 0.2, 0.1, 0.03], fase: 0.003 }, [bx, beinH - 0.05, bz + sz * (lz + 0.03)]));
      gestell.push(quader({ groesse: [bl - 0.3, 0.025, bt - 0.2], fase: 0.003, uvVersatz: [0.1, 0.4] }, [bx, 0.27, bz]));
      gestell.push(quader({ groesse: [0.42, 0.14, 0.06], fase: 0.004 }, [bx - bl / 2 + 0.3, bh - 0.08, bz + bt / 2 + 0.03]));
      this.mesh('werkbank.gestell', mergeGeometries(gestell), nuss, { empfaengt: false, eltern: werkbank });
    }
    s.add(werkbank);
    this.gruppen.set('werkbank', werkbank);

    // Kontaktschatten unter der Werkbank (weiches Rechteck, transparent)
    const kontakt = new THREE.Mesh(
      new THREE.PlaneGeometry(bl + 0.5, bt + 0.45).rotateX(-Math.PI / 2).translate(bx, 0.002, bz),
      this.basis('werkbank.kontaktschatten', { color: '#000000', alphaMap: weich, transparent: true, opacity: 0.6, depthWrite: false }),
    );
    kontakt.name = 'werkbank.kontaktschatten';
    kontakt.renderOrder = 1;
    this.merke(kontakt.geometry);
    s.add(kontakt);

    // ---- Wandregal über der Werkbank mit Dosen/Gläsern (instanziert)
    const regalY = 1.62;
    const regalZ = -D / 2 + 0.12;
    this.mesh(
      'regal',
      mergeGeometries([
        quader({ groesse: [1.7, 0.028, 0.22], fase: 0.003 }, [0.1, regalY, regalZ]),
        quader({ groesse: [0.03, 0.18, 0.18], fase: 0.003, faser: 1 }, [-0.6, regalY - 0.1, regalZ - 0.01]),
        quader({ groesse: [0.03, 0.18, 0.18], fase: 0.003, faser: 1 }, [0.8, regalY - 0.1, regalZ - 0.01]),
      ]),
      moebel,
      { empfaengt: false },
    );
    const dosenGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.12, 16);
    this.merke(dosenGeo);
    const dosen = new THREE.InstancedMesh(dosenGeo, this.mat('regal.dosen', { color: '#ffffff', roughness: 0.45, metalness: 0.3 }), 7);
    dosen.name = 'regal.dosen';
    const farben = ['#7d8a8f', '#2f5a4a', '#8e5d33', '#d9a35b', '#7d8a8f', '#3b2a1c', '#c58f55'];
    const m4 = new THREE.Matrix4();
    farben.forEach((f, i) => {
      const hoch = 0.8 + ((i * 37) % 5) * 0.12;
      m4.compose(
        new THREE.Vector3(-0.5 + i * 0.2 + ((i * 13) % 3) * 0.01, regalY + 0.014 + 0.06 * hoch, regalZ + 0.01),
        new THREE.Quaternion(),
        new THREE.Vector3(1, hoch, 1),
      );
      dosen.setMatrixAt(i, m4);
      dosen.setColorAt(i, new THREE.Color(f));
    });
    s.add(dosen);

    // ---- Holzlager an der rechten Wand (instanzierte Bretter)
    const lagerGeo = geometrie(fasenQuader({ groesse: [0.14, 0.022, 2.2], fase: 0.001, faser: 2, uvMeter: 1.2 }));
    this.merke(lagerGeo);
    const lager = new THREE.InstancedMesh(lagerGeo, holzMat('holzlager', '#e8cfae'), 9);
    lager.name = 'holzlager';
    for (let i = 0; i < 9; i++) {
      const lage = Math.floor(i / 3);
      const k = i % 3;
      m4.compose(
        new THREE.Vector3(W / 2 - 0.16 - k * 0.15, 0.4 + lage * 0.024, 0.35 + ((i * 7) % 3) * 0.03),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ((i * 5) % 3 - 1) * 0.01),
        new THREE.Vector3(1, 1, 1),
      );
      lager.setMatrixAt(i, m4);
      const t = 0.85 + ((i * 29) % 7) * 0.025;
      lager.setColorAt(i, new THREE.Color(t, t * 0.97, t * 0.93));
    }
    s.add(lager);
    const konsole: THREE.BufferGeometry[] = [];
    for (const z of [-0.55, 0.35, 1.25]) {
      konsole.push(quader({ groesse: [0.5, 0.04, 0.05], fase: 0.003 }, [W / 2 - 0.25, 0.37, z]));
      konsole.push(quader({ groesse: [0.04, 0.37, 0.05], fase: 0.003, faser: 1 }, [W / 2 - 0.03, 0.185, z]));
    }
    this.mesh('holzlager.konsolen', mergeGeometries(konsole), moebel, { empfaengt: false });

    // ---- Brett (Fichte) und Reststück; Geometrie folgt der Lage (setzeBrett)
    this.brettMat = holzMat('brett', '#ffffff');
    this.restMat = holzMat('reststueck', '#ffffff');
    this.hervorMat.set('reststueck', [this.restMat]);
    // Stirnseiten (Hirnholz): eigene Textur aus 012, sonst dunkler getönt. UV der Stirn: 1 m = 3,33 Einheiten.
    if (assets) {
      const h = kachel('fichte-hirn', 1.2 / 4);
      this.hirnMat = this.mat('brett.hirnholz', { color: '#ffffff', map: h.albedo, roughnessMap: h.orm, normalMap: h.normal, roughness: 1, metalness: 0 });
    } else {
      this.hirnMat = holzMat('brett.hirnholz', '#b08a62');
    }
    this.hervorMat.set('brett', [this.brettMat, this.hirnMat]);
    this.brett = this.mesh('brett', new THREE.BufferGeometry(), [this.brettMat, this.hirnMat], { empfaengt: true, wirft: true });
    this.rest = this.mesh('reststueck', new THREE.BufferGeometry(), [this.restMat, this.hirnMat], { empfaengt: true, wirft: true });
    // Kontaktschatten unter Brett und Reststück: hebt das helle Fichtenbrett von der Eichenplatte ab
    const kontaktMat = this.basis('brett.kontaktschatten', { color: '#000000', alphaMap: weich, transparent: true, opacity: 0.55, depthWrite: false });
    const kontaktGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.merke(kontaktGeo);
    const kontaktMesh = (name: string): THREE.Mesh => {
      const m = new THREE.Mesh(kontaktGeo, kontaktMat);
      m.name = name;
      m.renderOrder = 1;
      m.visible = false;
      s.add(m);
      return m;
    };
    this.brettKontakt = { brett: kontaktMesh('brett.kontakt'), reststueck: kontaktMesh('reststueck.kontakt') };
    this.gruppen.set('brett', this.brett);
    this.gruppen.set('reststueck', this.rest);
    const markeMat = this.mat('brett.bezugsende', { color: PALETTE.bernstein, emissive: PALETTE.bernstein, emissiveIntensity: 0.35, roughness: 0.6 });
    this.bezugsMarke = this.mesh('brett.bezugsende', new THREE.BoxGeometry(0.004, 0.0004, BRETT.breiteMm / 1000 - 0.004), markeMat, {});
    this.markierung = this.mesh(
      'brett.markierung',
      new THREE.BoxGeometry(0.0007, 0.0003, BRETT.breiteMm / 1000 - 0.002),
      this.mat('brett.markierung', { color: PALETTE.graphit, roughness: 0.45, metalness: 0.2 }),
      {},
    );
    this.fuge = this.mesh(
      'brett.fuge',
      new THREE.BoxGeometry(BRETT.fugeMm / 1000, 1, BRETT.breiteMm / 1000 + 0.0006).translate(0, -0.5, 0),
      this.mat('brett.fuge', { color: PALETTE.fuge, roughness: 1 }),
      {},
    );
    // Endriss: dunkler, spitz zulaufender Spalt auf der Oberseite (Länge 1 m entlang +x, skaliert) und Kerbe in der Stirn
    // Breiter, dunkler Spalt (≈ 9 mm offen am Ende, läuft spitz aus), damit er in der Arbeitsansicht lesbar ist (QA F4)
    const rissForm = new THREE.Shape([
      new THREE.Vector2(0, -0.0045),
      new THREE.Vector2(0.35, -0.0022),
      new THREE.Vector2(0.7, -0.0012),
      new THREE.Vector2(1, -0.0001),
      new THREE.Vector2(1, 0.0001),
      new THREE.Vector2(0.65, 0.0016),
      new THREE.Vector2(0.3, 0.0018),
      new THREE.Vector2(0, 0.0045),
    ]);
    const rissGeo = mergeGeometries([
      new THREE.ShapeGeometry(rissForm).rotateX(-Math.PI / 2).translate(0, 0.0003, 0),
      new THREE.PlaneGeometry(0.009, (BRETT.dickeMm / 1000) * 0.85).rotateY(-Math.PI / 2).translate(-0.0004, -BRETT.dickeMm / 2000, 0),
    ]);
    const rissMat = this.mat('brett.riss', { color: PALETTE.riss, roughness: 1, side: THREE.DoubleSide });
    this.risse = {
      a: this.mesh('brett.riss.a', rissGeo, rissMat, {}),
      b: this.mesh('brett.riss.b', rissGeo, rissMat, {}),
    };

    // ---- Säge, Massband, Bleistift
    this.saege = new THREE.Group();
    this.saege.name = 'saege';
    this.massband = new THREE.Group();
    this.massband.name = 'massband';
    const bleistift = new THREE.Group();
    bleistift.name = 'bleistift';
    if (assets) {
      const sm = this.modell(assets, 'saege', { Saege_Blatt: 'saege.blatt', Saege_Griff: 'saege.griff' });
      // Drehpunkt = Zahnlinie bei SAEGE_ANSATZ_Z; das Modell hängt darunter
      sm.position.set(0, -SAEGE_ZAHN_Y, -SAEGE_ANSATZ_Z);
      sm.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          const m = o.material as THREE.Material;
          // Sägezahnung als Alpha-Maske: mit MSAA weiche Kanten statt Treppen
          if (m.alphaTest > 0) m.alphaToCoverage = true;
        }
      });
      this.saege.add(sm);

      const mb = this.modell(assets, 'massband', { Massband_Gehaeuse: 'massband.gehaeuse', Massband_Band: 'massband.band' });
      mb.traverse((o) => {
        if (o instanceof THREE.Mesh) o.castShadow = true;
      });
      const band = knoten(mb, 'Band');
      const haken = knoten(mb, 'Haken');
      const austritt = knoten(mb, 'Bandaustritt');
      const bandMesh = band instanceof THREE.Mesh ? band : band.getObjectByProperty('type', 'Mesh');
      const bandKarten: THREE.Texture[] = [];
      if (bandMesh instanceof THREE.Mesh) {
        const m = bandMesh.material as THREE.MeshStandardMaterial;
        for (const t of [m.map, m.roughnessMap, m.metalnessMap, m.aoMap]) if (t && !bandKarten.includes(t)) bandKarten.push(t);
        bandMesh.castShadow = false;
        bandMesh.receiveShadow = true;
      }
      const gehaeuseBox = new THREE.Box3().setFromObject(knoten(mb, 'Gehaeuse'));
      this.massbandModell = {
        band,
        haken,
        austrittZ: austritt.position.z,
        bandKarten,
        gehaeuseHalbeHoehe: -gehaeuseBox.min.y,
        bandY: austritt.position.y,
      };
      this.massband.add(mb);

      const bs = this.modell(assets, 'bleistift', { Bleistift: 'bleistift.koerper' });
      bs.traverse((o) => {
        if (o instanceof THREE.Mesh) o.castShadow = true;
      });
      bleistift.add(bs);
      bleistift.position.set(0.32, WERKBANK.hoehe + 0.0042, BRETT.z - 0.2);
      bleistift.rotation.set(0, 1.25, 0);
    } else {
      this.saegePlatzhalter();
      this.massbandPlatzhalter(anisotropie);
      const stiftMat = this.mat('bleistift.schaft', { color: PALETTE.tanne, roughness: 0.4, metalness: 0 });
      const spitzeMat = this.mat('bleistift.spitze', { color: '#e3c08d', roughness: 0.7, metalness: 0 });
      this.hervorMat.set('bleistift', [stiftMat, spitzeMat]);
      this.mesh('bleistift.schaft', new THREE.CylinderGeometry(0.0038, 0.0038, 0.16, 6).rotateZ(Math.PI / 2), stiftMat, { wirft: true, eltern: bleistift });
      this.mesh('bleistift.spitze', new THREE.ConeGeometry(0.0038, 0.022, 6).rotateZ(-Math.PI / 2).translate(0.091, 0, 0), spitzeMat, { wirft: true, eltern: bleistift });
      bleistift.position.set(0.32, WERKBANK.hoehe + 0.0038, BRETT.z - 0.2);
      bleistift.rotation.y = 0.35;
    }
    s.add(this.saege, this.massband, bleistift);
    this.gruppen.set('saege', this.saege);
    this.gruppen.set('massband', this.massband);
    this.gruppen.set('bleistift', bleistift);

    // ---- Licht
    // Sonnenkegel durch das Fenster: heller, warmer Fleck auf der Werkbank mit weichem Rand; einziger Schatten.
    const kegel = new THREE.SpotLight(PALETTE.sonne);
    const quelle = new THREE.Vector3(...SONNE_QUELLE);
    const ziel = new THREE.Vector3(...SONNE_ZIEL);
    const abstand = quelle.distanceTo(ziel);
    // Beleuchtungsstärke wie die frühere Sonne (≈ 3,2π) am Ziel: I = E · d² (physikalischer Abfall)
    kegel.intensity = 4.2 * Math.PI * abstand * abstand;
    kegel.distance = 0;
    kegel.decay = 2;
    kegel.angle = 0.16;
    kegel.penumbra = 0.85;
    kegel.position.copy(quelle);
    kegel.target.position.copy(ziel);
    kegel.castShadow = true;
    kegel.shadow.mapSize.set(1024, 1024);
    kegel.shadow.camera.near = abstand - 1.2;
    kegel.shadow.camera.far = abstand + 4.5;
    kegel.shadow.bias = -0.0003;
    kegel.shadow.normalBias = 0.01;
    kegel.shadow.radius = 5;
    s.add(kegel, kegel.target);
    // Schwache Sonnen-Aufhellung im Raum (gleiche Richtung, ohne Schatten), damit Wände nicht absaufen
    const sonne = new THREE.DirectionalLight(PALETTE.sonne, 0.4 * Math.PI);
    const richtung = normalize([ziel.x - quelle.x, ziel.y - quelle.y, ziel.z - quelle.z]);
    sonne.position.copy(ziel).addScaledVector(new THREE.Vector3(...richtung), -6);
    sonne.target.position.copy(ziel);
    s.add(sonne, sonne.target);
    s.add(new THREE.HemisphereLight(PALETTE.himmel, PALETTE.bodenLicht, 0.5 * Math.PI));
    s.environmentIntensity = 0.3;
  }

  // ------------------------------------------------------------------ Aufbau-Hilfen

  /** Modell-Instanz mit umbenannten Materialien (Präfix = Objekt-ID für `hervorheben`). */
  private modell(assets: WerkstattAssets, name: 'werkbank' | 'saege' | 'massband' | 'bleistift', namen: Record<string, string>): THREE.Object3D {
    const { wurzel, entsorgen } = instanz(assets.modelle[name]);
    this.merke(...entsorgen);
    const mats: THREE.MeshStandardMaterial[] = [];
    wurzel.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m instanceof THREE.MeshStandardMaterial && !mats.includes(m)) {
          m.name = namen[m.name] ?? `${name}.${m.name.toLowerCase()}`;
          mats.push(m);
        }
      }
    });
    this.hervorMat.set(name, mats);
    return wurzel;
  }

  private saegePlatzhalter(): void {
    const blattMat = this.mat('saege.blatt', { color: PALETTE.stahl, roughness: 0.4, metalness: 0.85, side: THREE.DoubleSide });
    const griffMat = this.mat('saege.griff', { color: '#7a4a2a', roughness: 0.5, metalness: 0 });
    this.hervorMat.set('saege', [blattMat, griffMat]);
    const blattForm = new THREE.Shape([new THREE.Vector2(-0.06, 0), new THREE.Vector2(0.36, 0), new THREE.Vector2(0.36, 0.12), new THREE.Vector2(-0.06, 0.07)]);
    const blattGeo = new THREE.ExtrudeGeometry(blattForm, { depth: 0.0009, bevelEnabled: false }).translate(0, 0, -0.00045);
    this.mesh('saege.blatt', blattGeo, blattMat, { wirft: true, eltern: this.saege });
    const griffAussen = new THREE.Shape();
    griffAussen.moveTo(0.34, 0.0);
    griffAussen.lineTo(0.47, 0.02);
    griffAussen.quadraticCurveTo(0.5, 0.09, 0.47, 0.15);
    griffAussen.lineTo(0.36, 0.15);
    griffAussen.quadraticCurveTo(0.33, 0.08, 0.34, 0.0);
    const loch = new THREE.Path();
    loch.moveTo(0.385, 0.04);
    loch.lineTo(0.445, 0.05);
    loch.quadraticCurveTo(0.46, 0.085, 0.445, 0.12);
    loch.lineTo(0.39, 0.12);
    loch.quadraticCurveTo(0.375, 0.08, 0.385, 0.04);
    griffAussen.holes.push(loch);
    const griffGeo = new THREE.ExtrudeGeometry(griffAussen, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: 6 }).translate(0, 0, -0.009);
    this.mesh('saege.griff', griffGeo, griffMat, { wirft: true, eltern: this.saege });
  }

  private massbandPlatzhalter(anisotropie: number): void {
    const gehaeuseMat = this.mat('massband.gehaeuse', { color: PALETTE.bernstein, roughness: 0.42, metalness: 0, vertexColors: true });
    const textur = massbandTextur(anisotropie);
    const texturRueck = massbandTextur(anisotropie, true);
    this.merke(textur, texturRueck);
    const mat = this.mat('massband.band', { color: '#ffffff', map: textur, roughness: 0.5, metalness: 0.1 });
    this.hervorMat.set('massband', [gehaeuseMat, mat]);
    const gehaeuse = this.mesh('massband.gehaeuse', geometrie(fasenQuader({ groesse: [0.068, 0.064, 0.034], fase: 0.009, stirnFarbe: [1, 1, 1] })), gehaeuseMat, {
      wirft: true,
      eltern: this.massband,
    });
    const band = this.mesh('massband.band', new THREE.PlaneGeometry(1, 0.019).rotateX(-Math.PI / 2).translate(0.5, 0, 0), mat, {
      wirft: false,
      empfaengt: true,
      eltern: this.massband,
    });
    const haken = this.mesh('massband.haken', new THREE.BoxGeometry(0.0015, 0.02, 0.02), this.mat('massband.haken', { color: PALETTE.stahl, roughness: 0.35, metalness: 0.9 }), {
      eltern: this.massband,
    });
    this.platzhalterBand = { band, textur, texturRueck, mat, haken, gehaeuse };
  }

  private merke(...dinge: { dispose(): void }[]): void {
    this.entsorgen.push(...dinge);
  }

  private mat(name: string, p: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial(p);
    m.name = name;
    this.merke(m);
    return m;
  }

  private basis(name: string, p: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial {
    const m = new THREE.MeshBasicMaterial(p);
    m.name = name;
    this.merke(m);
    return m;
  }

  private mesh(name: string, g: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], o: { wirft?: boolean; empfaengt?: boolean; eltern?: THREE.Object3D }): THREE.Mesh {
    const mesh = new THREE.Mesh(g, m);
    mesh.name = name;
    mesh.castShadow = o.wirft ?? false;
    mesh.receiveShadow = o.empfaengt ?? false;
    this.merke(g);
    (o.eltern ?? this.szene).add(mesh);
    return mesh;
  }

  /** Umgebungsreflexion (vorgefilterte Cube-Map aus RoomEnvironment); nach Kontextverlust neu erzeugen. */
  umgebungErzeugen(renderer: THREE.WebGLRenderer): void {
    this.umgebung?.dispose();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const raum = new RoomEnvironment();
    this.umgebung = pmrem.fromScene(raum, 0.04);
    this.szene.environment = this.umgebung.texture;
    raum.dispose();
    pmrem.dispose();
  }

  // ------------------------------------------------------------------ Zustand → Bild

  aktualisiere(z: SzenenZustand): void {
    this.setzeBrett(z.lage, z.winkel);
    this.setzeRisse(z.lage, z.risse, z.winkel);
    this.setzeMarkierung(z.lage, z.markierungMm);
    this.setzeMassband(z.lage, z.massbandMm);
    this.setzeSaege(z.lage, z.markierungMm, z.saege);
    this.setzeHervorhebung(z.hervorgehoben);
  }

  /** Winkel des linken/rechten Endes eines Stücks: Werksenden behalten ihren Winkel, Schnittenden sind gerade. */
  private stueckWinkel(lage: BrettLage, id: 'brett' | 'reststueck', w: EndWinkel): { links: number; rechts: number } {
    if (lage.schnittIstMm === null) return { links: w.a, rechts: w.b };
    const bezugA = (lage.bezugsende ?? 'a') === 'a';
    if (id === 'brett') return bezugA ? { links: w.a, rechts: 0 } : { links: 0, rechts: w.b };
    return bezugA ? { links: 0, rechts: w.b } : { links: w.a, rechts: 0 };
  }

  private setzeBrett(lage: BrettLage, winkel: EndWinkel): void {
    const schluessel = `${String(lage.laengeMm)}|${String(lage.bezugsende)}|${String(lage.schnittIstMm)}|${String(winkel.a)}|${String(winkel.b)}`;
    if (schluessel === this.brettSchluessel) return;
    this.brettSchluessel = schluessel;
    const { richtung } = bezug(lage);
    const stuecke = brettStuecke(lage);
    for (const mesh of [this.brett, this.rest, this.brettKontakt.brett, this.brettKontakt.reststueck]) mesh.visible = false;
    for (const st of stuecke) {
      const mesh = st.id === 'brett' ? this.brett : this.rest;
      const kontakt = this.brettKontakt[st.id];
      kontakt.visible = true;
      kontakt.position.set(st.mitte[0], WERKBANK.hoehe + 0.0008, st.mitte[2] + 0.004);
      kontakt.scale.set(st.laengeMm / 1000 + 0.035, 1, BRETT.breiteMm / 1000 + 0.035);
      // Maserung läuft über den Schnitt hinweg weiter: UV-Versatz aus der ursprünglichen Lage
      const urX = st.id === 'brett' ? st.mitte[0] : st.mitte[0] - richtung * BRETT.restAbstandM;
      const daten = fasenQuader({
        groesse: [st.laengeMm / 1000, BRETT.dickeMm / 1000, BRETT.breiteMm / 1000],
        fase: BRETT.faseMm / 1000,
        uvMeter: 1.2,
        uvVersatz: [(urX - BRETT.x) / 1.2 + 0.13, 0.31],
      });
      const w = this.stueckWinkel(lage, st.id, winkel);
      endenScheren(daten.positionen, w.links, w.rechts);
      const neu = mitHirnGruppe(geometrie(daten), daten);
      mesh.geometry.dispose();
      mesh.geometry = neu;
      mesh.position.set(...st.mitte);
      mesh.visible = true;
    }
    this.bezugsMarke.visible = lage.bezugsende !== null;
    const ende = mmNachWelt(lage, 2, 0, 0.0002);
    this.bezugsMarke.position.set(...ende);
  }

  /** Endrisse an den physischen Enden a (links, −x) und b (rechts); nach dem Schnitt am jeweiligen Stück. */
  private setzeRisse(lage: BrettLage, risse: EndRisse, winkel: EndWinkel): void {
    const stuecke = brettStuecke(lage);
    const haupt = stuecke[0];
    const rest = stuecke[1];
    const bezugsende = lage.bezugsende ?? 'a';
    for (const ende of ['a', 'b'] as const) {
      const mesh = this.risse[ende];
      const laenge = risse[ende];
      // Stück, das dieses Ende trägt: vor dem Schnitt das Brett; danach das Teil am Bezugsende bzw. der Rest
      const stueck = lage.schnittIstMm === null || ende === bezugsende ? haupt : rest;
      if (laenge === null || laenge <= 0 || !stueck) {
        mesh.visible = false;
        continue;
      }
      const links = ende === 'a';
      // Riss sitzt 12 mm hinter der Brettmitte; die schräge Stirn verschiebt das Ende dort um tan(w)·z
      const zRel = -0.012;
      const k = Math.tan((winkel[ende] * ENDWINKEL_UEBERZEICHNUNG * Math.PI) / 180);
      const x = links ? stueck.box.min[0] + k * zRel : stueck.box.max[0] - k * zRel;
      mesh.visible = true;
      mesh.position.set(x, stueck.box.max[1], stueck.mitte[2] + zRel);
      // Geometrie läuft entlang +x vom Ende ins Stück; Ende b gespiegelt
      mesh.rotation.set(0, links ? 0 : Math.PI, 0);
      mesh.scale.set(Math.min(laenge, stueck.laengeMm) / 1000, 1, 1);
    }
  }

  private setzeMarkierung(lage: BrettLage, mm: number | null): void {
    const sichtbar = mm !== null && mm >= 0 && mm <= hauptLaengeMm(lage) + BRETT.fugeMm;
    this.markierung.visible = sichtbar;
    if (sichtbar) this.markierung.position.set(...mmNachWelt(lage, mm, 0, 0.00015));
  }

  private setzeMassband(lage: BrettLage, mm: number | null): void {
    if (this.massbandModell) this.setzeMassbandModell(this.massbandModell, lage, mm);
    else this.setzeMassbandPlatzhalter(lage, mm);
  }

  /**
   * Massband-Modell (assets-phase1.md): Haken am Bezugsende, Band an der HINTEREN Brettkante (der Strich bei
   * `mm` bleibt sichtbar), Gehäuse jenseits des Masses auf dem Brett. Ausziehen über `Band.scale.z`,
   * Kachel-Wiederholung und Hakenposition.
   */
  private setzeMassbandModell(m: MassbandModell, lage: BrettLage, mm: number | null): void {
    const g = this.massband;
    const aus = mm !== null && mm > 0;
    const l = aus ? mm / 1000 : 0;
    m.band.visible = aus;
    m.band.scale.z = Math.max(l, 1e-4);
    for (const t of m.bandKarten) t.repeat.x = Math.max(l, 1e-4);
    m.haken.position.z = m.austrittZ - l;
    if (!aus) {
      // Ruhelage hinten links auf der Werkbank
      g.position.set(WERKBANK.x - 0.62, WERKBANK.hoehe + m.gehaeuseHalbeHoehe, WERKBANK.z - 0.16);
      g.rotation.set(0, 0.6, 0, 'YXZ');
      return;
    }
    const { richtung } = bezug(lage);
    const bandZ = -(BRETT.breiteMm / 2000 - 0.0105);
    const haken = mmNachWelt(lage, 0, bandZ * 1000);
    // Gehäuse liegt auf dem Brett; das Band fällt vom Austritt leicht zum Haken an der Brettkante ab.
    const hoehe = m.gehaeuseHalbeHoehe;
    const strecke = l - m.austrittZ; // Haken → Gehäusemitte (austrittZ < 0)
    const abfall = hoehe + m.bandY; // Höhe des Austritts über der Brettoberseite
    const neigung = Math.atan2(Math.max(0, abfall), strecke);
    // Lokal −Z (Richtung Haken) zeigt zum Bezugsende: Ende a → −x (Drehung +90°), Ende b → +x (−90°).
    const yaw = richtung === 1 ? Math.PI / 2 : -Math.PI / 2;
    g.rotation.set(-neigung, yaw, 0, 'YXZ');
    g.position.set(haken[0] + richtung * strecke * Math.cos(neigung), BRETT_OBEN_Y + hoehe, haken[2]);
  }

  private setzeMassbandPlatzhalter(lage: BrettLage, mm: number | null): void {
    const p = this.platzhalterBand;
    if (!p) return;
    const { richtung } = bezug(lage);
    const bandZ = -(BRETT.breiteMm / 2000 - 0.0105);
    const aus = mm !== null && mm > 0;
    p.band.visible = aus;
    p.haken.visible = aus;
    this.massband.rotation.set(0, 0, 0);
    if (mm === null || !aus) {
      this.massband.position.set(WERKBANK.x - 0.62, WERKBANK.hoehe, WERKBANK.z - 0.16);
      this.massband.rotation.set(0, 0.5, 0);
      p.gehaeuse.position.set(0, 0.032, 0);
      return;
    }
    const laenge = Math.min(mm, MASSBAND_TEXTUR_MM);
    const l = laenge / 1000;
    const start = mmNachWelt(lage, 0, bandZ * 1000);
    this.massband.position.set(start[0], BRETT_OBEN_Y, start[2]);
    const vorwaerts = richtung === 1;
    const tex = vorwaerts ? p.textur : p.texturRueck;
    if (p.mat.map !== tex) {
      p.mat.map = tex;
      p.mat.needsUpdate = true;
    }
    tex.repeat.set(laenge / MASSBAND_TEXTUR_MM, 1);
    tex.offset.set(vorwaerts ? 0 : 1 - laenge / MASSBAND_TEXTUR_MM, 0);
    p.band.scale.set(l, 1, 1);
    p.band.position.set(vorwaerts ? 0 : -l, 0.0004, 0);
    p.haken.position.set(-richtung * 0.00075, -0.008, 0);
    p.gehaeuse.position.set(richtung * (l + 0.06), 0.032, -0.004);
  }

  private setzeSaege(lage: BrettLage, markierungMm: number | null, z: SaegeZustand | null): void {
    const s = this.saege;
    const modell = this.mitAssets;
    if (z === null) {
      this.fuge.visible = false;
      if (modell) {
        // Ruhelage: flach hinten rechts auf der Werkbank, Griff rechts
        s.position.set(WERKBANK.x + 0.78, WERKBANK.hoehe + 0.0145, WERKBANK.z - 0.2);
        s.rotation.set(0, Math.PI / 2 + 0.12, Math.PI / 2, 'YXZ');
        // Drehpunkt liegt auf der Zahnlinie: Modell zurück auf den Griff verschieben
        s.children[0]?.position.set(0, 0, 0);
      } else {
        s.position.set(WERKBANK.x + 0.55, WERKBANK.hoehe + 0.012, WERKBANK.z - 0.18);
        s.rotation.set(-Math.PI / 2, 0.25, 0, 'YXZ');
      }
      return;
    }
    const tiefe = Math.min(1, Math.max(0, z.tiefe01));
    const basisMm = markierungMm ?? hauptLaengeMm(lage) / 2;
    const p = mmNachWelt(lage, basisMm + z.versatzMm);
    const dicke = BRETT.dickeMm / 1000;
    const drift = (z.driftGrad * Math.PI) / 180;
    if (modell) {
      // Zahnlinie sitzt an der Brett-Hinterkante; Griff zum Spieler, leicht angehoben (am Ende flacher)
      s.children[0]?.position.set(0, -SAEGE_ZAHN_Y, -SAEGE_ANSATZ_Z);
      const neigung = ((3 + 6 * (1 - tiefe)) * Math.PI) / 180;
      s.position.set(p[0], BRETT_OBEN_Y - tiefe * (dicke + 0.001), BRETT.z - BRETT.breiteMm / 2000);
      s.rotation.set(-neigung, drift, 0, 'YXZ');
    } else {
      const neigung = ((18 - 14 * tiefe) * Math.PI) / 180;
      s.position.set(p[0], BRETT_OBEN_Y - tiefe * (dicke + 0.001), BRETT.z - BRETT.breiteMm / 2000);
      s.rotation.set(0, -Math.PI / 2 + drift, neigung, 'YZX');
    }
    const geschnitten = lage.schnittIstMm !== null;
    this.fuge.visible = !geschnitten && tiefe > 0.001;
    this.fuge.position.set(p[0], BRETT_OBEN_Y + 0.0002, BRETT.z);
    this.fuge.rotation.set(0, drift, 0);
    this.fuge.scale.set(1, Math.max(0.0005, tiefe * dicke) + 0.0002, 1);
  }

  private setzeHervorhebung(id: string | null): void {
    if (id === this.hervor) return;
    if (this.hervor !== null) {
      for (const m of this.hervorMat.get(this.hervor) ?? []) {
        m.emissive.set('#000000');
        m.emissiveIntensity = 1;
      }
    }
    this.hervor = id;
    if (id !== null) {
      for (const m of this.hervorMat.get(id) ?? []) {
        m.emissive.set(HERVORHEBUNG.farbe);
        m.emissiveIntensity = HERVORHEBUNG.staerke;
      }
    }
  }

  // ------------------------------------------------------------------ Abfragen

  /** Sichtbare Quader einer benannten Gruppe in Weltkoordinaten (null, wenn unsichtbar). */
  private boxVon(id: string): Aabb | null {
    const o = this.gruppen.get(id);
    if (!o?.visible) return null;
    o.updateWorldMatrix(true, true);
    const box = new THREE.Box3();
    const teil = new THREE.Box3();
    o.traverseVisible((k) => {
      if (k instanceof THREE.Mesh) {
        teil.setFromObject(k);
        box.union(teil);
      }
    });
    if (box.isEmpty()) return null;
    return { min: [box.min.x, box.min.y, box.min.z], max: [box.max.x, box.max.y, box.max.z] };
  }

  /** Pick-Ziele in Prioritätsreihenfolge (Werkzeuge und Werkstücke vor der Werkbank). */
  pickZiele(lage: BrettLage): PickZiel[] {
    const ziele: PickZiel[] = [];
    for (const id of ['saege', 'massband', 'bleistift']) {
      const b = this.boxVon(id);
      if (b) ziele.push({ id, box: b });
    }
    for (const st of brettStuecke(lage)) ziele.push({ id: st.id, box: st.box });
    ziele.push({ id: 'werkbank', box: WERKBANK_AABB });
    return ziele;
  }

  objektMitte(id: string, lage: BrettLage): Vec3 | null {
    const st = brettStuecke(lage).find((s) => s.id === id);
    if (st) return [st.mitte[0], st.box.max[1], st.mitte[2]];
    const b = id === 'werkbank' ? WERKBANK_AABB : this.boxVon(id);
    if (!b) return null;
    return [(b.min[0] + b.max[0]) / 2, b.max[1], (b.min[2] + b.max[2]) / 2];
  }

  /** Namen der Materialien, die gerade hervorgehoben leuchten (für Tests/Debug). */
  leuchtendeMaterialien(): string[] {
    const namen = new Set<string>();
    this.szene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m instanceof THREE.MeshStandardMaterial && m.emissive.getHexString() === HERVORHEBUNG.farbe.slice(1)) namen.add(m.name);
      }
    });
    return [...namen].sort();
  }

  dispose(): void {
    this.umgebung?.dispose();
    this.umgebung = null;
    for (const d of this.entsorgen) d.dispose();
    this.brett.geometry.dispose();
    this.rest.geometry.dispose();
    this.entsorgen.length = 0;
  }
}
