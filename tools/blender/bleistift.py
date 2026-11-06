"""Sechskant-Bleistift 175 mm (Ticket 019): Schlüsselweite 7 mm, Kanten gefast, gespitzt durch Schnitt mit einem
Kegel (die gewellte Lackkante entsteht wie beim echten Spitzer), Graphitmine Ø 2 mm, getauchte Endkappe.

Vertrag (docs/art/assets-phase1.md): Bleistift › Koerper, Minenspitze; Ursprung = Griffpunkt 35 mm hinter der Spitze,
Spitze nach −Z; Material Bleistift (ein Atlas).
Aufruf: .venv-blender/bin/python tools/blender/bleistift.py [--ohne-vorschau]
"""
import math
import os
import sys

import bpy  # noqa: I001 – bpy muss vor bmesh/mathutils geladen sein
import bmesh
import mathutils

sys.path.insert(0, os.path.dirname(__file__))
import hcl  # noqa: E402

MODELL = 'bleistift'
LAENGE = 175.0
GRIFF = 35.0
SW = 7.0
FASE = 0.45
KEGEL = 20.0
MINE_R = 1.0
KAPPE = 3.0

# lokale Achse t (Abstand hinter der Spitze, Blender-Z) → glTF z = t − 35 → Blender Y = 35 − t
M = mathutils.Matrix.Translation((0, GRIFF / 1000, 0)) @ mathutils.Matrix.Rotation(math.pi / 2, 4, 'X')


def querschnitt():
    apo = SW / 2
    pts = []
    for f in range(6):
        w = f * math.pi / 3
        n = (math.cos(w), math.sin(w))
        t = (-math.sin(w), math.cos(w))
        halb = apo * math.tan(math.pi / 6) - FASE
        for s in (-halb, halb):
            pts.append((n[0] * apo + t[0] * s, n[1] * apo + t[1] * s))
    return pts


def prisma():
    q = querschnitt()
    r_max = max(math.hypot(*p) for p in q)
    bm = bmesh.new()
    ringe = []
    for t, s in ((-1.0, 1.0), (LAENGE - KAPPE, 1.0), (LAENGE - 0.35, 1.0), (LAENGE, (r_max - 0.35) / r_max)):
        ringe.append([bm.verts.new((x * s / 1000, y * s / 1000, t / 1000)) for x, y in q])
    n = len(q)
    for a, b in zip(ringe, ringe[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(list(reversed(ringe[0])))
    bm.faces.new(ringe[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('Koerper')
    bm.to_mesh(me)
    bm.free()
    return hcl.mesh_objekt('Koerper', me), r_max


def v_von_t(t):
    """Längs-Koordinate → V: Spitze (0–25 mm) bekommt 60 % der Textur, Schaft 33 %, Kappe 7 %."""
    if t <= 25:
        return 0.6 * t / 25
    if t <= LAENGE - KAPPE:
        return 0.6 + 0.33 * (t - 25) / (LAENGE - KAPPE - 25)
    return 0.93 + 0.07 * (t - (LAENGE - KAPPE)) / KAPPE


def zylinder_uv(ob):
    """Zylindrische UV (u = Winkel, v = v_von_t); Naht-Flächen werden über u = 1 hinaus fortgesetzt und alles auf
    [0, 1) gestaucht, damit sich nichts überlappt (Voraussetzung für die AO)."""
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.new('UVMap')
    winkel = lambda co: (math.atan2(co.y, co.x) / (2 * math.pi)) % 1.0
    for f in bm.faces:
        us = []
        for l in f.loops:
            r = math.hypot(l.vert.co.x, l.vert.co.y)
            us.append(None if r < 1e-7 else winkel(l.vert.co))
        bekannt = [u for u in us if u is not None]
        if bekannt and max(bekannt) - min(bekannt) > 0.5:
            us = [None if u is None else (u + 1 if u < 0.5 else u) for u in us]
        mittel = sum(u for u in us if u is not None) / max(1, len([u for u in us if u is not None]))
        for l, u in zip(f.loops, us):
            u = mittel if u is None else u
            l[uv].uv = (u / 1.1, v_von_t(l.vert.co.z * 1000))
    bm.to_mesh(me)
    bm.free()


def main():
    vorschau = '--ohne-vorschau' not in sys.argv
    hcl.neu()
    ob, r_max = prisma()
    d_mine = MINE_R / r_max * KEGEL
    kegel = hcl.drehteil('Kegel', [(0, 0), (MINE_R, d_mine), (r_max, KEGEL), (r_max + 2, KEGEL + 2 * KEGEL / r_max), (r_max + 2, LAENGE + 5), (0, LAENGE + 5)], 24)
    m = ob.modifiers.new('Spitzen', 'BOOLEAN')
    m.operation = 'INTERSECT'
    m.solver = 'EXACT'
    m.object = kegel
    ob = hcl.anwenden(ob)
    bpy.data.objects.remove(kegel)

    mats = {
        'lack': hcl.pbr('Lack', '#2F5A4A', 0.28, 0.0),
        'holz': hcl.pbr('Zeder', '#D9A877', 0.78, 0.0, aufbau=lambda nt: _zeder(nt)),
        'mine': hcl.pbr('Graphit', '#3A3A3E', 0.42, 0.3),
        'kappe': hcl.pbr('Kappe', '#ECE2CC', 0.3, 0.0),
    }
    ob.data.name = 'Koerper'
    ob.data.materials.clear()  # Boolean-Ergebnis bringt einen leeren Slot mit
    for k in ('lack', 'holz', 'mine', 'kappe'):
        ob.data.materials.append(mats[k])
    for p in ob.data.polygons:
        t = p.center.z * 1000
        if t > LAENGE - KAPPE:
            p.material_index = 3  # getauchte Kappe
        elif p.normal.z < -0.05:  # Kegelfläche (zeigt zur Spitze)
            p.material_index = 2 if t < d_mine + 0.01 else 1
        else:
            p.material_index = 0  # Lack
    zylinder_uv(ob)
    hcl.transformiere(ob, M)
    hcl.glaetten(ob, 25)
    k = hcl.backe(ob, (512, 512), ('farbe', 'rauheit', 'metall', 'ao'), ao_abstand_mm=4, ao_samples=48)
    karten = hcl.karten(k, ao_min=0.4)
    wurzel = hcl.leer('Bleistift')
    hcl.setze_material(ob, hcl.export_material('Bleistift'))
    ob.parent = wurzel
    hcl.leer('Minenspitze', (0, 0, -GRIFF), wurzel)
    man = {
        'modell': MODELL,
        'materialien': {'Bleistift': {'karten': hcl.speichere_karten(MODELL, 'bleistift', karten)}},
        'dreiecke': {'Koerper': hcl.dreiecke(ob)},
    }
    print('Dreiecke', man['dreiecke'])
    hcl.exportiere(MODELL, wurzel, man)
    if vorschau:
        ob.data.materials[0] = hcl.vorschau_material('Bleistift', karten)
        wurzel.location = (0, 0, 0.0038)
        wurzel.rotation_euler = (0, 0, math.radians(-30))
        hcl.vorschau('bleistift', 'Bleistift, gespitzt · bleistift.glb', (0.06, -0.1, 0.06), (0.0, 0.035, 0.0), linse=60)


def _zeder(nt):
    k = hcl.koord(nt)
    mp = hcl.knoten(nt, 'ShaderNodeMapping', Scale=(1.0, 0.05, 1.0))
    nt.links.new(k, mp.inputs['Vector'])
    n = hcl.knoten(nt, 'ShaderNodeTexNoise', Scale=900.0, Detail=3.0)
    nt.links.new(mp.outputs['Vector'], n.inputs['Vector'])
    return {'farbe': hcl.rampe(nt, n.outputs['Fac'], [(0.35, '#CF9C6A'), (0.65, '#E0B386')])}


if __name__ == '__main__':
    main()
