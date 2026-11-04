/**
 * Werkstatt-Assets aus Ticket 012 laden (GLB mit KTX2/Basis-Texturen und meshopt-Kompression) und für die
 * Szene vervielfältigen. Knotennamen und Einbauregeln: `docs/art/assets-phase1.md`.
 *
 * Die geladenen Objekte sind **Vorlagen**: Sie werden nie selbst gezeichnet. Die Szene holt sich mit
 * `instanz()` eigene Kopien (Geometrie, Material, Textur-Objekte neu; Bilddaten geteilt). So kann sie nach
 * einem Kontextverlust komplett neu aufgebaut werden, ohne GL-Objekte des alten Kontexts anzufassen.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export const MODELLE = ['werkbank', 'saege', 'massband', 'bleistift'] as const;
export type ModellName = (typeof MODELLE)[number];

export const KACHEL_TEXTUREN = ['fichte-laengs', 'fichte-hirn', 'wand-putz', 'boden-dielen'] as const;
export type KachelName = (typeof KACHEL_TEXTUREN)[number];

/** Kachelnde PBR-Karten (Farbe sRGB; ORM: R = AO, G = Rauheit, B = Metall). */
export interface KachelMaps {
  readonly farbe: THREE.Texture;
  readonly normal: THREE.Texture;
  readonly orm: THREE.Texture;
}

export interface WerkstattAssets {
  readonly modelle: Readonly<Record<ModellName, THREE.Object3D>>;
  readonly texturen: Readonly<Record<KachelName, KachelMaps>>;
  /** Diagnose (Ticket 018): Ladedauer und gewählte KTX2-Zielformate. */
  readonly info: AssetInfo;
}

/** Was beim Laden passiert ist – für Debug-Overlay und E2E-Fehlermeldungen. */
export interface AssetInfo {
  readonly ladeMs: number;
  /** Vom KTX2Loader erkannte komprimierte Formate (true = wird als Transcodier-Ziel genutzt). */
  readonly ktx2: Readonly<Record<string, boolean>>;
  /** GL-Format der ersten Kacheltextur (hex) – zeigt, ob komprimiert oder RGBA übertragen wird. */
  readonly texturFormat: string;
}

/** Ohne Antwort nach dieser Zeit gilt das Laden als gescheitert (Platzhalter statt stillem Warten). */
export const ASSET_FRIST_MS = 60_000;

/** Verwirft `p` mit einem Fehler, wenn es nicht innerhalb von `ms` fertig ist. */
export function mitFrist<T>(p: Promise<T>, ms: number, was: string): Promise<T> {
  return new Promise<T>((aufloesen, verwerfen) => {
    const uhr = setTimeout(() => { verwerfen(new Error(`${was}: keine Antwort nach ${String(Math.round(ms / 1000))} s`)); }, ms);
    p.then(
      (v) => { clearTimeout(uhr); aufloesen(v); },
      (e: unknown) => { clearTimeout(uhr); verwerfen(e instanceof Error ? e : new Error(String(e))); },
    );
  });
}

/** Physische Kachelgrösse der Texturen in m (assets-phase1.md). */
export const KACHEL_M: Readonly<Record<KachelName, number>> = {
  'fichte-laengs': 0.5,
  'fichte-hirn': 0.15,
  'wand-putz': 1.0,
  'boden-dielen': 0.9,
};

/**
 * Lädt alle Modelle und Kacheltexturen. `basisUrl` = ausgelieferter Wurzelpfad (Vite `BASE_URL`).
 * Wirft bei Netz- oder Formatfehlern; der Aufrufer fällt dann auf die Platzhalter zurück.
 */
export async function ladeWerkstattAssets(renderer: THREE.WebGLRenderer, basisUrl: string, fristMs = ASSET_FRIST_MS): Promise<WerkstattAssets> {
  const start = performance.now();
  const basis = basisUrl.endsWith('/') ? basisUrl : `${basisUrl}/`;
  const ktx2 = new KTX2Loader().setTranscoderPath(`${basis}basis/`).detectSupport(renderer);
  const formate = { ...((ktx2 as unknown as { workerConfig: Record<string, boolean> | null }).workerConfig ?? {}) };
  try {
    return await mitFrist(ladeAlles(ktx2, basis, formate, start), fristMs, 'Assets laden');
  } finally {
    // Der Transcoder wird nur zum Laden gebraucht (Worker beenden); Texturdaten bleiben in den Vorlagen.
    ktx2.dispose();
  }
}

async function ladeAlles(ktx2: KTX2Loader, basis: string, formate: Record<string, boolean>, start: number): Promise<WerkstattAssets> {
  const gltf = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
  const modellListe = await Promise.all(
    MODELLE.map(async (name) => {
      const g = await gltf.loadAsync(`${basis}assets/modelle/${name}.glb`);
      return [name, g.scene] as const;
    }),
  );
  const texturListe = await Promise.all(
    KACHEL_TEXTUREN.map(async (name) => {
      const laden = async (art: 'farbe' | 'normal' | 'orm'): Promise<THREE.Texture> => {
        const t = await ktx2.loadAsync(`${basis}assets/texturen/${name}_${art}.ktx2`);
        t.name = `${name}_${art}`;
        t.wrapS = THREE.RepeatWrapping;
        t.wrapT = THREE.RepeatWrapping;
        t.colorSpace = art === 'farbe' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        return t;
      };
      const [farbe, normal, orm] = await Promise.all([laden('farbe'), laden('normal'), laden('orm')]);
      return [name, { farbe, normal, orm }] as const;
    }),
  );
  const texturen = Object.fromEntries(texturListe) as unknown as Record<KachelName, KachelMaps>;
  return {
    modelle: Object.fromEntries(modellListe) as unknown as Record<ModellName, THREE.Object3D>,
    texturen,
    info: { ladeMs: Math.round(performance.now() - start), ktx2: formate, texturFormat: `0x${texturen['fichte-laengs'].farbe.format.toString(16)}` },
  };
}

const TEXTUR_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap', 'emissiveMap'] as const;

/** Eigene Textur-Objekte (gleiche Bilddaten), damit jede Szene ihre Texturen selbst entsorgen kann. */
export function texturKopie(t: THREE.Texture, kopien: Map<THREE.Texture, THREE.Texture> = new Map()): THREE.Texture {
  const da = kopien.get(t);
  if (da) return da;
  const k = t.clone();
  kopien.set(t, k);
  return k;
}

export interface Instanz {
  readonly wurzel: THREE.Object3D;
  /** Alles, was die Szene beim Entsorgen freigeben muss. */
  readonly entsorgen: { dispose(): void }[];
}

/**
 * Tiefe Kopie einer Vorlage mit eigenen Geometrien, Materialien und Textur-Objekten. Gemeinsam genutzte
 * Materialien/Texturen der Vorlage bleiben auch in der Kopie gemeinsam (keine zusätzlichen Draw-Call-Wechsel).
 */
export function instanz(vorlage: THREE.Object3D): Instanz {
  const wurzel = vorlage.clone(true);
  const entsorgen: { dispose(): void }[] = [];
  const materialien = new Map<THREE.Material, THREE.Material>();
  const texturen = new Map<THREE.Texture, THREE.Texture>();
  const materialKopie = (m: THREE.Material): THREE.Material => {
    const da = materialien.get(m);
    if (da) return da;
    const k = m.clone();
    const slots = k as unknown as Record<string, unknown>;
    for (const slot of TEXTUR_SLOTS) {
      const roh = slots[slot];
      if (roh instanceof THREE.Texture) {
        const t = roh as THREE.Texture;
        const neu = !texturen.has(t);
        const kt = texturKopie(t, texturen);
        slots[slot] = kt;
        if (neu) entsorgen.push(kt);
      }
    }
    materialien.set(m, k);
    entsorgen.push(k);
    return k;
  };
  wurzel.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const g = (o.geometry as THREE.BufferGeometry).clone();
    o.geometry = g;
    entsorgen.push(g);
    o.material = Array.isArray(o.material) ? o.material.map(materialKopie) : materialKopie(o.material as THREE.Material);
  });
  return { wurzel, entsorgen };
}

/** Kind-Knoten nach Name (wirft, wenn er fehlt – dann passt das Asset nicht zum dokumentierten Vertrag). */
export function knoten(wurzel: THREE.Object3D, name: string): THREE.Object3D {
  const k = wurzel.getObjectByName(name);
  if (!k) throw new Error(`Asset-Knoten "${name}" fehlt in "${wurzel.name}"`);
  return k;
}
