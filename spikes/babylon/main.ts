/**
 * Engine-Spike Babylon.js (Ticket 005). Nur Rendern – Steuerung, Kamera, Interaktion, Messung in
 * spikes/shared. Tiefe Importe aus @babylonjs/core (Tree-Shaking); rechtshändiges System, damit
 * Koordinaten und Kamera exakt den anderen beiden Engines entsprechen. Zwei Fallstricke (im Spike
 * gefunden): Babylon behandelt auch im RH-Modus CW als Vorderseite → Material auf CCW stellen;
 * Babylon-PBR rechnet Lambert mit 1/π wie Three → Lichtstärken × π (siehe scene-spec LIGHT).
 */
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Material } from '@babylonjs/core/Materials/material';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { FxaaPostProcess } from '@babylonjs/core/PostProcesses/fxaaPostProcess';
import { runSpike, type EngineAdapter, type SceneContext } from '../shared/app';
import type { MeshData } from '../shared/geometry';
import { add, hexToLinear, type Vec3 } from '../shared/math';
import type { AaMode } from '../shared/perf';
import {
  BEAM_CENTER,
  CAMERA,
  CUT_LINE_MESH,
  HIGHLIGHT_EMISSIVE,
  HIGHLIGHT_TINT,
  INSTANCES,
  LIGHT,
  MATERIALS,
  PARTS,
  type MaterialId,
} from '../shared/scene-spec';

const lin = (hex: string): Color3 => {
  const c = hexToLinear(hex);
  return new Color3(c[0], c[1], c[2]);
};

function makeMesh(name: string, data: MeshData, scene: Scene): Mesh {
  const mesh = new Mesh(name, scene);
  const vd = new VertexData();
  vd.positions = data.positions;
  vd.normals = data.normals;
  vd.tangents = data.tangents;
  vd.uvs = data.uvs;
  vd.indices = data.indices;
  vd.applyToMesh(mesh, false);
  return mesh;
}

class BabylonAdapter implements EngineAdapter {
  readonly engine = 'babylon' as const;
  readonly version = Engine.Version;
  private bjs!: Engine;
  private scene!: Scene;
  private camera!: FreeCamera;
  private beamMat!: PBRMaterial;
  private cutLine!: Mesh;

  init(canvas: HTMLCanvasElement, ctx: SceneContext): Promise<{ aa: AaMode; msaaSamples: number }> {
    const msaa = ctx.params.aa === 'msaa';
    const engine = new Engine(canvas, msaa, { powerPreference: 'high-performance', stencil: false }, false);
    this.bjs = engine;
    engine.setHardwareScalingLevel(1 / ctx.pixelRatio);
    const scene = new Scene(engine);
    this.scene = scene;
    scene.useRightHandedSystem = true;
    // Babylon schreibt die Clear-Farbe unverändert in den Framebuffer → sRGB-Wert direkt
    scene.clearColor = Color4.FromHexString(`${LIGHT.clearColor}ff`);
    scene.skipPointerMovePicking = true;
    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1;

    const cam = new FreeCamera('cam', new Vector3(...CAMERA.start.position), scene);
    cam.minZ = CAMERA.near;
    cam.maxZ = CAMERA.far;
    cam.fov = CAMERA.fovY;
    cam.inputs.clear(); // Eingabe kommt aus spikes/shared
    this.camera = cam;

    // Texturen
    const t = ctx.textures;
    const tex = (data: Uint8Array, gamma: boolean): RawTexture => {
      const r = RawTexture.CreateRGBATexture(data, t.size, t.size, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
      r.wrapU = Texture.WRAP_ADDRESSMODE;
      r.wrapV = Texture.WRAP_ADDRESSMODE;
      r.anisotropicFilteringLevel = 4;
      r.gammaSpace = gamma;
      return r;
    };
    const albedo = tex(t.albedo, true);
    const orm = tex(t.orm, false);
    const normal = tex(t.normal, false);

    const mats = new Map<MaterialId, PBRMaterial>();
    const material = (id: MaterialId): PBRMaterial => {
      const existing = mats.get(id);
      if (existing) return existing;
      const s = MATERIALS[id];
      const m = new PBRMaterial(id, scene);
      // Gemeinsame Geometrie ist CCW (OpenGL); Babylon nimmt sonst auch im RH-Modus CW als Vorderseite.
      m.sideOrientation = Material.CounterClockWiseSideOrientation;
      m.albedoColor = lin(s.color);
      m.metallic = s.metalness;
      m.roughness = s.roughness;
      m.environmentIntensity = 0;
      if (s.woodTexture) {
        m.albedoTexture = albedo;
        m.metallicTexture = orm;
        m.useRoughnessFromMetallicTextureGreen = true;
        m.useMetallnessFromMetallicTextureBlue = true;
        m.useAmbientOcclusionFromMetallicTextureRed = false;
        m.metallic = 1; // Faktor × Blau-Kanal (= 0)
        m.roughness = 1; // Faktor × Grün-Kanal
        m.bumpTexture = normal;
        // Normalenkarte in OpenGL-Konvention (+Y) wie bei Three/PlayCanvas
        m.invertNormalMapY = false;
      }
      mats.set(id, m);
      return m;
    };

    // Licht
    const d = LIGHT.sunDirection;
    const sun = new DirectionalLight('sun', new Vector3(d[0], d[1], d[2]), scene);
    sun.position = new Vector3(-d[0] * 8, -d[1] * 8, -d[2] * 8);
    sun.diffuse = lin(LIGHT.sunColor);
    sun.specular = lin(LIGHT.sunColor);
    sun.intensity = LIGHT.sunIntensity * Math.PI;
    sun.shadowMinZ = 1;
    sun.shadowMaxZ = 20;
    const amb = new HemisphericLight('amb', new Vector3(0, 1, 0), scene);
    amb.diffuse = lin(LIGHT.ambientColor);
    amb.groundColor = lin(LIGHT.ambientColor);
    amb.specular = Color3.Black();
    amb.intensity = LIGHT.ambientIntensity * Math.PI;

    const shadows = new ShadowGenerator(LIGHT.shadowMapSize, sun);
    shadows.usePercentageCloserFiltering = true;
    shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    shadows.bias = 0.0005;
    shadows.normalBias = 0.02;

    for (const p of PARTS) {
      const mesh = makeMesh(p.id, p.mesh, scene);
      mesh.position.set(...p.position);
      mesh.material = material(p.material);
      mesh.receiveShadows = p.receiveShadow;
      if (p.castShadow) shadows.addShadowCaster(mesh);
      mesh.freezeWorldMatrix();
    }
    for (const g of INSTANCES) {
      const mesh = makeMesh(g.id, g.mesh, scene);
      mesh.material = material(g.material);
      const buf = new Float32Array(16 * g.matrices.length);
      g.matrices.forEach((m, i) => { buf.set(m, i * 16); });
      mesh.thinInstanceSetBuffer('matrix', buf, 16, true);
      mesh.receiveShadows = true;
      shadows.addShadowCaster(mesh);
    }
    this.beamMat = material('beam');
    this.cutLine = makeMesh('cutLine', CUT_LINE_MESH, scene);
    this.cutLine.material = material('cutLine');
    this.cutLine.position.set(...BEAM_CENTER);
    this.cutLine.receiveShadows = true;
    this.cutLine.setEnabled(false);

    let aa: AaMode = msaa ? 'msaa' : 'none';
    let samples = msaa ? (engine._gl.getParameter(engine._gl.SAMPLES) as number) : 0;
    if (ctx.params.aa === 'fxaa') {
      new FxaaPostProcess('fxaa', 1.0, cam);
      aa = 'fxaa';
      samples = 0;
    }
    return scene.whenReadyAsync().then(() => ({ aa, msaaSamples: samples }));
  }

  resize(_w: number, _h: number, ratio: number): void {
    this.bjs.setHardwareScalingLevel(1 / ratio);
    this.bjs.resize();
  }

  setCamera(eye: Vec3, forward: Vec3, fovY: number): void {
    this.camera.position.set(...eye);
    this.camera.setTarget(new Vector3(...add(eye, forward)));
    this.camera.fov = fovY;
  }

  setBeamHighlight(on: boolean): void {
    this.beamMat.emissiveColor = on ? lin(HIGHLIGHT_EMISSIVE) : Color3.Black();
    this.beamMat.albedoColor = lin(on ? HIGHLIGHT_TINT : MATERIALS.beam.color);
  }

  setCutLine(x: number | null): void {
    this.cutLine.setEnabled(x !== null);
    if (x !== null) this.cutLine.position.x = x;
  }

  start(onFrame: (nowMs: number) => void): void {
    this.bjs.runRenderLoop(() => {
      onFrame(performance.now());
      this.scene.render();
    });
  }
}

void runSpike(new BabylonAdapter());
