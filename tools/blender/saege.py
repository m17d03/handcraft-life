"""Fuchsschwanz (Ticket 019): Buchengriff mit weichen Rundungen und Griffloch, drei Messing-Griffschrauben je Seite,
Stahlblatt 595 mm mit geometrischer Zahnung (7 TPI) und Verjüngung (Höhe 118 → 62 mm, Dicke 0,9 → 0,75 mm).

Vertrag (docs/art/assets-phase1.md): Knoten Saege › Blatt, Griff, Zahnlinie_Mitte, Blattspitze; Ursprung = Mitte der
Griffhand; Blatt zeigt nach −Z, Zähne nach −Y (Zahnspitzen y = −55 mm), Blattebene YZ; Materialien Saege_Blatt, Saege_Griff.
Aufruf: .venv-blender/bin/python tools/blender/saege.py [--ohne-vorschau]
"""
import math
import os
import sys

import bpy  # noqa: I001 – bpy muss vor bmesh/mathutils geladen sein
import bmesh
import mathutils

sys.path.insert(0, os.path.dirname(__file__))
import hcl  # noqa: E402

MODELL = 'saege'
A0 = -13.0  # Griffmitte in a
ZAHN_B = -55.0
BLATT_A0 = 50.0
LAENGE = 595.0
H_FERSE = 118.0
H_SPITZE = 62.0
TEILUNG = 3.6
ZAHN_H = 3.1
DICKE_GRIFF = 24.0
RUNDUNG = 6.0

# Griff-Ebene (a, b, Dicke) → Blender: a → +Y (versetzt um −A0), b → +Z, Dicke → X
M_GRIFF = hcl.achsen_matrix((0, 1, 0), (0, 0, 1), (1, 0, 0), (0, -A0 / 1000, 0))


def griff_umriss(f=1):
    """Aussenkontur und Griffloch (a, b in mm), wie der bisherige Griff, Loch etwas grösser (Hand)."""
    s = hcl.Pfad(92, -46)
    s.linie(40, -52, 3 * f)
    s.quad(5, -56, -12, -70, 5 * f)
    s.quad(-28, -80, -34, -64, 5 * f)
    s.kubik(-30, -30, -26, 10, -30, 40, 8 * f)
    s.quad(-34, 62, -22, 72, 5 * f)
    s.quad(-8, 80, 5, 70, 5 * f)
    s.kubik(25, 60, 50, 74, 70, 74, 7 * f)
    s.quad(88, 74, 94, 60, 4 * f)
    s.kubik(100, 30, 96, -10, 98, -30, 7 * f)
    s.quad(99, -44, 92, -46, 3 * f)
    loch = hcl.Pfad(9, -32)
    loch.quad(31, -40, 39, -20, 5 * f)
    loch.kubik(44, 6, 42, 38, 28, 52, 8 * f)
    loch.quad(15, 59, 7, 45, 4 * f)
    loch.kubik(0, 22, 0, -10, 9, -32, 8 * f)
    return s.punkte(), loch.punkte()


def griff_holz(fein=False):
    aussen, loch = griff_umriss(2 if fein else 1)
    ob = hcl.profil_koerper('Griff_Holz' + ('_hp' if fein else ''), aussen, [loch], DICKE_GRIFF, RUNDUNG, 8 if fein else 3, M_GRIFF, rundung_z=5.0)
    return ob


SCHRAUBEN = [(64, 40), (80, 6), (66, -27)]


def schrauben(fein=False):
    """Messing-Griffschrauben (Sägemutter): flacher Teller mit Kuppel und Schlitzring."""
    seg = 32 if fein else 14
    profil = [(6.6, -0.8), (6.6, 0.4), (6.2, 1.0), (5.0, 1.45), (3.2, 1.6), (2.8, 1.35), (2.3, 1.6), (0, 1.75)]
    obs = []
    for a, b in SCHRAUBEN:
        for seite in (1, -1):
            ob = hcl.drehteil(f'Schraube_{a}_{seite}', profil, seg)
            # lokale Z (Achse) → Blender ±X (Dicke)
            rot = mathutils.Matrix.Rotation(seite * math.pi / 2, 4, 'Y')
            ort = mathutils.Matrix.Translation(((seite * DICKE_GRIFF / 2 - seite * 0.15) / 1000, (a - A0) / 1000, b / 1000))
            hcl.transformiere(ob, ort @ rot)
            obs.append(ob)
    return obs


def blatt():
    a0, a1 = BLATT_A0, BLATT_A0 + LAENGE
    rueck = lambda a: ZAHN_B + H_FERSE + (a - a0) / LAENGE * (H_SPITZE - H_FERSE) + 4.0 * math.sin(math.pi * (a - a0) / LAENGE)
    pts = []
    n = int(LAENGE // TEILUNG)
    start = a1 - n * TEILUNG
    pts.append((a0, ZAHN_B + ZAHN_H + 1.5))  # Ferse (im Griff, ohne Zähne)
    pts.append((start, ZAHN_B + ZAHN_H))
    for i in range(n):
        ag = start + i * TEILUNG
        pts.append((ag + 0.62 * TEILUNG, ZAHN_B))  # Zahnspitze, Brust steil zur Spitze
        pts.append((ag + TEILUNG, ZAHN_B + ZAHN_H))
    pts[-1] = (a1, ZAHN_B + ZAHN_H)
    # Spitze: kleine Rundung oben
    pts.append((a1, rueck(a1) - 6))
    pts.append((a1 - 1.5, rueck(a1) - 1.5))
    pts.append((a1 - 6, rueck(a1)))
    for k in range(12, -1, -1):
        a = a0 + (a1 - 6 - a0) * k / 13
        pts.append((a, rueck(a)))
    me = bpy.data.meshes.new('Blatt')
    bm = bmesh.new()
    vs = [bm.verts.new((0, (a - A0) / 1000, b / 1000)) for a, b in pts]
    f = bm.faces.new(vs)
    bmesh.ops.reverse_faces(bm, faces=[f]) if f.normal.x < 0 else None
    bm.normal_update()
    ex = bmesh.ops.extrude_face_region(bm, geom=[f], use_keep_orig=True)
    neu = [v for v in ex['geom'] if isinstance(v, bmesh.types.BMVert)]
    for v in neu:
        v.co.x -= 1.0  # Platzhalter, unten skaliert
    # Dicke mit Verjüngung 0,9 → 0,75 mm, symmetrisch um x = 0
    for v in bm.verts:
        a = v.co.y * 1000 + A0
        t = min(1, max(0, (a - a0) / LAENGE))
        d = (0.9 - 0.15 * t) / 1000
        v.co.x = d / 2 if v.co.x > -0.5 else -d / 2
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.triangulate(bm, faces=bm.faces, quad_method='FIXED', ngon_method='EAR_CLIP')  # deterministisch
    # UV: planar auf YZ; u entlang des Blatts, v über die Höhe
    uv = bm.loops.layers.uv.new('UVMap')
    bmin, bmax = ZAHN_B, ZAHN_B + H_FERSE + 4
    for fc in bm.faces:
        for l in fc.loops:
            a = l.vert.co.y * 1000 + A0
            b = l.vert.co.z * 1000
            l[uv].uv = ((a - a0) / LAENGE, (b - bmin) / (bmax - bmin))
    bm.to_mesh(me)
    bm.free()
    ob = hcl.mesh_objekt('Blatt', me)
    hcl.glaetten(ob, 30)
    return ob


def mat_buche(name='Buche'):
    def aufbau(nt):
        k = hcl.koord(nt)
        mp = hcl.knoten(nt, 'ShaderNodeMapping', Scale=(1.0, 0.18, 1.0))
        nt.links.new(k, mp.inputs['Vector'])
        v = mp.outputs['Vector']
        verz = hcl.knoten(nt, 'ShaderNodeTexNoise', Scale=60.0, Detail=4.0, Roughness=0.55)
        nt.links.new(v, verz.inputs['Vector'])
        welle = hcl.knoten(nt, 'ShaderNodeTexWave', Scale=85.0, Distortion=3.0, Detail=3.0, _wave_type='BANDS', _bands_direction='Z', _wave_profile='SIN')
        nt.links.new(k, welle.inputs['Vector'])
        nt.links.new(verz.outputs['Fac'], welle.inputs['Phase Offset'])
        ringe = hcl.mathe(nt, 'POWER', welle.outputs['Fac'], 3.0)
        # Buchen-Spiegel: kleine dunklere Flecken, gestreckt entlang der Faser
        mp2 = hcl.knoten(nt, 'ShaderNodeMapping', Scale=(1.0, 0.25, 1.0))
        nt.links.new(k, mp2.inputs['Vector'])
        fl = hcl.knoten(nt, 'ShaderNodeTexVoronoi', Scale=900.0, Randomness=1.0)
        nt.links.new(mp2.outputs['Vector'], fl.inputs['Vector'])
        flecken = hcl.mathe(nt, 'LESS_THAN', fl.outputs['Distance'], 0.16)
        ton = hcl.knoten(nt, 'ShaderNodeTexNoise', Scale=25.0, Detail=2.0)
        nt.links.new(k, ton.inputs['Vector'])
        basis = hcl.rampe(nt, ton.outputs['Fac'], [(0.3, '#A86A3C'), (0.7, '#B87A48')])  # Buche geölt, satter
        farbe = hcl.mische(nt, hcl.mathe(nt, 'MULTIPLY', ringe, 0.4), basis, '#83491F')
        farbe = hcl.mische(nt, hcl.mathe(nt, 'MULTIPLY', flecken, 0.35), farbe, '#8E5530')
        rau = hcl.mathe(nt, 'MULTIPLY_ADD', ringe, 0.08, 0.46)
        hoehe = hcl.mathe(nt, 'MULTIPLY', hcl.mathe(nt, 'ADD', ringe, hcl.mathe(nt, 'MULTIPLY', flecken, 0.6)), -1.0)
        return {'farbe': farbe, 'rauheit': rau, 'hoehe': hoehe, 'bump_staerke': 0.25, 'bump_abstand': 0.00015}
    return hcl.pbr(name, '#C8874E', 0.4, 0.0, aufbau)


def mat_messing(name='Messing'):
    def aufbau(nt):
        n = hcl.knoten(nt, 'ShaderNodeTexNoise', Scale=900.0, Detail=3.0)
        nt.links.new(hcl.koord(nt), n.inputs['Vector'])
        farbe = hcl.rampe(nt, n.outputs['Fac'], [(0.35, '#A98234'), (0.65, '#C9A24E')])
        rau = hcl.mathe(nt, 'MULTIPLY_ADD', n.outputs['Fac'], 0.15, 0.22)
        return {'farbe': farbe, 'rauheit': rau}
    return hcl.pbr(name, '#B8913F', 0.3, 1.0, aufbau)


def mat_stahl(name='Stahl'):
    def aufbau(nt):
        k = hcl.koord(nt)
        # gebürstet: Rauschen stark gestreckt entlang der Blattlänge (Blender Y)
        mp = hcl.knoten(nt, 'ShaderNodeMapping', Scale=(1.0, 0.004, 1.0))
        nt.links.new(k, mp.inputs['Vector'])
        bu = hcl.knoten(nt, 'ShaderNodeTexNoise', Scale=1200.0, Detail=2.0)
        nt.links.new(mp.outputs['Vector'], bu.inputs['Vector'])
        fl = hcl.knoten(nt, 'ShaderNodeTexNoise', Scale=12.0, Detail=3.0)
        nt.links.new(k, fl.inputs['Vector'])
        # Zahnbereich (unten): gehärtet, dunkler; geschliffene Zahnflanken hell
        z = hcl.knoten(nt, 'ShaderNodeSeparateXYZ')
        nt.links.new(k, z.inputs[0])
        zahn = hcl.mathe(nt, 'LESS_THAN', z.outputs['Z'], (ZAHN_B + ZAHN_H + 0.6) / 1000)
        streif = hcl.rampe(nt, bu.outputs['Fac'], [(0.3, '#B4BBBF'), (0.7, '#CDD2D4')])
        farbe = hcl.mische(nt, hcl.mathe(nt, 'MULTIPLY', fl.outputs['Fac'], 0.25), streif, '#9EA6AA')
        farbe = hcl.mische(nt, hcl.mathe(nt, 'MULTIPLY', zahn, 0.8), farbe, '#59626B')
        rau = hcl.mathe(nt, 'ADD', hcl.mathe(nt, 'MULTIPLY_ADD', bu.outputs['Fac'], 0.14, 0.24), hcl.mathe(nt, 'MULTIPLY', zahn, 0.12))
        return {'farbe': farbe, 'rauheit': rau}
    return hcl.pbr(name, '#C3C9CC', 0.3, 1.0, aufbau)


def main():
    vorschau = '--ohne-vorschau' not in sys.argv
    hcl.neu()
    buche, messing, stahl = mat_buche(), mat_messing(), mat_stahl()

    holz = griff_holz()
    holz.data.materials.append(buche)
    sch = schrauben()
    for s in sch:
        s.data.materials.append(messing)
    griff = hcl.vereine([holz, *sch], 'Griff')
    hcl.glaetten(griff, 50)
    hcl.uv_smart(griff, 66, 0.01)
    hcl.uv_packen(griff, 0.008)

    holz_hp = griff_holz(fein=True)
    holz_hp.data.materials.append(buche)
    sch_hp = schrauben(fein=True)
    for s in sch_hp:
        s.data.materials.append(messing)
    hp = hcl.vereine([holz_hp, *sch_hp], 'Griff_hp')
    hp.data.shade_smooth()

    bl = blatt()
    bl.data.materials.append(stahl)

    # Backen (hp nur für die Normal-Map sichtbar, sonst würde es AO werfen)
    hp.hide_render = True
    kb = hcl.backe(bl, (2048, 512), ('farbe', 'rauheit', 'metall', 'ao'), ao_abstand_mm=25, ao_samples=48)
    kg = hcl.backe(griff, (1024, 1024), ('farbe', 'rauheit', 'metall', 'ao'), ao_abstand_mm=15, ao_samples=64)
    hp.hide_render = False
    griff.hide_render = False
    kg.update(hcl.backe(griff, (1024, 1024), ('normal',), hochpoly=hp, kaefig_mm=1.5))
    bpy.data.objects.remove(hp)

    karten_blatt = hcl.karten(kb, ao_min=0.35)
    karten_griff = hcl.karten(kg, ao_min=0.2)
    # Texturspeicher-Ziel < 120 MB (QA 019): Blatt 1024×256 (Zähne sind Geometrie), Griff-ORM 512²
    karten_blatt = {k: hcl.halbiere(v) for k, v in karten_blatt.items()}
    karten_griff['orm'] = hcl.halbiere(karten_griff['orm'])
    man = {
        'modell': MODELL,
        'materialien': {
            'Saege_Blatt': {'karten': hcl.speichere_karten(MODELL, 'blatt', karten_blatt)},
            'Saege_Griff': {'karten': hcl.speichere_karten(MODELL, 'griff', karten_griff)},
        },
    }
    # Export-Hierarchie
    wurzel = hcl.leer('Saege')
    hcl.setze_material(bl, hcl.export_material('Saege_Blatt'))
    hcl.setze_material(griff, hcl.export_material('Saege_Griff'))
    bl.parent = wurzel
    griff.parent = wurzel
    mitte = BLATT_A0 + LAENGE / 2
    hcl.leer('Zahnlinie_Mitte', (0, ZAHN_B, -(mitte - A0)), wurzel)
    hcl.leer('Blattspitze', (0, ZAHN_B, -(BLATT_A0 + LAENGE - A0)), wurzel)
    man['dreiecke'] = {'Blatt': hcl.dreiecke(bl), 'Griff': hcl.dreiecke(griff)}
    print('Dreiecke', man['dreiecke'])
    hcl.exportiere(MODELL, wurzel, man)

    if vorschau:
        bl.data.materials[0] = hcl.vorschau_material('Saege_Blatt', karten_blatt)
        griff.data.materials[0] = hcl.vorschau_material('Saege_Griff', karten_griff)
        # Säge auf der Seite liegend, leicht gedreht; Kamera nah am Griff
        wurzel.rotation_euler = (0, math.radians(90), math.radians(-25))
        wurzel.location = (0, 0, 0.0005 + 0.012)
        hcl.vorschau('saege-nah', 'Fuchsschwanz nah · saege.glb', (0.16, -0.12, 0.2), (0.03, 0.06, 0.0), linse=50)
        bpy.data.objects['Kamera'].location = (0.05, -0.42, 0.62)
        z = mathutils.Vector((0.05, 0.25, 0.0)) - bpy.data.objects['Kamera'].location
        bpy.data.objects['Kamera'].rotation_euler = z.to_track_quat('-Z', 'Y').to_euler()
        bpy.data.curves['Text0'].body = 'Fuchsschwanz · saege.glb'
        bpy.context.scene.render.filepath = os.path.join(hcl.VORSCHAU, 'saege.jpg')
        bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    main()
