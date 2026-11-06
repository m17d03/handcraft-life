// Schreibt die kachelnde Eichen-Textur der Werkbank (Generator tools/assets/texturen/holz.mjs, gleicher Seed wie im Spiel)
// als RGBA8-Rohdaten nach tools/blender/build/werkbank/, damit die Cycles-Vorschau dieselben Karten zeigt.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { albedoRgba, ormRgba, normalRgba } from '../assets/lib/bild.mjs';
import { eicheLamellen } from '../assets/texturen/holz.mjs';

const SEED = 20261101;
const ziel = join(dirname(fileURLToPath(import.meta.url)), 'build', 'werkbank');
mkdirSync(ziel, { recursive: true });
const ei = eicheLamellen(1024, SEED);
writeFileSync(join(ziel, 'eiche_farbe.rgba'), albedoRgba(ei.k));
writeFileSync(join(ziel, 'eiche_orm.rgba'), ormRgba(ei.k));
writeFileSync(join(ziel, 'eiche_normal.rgba'), normalRgba(ei.k, ei.mmProPixel, ei.mmProPixel, 4));
console.log('Eiche-Rohdaten 1024² geschrieben');
