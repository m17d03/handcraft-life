/**
 * Engine-Spike Three.js (Ticket 005). Nur Rendern – Steuerung, Kamera, Interaktion, Messung in
 * spikes/shared. Lichtwerte × π, weil Three seit r155 physikalische Lichteinheiten nutzt
 * (Lambert mit 1/π), die Szenenbeschreibung aber in Albedo-Multiplikator-Einheiten rechnet.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FXAAPass } from 'three/examples/jsm/postprocessing/FXAAPass.js';
import { runSpike, type EngineAdapter, type SceneContext } from '../shared/app';
import type { MeshData } from '../shared/geometry';
import { add, type Vec3 } from '../shared/math';
import type { AaMode } from '../shared/perf';
import {
  CAMERA,
  CUT_LINE_MESH,
  BEAM_CENTER,
  HIGHLIGHT_EMISSIVE,
  HIGHLIGHT_TINT,
  INSTANCES,
  LIGHT,
  MATERIALS,
  PARTS,
  type MaterialId,
} from '../shared/scene-spec';

function geometry(m: MeshData): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
  g.setAttribute('tangent', new THREE.BufferAttribute(m.tangents, 4));
  g.setAttribute('uv', new THREE.BufferAttribute(m.uvs, 2));
  g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  return g;
}

class ThreeAdapter implements EngineAdapter {
  readonly engine = 'three' as const;
  readonly version = THREE.REVISION;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private fxaa: FXAAPass | null = null;
  private beamMat!: THREE.MeshStandardMaterial;
  private cutLine!: THREE.Mesh;

  init(canvas: HTMLCanvasElement, ctx: SceneContext): Promise<{ aa: AaMode; msaaSamples: number }> {
    const msaa = ctx.params.aa === 'msaa';
    const r = new THREE.WebGLRenderer({ canvas, antialias: msaa, powerPreference: 'high-performance' });
    this.renderer = r;
    r.setPixelRatio(ctx.pixelRatio);
    r.setSize(ctx.cssWidth, ctx.cssHeight, false);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.setClearColor(new THREE.Color(LIGHT.clearColor));

    const scene = new THREE.Scene();
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera((CAMERA.fovY * 180) / Math.PI, ctx.cssWidth / ctx.cssHeight, CAMERA.near, CAMERA.far);

    // Texturen
    const t = ctx.textures;
    const tex = (data: Uint8Array, srgb: boolean): THREE.DataTexture => {
      const d = new THREE.DataTexture(data, t.size, t.size, THREE.RGBAFormat, THREE.UnsignedByteType);
      d.wrapS = THREE.RepeatWrapping;
      d.wrapT = THREE.RepeatWrapping;
      d.generateMipmaps = true;
      d.minFilter = THREE.LinearMipmapLinearFilter;
      d.magFilter = THREE.LinearFilter;
      d.anisotropy = Math.min(4, r.capabilities.getMaxAnisotropy());
      d.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      d.needsUpdate = true;
      return d;
    };
    const albedo = tex(t.albedo, true);
    const orm = tex(t.orm, false);
    const normal = tex(t.normal, false);

    const mats = new Map<MaterialId, THREE.MeshStandardMaterial>();
    const material = (id: MaterialId): THREE.MeshStandardMaterial => {
      const existing = mats.get(id);
      if (existing) return existing;
      const s = MATERIALS[id];
      const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(s.color), roughness: s.roughness, metalness: s.metalness });
      if (s.woodTexture) {
        m.map = albedo;
        m.roughnessMap = orm;
        m.normalMap = normal;
      }
      mats.set(id, m);
      return m;
    };

    for (const p of PARTS) {
      const mesh = new THREE.Mesh(geometry(p.mesh), material(p.material));
      mesh.position.set(...p.position);
      mesh.castShadow = p.castShadow;
      mesh.receiveShadow = p.receiveShadow;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      scene.add(mesh);
    }
    for (const g of INSTANCES) {
      const mesh = new THREE.InstancedMesh(geometry(g.mesh), material(g.material), g.matrices.length);
      g.matrices.forEach((m, i) => { mesh.setMatrixAt(i, new THREE.Matrix4().fromArray(m)); });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
    this.beamMat = material('beam');
    this.cutLine = new THREE.Mesh(geometry(CUT_LINE_MESH), material('cutLine'));
    this.cutLine.visible = false;
    this.cutLine.receiveShadow = true;
    this.cutLine.position.set(...BEAM_CENTER);
    scene.add(this.cutLine);

    // Licht
    const sun = new THREE.DirectionalLight(new THREE.Color(LIGHT.sunColor), LIGHT.sunIntensity * Math.PI);
    const d = LIGHT.sunDirection;
    sun.position.set(-d[0] * 8, -d[1] * 8, -d[2] * 8);
    sun.target.position.set(0, 0, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(LIGHT.shadowMapSize, LIGHT.shadowMapSize);
    const sc = sun.shadow.camera;
    sc.left = -4;
    sc.right = 4;
    sc.top = 4;
    sc.bottom = -4;
    sc.near = 1;
    sc.far = 20;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);
    scene.add(new THREE.AmbientLight(new THREE.Color(LIGHT.ambientColor), LIGHT.ambientIntensity * Math.PI));

    let aa: AaMode = msaa ? 'msaa' : 'none';
    let samples = msaa ? (r.getContext().getParameter(r.getContext().SAMPLES) as number) : 0;
    if (ctx.params.aa === 'fxaa') {
      const composer = new EffectComposer(r);
      composer.addPass(new RenderPass(scene, this.camera));
      composer.addPass(new OutputPass());
      this.fxaa = new FXAAPass();
      composer.addPass(this.fxaa);
      this.composer = composer;
      aa = 'fxaa';
      samples = 0;
    }
    return Promise.resolve({ aa, msaaSamples: samples });
  }

  resize(w: number, h: number, ratio: number): void {
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h, false);
    this.composer?.setPixelRatio(ratio);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setCamera(eye: Vec3, forward: Vec3, fovY: number): void {
    this.camera.position.set(...eye);
    this.camera.lookAt(...add(eye, forward));
    const deg = (fovY * 180) / Math.PI;
    if (this.camera.fov !== deg) {
      this.camera.fov = deg;
      this.camera.updateProjectionMatrix();
    }
  }

  setBeamHighlight(on: boolean): void {
    this.beamMat.emissive.set(on ? HIGHLIGHT_EMISSIVE : '#000000');
    this.beamMat.color.set(on ? HIGHLIGHT_TINT : MATERIALS.beam.color);
  }

  setCutLine(x: number | null): void {
    this.cutLine.visible = x !== null;
    if (x !== null) this.cutLine.position.x = x;
  }

  start(onFrame: (nowMs: number) => void): void {
    this.renderer.setAnimationLoop((now: number) => {
      onFrame(now);
      if (this.composer) this.composer.render();
      else this.renderer.render(this.scene, this.camera);
    });
  }
}

void runSpike(new ThreeAdapter());
