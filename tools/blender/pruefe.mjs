// Vertragsprüfung (Ticket 019): Knotennamen, Knotenlagen, Materialnamen und Bounding-Boxen je Knoten (in mm)
// eines GLB – optional im Vergleich mit einer älteren Fassung.
// Aufruf: node tools/blender/pruefe.mjs public/assets/modelle/saege.glb [alt/saege.glb]
import process from 'node:process';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

async function bericht(pfad) {
  const doc = await io.read(pfad);
  const root = doc.getRoot();
  const zeilen = {};
  const mm = (v) => v.map((x) => Math.round(x * 10000) / 10).join(', ');
  for (const n of root.listNodes()) {
    const t = n.getTranslation();
    const s = n.getScale();
    let box = '';
    const mesh = n.getMesh();
    let tris = 0;
    if (mesh) {
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      for (const p of mesh.listPrimitives()) {
        const a = p.getAttribute('POSITION');
        const e = [0, 0, 0];
        for (let i = 0; i < a.getCount(); i++) {
          a.getElement(i, e);
          for (let k = 0; k < 3; k++) {
            min[k] = Math.min(min[k], e[k]);
            max[k] = Math.max(max[k], e[k]);
          }
        }
        tris += (p.getIndices()?.getCount() ?? 0) / 3;
      }
      const mats = mesh.listPrimitives().map((p) => `${p.getMaterial()?.getName()}(${p.listSemantics().join('/')})`).join('+');
      box = ` box [${mm(min)}] … [${mm(max)}] ${tris} Dr. ${mats}`;
    }
    const kinder = n.listChildren().map((c) => c.getName()).join(',');
    zeilen[n.getName()] = `pos [${mm(t)}] scale [${s.join(', ')}]${box}${kinder ? ` › ${kinder}` : ''}`;
  }
  return zeilen;
}

const [neu, alt] = process.argv.slice(2);
const a = alt ? await bericht(alt) : {};
const b = await bericht(neu);
for (const name of new Set([...Object.keys(a), ...Object.keys(b)])) {
  console.log(`${name}`);
  if (alt) console.log(`  alt: ${a[name] ?? 'FEHLT'}`);
  console.log(`  neu: ${b[name] ?? 'FEHLT'}`);
}
