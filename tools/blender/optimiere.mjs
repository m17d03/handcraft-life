// Blender-Rohexport → Spiel-GLB (Ticket 019): setzt die gebackenen Karten als KTX2 (Basis, über tools/assets/lib/ktx2.mjs)
// in die Materialien, komprimiert die Meshes mit EXT_meshopt_compression und schreibt public/assets/modelle/<modell>.glb.
// Aufruf: node tools/blender/optimiere.mjs [saege massband bleistift werkbank]
// Eingabe je Modell: tools/blender/build/<modell>/{roh.glb, manifest.json, *.rgba}
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { NodeIO, TextureInfo } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRTextureBasisu } from '@gltf-transform/extensions';
import { MeshoptEncoder } from 'meshoptimizer';
import { kodiereKtx2 } from '../assets/lib/ktx2.mjs';
import { albedoRgba, ormRgba, normalRgba } from '../assets/lib/bild.mjs';
import { bandSkala } from '../assets/texturen/werkzeug.mjs';
import { eicheLamellen } from '../assets/texturen/holz.mjs';

const SEED = 20261101; // wie tools/assets/build.mjs
const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BUILD = join(WURZEL, 'tools', 'blender', 'build');
const AUS = join(WURZEL, 'public', 'assets', 'modelle');
const kb = (b) => `${(b / 1024).toFixed(0)} kB`;

/** Texturen aus den bestehenden Node-Generatoren (Skala mit Ziffern, kachelnde Eiche) – unverändert wiederverwendet. */
async function generator(name) {
  if (name === 'bandSkala') {
    const sk = bandSkala(2048, 256, SEED).k;
    return {
      farbe: { ktx: await kodiereKtx2(albedoRgba(sk), 2048, 256, 'farbe-uastc'), w: 2048, h: 256 },
      orm: { ktx: await kodiereKtx2(ormRgba(sk), 2048, 256, 'linear'), w: 2048, h: 256 },
    };
  }
  if (name === 'eiche') {
    const ei = eicheLamellen(1024, SEED);
    return {
      farbe: { ktx: await kodiereKtx2(albedoRgba(ei.k), 1024, 1024, 'farbe'), w: 1024, h: 1024 },
      normal: { ktx: await kodiereKtx2(normalRgba(ei.k, ei.mmProPixel, ei.mmProPixel, 4), 1024, 1024, 'normal'), w: 1024, h: 1024 },
      orm: { ktx: await kodiereKtx2(ormRgba(ei.k), 1024, 1024, 'linear'), w: 1024, h: 1024 },
    };
  }
  throw new Error(`unbekannter Generator ${name}`);
}

const ART = { farbe: 'farbe', normal: 'normal', orm: 'linear', ao: 'linear' };

async function rohKarte(verz, k, art) {
  const rgba = new Uint8Array(readFileSync(join(verz, k.datei)));
  if (rgba.byteLength !== k.w * k.h * 4) throw new Error(`${k.datei}: Grösse passt nicht`);
  return { ktx: await kodiereKtx2(rgba, k.w, k.h, ART[art]), w: k.w, h: k.h };
}

async function baue(modell) {
  const verz = join(BUILD, modell);
  const man = JSON.parse(readFileSync(join(verz, 'manifest.json'), 'utf8'));
  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  const doc = await io.read(join(verz, man.glb));
  const root = doc.getRoot();
  root.getAsset().generator = 'handcraft-life tools/blender (Blender 5.2.3 bpy + glTF-Transform)';
  for (const ext of root.listExtensionsUsed()) ext.dispose();
  for (const t of root.listTextures()) t.dispose();
  doc.createExtension(KHRTextureBasisu).setRequired(true);
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });

  const texturen = [];
  const neueTextur = (name, k) => {
    texturen.push(`${name} ${k.w}×${k.h} ${kb(k.ktx.byteLength)}`);
    return doc.createTexture(name).setImage(k.ktx).setMimeType('image/ktx2');
  };
  for (const m of root.listMaterials()) {
    const def = man.materialien[m.getName()];
    if (!def) throw new Error(`${modell}: Material ${m.getName()} fehlt im Manifest`);
    const k = {};
    if (def.generator) Object.assign(k, await generator(def.generator));
    for (const [art, karte] of Object.entries(def.karten ?? {})) k[art] = await rohKarte(verz, karte, art);
    const wrap = def.kachel ? TextureInfo.WrapMode.REPEAT : TextureInfo.WrapMode.CLAMP_TO_EDGE;
    const wrapU = def.kachelU || def.kachel ? TextureInfo.WrapMode.REPEAT : wrap;
    const info = (ti, kachel = true) => {
      ti.setWrapS(kachel ? wrapU : TextureInfo.WrapMode.CLAMP_TO_EDGE).setWrapT(kachel ? wrap : TextureInfo.WrapMode.CLAMP_TO_EDGE);
      ti.setMinFilter(TextureInfo.MinFilter.LINEAR_MIPMAP_LINEAR).setMagFilter(TextureInfo.MagFilter.LINEAR);
    };
    const praefix = def.texturName ?? m.getName();
    m.setBaseColorFactor(def.faktor ?? [1, 1, 1, 1]).setRoughnessFactor(def.rauheit ?? 1).setMetallicFactor(def.metall ?? 1);
    m.setEmissiveFactor([0, 0, 0]);
    const geteilt = (art) => {
      // gleiche Karten mehrerer Materialien (Werkbank: Platte + Gestell) nur einmal ablegen
      const n = `${praefix}_${art}`;
      return root.listTextures().find((t) => t.getName() === n) ?? neueTextur(n, k[art]);
    };
    if (k.farbe) {
      m.setBaseColorTexture(geteilt('farbe'));
      info(m.getBaseColorTextureInfo());
    }
    if (k.normal) {
      m.setNormalTexture(geteilt('normal')).setNormalScale(def.normalStaerke ?? 1);
      info(m.getNormalTextureInfo());
    }
    if (k.orm) {
      m.setMetallicRoughnessTexture(geteilt('orm'));
      info(m.getMetallicRoughnessTextureInfo());
      if (!k.ao) {
        m.setOcclusionTexture(geteilt('orm'));
        info(m.getOcclusionTextureInfo());
      }
    }
    if (k.ao) {
      // gebackene AO auf eigener UV (TEXCOORD_1), weil Farbe/ORM kacheln
      m.setOcclusionTexture(geteilt('ao')).setOcclusionStrength(def.aoStaerke ?? 1);
      info(m.getOcclusionTextureInfo(), false);
      m.getOcclusionTextureInfo().setTexCoord(1);
    }
    if (def.alphaMaske != null) m.setAlphaMode('MASK').setAlphaCutoff(def.alphaMaske);
  }
  // Knoten-Nachbearbeitung (z. B. Massband-Band scale.z = 0 im Ruhezustand)
  for (const [name, w] of Object.entries(man.knoten ?? {})) {
    const n = root.listNodes().find((x) => x.getName() === name);
    if (!n) throw new Error(`${modell}: Knoten ${name} fehlt`);
    if (w.scale) n.setScale(w.scale);
  }
  // Ungenutzte Attribute entfernen; Blender-Export enthält nur POSITION/NORMAL/TEXCOORD_n
  let dreiecke = 0;
  const jeMesh = [];
  for (const mesh of root.listMeshes()) {
    let d = 0;
    for (const p of mesh.listPrimitives()) d += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
    dreiecke += d;
    jeMesh.push(`${mesh.getName()} ${d}`);
  }
  const glb = await io.writeBinary(doc);
  writeFileSync(join(AUS, `${modell}.glb`), glb);
  const knotenListe = root.listNodes().map((n) => n.getName()).join(', ');
  console.log(`${modell}.glb  ${dreiecke} Dreiecke (${jeMesh.join(', ')})  ${root.listMaterials().length} Materialien  ${kb(glb.byteLength)}`);
  console.log(`  Texturen: ${texturen.join(' · ')}`);
  console.log(`  Knoten: ${knotenListe}`);
}

function summe(v) {
  let s = 0;
  for (const e of readdirSync(v)) {
    const p = join(v, e);
    s += statSync(p).isDirectory() ? summe(p) : statSync(p).size;
  }
  return s;
}

const liste = process.argv.slice(2).length ? process.argv.slice(2) : ['saege', 'massband', 'bleistift', 'werkbank'];
for (const m of liste) {
  if (!existsSync(join(BUILD, m, 'manifest.json'))) {
    console.log(`${m}: kein Blender-Export (tools/blender/${m}.py zuerst) – übersprungen`);
    continue;
  }
  await baue(m);
}
console.log(`Gesamt public/assets: ${(summe(join(WURZEL, 'public', 'assets')) / 1024 / 1024).toFixed(2)} MB (Grenze 6 MB)`);
