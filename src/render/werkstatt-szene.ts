/**
 * Werkstatt-Szene Stil A „Honigwerkstatt“ (docs/art/stil-varianten.md) aus Primitiven.
 * Echte Modelle folgen in 012/013: jedes austauschbare Objekt ist eine benannte Gruppe
 * (`werkbank`, `brett`, `reststueck`, `saege`, `massband`, `bleistift`) mit benannten Teilen
 * (`saege.blatt`, `saege.griff`, `massband.gehaeuse`, `massband.band`, …).
 *
 * Licht: tiefstehende Sonne durch das Fenster (warm, ein Echtzeit-Schatten nur im Werkbankbereich),
 * kühle Himmels-/warme Bodenaufhellung, schwache Umgebungsreflexion; ACES-Tonemapping im Renderer.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
  eicheTon: '#b99a80', // ergibt mit Fichtentextur ≈ Eiche #C58F55
  nussTon: '#86685a', // ≈ Nussbaum #8E5D33
  bodenTon: '#5e4536', // dunkles Holz ≈ #3B2A1C
  deckeTon: '#5a4434',
  wand: '#a8977e',
  stahl: '#7d8a8f',
  bernstein: '#d9a35b',
  hellAkzent: '#ffd08a',
  tanne: '#2f5a4a',
  graphit: '#2b2724',
  fuge: '#1a130d',
  sonne: '#ffc68a', // ca. 3500 K
  himmel: '#a9b9cc', // kühle Schattenseite
  bodenLicht: '#6b4a30',
  fenster: '#fff0d6',
} as const;

const SONNE_RICHTUNG: Vec3 = normalize([0.75, -0.45, -0.48]); // Richtung, in die das Licht fällt
const HERVORHEBUNG = { farbe: '#ffb35c', staerke: 0.45 } as const;

export interface SaegeZustand {
  readonly versatzMm: number;
  readonly tiefe01: number;
  readonly driftGrad: number;
}

export interface SzenenZustand {
  readonly lage: BrettLage;
  readonly markierungMm: number | null;
  readonly massbandMm: number | null;
  readonly saege: SaegeZustand | null;
  readonly hervorgehoben: string | null;
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

export class WerkstattSzene {
  readonly szene = new THREE.Scene();
  private readonly entsorgen: { dispose(): void }[] = [];
  private readonly hervorMat = new Map<string, THREE.MeshStandardMaterial[]>();
  private readonly gruppen = new Map<string, THREE.Object3D>();
  private readonly brettMat: THREE.MeshStandardMaterial;
  private readonly restMat: THREE.MeshStandardMaterial;
  private readonly brett: THREE.Mesh;
  private readonly rest: THREE.Mesh;
  private readonly bezugsMarke: THREE.Mesh;
  private readonly markierung: THREE.Mesh;
  private readonly fuge: THREE.Mesh;
  private readonly saege: THREE.Group;
  private readonly massband: THREE.Group;
  private readonly band: THREE.Mesh;
  private readonly bandTextur: THREE.CanvasTexture;
  private readonly haken: THREE.Mesh;
  private readonly gehaeuse: THREE.Mesh;
  private brettSchluessel = '';
  private hervor: string | null = null;
  private umgebung: THREE.WebGLRenderTarget | null = null;

  constructor(holz: HolzTexturen, anisotropie: number) {
    const s = this.szene;
    s.background = new THREE.Color(PALETTE.tiefe);
    const maps = holzMaps(holz, anisotropie);
    this.merke(maps.albedo, maps.orm, maps.normal);

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
    const bodenMat = holzMat('boden', PALETTE.bodenTon);
    bodenMat.normalScale.set(0.35, 0.35);
    this.mesh('boden', geometrie(dielenBoden(W, D, 14, 0.004)), bodenMat, { empfaengt: false });
    const wandMat = this.mat('wand', { color: PALETTE.wand, roughness: 0.95, metalness: 0, vertexColors: true });
    const wand = (g: Vec3, p: Vec3): THREE.BufferGeometry => quader({ groesse: g, fase: 0.01, uvMeter: 2 }, p);
    this.mesh(
      'raum.waende',
      mergeGeometries([
        wand([W + 2 * T, H, T], [0, H / 2, -D / 2 - T / 2]),
        wand([W + 2 * T, H, T], [0, H / 2, D / 2 + T / 2]),
        wand([T, H, D], [-W / 2 - T / 2, H / 2, 0]),
        wand([T, H, D], [W / 2 + T / 2, H / 2, 0]),
        // Sockelleiste läuft rundum (dunkler über Vertex-Farbe gelöst wäre teurer – eigene Leisten)
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
    const fz = -1.15;
    const fy = 1.7;
    const fb = 1.3;
    const fh = 1.0;
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

    // Fensterlicht als weicher, schräger Fleck auf der Rückwand (gestaltet, nicht berechnet: kostet
    // einen Draw Call statt eines raumweiten Schattens)
    const fleckGeo = new THREE.PlaneGeometry(0.9, 0.75);
    const fp = fleckGeo.getAttribute('position');
    for (let k = 0; k < fp.count; k++) if (fp.getY(k) > 0) fp.setX(k, fp.getX(k) - 0.3);
    fleckGeo.translate(-1.75, 1.25, -D / 2 + 0.003);
    const fleck = new THREE.Mesh(
      fleckGeo,
      this.basis('fenster.lichtfleck', {
        color: PALETTE.sonne,
        alphaMap: weich,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    fleck.name = 'fenster.lichtfleck';
    this.merke(fleckGeo);
    s.add(fleck);

    // ---- Werkbank: Eichenplatte, Gestell Nussbaum, Ablage
    const eiche = holzMat('werkbank.platte', PALETTE.eicheTon);
    const nuss = holzMat('werkbank.gestell', PALETTE.nussTon);
    this.hervorMat.set('werkbank', [eiche, nuss]);
    const werkbank = new THREE.Group();
    werkbank.name = 'werkbank';
    const { x: bx, z: bz, laenge: bl, tiefe: bt, hoehe: bh, platte: bp } = WERKBANK;
    const platte = this.mesh(
      'werkbank.platte',
      quader({ groesse: [bl, bp, bt], fase: 0.003, uvMeter: 1.4, uvVersatz: [0.37, 0.61] }, [bx, bh - bp / 2, bz]),
      eiche,
      { empfaengt: true, eltern: werkbank },
    );
    platte.receiveShadow = true;
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
    for (const sz of [-1, 1]) {
      gestell.push(quader({ groesse: [bl - 0.2, 0.1, 0.03], fase: 0.003 }, [bx, beinH - 0.05, bz + sz * (lz + 0.03)]));
    }
    gestell.push(quader({ groesse: [bl - 0.3, 0.025, bt - 0.2], fase: 0.003, uvVersatz: [0.1, 0.4] }, [bx, 0.27, bz]));
    // Vorderzange links (Klotz + Spindel angedeutet)
    gestell.push(quader({ groesse: [0.42, 0.14, 0.06], fase: 0.004 }, [bx - bl / 2 + 0.3, bh - 0.08, bz + bt / 2 + 0.03]));
    this.mesh('werkbank.gestell', mergeGeometries(gestell), nuss, { empfaengt: false, eltern: werkbank });
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
      nuss,
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
    const lagerMat = holzMat('holzlager', '#e8cfae');
    const lager = new THREE.InstancedMesh(lagerGeo, lagerMat, 9);
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
    this.mesh('holzlager.konsolen', mergeGeometries(konsole), nuss, { empfaengt: false });

    // ---- Brett (Fichte) und Reststück; Geometrie folgt der Lage (setzeBrett)
    this.brettMat = holzMat('brett', '#ffffff');
    this.restMat = holzMat('reststueck', '#ffffff');
    this.hervorMat.set('brett', [this.brettMat]);
    this.hervorMat.set('reststueck', [this.restMat]);
    this.brett = this.mesh('brett', new THREE.BufferGeometry(), this.brettMat, { empfaengt: true, wirft: true });
    this.rest = this.mesh('reststueck', new THREE.BufferGeometry(), this.restMat, { empfaengt: true, wirft: true });
    this.gruppen.set('brett', this.brett);
    this.gruppen.set('reststueck', this.rest);
    const markeMat = this.mat('brett.bezugsende', { color: PALETTE.bernstein, emissive: PALETTE.bernstein, emissiveIntensity: 0.35, roughness: 0.6 });
    this.bezugsMarke = this.mesh('brett.bezugsende', new THREE.BoxGeometry(0.004, 0.0004, BRETT.breiteMm / 1000 - 0.004), markeMat, {});
    this.markierung = this.mesh(
      'brett.markierung',
      new THREE.BoxGeometry(0.0007, 0.0003, BRETT.breiteMm / 1000 - 0.01),
      this.mat('brett.markierung', { color: PALETTE.graphit, roughness: 0.45, metalness: 0.2 }),
      {},
    );
    this.fuge = this.mesh(
      'brett.fuge',
      new THREE.BoxGeometry(BRETT.fugeMm / 1000, 1, BRETT.breiteMm / 1000 + 0.0006).translate(0, -0.5, 0),
      this.mat('brett.fuge', { color: PALETTE.fuge, roughness: 1 }),
      {},
    );

    // ---- Säge (Platzhalter): Blatt + D-Griff; Ursprung = Zahnlinie am Brett-Hinterrand
    this.saege = new THREE.Group();
    this.saege.name = 'saege';
    const blattMat = this.mat('saege.blatt', { color: PALETTE.stahl, roughness: 0.38, metalness: 0.85, side: THREE.DoubleSide });
    const griffMat = this.mat('saege.griff', { color: '#7a4a2a', roughness: 0.5, metalness: 0 });
    this.hervorMat.set('saege', [blattMat, griffMat]);
    const blattForm = new THREE.Shape([
      new THREE.Vector2(-0.06, 0),
      new THREE.Vector2(0.36, 0),
      new THREE.Vector2(0.36, 0.12),
      new THREE.Vector2(-0.06, 0.07),
    ]);
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
    const griffGeo = new THREE.ExtrudeGeometry(griffAussen, {
      depth: 0.018,
      bevelEnabled: true,
      bevelThickness: 0.003,
      bevelSize: 0.003,
      bevelSegments: 1,
      curveSegments: 6,
    }).translate(0, 0, -0.009);
    this.mesh('saege.griff', griffGeo, griffMat, { wirft: true, eltern: this.saege });
    s.add(this.saege);
    this.gruppen.set('saege', this.saege);

    // ---- Massband (Platzhalter): Gehäuse, Band mit mm-Skala, Haken
    this.massband = new THREE.Group();
    this.massband.name = 'massband';
    const gehaeuseMat = this.mat('massband.gehaeuse', { color: PALETTE.bernstein, roughness: 0.42, metalness: 0, vertexColors: true });
    this.bandTextur = massbandTextur(anisotropie);
    this.merke(this.bandTextur);
    const bandMat = this.mat('massband.band', { color: '#ffffff', map: this.bandTextur, roughness: 0.5, metalness: 0.1 });
    this.hervorMat.set('massband', [gehaeuseMat, bandMat]);
    this.gehaeuse = this.mesh(
      'massband.gehaeuse',
      geometrie(fasenQuader({ groesse: [0.068, 0.064, 0.034], fase: 0.009, stirnFarbe: [1, 1, 1] })),
      gehaeuseMat,
      { wirft: true, eltern: this.massband },
    );
    // Band: Ursprung am Haken (0 mm), läuft entlang +x bis Länge 1 (skaliert auf mm)
    this.band = this.mesh(
      'massband.band',
      new THREE.PlaneGeometry(1, 0.019).rotateX(-Math.PI / 2).translate(0.5, 0, 0),
      bandMat,
      { wirft: false, empfaengt: true, eltern: this.massband },
    );
    this.haken = this.mesh(
      'massband.haken',
      new THREE.BoxGeometry(0.0015, 0.02, 0.02),
      this.mat('massband.haken', { color: PALETTE.stahl, roughness: 0.35, metalness: 0.9 }),
      { eltern: this.massband },
    );
    s.add(this.massband);
    this.gruppen.set('massband', this.massband);

    // ---- Bleistift (Platzhalter, ruht auf der Werkbank)
    const bleistift = new THREE.Group();
    bleistift.name = 'bleistift';
    const stiftMat = this.mat('bleistift.schaft', { color: PALETTE.tanne, roughness: 0.4, metalness: 0 });
    const spitzeMat = this.mat('bleistift.spitze', { color: '#e3c08d', roughness: 0.7, metalness: 0 });
    this.hervorMat.set('bleistift', [stiftMat, spitzeMat]);
    this.mesh('bleistift.schaft', new THREE.CylinderGeometry(0.0038, 0.0038, 0.16, 6).rotateZ(Math.PI / 2), stiftMat, { wirft: true, eltern: bleistift });
    this.mesh('bleistift.spitze', new THREE.ConeGeometry(0.0038, 0.022, 6).rotateZ(-Math.PI / 2).translate(0.091, 0, 0), spitzeMat, { wirft: true, eltern: bleistift });
    bleistift.position.set(0.55, WERKBANK.hoehe + 0.0038, BRETT.z + 0.16);
    bleistift.rotation.y = 0.35;
    s.add(bleistift);
    this.gruppen.set('bleistift', bleistift);

    // ---- Licht
    const sonne = new THREE.DirectionalLight(PALETTE.sonne, 3.2 * Math.PI);
    const ziel = new THREE.Vector3(WERKBANK.x, WERKBANK.hoehe, WERKBANK.z);
    sonne.position.copy(ziel).addScaledVector(new THREE.Vector3(...SONNE_RICHTUNG), -6);
    sonne.target.position.copy(ziel);
    sonne.castShadow = true;
    sonne.shadow.mapSize.set(1024, 1024);
    const sc = sonne.shadow.camera;
    sc.left = -1.4;
    sc.right = 1.4;
    sc.top = 1.1;
    sc.bottom = -1.1;
    sc.near = 3;
    sc.far = 9;
    sonne.shadow.bias = -0.0004;
    sonne.shadow.normalBias = 0.012;
    sonne.shadow.radius = 4;
    s.add(sonne, sonne.target);
    s.add(new THREE.HemisphereLight(PALETTE.himmel, PALETTE.bodenLicht, 0.42 * Math.PI));
    s.environmentIntensity = 0.28;
  }

  // ------------------------------------------------------------------ Hilfen

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

  private mesh(
    name: string,
    g: THREE.BufferGeometry,
    m: THREE.Material,
    o: { wirft?: boolean; empfaengt?: boolean; eltern?: THREE.Object3D },
  ): THREE.Mesh {
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
    this.setzeBrett(z.lage);
    this.setzeMarkierung(z.lage, z.markierungMm);
    this.setzeMassband(z.lage, z.massbandMm);
    this.setzeSaege(z.lage, z.markierungMm, z.saege);
    this.setzeHervorhebung(z.hervorgehoben);
  }

  private setzeBrett(lage: BrettLage): void {
    const schluessel = `${String(lage.laengeMm)}|${String(lage.bezugsende)}|${String(lage.schnittIstMm)}`;
    if (schluessel === this.brettSchluessel) return;
    this.brettSchluessel = schluessel;
    const { richtung } = bezug(lage);
    const stuecke = brettStuecke(lage);
    for (const mesh of [this.brett, this.rest]) mesh.visible = false;
    for (const st of stuecke) {
      const mesh = st.id === 'brett' ? this.brett : this.rest;
      // Maserung läuft über den Schnitt hinweg weiter: UV-Versatz aus der ursprünglichen Lage
      const urX = st.id === 'brett' ? st.mitte[0] : st.mitte[0] - richtung * BRETT.restAbstandM;
      const neu = geometrie(
        fasenQuader({
          groesse: [st.laengeMm / 1000, BRETT.dickeMm / 1000, BRETT.breiteMm / 1000],
          fase: BRETT.faseMm / 1000,
          uvMeter: 1.2,
          uvVersatz: [(urX - BRETT.x) / 1.2 + 0.13, 0.31],
        }),
      );
      mesh.geometry.dispose();
      mesh.geometry = neu;
      mesh.position.set(...st.mitte);
      mesh.visible = true;
    }
    this.bezugsMarke.visible = lage.bezugsende !== null;
    const ende = mmNachWelt(lage, 2, 0, 0.0002);
    this.bezugsMarke.position.set(...ende);
  }

  private setzeMarkierung(lage: BrettLage, mm: number | null): void {
    const sichtbar = mm !== null && mm >= 0 && mm <= hauptLaengeMm(lage) + BRETT.fugeMm;
    this.markierung.visible = sichtbar;
    if (sichtbar) this.markierung.position.set(...mmNachWelt(lage, mm, 0, 0.00015));
  }

  private setzeMassband(lage: BrettLage, mm: number | null): void {
    const { richtung } = bezug(lage);
    const bandZ = BRETT.breiteMm / 2000 - 0.0105;
    const aus = mm !== null && mm > 0;
    this.band.visible = aus;
    this.haken.visible = aus;
    if (mm === null || !aus) {
      // Ruhelage hinten links auf der Werkbank
      this.massband.position.set(WERKBANK.x - 0.78, WERKBANK.hoehe, WERKBANK.z - 0.12);
      this.massband.rotation.set(0, 0.5, 0);
      this.gehaeuse.position.set(0, 0.032, 0);
      return;
    }
    const laenge = Math.min(mm, MASSBAND_TEXTUR_MM);
    const start = mmNachWelt(lage, 0, bandZ * 1000);
    this.massband.position.set(start[0], BRETT_OBEN_Y, start[2]);
    // lokal +x zeigt vom Bezugsende weg; bei Ende 'b' um 180° gedreht
    this.massband.rotation.set(0, richtung === 1 ? 0 : Math.PI, 0);
    this.band.scale.set(laenge / 1000, 1, 1);
    this.band.position.set(0, 0.0004, 0);
    this.bandTextur.repeat.set(laenge / MASSBAND_TEXTUR_MM, 1);
    this.haken.position.set(-0.00075, -0.008, 0);
    this.gehaeuse.position.set(laenge / 1000 + 0.036, 0.032, 0.002);
  }

  private setzeSaege(lage: BrettLage, markierungMm: number | null, z: SaegeZustand | null): void {
    const s = this.saege;
    if (z === null) {
      this.fuge.visible = false;
      // Ruhelage: flach rechts hinten auf der Werkbank
      s.position.set(WERKBANK.x + 0.55, WERKBANK.hoehe + 0.012, WERKBANK.z - 0.18);
      s.rotation.set(-Math.PI / 2, 0.25, 0, 'YXZ');
      return;
    }
    const tiefe = Math.min(1, Math.max(0, z.tiefe01));
    const basisMm = markierungMm ?? hauptLaengeMm(lage) / 2;
    const p = mmNachWelt(lage, basisMm + z.versatzMm);
    const dicke = BRETT.dickeMm / 1000;
    const neigung = ((18 - 14 * tiefe) * Math.PI) / 180;
    s.position.set(p[0], BRETT_OBEN_Y - tiefe * (dicke + 0.001), BRETT.z - BRETT.breiteMm / 2000);
    s.rotation.set(0, -Math.PI / 2 + (z.driftGrad * Math.PI) / 180, neigung, 'YZX');
    const geschnitten = lage.schnittIstMm !== null;
    this.fuge.visible = !geschnitten && tiefe > 0.001;
    this.fuge.position.set(p[0], BRETT_OBEN_Y + 0.0002, BRETT.z);
    this.fuge.rotation.set(0, (z.driftGrad * Math.PI) / 180, 0);
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

  dispose(): void {
    this.umgebung?.dispose();
    this.umgebung = null;
    for (const d of this.entsorgen) d.dispose();
    this.brett.geometry.dispose();
    this.rest.geometry.dispose();
    this.entsorgen.length = 0;
  }
}
