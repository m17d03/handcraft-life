// KTX2-Kodierung (Basis Universal, WASM aus `ktx2-encoder`), ohne native Werkzeuge.
// Basisfarbe/ORM: ETC1S (klein). Normal-Maps und Alpha-Kanten: UASTC + Zstandard (Qualität).
import process from 'node:process';
import { encodeToKTX2 } from 'ktx2-encoder';
import { albedoRgba, normalRgba, ormRgba } from './bild.mjs';

/**
 * Kodiert einen Kanalsatz (siehe bild.mjs) zu KTX2: Farbe (sRGB, ETC1S oder UASTC bei Alpha-Kanten),
 * Normal (UASTC, optional), ORM (linear, ETC1S).
 */
export async function kodiereSatz(k, { mmProPixel = 1, normalStaerke = 1, normal = true, farbeUastc = false } = {}) {
  const farbe = await kodiereKtx2(albedoRgba(k), k.w, k.h, farbeUastc ? 'farbe-uastc' : 'farbe');
  const nor = normal ? await kodiereKtx2(normalRgba(k, mmProPixel, mmProPixel, normalStaerke), k.w, k.h, 'normal') : null;
  const orm = await kodiereKtx2(ormRgba(k), k.w, k.h, 'linear');
  return { farbe, normal: nor, orm };
}

/** Der Basis-Encoder schreibt Fortschritt direkt auf stdout; während des Kodierens stummschalten. */
async function leise(fn) {
  const orig = process.stdout.write.bind(process.stdout);
  process.stdout.write = () => true;
  try {
    return await fn();
  } finally {
    process.stdout.write = orig;
  }
}

/**
 * @param {Uint8Array} rgba  Rohpixel RGBA8, erste Zeile = oben
 * @param {'farbe'|'linear'|'normal'|'farbe-uastc'} art
 */
export function kodiereKtx2(rgba, w, h, art) {
  const farbe = art === 'farbe' || art === 'farbe-uastc';
  const uastc = art === 'normal' || art === 'farbe-uastc';
  /** @type {import('ktx2-encoder').IEncodeOptions} */
  const optionen = {
    isUASTC: uastc,
    isKTX2File: true,
    generateMipmap: true,
    isPerceptual: farbe,
    isSetKTX2SRGBTransferFunc: farbe,
    imageDecoder: () => Promise.resolve({ width: w, height: h, data: rgba }),
  };
  if (uastc) {
    Object.assign(optionen, {
      needSupercompression: true,
      enableRDO: true,
      rdoQualityLevel: art === 'normal' ? 3 : 0.75,
      uastcLDRQualityLevel: 1,
    });
    if (art === 'normal') optionen.isNormalMap = true;
  } else {
    Object.assign(optionen, { qualityLevel: 200, compressionLevel: 2 });
  }
  return leise(() => encodeToKTX2(new Uint8Array(1), optionen));
}
