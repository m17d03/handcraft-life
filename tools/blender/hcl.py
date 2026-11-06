"""Gemeinsame Helfer für die Blender-Modellskripte (Ticket 019, ADR 0005).

Ablauf je Modell (siehe saege.py usw.):
  1. neu()                 – leere Szene, Cycles CPU, fester Seed
  2. Geometrie bauen       – Kurven mit Rundung (profil_koerper), Primitive, Modifikatoren
  3. Materialien (prozedural, pbr()) → backe() in einen UV-Atlas: Farbe, Rauheit, Metall, AO (Cycles), Normal
  4. exportiere()          – GLB ohne Bilder + manifest.json + Rohtexturen (RGBA8) in tools/blender/build/<modell>/
  5. vorschau()            – Cycles-Render mit den gebackenen Karten (Asset-Vorschau – kein Spielscreenshot)
Danach setzt `node tools/blender/optimiere.mjs` KTX2 + meshopt um (bestehende Pipeline tools/assets/lib).

Koordinaten: Die Skripte rechnen in glTF-Achsen (Y oben, Masse in mm) und setzen über G() in Blender-Achsen
(Z oben) um; der glTF-Export (+Y up) macht daraus wieder genau die glTF-Lage. glTF (x, y, z) = Blender (x, -y_b, z_b)…
konkret: Blender = (x, -z, y).
"""
import json
import math
import os

import bpy  # noqa: I001 – bpy muss vor bmesh/mathutils geladen sein
import bmesh
import mathutils
import numpy as np

WURZEL = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
BUILD = os.path.join(WURZEL, 'tools', 'blender', 'build')
VORSCHAU = os.path.join(WURZEL, 'docs', 'art', 'assets-blender')
SEED = 20261101


# ---------------------------------------------------------------------------------------------
# Szene
# ---------------------------------------------------------------------------------------------

def neu():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.seed = SEED
    sc.cycles.use_animated_seed = False
    sc.render.threads_mode = 'FIXED'
    sc.render.threads = os.cpu_count() or 4
    w = bpy.data.worlds.new('Welt')
    sc.world = w
    _nodes_an(w)
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.5, 0.5, 0.5, 1)
    return sc


def _nodes_an(idb):
    try:
        idb.use_nodes = True
    except Exception:  # Blender 5: immer Knoten
        pass
    if idb.node_tree is None:
        raise RuntimeError('keine Knoten')


def G(x, y, z):
    """glTF-Punkt in mm → Blender-Vektor in m."""
    return mathutils.Vector((x / 1000.0, -z / 1000.0, y / 1000.0))


def verlinke(ob, eltern=None):
    bpy.context.scene.collection.objects.link(ob)
    if eltern is not None:
        ob.parent = eltern
    return ob


def leer(name, pos_mm=(0, 0, 0), eltern=None):
    ob = bpy.data.objects.new(name, None)
    ob.empty_display_size = 0.01
    ob.location = G(*pos_mm)
    return verlinke(ob, eltern)


def mesh_objekt(name, me, eltern=None):
    ob = bpy.data.objects.new(name, me)
    return verlinke(ob, eltern)


def aktiv(*obs):
    bpy.context.view_layer.update()
    for o in bpy.context.scene.objects:
        if o is not None:
            o.select_set(False)
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]


def anwenden(ob):
    """Modifikatoren/Kurve → reines Mesh (gleiches Objekt bleibt, Daten ersetzt)."""
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    if len(me.materials) and all(m is None for m in me.materials):
        me.materials.clear()  # Boolean legt sonst einen leeren Slot an (Flächen zeigen dann auf „kein Material“)
    if ob.type == 'MESH':
        ob.modifiers.clear()
        alt = ob.data
        ob.data = me
        bpy.data.meshes.remove(alt)
        return ob
    neu_ob = bpy.data.objects.new(ob.name + '_m', me)
    neu_ob.matrix_world = ob.matrix_world.copy()
    verlinke(neu_ob)
    for s in ob.material_slots:
        neu_ob.data.materials.append(s.material)
    bpy.data.objects.remove(ob)
    return neu_ob


def transformiere(ob, matrix):
    ob.data.transform(matrix)
    ob.data.update()


def vereine(obs, name):
    """Objekte zu einem Mesh zusammenfügen (Materialien bleiben als Slots erhalten)."""
    for o in obs:
        o.data.transform(o.matrix_world)
        o.matrix_world = mathutils.Matrix.Identity(4)
    aktiv(*obs)
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    return ob


def glaetten(ob, winkel_grad=40):
    me = ob.data
    me.shade_smooth()
    if winkel_grad is not None:
        me.set_sharp_from_angle(angle=math.radians(winkel_grad))


def dreiecke(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    me = ob.evaluated_get(dg).to_mesh()
    me.calc_loop_triangles()
    n = len(me.loop_triangles)
    ob.evaluated_get(dg).to_mesh_clear()
    return n


# ---------------------------------------------------------------------------------------------
# 2D-Pfade (wie THREE.Shape) und Kurven-Körper mit runder Kante
# ---------------------------------------------------------------------------------------------

class Pfad:
    def __init__(self, x, y):
        self.p = [(x, y)]

    def linie(self, x, y, n=1):
        x0, y0 = self.p[-1]
        for i in range(1, n + 1):
            t = i / n
            self.p.append((x0 + (x - x0) * t, y0 + (y - y0) * t))
        return self

    def quad(self, cx, cy, x, y, n=6):
        x0, y0 = self.p[-1]
        for i in range(1, n + 1):
            t = i / n
            a, b, c = (1 - t) ** 2, 2 * (1 - t) * t, t * t
            self.p.append((a * x0 + b * cx + c * x, a * y0 + b * cy + c * y))
        return self

    def kubik(self, c1x, c1y, c2x, c2y, x, y, n=8):
        x0, y0 = self.p[-1]
        for i in range(1, n + 1):
            t = i / n
            a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t * t, t ** 3
            self.p.append((a * x0 + b * c1x + c * c2x + d * x, a * y0 + b * c1y + c * c2y + d * y))
        return self

    def punkte(self):
        p = list(self.p)
        if math.dist(p[0], p[-1]) < 1e-6:
            p.pop()
        return p


def gerundetes_rechteck(w, h, r, n=6):
    x0, x1, y0, y1 = -w / 2, w / 2, -h / 2, h / 2
    p = Pfad(x0 + r, y0)
    p.linie(x1 - r, y0).quad(x1, y0, x1, y0 + r, n)
    p.linie(x1, y1 - r).quad(x1, y1, x1 - r, y1, n)
    p.linie(x0 + r, y1).quad(x0, y1, x0, y1 - r, n)
    p.linie(x0, y0 + r).quad(x0, y0, x0 + r, y0, n)
    return p.punkte()


def kreis(r, n, cx=0.0, cy=0.0):
    return [(cx + r * math.cos(2 * math.pi * i / n), cy + r * math.sin(2 * math.pi * i / n)) for i in range(n)]


def versatz(pts, d):
    """Geschlossenes Polygon um d (mm) nach aussen (d > 0, bezogen auf sein Inneres) bzw. innen verschieben."""
    n = len(pts)
    flaeche = sum(pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1] for i in range(n)) / 2
    s = 1 if flaeche > 0 else -1

    def nrm(a, b):
        dx, dy = b[0] - a[0], b[1] - a[1]
        l = math.hypot(dx, dy) or 1
        return (s * dy / l, -s * dx / l)
    out = []
    for i in range(n):
        p0, p1, p2 = pts[i - 1], pts[i], pts[(i + 1) % n]
        n1, n2 = nrm(p0, p1), nrm(p1, p2)
        bx, by = n1[0] + n2[0], n1[1] + n2[1]
        bl = math.hypot(bx, by) or 1
        bx, by = bx / bl, by / bl
        cos = max(0.5, bx * n1[0] + by * n1[1])
        out.append((p1[0] + bx * d / cos, p1[1] + by * d / cos))
    return out


def profil_koerper(name, aussen, loecher=(), dicke=10.0, rundung=2.0, aufl=3, matrix=None, rundung_z=None):
    """Extrudierter 2D-Umriss (mm) mit runder Kante (Viertelkreis, `aufl` Segmente je Seite). Der Umriss ist die
    Silhouette; Deckel liegen bei ±dicke/2. Löcher werden ebenfalls gerundet. Ergebnis in m, Dicke entlang lokal Z,
    danach `matrix` (Blender-Raum). rundung_z: abweichender Radius in Dickenrichtung (elliptisch)."""
    rz = rundung if rundung_z is None else rundung_z
    e = dicke / 2 - rz
    stufen = []  # (inset, z)
    for k in range(aufl, -1, -1):
        ph = math.pi / 2 * k / aufl
        stufen.append((rundung * (1 - math.cos(ph)), -e - rz * math.sin(ph)))
    for k in range(0, aufl + 1):
        ph = math.pi / 2 * k / aufl
        stufen.append((rundung * (1 - math.cos(ph)), e + rz * math.sin(ph)))
    if e <= 1e-6:
        del stufen[aufl + 1]
    konturen = [(aussen, -1)] + [(l, 1) for l in loecher]
    bm = bmesh.new()
    ringe_je_kontur = []
    for pts, vz in konturen:
        ringe = []
        for inset, z in stufen:
            q = versatz(pts, vz * inset) if inset > 1e-9 else pts
            ringe.append([bm.verts.new((x / 1000, y / 1000, z / 1000)) for x, y in q])
        ringe_je_kontur.append(ringe)
        n = len(pts)
        for r0, r1 in zip(ringe, ringe[1:]):
            for i in range(n):
                j = (i + 1) % n
                bm.faces.new((r0[i], r0[j], r1[j], r1[i]))
    # Deckel mit Löchern
    for idx in (0, -1):
        polys = [[v.co.copy() for v in ringe[idx]] for ringe in ringe_je_kontur]
        flach = [v for ringe in ringe_je_kontur for v in ringe[idx]]
        tris = mathutils.geometry.tessellate_polygon(polys)
        if len(tris) != len(flach) + 2 * (len(polys) - 1) - 2:
            raise RuntimeError(f'{name}: Deckel nicht sauber trianguliert ({len(tris)} Dreiecke) – Umriss/Loch zu nah?')
        for tri in tris:
            try:
                bm.faces.new([flach[t] for t in tri])
            except ValueError:
                pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = mesh_objekt(name, me)
    if matrix is not None:
        transformiere(ob, matrix)
    return ob


def quader(name, sx, sy, sz, mitte_mm=(0, 0, 0), fase=0.0, segmente=1, gltf=True):
    """Quader in mm. gltf=True: Masse/Mitte in glTF-Achsen (x, y oben, z vorn)."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    if gltf:
        s = (sx / 1000, sz / 1000, sy / 1000)
        c = G(*mitte_mm)
    else:
        s = (sx / 1000, sy / 1000, sz / 1000)
        c = mathutils.Vector(mitte_mm) / 1000
    for v in bm.verts:
        v.co = mathutils.Vector((v.co.x * s[0], v.co.y * s[1], v.co.z * s[2])) + c
    bm.to_mesh(me)
    bm.free()
    ob = mesh_objekt(name, me)
    if fase > 0:
        fasen(ob, fase, segmente)
    return ob


def fasen(ob, breite_mm, segmente=1, winkel=50, anwenden_sofort=True):
    m = ob.modifiers.new('Fase', 'BEVEL')
    m.width = breite_mm / 1000.0
    m.segments = segmente
    m.limit_method = 'ANGLE'
    m.angle_limit = math.radians(winkel)
    m.harden_normals = False
    if anwenden_sofort:
        return anwenden(ob)
    return ob


def zylinder(name, r_mm, laenge_mm, segmente=16, fase_mm=0.0, deckel=True):
    """Zylinder entlang Blender-Z, Mitte im Ursprung."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=deckel, cap_tris=False, segments=segmente, radius1=r_mm / 1000, radius2=r_mm / 1000, depth=laenge_mm / 1000)
    bm.to_mesh(me)
    bm.free()
    ob = mesh_objekt(name, me)
    if fase_mm > 0:
        ob = fasen(ob, fase_mm, 1, 60)
    return ob


def drehteil(name, profil_mm, segmente=16):
    """Rotationskörper um Blender-Z aus (r, z)-Profil in mm (von unten nach oben). r = 0 schliesst."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    ringe = []
    for r, z in profil_mm:
        if r <= 1e-9:
            ringe.append([bm.verts.new((0, 0, z / 1000))])
        else:
            ringe.append([bm.verts.new((r / 1000 * math.cos(2 * math.pi * i / segmente), r / 1000 * math.sin(2 * math.pi * i / segmente), z / 1000)) for i in range(segmente)])
    for a, b in zip(ringe, ringe[1:]):
        for i in range(segmente):
            j = (i + 1) % segmente
            if len(a) == 1 and len(b) == 1:
                continue
            if len(a) == 1:
                bm.faces.new((a[0], b[j], b[i]))
            elif len(b) == 1:
                bm.faces.new((a[i], a[j], b[0]))
            else:
                bm.faces.new((a[i], a[j], b[j], b[i]))
    if len(ringe[0]) > 1:
        bm.faces.new(list(reversed(ringe[0])))
    if len(ringe[-1]) > 1:
        bm.faces.new(ringe[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    return mesh_objekt(name, me)


def achsen_matrix(x_nach, y_nach, z_nach, ort_m=(0, 0, 0)):
    """Matrix, die lokale X/Y/Z auf die gegebenen Blender-Richtungen legt (Spalten)."""
    m = mathutils.Matrix((
        (x_nach[0], y_nach[0], z_nach[0], ort_m[0]),
        (x_nach[1], y_nach[1], z_nach[1], ort_m[1]),
        (x_nach[2], y_nach[2], z_nach[2], ort_m[2]),
        (0, 0, 0, 1),
    ))
    return m


# ---------------------------------------------------------------------------------------------
# Materialien (prozedural, nur für das Backen) und Export-Materialien
# ---------------------------------------------------------------------------------------------

def hex_lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v / 12.92) if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in c) + (1.0,)


def pbr(name, farbe='#808080', rauheit=0.5, metall=0.0, aufbau=None, kante_mm=0.0):
    """Principled-Material. `aufbau(nt, ein)` darf Knoten anlegen und Sockets liefern:
    Rückgabe dict mit optional 'farbe', 'rauheit', 'metall', 'hoehe' (Bump), 'bump_staerke', 'bump_abstand'.
    `kante_mm` > 0: Bevel-Shader rundet Kanten in der Normal-Map ab."""
    m = bpy.data.materials.new(name)
    _nodes_an(m)
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    aus = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.name = 'BSDF'
    nt.links.new(bsdf.outputs[0], aus.inputs['Surface'])
    bsdf.inputs['Base Color'].default_value = hex_lin(farbe) if isinstance(farbe, str) else farbe
    bsdf.inputs['Roughness'].default_value = rauheit
    bsdf.inputs['Metallic'].default_value = metall
    ein = {}
    if aufbau:
        ein = aufbau(nt) or {}
    if 'farbe' in ein:
        nt.links.new(ein['farbe'], bsdf.inputs['Base Color'])
    if 'rauheit' in ein:
        nt.links.new(ein['rauheit'], bsdf.inputs['Roughness'])
    if 'metall' in ein:
        nt.links.new(ein['metall'], bsdf.inputs['Metallic'])
    normal = None
    if kante_mm > 0:
        bev = nt.nodes.new('ShaderNodeBevel')
        bev.samples = 8
        bev.inputs['Radius'].default_value = kante_mm / 1000
        normal = bev.outputs['Normal']
    if 'hoehe' in ein:
        bump = nt.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = ein.get('bump_staerke', 1.0)
        bump.inputs['Distance'].default_value = ein.get('bump_abstand', 0.0005)
        nt.links.new(ein['hoehe'], bump.inputs['Height'])
        if normal is not None:
            nt.links.new(normal, bump.inputs['Normal'])
        normal = bump.outputs['Normal']
    if normal is not None:
        nt.links.new(normal, bsdf.inputs['Normal'])
    return m


def knoten(nt, typ, **werte):
    n = nt.nodes.new(typ)
    for k, v in werte.items():
        if k.startswith('_'):
            setattr(n, k[1:], v)
        else:
            n.inputs[k].default_value = v
    return n


def koord(nt, art='Object'):
    return knoten(nt, 'ShaderNodeTexCoord').outputs[art]


def rampe(nt, faktor, stopps):
    """Farbrampe: stopps = [(pos, '#hex' oder (r,g,b,a))]."""
    r = nt.nodes.new('ShaderNodeValToRGB')
    el = r.color_ramp.elements
    while len(el) > len(stopps):
        el.remove(el[-1])
    while len(el) < len(stopps):
        el.new(0.5)
    for e, (p, c) in zip(el, stopps):
        e.position = p
        e.color = hex_lin(c) if isinstance(c, str) else c
    nt.links.new(faktor, r.inputs['Fac'])
    return r.outputs['Color']


def mathe(nt, op, a, b=None, c=None):
    n = nt.nodes.new('ShaderNodeMath')
    n.operation = op
    for i, v in enumerate((a, b, c)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]


def mische(nt, faktor, a, b, modus='MIX'):
    n = nt.nodes.new('ShaderNodeMix')
    n.data_type = 'RGBA'
    n.blend_type = modus
    for sock, v in ((n.inputs[0], faktor), (n.inputs[6], a), (n.inputs[7], b)):
        if isinstance(v, (int, float)):
            sock.default_value = v
        elif isinstance(v, (tuple, str)):
            sock.default_value = hex_lin(v) if isinstance(v, str) else v
        else:
            nt.links.new(v, sock)
    return n.outputs[2]


def export_material(name, rauheit=1.0, metall=1.0):
    m = bpy.data.materials.new(name)
    _nodes_an(m)
    b = m.node_tree.nodes.get('Principled BSDF')
    if b is None:
        b = m.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
        m.node_tree.links.new(b.outputs[0], m.node_tree.nodes.new('ShaderNodeOutputMaterial').inputs['Surface'])
    b.inputs['Roughness'].default_value = rauheit
    b.inputs['Metallic'].default_value = metall
    return m


def setze_material(ob, mat):
    ob.data.materials.clear()
    ob.data.materials.append(mat)
    for p in ob.data.polygons:
        p.material_index = 0


# ---------------------------------------------------------------------------------------------
# UV und Backen
# ---------------------------------------------------------------------------------------------

def uv_smart(obs, winkel=60, rand=0.008, name='UVMap'):
    """Smart-UV für ein Objekt oder mehrere (gemeinsamer Atlas)."""
    obs = obs if isinstance(obs, (list, tuple)) else [obs]
    for ob in obs:
        if name not in ob.data.uv_layers:
            ob.data.uv_layers.new(name=name)
        ob.data.uv_layers.active = ob.data.uv_layers[name]
    aktiv(*obs)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(winkel), island_margin=rand, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')


def uv_packen(obs, rand=0.006):
    aktiv(*(obs if isinstance(obs, (list, tuple)) else [obs]))
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(margin=rand, rotate=True, shape_method='CONCAVE')
    bpy.ops.object.mode_set(mode='OBJECT')


def _bild(name, w, h, nicht_farbe=True):
    img = bpy.data.images.new(name, w, h, alpha=True, float_buffer=True)
    img.colorspace_settings.name = 'Non-Color' if nicht_farbe else 'Linear Rec.709'
    img.generated_color = (0, 0, 0, 1)
    return img


def _ziel_knoten(mats, img):
    erzeugt = []
    for m in mats:
        nt = m.node_tree
        n = nt.nodes.new('ShaderNodeTexImage')
        n.image = img
        n.interpolation = 'Closest'
        for x in nt.nodes:
            x.select = False
        n.select = True
        nt.nodes.active = n
        erzeugt.append((m, n))
    return erzeugt


def _pixel(img):
    w, h = img.size
    a = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(h, w, 4)[::-1].copy()  # erste Zeile = oben


def _mats(ob):
    return [s.material for s in ob.material_slots if s.material]


def _umleiten(mats, eingang):
    """Material-Ausgang temporär auf Emission(eingang) legen. Liefert Rückbau-Info."""
    alt = []
    for m in mats:
        nt = m.node_tree
        bsdf = nt.nodes['BSDF']
        aus = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
        em = nt.nodes.new('ShaderNodeEmission')
        em.inputs['Strength'].default_value = 1.0
        sock = bsdf.inputs[eingang]
        if sock.is_linked:
            nt.links.new(sock.links[0].from_socket, em.inputs['Color'])
        else:
            v = sock.default_value
            em.inputs['Color'].default_value = tuple(v) if hasattr(v, '__len__') else (v, v, v, 1)
        nt.links.new(em.outputs[0], aus.inputs['Surface'])
        alt.append((m, em, bsdf, aus))
    return alt


def _rueckbau(alt):
    for m, em, bsdf, aus in alt:
        m.node_tree.links.new(bsdf.outputs[0], aus.inputs['Surface'])
        m.node_tree.nodes.remove(em)


def backe(obs, groesse, kanaele=('farbe', 'rauheit', 'metall', 'ao', 'normal'), ao_abstand_mm=20.0, ao_samples=64,
          hochpoly=None, kaefig_mm=2.0, uv='UVMap'):
    """Backt die Kanäle von `obs` (ein Objekt oder Liste, gemeinsamer UV-Atlas `uv`) in Bilder groesse = (w, h).
    Rückgabe dict name → float-Array (h, w, 4), Farbe linear. 'normal' optional aus High-Poly (selected to active)."""
    obs = obs if isinstance(obs, (list, tuple)) else [obs]
    w, h = groesse
    sc = bpy.context.scene
    sc.render.bake.margin = 8
    sc.render.bake.margin_type = 'EXTEND'
    for ob in obs:
        ob.data.uv_layers.active = ob.data.uv_layers[uv]
        for l in ob.data.uv_layers:
            l.active_render = l.name == uv
    mats = list(dict.fromkeys(m for ob in obs for m in _mats(ob)))
    erg = {}
    for k in kanaele:
        img = _bild(f'{obs[0].name}_{k}', w, h, nicht_farbe=(k != 'farbe'))
        if k == 'normal':
            img.generated_color = (0.5, 0.5, 1.0, 1.0)
        hp_mats = _mats(hochpoly) if (hochpoly and k == 'normal') else []
        ziele = _ziel_knoten(mats + [m for m in hp_mats if m not in mats], img)
        aktiv(*obs)
        sc.render.bake.use_selected_to_active = False
        if k in ('farbe', 'rauheit', 'metall'):
            sc.cycles.samples = 1
            sc.cycles.use_denoising = False
            eingang = {'farbe': 'Base Color', 'rauheit': 'Roughness', 'metall': 'Metallic'}[k]
            alt = _umleiten(mats, eingang)
            bpy.ops.object.bake(type='EMIT', margin=8, use_clear=True)
            _rueckbau(alt)
        elif k == 'ao':
            sc.cycles.samples = ao_samples
            sc.world.light_settings.distance = ao_abstand_mm / 1000
            bpy.ops.object.bake(type='AO', margin=8, use_clear=True)
        elif k == 'normal':
            sc.cycles.samples = 8
            sc.render.bake.normal_space = 'TANGENT'
            if hochpoly is not None:
                for i, ob in enumerate(obs):
                    aktiv(ob, hochpoly)
                    bpy.context.view_layer.objects.active = ob
                    sc.render.bake.max_ray_distance = kaefig_mm * 2 / 1000
                    bpy.ops.object.bake(type='NORMAL', margin=8, use_clear=(i == 0), use_selected_to_active=True,
                                        cage_extrusion=kaefig_mm / 1000)
            else:
                bpy.ops.object.bake(type='NORMAL', margin=8, use_clear=True)
        erg[k] = _pixel(img)
        for m, n in ziele:
            m.node_tree.nodes.remove(n)
        bpy.data.images.remove(img)
    return erg


def lin_srgb(a):
    a = np.clip(a, 0, 1)
    return np.where(a <= 0.0031308, a * 12.92, 1.055 * np.power(a, 1 / 2.4) - 0.055)


def u8(a):
    return (np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)


def halbiere(a, normal=False):
    """RGBA8-Karte auf halbe Kantenlänge (2×2-Mittel); Normal-Maps danach neu normiert."""
    f = a.astype(np.float32) / 255
    f = (f[0::2, 0::2] + f[1::2, 0::2] + f[0::2, 1::2] + f[1::2, 1::2]) / 4
    if normal:
        v = f[..., :3] * 2 - 1
        v /= np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-6)
        f[..., :3] = v * 0.5 + 0.5
    return u8(f)


def karten(b, ao_min=0.0, ao_gamma=1.0):
    """Gebackene Kanäle → RGBA8-Karten (erste Zeile oben): farbe (sRGB), orm (R=AO, G=Rauheit, B=Metall), normal."""
    out = {}
    h, w = next(iter(b.values())).shape[:2]
    if 'farbe' in b:
        f = np.ones((h, w, 4), np.float32)
        f[..., :3] = lin_srgb(b['farbe'][..., :3])
        out['farbe'] = u8(f)
    if 'rauheit' in b or 'ao' in b:
        o = np.ones((h, w, 4), np.float32)
        ao = b['ao'][..., 0] if 'ao' in b else np.ones((h, w), np.float32)
        ao = ao_min + (1 - ao_min) * np.power(np.clip(ao, 0, 1), ao_gamma)
        o[..., 0] = ao
        o[..., 1] = b['rauheit'][..., 0] if 'rauheit' in b else 1
        o[..., 2] = b['metall'][..., 0] if 'metall' in b else 0
        out['orm'] = u8(o)
    if 'normal' in b:
        n = np.ones((h, w, 4), np.float32)
        n[..., :3] = b['normal'][..., :3]
        out['normal'] = u8(n)
    return out


# ---------------------------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------------------------

def speichere_karten(modell, praefix, k):
    """RGBA8-Rohdaten für optimiere.mjs + PNG zur Ansicht. Rückgabe: Manifest-Einträge."""
    ziel = os.path.join(BUILD, modell)
    os.makedirs(ziel, exist_ok=True)
    eintraege = {}
    for art, a in k.items():
        datei = f'{praefix}_{art}.rgba'
        a.tofile(os.path.join(ziel, datei))
        eintraege[art] = {'datei': datei, 'w': int(a.shape[1]), 'h': int(a.shape[0])}
        img = bpy.data.images.new(f'png_{praefix}_{art}', a.shape[1], a.shape[0], alpha=True)
        img.pixels.foreach_set((a[::-1].astype(np.float32) / 255).ravel())
        img.filepath_raw = os.path.join(ziel, f'{praefix}_{art}.png')
        img.file_format = 'PNG'
        img.save()
        bpy.data.images.remove(img)
    return eintraege


def exportiere(modell, wurzel, manifest):
    """GLB (ohne Bilder) der Hierarchie unter `wurzel` + manifest.json nach build/<modell>/."""
    ziel = os.path.join(BUILD, modell)
    os.makedirs(ziel, exist_ok=True)
    obs = [wurzel, *wurzel.children_recursive]
    aktiv(*obs)
    pfad = os.path.join(ziel, 'roh.glb')
    bpy.ops.export_scene.gltf(
        filepath=pfad, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
        export_texcoords=True, export_normals=True, export_tangents=True, export_materials='EXPORT',
        export_image_format='NONE', export_extras=False, export_cameras=False, export_lights=False,
        export_animations=False, export_skins=False, export_morph=False,
    )
    manifest = dict(manifest)
    manifest['glb'] = 'roh.glb'
    with open(os.path.join(ziel, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f'[{modell}] exportiert: {pfad}')


# ---------------------------------------------------------------------------------------------
# Vorschau (Cycles) mit den gebackenen Karten
# ---------------------------------------------------------------------------------------------

def vorschau_material(name, k, wrap_kachel=False, faktor=(1, 1, 1, 1), ao_extra=None):
    """Material aus den RGBA8-Karten (wie im Spiel: Farbe × AO, ORM, Normal)."""
    m = bpy.data.materials.new('V_' + name)
    _nodes_an(m)
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    aus = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bsdf.outputs[0], aus.inputs['Surface'])

    def bild(art, farbe):
        a = k[art]
        img = bpy.data.images.new(f'V_{name}_{art}', a.shape[1], a.shape[0], alpha=True)
        img.colorspace_settings.name = 'sRGB' if farbe else 'Non-Color'  # vor den Pixeln setzen (sonst neu erzeugt)
        img.pixels.foreach_set((a[::-1].astype(np.float32) / 255).ravel())
        img.update()
        n = nt.nodes.new('ShaderNodeTexImage')
        n.image = img
        n.extension = 'REPEAT' if wrap_kachel else 'EXTEND'
        return n

    farbe = None
    if 'farbe' in k:
        farbe = bild('farbe', True).outputs['Color']
    fk = mische(nt, 1.0, faktor, farbe if farbe is not None else (1, 1, 1, 1), 'MULTIPLY')
    if 'orm' in k:
        o = bild('orm', False)
        sep = nt.nodes.new('ShaderNodeSeparateColor')
        nt.links.new(o.outputs['Color'], sep.inputs[0])
        ao = sep.outputs[0]
        if ao_extra is not None:
            a2 = bild(ao_extra, False)
            a2.extension = 'EXTEND'
            uvn = nt.nodes.new('ShaderNodeUVMap')
            uvn.uv_map = 'AO'
            nt.links.new(uvn.outputs[0], a2.inputs['Vector'])
            ao = a2.outputs['Color']
        fk = mische(nt, 1.0, fk, ao, 'MULTIPLY')
        nt.links.new(sep.outputs[1], bsdf.inputs['Roughness'])
        nt.links.new(sep.outputs[2], bsdf.inputs['Metallic'])
    nt.links.new(fk, bsdf.inputs['Base Color'])
    if 'normal' in k:
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nt.links.new(bild('normal', False).outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs[0], bsdf.inputs['Normal'])
    return m


def vorschau(datei, titel, kamera_pos, ziel, linse=50, aufloesung=(960, 600), samples=32, boden=True, sonne_rot=(50, 0, 140)):
    """Cycles-Render nach docs/art/assets-blender/<datei>.jpg mit Hinweis „Asset-Vorschau – kein Spielscreenshot“."""
    sc = bpy.context.scene
    os.makedirs(VORSCHAU, exist_ok=True)
    # Welt: warmes Innenraum-Licht (Stil A), Schattenseite leicht kühl
    wn = sc.world.node_tree
    wn.nodes['Background'].inputs['Color'].default_value = (0.42, 0.40, 0.40, 1)
    wn.nodes['Background'].inputs['Strength'].default_value = 0.55
    sonne = bpy.data.lights.new('Sonne', 'SUN')
    sonne.energy = 3.2
    sonne.color = (1.0, 0.82, 0.62)
    sonne.angle = math.radians(4)
    so = verlinke(bpy.data.objects.new('Sonne', sonne))
    so.rotation_euler = [math.radians(v) for v in sonne_rot]
    if boden:
        me = bpy.data.meshes.new('Boden')
        bm = bmesh.new()
        bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=20)
        bm.to_mesh(me)
        bm.free()
        b = mesh_objekt('Vorschau_Boden', me)
        bm_ = pbr('Vorschau_Boden', '#3B2A1C', 0.75, 0.0, aufbau=lambda nt: {
            'farbe': rampe(nt, knoten(nt, 'ShaderNodeTexWave', Scale=3.0, Distortion=6.0, _wave_type='BANDS',
                                     _bands_direction='X').outputs['Fac'], [(0.0, '#2E2016'), (1.0, '#4A3524')])})
        b.data.materials.append(bm_)
    cam = bpy.data.cameras.new('Kamera')
    cam.lens = linse
    cam.clip_start = 0.005
    co = verlinke(bpy.data.objects.new('Kamera', cam))
    co.location = kamera_pos
    richtung = mathutils.Vector(ziel) - mathutils.Vector(kamera_pos)
    co.rotation_euler = richtung.to_track_quat('-Z', 'Y').to_euler()
    sc.camera = co
    # Beschriftung als Text vor der Kamera
    for i, (txt, gr, y) in enumerate(((titel, 0.034, 0.0), ('Asset-Vorschau – kein Spielscreenshot · Cycles, Ticket 019', 0.024, -0.05))):
        tc = bpy.data.curves.new(f'Text{i}', 'FONT')
        tc.body = txt
        tc.size = gr * 0.02
        to = verlinke(bpy.data.objects.new(f'Text{i}', tc), co)
        breite = 2 * math.tan(cam.angle / 2)
        to.location = tuple(0.02 * v for v in (-breite / 2 * 0.95, breite / 2 * aufloesung[1] / aufloesung[0] * 0.9 + y - 0.035, -1.0))
        tm = bpy.data.materials.new(f'Text{i}')
        _nodes_an(tm)
        nt = tm.node_tree
        for n in list(nt.nodes):
            nt.nodes.remove(n)
        em = nt.nodes.new('ShaderNodeEmission')
        em.inputs['Color'].default_value = (1.0, 0.85, 0.6, 1) if i else (1, 1, 1, 1)
        em.inputs['Strength'].default_value = 1.0
        nt.links.new(em.outputs[0], nt.nodes.new('ShaderNodeOutputMaterial').inputs['Surface'])
        tc.materials.append(tm)
        to.visible_shadow = False
        to.visible_glossy = False
        to.visible_diffuse = False
        to.visible_transmission = False
    sc.render.resolution_x, sc.render.resolution_y = aufloesung
    sc.render.resolution_percentage = 100
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 6
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'None'
    sc.render.image_settings.file_format = 'JPEG'
    sc.render.image_settings.quality = 88
    sc.render.filepath = os.path.join(VORSCHAU, datei + '.jpg')
    bpy.ops.render.render(write_still=True)
    print(f'Vorschau: {sc.render.filepath}')
