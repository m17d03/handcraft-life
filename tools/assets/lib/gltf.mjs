// three-Geometrie → glTF 2.0 (GLB) über @gltf-transform/core.
// Texturen als KTX2 (KHR_texture_basisu), Meshes mit EXT_meshopt_compression.
import { Document, NodeIO, TextureInfo } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRTextureBasisu } from '@gltf-transform/extensions';
import { MeshoptEncoder } from 'meshoptimizer';

export class GlbBau {
  constructor(name) {
    this.doc = new Document();
    this.doc.getRoot().getAsset().generator = 'handcraft-life tools/assets (glTF-Transform)';
    this.puffer = this.doc.createBuffer('daten');
    this.szene = this.doc.createScene(name);
    this.doc.createExtension(KHRTextureBasisu).setRequired(true);
    this.doc
      .createExtension(EXTMeshoptCompression)
      .setRequired(true)
      .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
    this.dreiecke = 0;
    this.texturen = [];
  }

  textur(name, ktx2, breite, hoehe) {
    const t = this.doc.createTexture(name).setImage(ktx2).setMimeType('image/ktx2');
    this.texturen.push({ name, breite, hoehe, bytes: ktx2.byteLength });
    return t;
  }

  /**
   * PBR-Material (metallic-roughness). `orm`: R = AO, G = Rauheit, B = Metall (glTF-Konvention).
   * wrap: 'kachel' (REPEAT) oder 'rand' (CLAMP_TO_EDGE); wrapU/wrapV einzeln überschreibbar.
   */
  material(name, { farbe, normal, orm, faktor = [1, 1, 1, 1], rauheit = 1, metall = 1, alphaMaske = null, wrapU = 'rand', wrapV = 'rand', normalStaerke = 1 }) {
    const m = this.doc.createMaterial(name).setBaseColorFactor(faktor).setRoughnessFactor(rauheit).setMetallicFactor(metall);
    const modus = (w) => (w === 'kachel' ? TextureInfo.WrapMode.REPEAT : TextureInfo.WrapMode.CLAMP_TO_EDGE);
    const info = (ti) => {
      ti.setWrapS(modus(wrapU)).setWrapT(modus(wrapV));
      ti.setMinFilter(TextureInfo.MinFilter.LINEAR_MIPMAP_LINEAR).setMagFilter(TextureInfo.MagFilter.LINEAR);
    };
    if (farbe) {
      m.setBaseColorTexture(farbe);
      info(m.getBaseColorTextureInfo());
    }
    if (normal) {
      m.setNormalTexture(normal).setNormalScale(normalStaerke);
      info(m.getNormalTextureInfo());
    }
    if (orm) {
      m.setMetallicRoughnessTexture(orm);
      info(m.getMetallicRoughnessTextureInfo());
      m.setOcclusionTexture(orm);
      info(m.getOcclusionTextureInfo());
    }
    if (alphaMaske !== null) m.setAlphaMode('MASK').setAlphaCutoff(alphaMaske);
    return m;
  }

  /** Mesh aus [{ geometrie, material }] (je ein Primitive). */
  mesh(name, primitive) {
    const mesh = this.doc.createMesh(name);
    for (const { geometrie: g, material } of primitive) {
      const acc = (n, arr, typ) => this.doc.createAccessor(`${name}_${n}`).setArray(arr).setType(typ).setBuffer(this.puffer);
      const pos = new Float32Array(g.getAttribute('position').array);
      const index = g.index.array;
      const anzahl = g.getAttribute('position').count;
      const idx = anzahl < 65536 ? new Uint16Array(index) : new Uint32Array(index);
      const p = this.doc
        .createPrimitive()
        .setAttribute('POSITION', acc('pos', pos, 'VEC3'))
        .setAttribute('NORMAL', acc('nor', new Float32Array(g.getAttribute('normal').array), 'VEC3'))
        .setAttribute('TEXCOORD_0', acc('uv', new Float32Array(g.getAttribute('uv').array), 'VEC2'))
        .setIndices(acc('idx', idx, 'SCALAR'))
        .setMaterial(material);
      mesh.addPrimitive(p);
      this.dreiecke += index.length / 3;
    }
    return mesh;
  }

  knoten(name, { mesh = null, position = [0, 0, 0], eltern = null } = {}) {
    const k = this.doc.createNode(name).setTranslation(position);
    if (mesh) k.setMesh(mesh);
    if (eltern) eltern.addChild(k);
    else this.szene.addChild(k);
    return k;
  }

  async schreiben() {
    await MeshoptEncoder.ready;
    const io = new NodeIO().registerExtensions([KHRTextureBasisu, EXTMeshoptCompression]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
    return io.writeBinary(this.doc);
  }
}
