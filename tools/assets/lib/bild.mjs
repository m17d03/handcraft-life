// Bildpuffer-Hilfen: Farbe, Höhe → Normal-Map (glTF/OpenGL: +Y = Bild oben), ORM packen, Debug-PNG.
import { Buffer } from 'node:buffer';
import { deflateSync } from 'node:zlib';

export function hex(farbe) {
  const n = parseInt(farbe.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export const mischFarbe = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const b8 = (x) => (x <= 0 ? 0 : x >= 1 ? 255 : Math.round(x * 255));

/**
 * Kanalpuffer für eine Textur. `farbe` sRGB 0..1 (3 Kanäle), `alpha` 0..1, `hoehe` in mm,
 * `rauheit`, `metall`, `ao` 0..1.
 */
export function kanaele(w, h) {
  const n = w * h;
  return {
    w,
    h,
    farbe: new Float32Array(n * 3),
    alpha: new Float32Array(n).fill(1),
    hoehe: new Float32Array(n),
    rauheit: new Float32Array(n).fill(0.7),
    metall: new Float32Array(n),
    ao: new Float32Array(n).fill(1),
  };
}

/** Ruft fn(px, i, u, v) für jedes Pixel; u, v ∈ [0, 1), v = 0 oben (glTF-Konvention). */
export function jedesPixel(k, fn) {
  for (let y = 0; y < k.h; y++) {
    for (let x = 0; x < k.w; x++) {
      const i = y * k.w + x;
      fn(x, y, i, (x + 0.5) / k.w, (y + 0.5) / k.h);
    }
  }
}

export function setzeFarbe(k, i, c) {
  k.farbe[i * 3] = c[0];
  k.farbe[i * 3 + 1] = c[1];
  k.farbe[i * 3 + 2] = c[2];
}

export function albedoRgba(k) {
  const out = new Uint8Array(k.w * k.h * 4);
  for (let i = 0; i < k.w * k.h; i++) {
    out[i * 4] = b8(k.farbe[i * 3]);
    out[i * 4 + 1] = b8(k.farbe[i * 3 + 1]);
    out[i * 4 + 2] = b8(k.farbe[i * 3 + 2]);
    out[i * 4 + 3] = b8(k.alpha[i]);
  }
  return out;
}

/** glTF-ORM: R = Umgebungsverdeckung, G = Rauheit, B = Metall. */
export function ormRgba(k) {
  const out = new Uint8Array(k.w * k.h * 4);
  for (let i = 0; i < k.w * k.h; i++) {
    out[i * 4] = b8(k.ao[i]);
    out[i * 4 + 1] = b8(k.rauheit[i]);
    out[i * 4 + 2] = b8(k.metall[i]);
    out[i * 4 + 3] = 255;
  }
  return out;
}

/**
 * Normal-Map aus Höhe (mm), kachelnd (Wrap). mmProPixel = physische Pixelgrösse.
 * Konvention glTF/OpenGL: R = +X (rechts), G = +Y (Bild oben), B = +Z.
 */
export function normalRgba(k, mmProPixelX, mmProPixelY = mmProPixelX, staerke = 1) {
  const { w, h, hoehe } = k;
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const yo = (y - 1 + h) % h;
    const yu = (y + 1) % h;
    for (let x = 0; x < w; x++) {
      const xl = (x - 1 + w) % w;
      const xr = (x + 1) % w;
      const dhdx = ((hoehe[y * w + xr] - hoehe[y * w + xl]) / (2 * mmProPixelX)) * staerke;
      const dhdyOben = ((hoehe[yo * w + x] - hoehe[yu * w + x]) / (2 * mmProPixelY)) * staerke;
      let nx = -dhdx;
      let ny = -dhdyOben;
      let nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l;
      ny /= l;
      nz /= l;
      const i = (y * w + x) * 4;
      out[i] = b8(nx * 0.5 + 0.5);
      out[i + 1] = b8(ny * 0.5 + 0.5);
      out[i + 2] = b8(nz * 0.5 + 0.5);
      out[i + 3] = 255;
    }
  }
  return out;
}

// --- Debug-PNG (nur zur Sichtprüfung, wird nicht ausgeliefert) ---
const crcTab = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTab[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(typ, daten) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(daten.length);
  const td = Buffer.concat([Buffer.from(typ, 'ascii'), daten]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function pngKodieren(rgba, w, h) {
  const roh = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    roh[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(roh, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(roh, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
