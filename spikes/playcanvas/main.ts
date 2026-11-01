/**
 * Engine-Spike PlayCanvas (Ticket 005), Open-Source-Engine über npm, ohne Editor.
 * Nur Rendern – Steuerung, Kamera, Interaktion, Messung in spikes/shared.
 * AppBase mit nur den nötigen Komponenten (kleineres Bundle als `Application`).
 * PlayCanvas hat kein eingebautes FXAA: ?aa=fxaa schaltet hier TAA (CameraFrame) ein.
 */
import {
  ADDRESS_REPEAT,
  AppBase,
  AppOptions,
  BoundingBox,
  CameraComponentSystem,
  CameraFrame,
  Color,
  Entity,
  FILLMODE_NONE,
  FILTER_LINEAR,
  FILTER_LINEAR_MIPMAP_LINEAR,
  GAMMA_SRGB,
  LightComponentSystem,
  Mesh,
  MeshInstance,
  PIXELFORMAT_RGBA8,
  PIXELFORMAT_SRGBA8,
  PRIMITIVE_TRIANGLES,
  Quat,
  RenderComponentSystem,
  RESOLUTION_AUTO,
  SEMANTIC_TANGENT,
  SHADOW_PCF3_32F,
  StandardMaterial,
  Texture,
  TONEMAP_ACES,
  Vec3 as PcVec3,
  VertexBuffer,
  VertexFormat,
  WebglGraphicsDevice,
  version,
} from 'playcanvas';
import { runSpike, type EngineAdapter, type SceneContext } from '../shared/app';
import type { MeshData } from '../shared/geometry';
import { add, quatFromUnitVectors, type Vec3 } from '../shared/math';
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

const color = (hex: string): Color => new Color().fromString(hex);

class PlayCanvasAdapter implements EngineAdapter {
  readonly engine = 'playcanvas' as const;
  readonly version = version;
  private app!: AppBase;
  private device!: WebglGraphicsDevice;
  private camera!: Entity;
  private beamMat!: StandardMaterial;
  private cutLine!: Entity;
  private readonly target = new PcVec3();

  init(canvas: HTMLCanvasElement, ctx: SceneContext): Promise<{ aa: AaMode; msaaSamples: number; note?: string }> {
    const wantTaa = ctx.params.aa === 'fxaa';
    const msaa = ctx.params.aa === 'msaa';
    const device = new WebglGraphicsDevice(canvas, { antialias: msaa, powerPreference: 'high-performance', stencil: false });
    device.maxPixelRatio = ctx.pixelRatio;
    this.device = device;
    const opts = new AppOptions();
    opts.graphicsDevice = device;
    opts.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];
    opts.resourceHandlers = [];
    const app = new AppBase(canvas);
    app.init(opts);
    app.setCanvasFillMode(FILLMODE_NONE);
    app.setCanvasResolution(RESOLUTION_AUTO);
    this.app = app;
    const scene = app.scene;

    // Umgebungslicht: lineare Farbe × Stärke; PlayCanvas erwartet sRGB und linearisiert selbst
    const ambient = color(LIGHT.ambientColor);
    const amb = ambient.clone().linear().mulScalar(LIGHT.ambientIntensity).gamma();
    scene.ambientLight = amb;

    // Kamera
    const cam = new Entity('camera');
    cam.addComponent('camera', {
      clearColor: color(LIGHT.clearColor),
      fov: (CAMERA.fovY * 180) / Math.PI,
      nearClip: CAMERA.near,
      farClip: CAMERA.far,
      toneMapping: TONEMAP_ACES,
      gammaCorrection: GAMMA_SRGB,
    });
    app.root.addChild(cam);
    this.camera = cam;

    // Texturen
    const t = ctx.textures;
    const tex = (name: string, data: Uint8Array, srgb: boolean): Texture =>
      new Texture(device, {
        name,
        width: t.size,
        height: t.size,
        format: srgb ? PIXELFORMAT_SRGBA8 : PIXELFORMAT_RGBA8,
        mipmaps: true,
        addressU: ADDRESS_REPEAT,
        addressV: ADDRESS_REPEAT,
        minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
        magFilter: FILTER_LINEAR,
        anisotropy: 4,
        levels: [data],
      });
    const albedo = tex('wood-albedo', t.albedo, true);
    const orm = tex('wood-orm', t.orm, false);
    const normal = tex('wood-normal', t.normal, false);

    const mats = new Map<MaterialId, StandardMaterial>();
    const material = (id: MaterialId): StandardMaterial => {
      const existing = mats.get(id);
      if (existing) return existing;
      const s = MATERIALS[id];
      const m = new StandardMaterial();
      m.name = id;
      m.diffuse = color(s.color);
      m.useMetalness = true;
      m.metalness = s.metalness;
      m.glossInvert = true; // gloss-Werte als Rauheit
      m.gloss = s.roughness;
      if (s.woodTexture) {
        m.diffuseMap = albedo;
        m.glossMap = orm;
        m.glossMapChannel = 'g';
        m.normalMap = normal;
        m.bumpiness = 1;
      }
      m.update();
      mats.set(id, m);
      return m;
    };

    const mesh = (d: MeshData): Mesh => {
      const m = new Mesh(device);
      m.setPositions(d.positions);
      m.setNormals(d.normals);
      m.setUvs(0, d.uvs);
      m.setVertexStream(SEMANTIC_TANGENT, d.tangents, 4);
      m.setIndices(d.indices);
      m.update(PRIMITIVE_TRIANGLES);
      return m;
    };

    for (const p of PARTS) {
      const e = new Entity(p.id);
      e.addComponent('render', {
        meshInstances: [new MeshInstance(mesh(p.mesh), material(p.material))],
        castShadows: p.castShadow,
        receiveShadows: p.receiveShadow,
      });
      e.setPosition(...p.position);
      app.root.addChild(e);
    }
    const instFormat = VertexFormat.getDefaultInstancingFormat(device);
    for (const g of INSTANCES) {
      const data = new Float32Array(16 * g.matrices.length);
      g.matrices.forEach((m, i) => { data.set(m, i * 16); });
      const mi = new MeshInstance(mesh(g.mesh), material(g.material));
      mi.setInstancing(new VertexBuffer(device, instFormat, g.matrices.length, { data }));
      // Instanzen liegen auf der Werkbank: Hüllquader für Sichtbarkeit/Schatten von Hand setzen
      mi.setCustomAabb(new BoundingBox(new PcVec3(0, 0.6, -1.45), new PcVec3(1.1, 0.5, 0.45)));
      const e = new Entity(g.id);
      e.addComponent('render', { meshInstances: [mi], castShadows: true, receiveShadows: true });
      app.root.addChild(e);
    }
    this.beamMat = material('beam');
    this.cutLine = new Entity('cutLine');
    this.cutLine.addComponent('render', {
      meshInstances: [new MeshInstance(mesh(CUT_LINE_MESH), material('cutLine'))],
      castShadows: false,
      receiveShadows: true,
    });
    this.cutLine.setPosition(...BEAM_CENTER);
    this.cutLine.enabled = false;
    app.root.addChild(this.cutLine);

    // Richtungslicht: leuchtet entlang −Y der Entity
    const sun = new Entity('sun');
    sun.addComponent('light', {
      type: 'directional',
      color: color(LIGHT.sunColor),
      intensity: LIGHT.sunIntensity,
      castShadows: true,
      shadowResolution: LIGHT.shadowMapSize,
      shadowDistance: 9,
      shadowType: SHADOW_PCF3_32F,
      shadowBias: 0.05,
      normalOffsetBias: 0.05,
    });
    const q = quatFromUnitVectors([0, -1, 0], LIGHT.sunDirection);
    sun.setRotation(new Quat(q[0], q[1], q[2], q[3]));
    app.root.addChild(sun);

    let aa: AaMode = msaa ? 'msaa' : 'none';
    let samples = msaa ? device.samples : 0;
    let note: string | undefined;
    if (wantTaa && cam.camera) {
      const frame = new CameraFrame(app, cam.camera);
      frame.rendering.toneMapping = TONEMAP_ACES;
      frame.rendering.samples = 1;
      frame.taa.enabled = true;
      frame.update();
      aa = 'taa';
      samples = 0;
      note = 'PlayCanvas: kein eingebautes FXAA – TAA aktiv';
    }
    app.updateCanvasSize();
    const result: { aa: AaMode; msaaSamples: number; note?: string } = { aa, msaaSamples: samples };
    if (note) result.note = note;
    return Promise.resolve(result);
  }

  resize(_w: number, _h: number, ratio: number): void {
    this.device.maxPixelRatio = ratio;
    this.app.updateCanvasSize();
  }

  setCamera(eye: Vec3, forward: Vec3, fovY: number): void {
    this.camera.setPosition(...eye);
    const t = add(eye, forward);
    this.target.set(t[0], t[1], t[2]);
    this.camera.lookAt(this.target);
    const cc = this.camera.camera;
    if (cc) cc.fov = (fovY * 180) / Math.PI;
  }

  setBeamHighlight(on: boolean): void {
    this.beamMat.emissive = color(on ? HIGHLIGHT_EMISSIVE : '#000000');
    this.beamMat.diffuse = color(on ? HIGHLIGHT_TINT : MATERIALS.beam.color);
    this.beamMat.update();
  }

  setCutLine(x: number | null): void {
    this.cutLine.enabled = x !== null;
    if (x !== null) this.cutLine.setPosition(x, BEAM_CENTER[1], BEAM_CENTER[2]);
  }

  start(onFrame: (nowMs: number) => void): void {
    this.app.on('update', () => { onFrame(performance.now()); });
    this.app.start();
  }
}

void runSpike(new PlayCanvasAdapter());
