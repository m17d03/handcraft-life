// Werkbank (vereinfachte Hobelbank): Eichenplatte 1500 × 600 × 60 mm, Oberkante 900 mm,
// Gestell aus Kufen, Beinen, Querriegeln und Längszargen, Vorderzange links vorn (Backe, Holzspindel,
// Knebel). Ursprung = Boden unter Plattenmitte; Vorderseite (Spielerseite) zeigt nach +Z.
import { GlbBau } from '../lib/gltf.mjs';
import { THREE, drehteil, gefasterQuader, hauptachse, mat, teil, zusammen, dreieckAnzahl } from '../lib/geometrie.mjs';
import { kodiereSatz } from '../lib/ktx2.mjs';
import { hash01 } from '../lib/rauschen.mjs';
import { eicheLamellen } from '../texturen/holz.mjs';

const KACHEL = 0.5; // m je Texturkachel
const S = new THREE.Matrix4().makeScale(0.001, 0.001, 0.001);

/** Box-Projektion in Weltmetern; Faser entlang `faser` (0 = x, 1 = y, 2 = z), Versatz je Teil. */
function holzUv(faser, versatz) {
  return (n, p) => {
    const q = [p.x, p.y, p.z];
    const ach = hauptachse(n);
    const andere = [0, 1, 2].filter((k) => k !== ach);
    const quer = andere.find((k) => k !== faser) ?? andere[1];
    const laengs = andere.includes(faser) ? faser : andere[0];
    return [q[laengs] / KACHEL + versatz[0], q[quer] / KACHEL + versatz[1]];
  };
}

let teilNr = 0;
/** Gefaster Quader in mm (Mittelpunkt mx, my, mz), Faserrichtung = längste Kante. */
function brett(bx, by, bz, mx, my, mz, fase, seed) {
  const masse = [bx, by, bz];
  const faser = masse.indexOf(Math.max(...masse));
  const nr = teilNr++;
  const versatz = [hash01(nr, seed) * 7, hash01(nr + 50, seed) * 7];
  return teil(gefasterQuader(bx, by, bz, fase), holzUv(faser, versatz), mat.kette(mat.verschiebung(mx, my, mz), S));
}

function rundstab(r, laenge, fase, segmente, seed, matrixMm) {
  const g = drehteil(
    [
      [0, -laenge / 2],
      [r - fase, -laenge / 2],
      [r, -laenge / 2 + fase],
      [r, laenge / 2 - fase],
      [r - fase, laenge / 2],
      [0, laenge / 2],
    ],
    segmente,
    40,
  );
  const nr = teilNr++;
  return teil(g, holzUv(1, [hash01(nr, seed) * 7, 0]), mat.kette(matrixMm, S));
}

export async function baueWerkbank(seed) {
  teilNr = 0;
  const bau = new GlbBau('Werkbank');
  const ei = eicheLamellen(1024, seed);
  const s = await kodiereSatz(ei.k, { mmProPixel: ei.mmProPixel, normalStaerke: 4 });
  const tex = {
    farbe: bau.textur('Eiche_Farbe', s.farbe, 1024, 1024),
    normal: bau.textur('Eiche_Normal', s.normal, 1024, 1024),
    orm: bau.textur('Eiche_ORM', s.orm, 1024, 1024),
  };
  const mPlatte = bau.material('Werkbank_Platte', { ...tex, metall: 0, wrapU: 'kachel', wrapV: 'kachel' });
  // Gestell: gleiche Eichen-Texturen, dunkler getönt (Nussbaum-Ton #8E5D33 aus Stil A)
  const mGestell = bau.material('Werkbank_Gestell', { ...tex, metall: 0, faktor: [0.62, 0.5, 0.42, 1], wrapU: 'kachel', wrapV: 'kachel' });

  // Platte: 1500 × 60 × 600, Oberkante 900 mm
  const platte = zusammen([brett(1500, 60, 600, 0, 870, 0, 3, seed)]);

  // Gestell
  const g = [];
  for (const x of [-630, 630]) {
    g.push(brett(90, 80, 640, x, 40, 0, 4, seed)); // Kufe
    g.push(brett(110, 70, 560, x, 805, 0, 3, seed)); // Kopfriegel unter der Platte
    for (const z of [-215, 215]) g.push(brett(80, 760, 80, x, 460, z, 3, seed)); // Beine
  }
  for (const z of [-215, 215]) g.push(brett(1180, 110, 40, 0, 260, z, 3, seed)); // Längszargen
  const gestell = zusammen(g);

  // Vorderzange: Knoten-Ursprung an der Plattenvorderkante (x = −520, y = 790, z = 300)
  const vz = { x: -520, y: 790, z: 300 };
  const backe = zusammen([brett(450, 220, 55, 0, 0, 30, 3, seed)]);
  const sp = [];
  sp.push(rundstab(20, 110, 2, 16, seed, mat.kette(mat.drehungX(Math.PI / 2), mat.verschiebung(0, -30, 80))));
  sp.push(rundstab(36, 40, 4, 20, seed, mat.kette(mat.drehungX(Math.PI / 2), mat.verschiebung(0, -30, 78))));
  sp.push(rundstab(11, 320, 2, 12, seed, mat.kette(mat.drehungZ(Math.PI / 2), mat.verschiebung(0, -30, 82))));
  for (const x of [-160, 160]) sp.push(rundstab(17, 4, 1.5, 12, seed, mat.kette(mat.drehungZ(Math.PI / 2), mat.verschiebung(x, -30, 82)))); // Knebel-Anschläge
  const spindel = zusammen(sp);

  const wurzel = bau.knoten('Werkbank');
  bau.knoten('Platte', { mesh: bau.mesh('Platte', [{ geometrie: platte, material: mPlatte }]), eltern: wurzel });
  bau.knoten('Gestell', { mesh: bau.mesh('Gestell', [{ geometrie: gestell, material: mGestell }]), eltern: wurzel });
  bau.knoten('Vorderzange', {
    mesh: bau.mesh('Vorderzange', [
      { geometrie: backe, material: mPlatte },
      { geometrie: spindel, material: mGestell },
    ]),
    position: [vz.x / 1000, vz.y / 1000, vz.z / 1000],
    eltern: wurzel,
  });
  bau.knoten('Arbeitsflaeche', { position: [0, 0.9, 0], eltern: wurzel });
  return {
    name: 'werkbank',
    bau,
    teile: { Platte: dreieckAnzahl(platte), Gestell: dreieckAnzahl(gestell), Vorderzange: dreieckAnzahl(backe) + dreieckAnzahl(spindel) },
    knoten: 'Werkbank › Platte, Gestell, Vorderzange (Backe + Spindel, öffnet entlang +Z), Arbeitsflaeche (Hilfsknoten, y = 0,9 m)',
  };
}
