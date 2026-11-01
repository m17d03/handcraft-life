// Erzeugt alle Werkstatt-Assets reproduzierbar (fester Seed): `npm run assets:build`.
// Ausgabe: public/assets/modelle/*.glb, public/assets/texturen/*.ktx2.
// Lizenz aller erzeugten Dateien: CC0 (eigen erzeugt), siehe assets/LICENSES.md.
import { mkdirSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { kodiereSatz } from './lib/ktx2.mjs';
import { fichteHirn, fichteLaengs } from './texturen/holz.mjs';
import { bodenDielen, wandPutz } from './texturen/raum.mjs';
import { baueSaege } from './modelle/saege.mjs';
import { baueMassband } from './modelle/massband.mjs';
import { baueBleistift } from './modelle/bleistift.mjs';
import { baueWerkbank } from './modelle/werkbank.mjs';

export const SEED = 20261101;
const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUS = join(WURZEL, 'public', 'assets');
const N = 1024;

const kb = (b) => `${(b / 1024).toFixed(0)} kB`;

async function texturen() {
  const ziel = join(AUS, 'texturen');
  mkdirSync(ziel, { recursive: true });
  const saetze = [
    ['fichte-laengs', fichteLaengs, SEED + 10, 4],
    ['fichte-hirn', fichteHirn, SEED + 20, 3],
    ['wand-putz', wandPutz, SEED + 30, 3],
    ['boden-dielen', bodenDielen, SEED + 40, 2],
  ];
  const zeilen = [];
  for (const [name, fn, seed, staerke] of saetze) {
    const t0 = Date.now();
    const { k, mmProPixel } = fn(N, seed);
    const s = await kodiereSatz(k, { mmProPixel, normalStaerke: staerke });
    for (const [art, daten] of [['farbe', s.farbe], ['normal', s.normal], ['orm', s.orm]]) {
      writeFileSync(join(ziel, `${name}_${art}.ktx2`), daten);
      zeilen.push(`  ${name}_${art}.ktx2  ${N}²  ${kb(daten.byteLength)}`);
    }
    console.log(`Textur ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  }
  return zeilen;
}

async function modelle() {
  const ziel = join(AUS, 'modelle');
  mkdirSync(ziel, { recursive: true });
  const zeilen = [];
  for (const baue of [baueSaege, baueMassband, baueBleistift, baueWerkbank]) {
    const t0 = Date.now();
    const m = await baue(SEED);
    const glb = await m.bau.schreiben();
    writeFileSync(join(ziel, `${m.name}.glb`), glb);
    const tex = m.bau.texturen.map((t) => `${t.breite}×${t.hoehe}`).join(', ');
    const mats = m.bau.doc.getRoot().listMaterials().length;
    zeilen.push(`  ${m.name}.glb  ${m.bau.dreiecke} Dreiecke (${Object.entries(m.teile).map(([n, d]) => `${n} ${d}`).join(', ')})  ${mats} Materialien  ${kb(glb.byteLength)}  Texturen: ${tex}`);
    zeilen.push(`    Knoten: ${m.knoten}`);
    console.log(`Modell ${m.name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  }
  return zeilen;
}

function summe(verz) {
  let s = 0;
  for (const e of readdirSync(verz)) {
    const p = join(verz, e);
    s += statSync(p).isDirectory() ? summe(p) : statSync(p).size;
  }
  return s;
}

const nurModelle = process.argv.includes('--nur-modelle');
if (!nurModelle) rmSync(join(AUS, 'texturen'), { recursive: true, force: true });
rmSync(join(AUS, 'modelle'), { recursive: true, force: true });
const z1 = nurModelle ? [] : await texturen();
const z2 = await modelle();
console.log(`\nAusgabe ${relative(WURZEL, AUS)}/`);
for (const z of [...z1, ...z2]) console.log(z);
console.log(`Gesamt public/assets: ${(summe(AUS) / 1024 / 1024).toFixed(2)} MB (Grenze 6 MB)`);
