"""Werkbank / Hobelbank (Ticket 019): Eichenplatte 1500 × 600 × 60 mm mit Fasen und einer Reihe Bankhaken-Löcher
(20 × 20 mm), Gestell aus Kufen, Beinen, Kopfriegeln, Längszargen und Ablage, Vorderzange links vorn mit Backe,
Holzspindel, Spindelkopf, Knebel und zwei Führungsstangen.

Farbe/Normal/Rauheit kacheln (Eichen-Generator aus tools/assets, TEXCOORD_0, 500 mm je Kachel); die in Cycles
gebackene Ambient Occlusion liegt auf einer eigenen UV (TEXCOORD_1) in einer 1024²-Karte (kachelnde Karten können
keine ortsfeste AO tragen).

Vertrag (docs/art/assets-phase1.md): Werkbank › Platte, Gestell, Vorderzange, Arbeitsflaeche; Ursprung = Boden unter
Plattenmitte, Vorderseite +Z, Plattenoberkante y = 0,9 m; Vorderzange-Knoten an der Plattenvorderkante (−520, 790, 300),
öffnet entlang +Z. Materialien Werkbank_Platte, Werkbank_Gestell.
Aufruf: .venv-blender/bin/python tools/blender/werkbank.py [--ohne-vorschau]
"""
import math
import os
import random
import subprocess
import sys

import bpy  # noqa: I001 – bpy muss vor bmesh/mathutils geladen sein
import bmesh
import mathutils
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import hcl  # noqa: E402

MODELL = 'werkbank'
KACHEL = 0.5  # m je Texturkachel
VZ = (-520.0, 790.0, 300.0)  # Knoten Vorderzange (glTF, mm)
rnd = random.Random(hcl.SEED)


def box_uv(ob, faser=None):
    """Box-Projektion in Metern (Kachel 0,5 m); Faser entlang der längsten Kante (Blender-Achse), Versatz je Teil."""
    me = ob.data
    if 'UVMap' not in me.uv_layers:
        me.uv_layers.new(name='UVMap')
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv['UVMap']
    if faser is None:
        lo = [min(v.co[i] for v in bm.verts) for i in range(3)]
        hi = [max(v.co[i] for v in bm.verts) for i in range(3)]
        d = [hi[i] - lo[i] for i in range(3)]
        faser = d.index(max(d))
    ver = (rnd.random() * 7, rnd.random() * 7)
    for f in bm.faces:
        n = f.normal
        ach = max(range(3), key=lambda i: abs(n[i]))
        andere = [i for i in range(3) if i != ach]
        laengs = faser if faser in andere else andere[0]
        quer = [i for i in andere if i != laengs][0]
        for l in f.loops:
            l[uv].uv = (l.vert.co[laengs] / KACHEL + ver[0], l.vert.co[quer] / KACHEL + ver[1])
    bm.to_mesh(me)
    bm.free()


def brett(name, bx, by, bz, mitte, fase=3.0, seg=1):
    ob = hcl.quader(name, bx, by, bz, mitte, fase=fase, segmente=seg)
    box_uv(ob)
    return ob


def rund(name, profil, achse_mm_von, segmente=16, ort=(0, 0, 0)):
    """Drehteil entlang glTF-Achse 'x' oder 'z' (profil (r, t) in mm, t entlang der Achse), Mitte bei ort (glTF mm)."""
    ob = hcl.drehteil(name, profil, segmente)
    if achse_mm_von == 'z':  # Blender-Z → glTF +Z = Blender −Y
        rot = mathutils.Matrix.Rotation(math.pi / 2, 4, 'X')
    else:  # Blender-Z → Blender X
        rot = mathutils.Matrix.Rotation(math.pi / 2, 4, 'Y')
    hcl.transformiere(ob, mathutils.Matrix.Translation(hcl.G(*ort)) @ rot)
    hcl.glaetten(ob, 50)
    box_uv(ob, faser=0 if achse_mm_von == 'x' else 1)
    return ob


def platte():
    ob = hcl.quader('Platte', 1500, 60, 600, (0, 870, 0), fase=0.0)
    ob = hcl.fasen(ob, 4.0, 2, 50)
    # Bankhaken-Löcher: vordere Reihe, 20 × 20 mm, Abstand 150 mm, 50 mm hinter der Vorderkante
    schneider = []
    for i in range(8):
        x = -600 + i * 150
        c = hcl.quader(f'Loch{i}', 20, 80, 20, (x, 870, 250), fase=0.0)
        schneider.append(c)
    vereint = hcl.vereine(schneider, 'Loecher')
    m = ob.modifiers.new('Loecher', 'BOOLEAN')
    m.operation = 'DIFFERENCE'
    m.solver = 'EXACT'
    m.object = vereint
    ob = hcl.anwenden(ob)
    bpy.data.objects.remove(vereint)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(1), verts=bm.verts, edges=bm.edges)
    bm.to_mesh(ob.data)
    bm.free()
    box_uv(ob, faser=0)
    hcl.glaetten(ob, 35)
    return ob


def gestell():
    g = []
    for x in (-630, 630):
        g.append(brett(f'Kufe{x}', 90, 80, 660, (x, 40, 0), 4))
        g.append(brett(f'Kopfriegel{x}', 110, 70, 560, (x, 805, 0), 3))
        for z in (-215, 215):
            g.append(brett(f'Bein{x}{z}', 80, 760, 80, (x, 460, z), 3))
    for z in (-215, 215):
        g.append(brett(f'Zarge{z}', 1180, 110, 40, (0, 260, z), 3))
    # Ablage: fünf Bretter auf den Zargen
    for i in range(5):
        z = -170 + i * 85
        g.append(brett(f'Ablage{i}', 1180, 18, 78, (0, 324, z), 2))
    # Keile der durchgezapften Zargen (aussen an den Beinen)
    for x in (-690, 690):
        for z in (-215, 215):
            g.append(brett(f'Keil{x}{z}', 30, 70, 14, (x, 260, z), 2))
    ob = hcl.vereine(g, 'Gestell')
    hcl.glaetten(ob, 35)
    return ob


def vorderzange():
    """Teile relativ zum Knoten VZ (glTF mm). Rückgabe (backe, spindelteile)."""
    backe = brett('Backe', 450, 220, 55, (0, 0, 30), 4, 2)
    hcl.glaetten(backe, 35)
    sp = []
    # Spindel (Holzgewinde, im Kern Ø 40) von der Backe nach hinten unter die Platte
    sp.append(rund('Spindel', [(20, -360), (20, 60)], 'z', 14, (0, -30, 0)))
    # Spindelkopf: gedrechselt, mit Wulst
    sp.append(rund('Kopf', [(0, 57), (34, 57), (36, 62), (36, 82), (30, 92), (24, 100), (0, 100)], 'z', 20, (0, -30, 0)))
    # Knebel quer durch den Kopf, mit Anschlagknöpfen
    sp.append(rund('Knebel', [(0, -165), (11, -165), (11, 165), (0, 165)], 'x', 10, (0, -30, 82)))
    for s in (-1, 1):
        sp.append(rund(f'Knopf{s}', [(0, -8), (12, -8), (16, -3), (16, 3), (12, 8), (0, 8)], 'x', 12, (s * 172, -30, 82)))
    # Führungsstangen unter der Platte
    for x in (-180, 180):
        sp.append(brett(f'Fuehrung{x}', 30, 30, 360, (x, -60, -178), 2))
    return backe, sp


def mat_backen(name, farbe):
    return hcl.pbr(name, farbe, 0.6, 0.0)


def main():
    vorschau = '--ohne-vorschau' not in sys.argv
    hcl.neu()
    b_platte = mat_backen('B_Platte', '#C58F55')
    b_gestell = mat_backen('B_Gestell', '#8E5D33')
    pl = platte()
    pl.data.materials.append(b_platte)
    ge = gestell()
    ge.data.materials.append(b_gestell)
    backe, sp = vorderzange()
    backe.data.materials.append(b_platte)
    for o in sp:
        o.data.materials.append(b_gestell)
    vz = hcl.vereine([backe, *sp], 'Vorderzange')
    hcl.glaetten(vz, 40)
    vz.location = hcl.G(*VZ)
    obs = [pl, ge, vz]
    print('Dreiecke', {o.name: hcl.dreiecke(o) for o in obs})
    # AO-UV (TEXCOORD_1) und Bake; Boden für Kontakt-AO
    hcl.uv_smart(obs, 60, 0.004, name='AO')
    hcl.uv_packen(obs, 0.004)
    boden = hcl.quader('AO_Boden', 4000, 10, 4000, (0, -5, 0))
    k = hcl.backe(obs, (1024, 1024), ('ao',), ao_abstand_mm=250, ao_samples=64, uv='AO')
    bpy.data.objects.remove(boden)
    ao = k['ao'][..., 0]
    ao = 0.3 + 0.7 * np.clip(ao, 0, 1)
    a8 = np.ones(ao.shape + (4,), np.float32)
    a8[..., 0] = a8[..., 1] = a8[..., 2] = ao
    karte_ao = {'ao': hcl.u8(a8)}
    eintrag = hcl.speichere_karten(MODELL, 'werkbank', karte_ao)
    for o in obs:
        o.data.uv_layers.active = o.data.uv_layers['UVMap']
        o.data.uv_layers['UVMap'].active_render = True

    wurzel = hcl.leer('Werkbank')
    m_pl = hcl.export_material('Werkbank_Platte', 1.0, 0.0)
    m_ge = hcl.export_material('Werkbank_Gestell', 1.0, 0.0)
    for o in obs:
        for i, s in enumerate(o.material_slots):
            o.data.materials[i] = m_pl if s.material is b_platte else m_ge
        o.parent = wurzel
    hcl.leer('Arbeitsflaeche', (0, 900, 0), wurzel)
    gemeinsam = {'generator': 'eiche', 'texturName': 'Eiche', 'kachel': True, 'metall': 0, 'karten': eintrag}
    man = {
        'modell': MODELL,
        'materialien': {
            'Werkbank_Platte': dict(gemeinsam),
            'Werkbank_Gestell': dict(gemeinsam, faktor=[0.62, 0.5, 0.42, 1]),
        },
        'dreiecke': {o.name: hcl.dreiecke(o) for o in obs},
    }
    hcl.exportiere(MODELL, wurzel, man)

    if vorschau:
        subprocess.run(['node', os.path.join(hcl.WURZEL, 'tools', 'blender', 'eiche-roh.mjs')], check=True)
        roh = {}
        for art in ('farbe', 'orm', 'normal'):
            a = np.fromfile(os.path.join(hcl.BUILD, MODELL, f'eiche_{art}.rgba'), np.uint8).reshape(1024, 1024, 4)
            roh[art] = a
        roh['ao'] = karte_ao['ao']
        v_pl = hcl.vorschau_material('Werkbank_Platte', roh, wrap_kachel=True, ao_extra='ao')
        v_ge = hcl.vorschau_material('Werkbank_Gestell', roh, wrap_kachel=True, faktor=(0.62, 0.5, 0.42, 1), ao_extra='ao')
        for o in obs:
            for i, s in enumerate(o.material_slots):
                o.data.materials[i] = v_pl if s.material is m_pl else v_ge
        hcl.vorschau('werkbank', 'Werkbank mit Vorderzange und Bankhaken-Löchern · werkbank.glb', (1.25, -1.9, 1.55), (-0.1, 0.0, 0.62), linse=35,
                     sonne_rot=(55, 0, 200))


if __name__ == '__main__':
    main()
