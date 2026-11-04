"""Massband 5 m / 19 mm (Ticket 019): Gehäuse mit weichen Rundungen (Kunststoff tannengrün), Gummierung auf beiden
Seiten mit Riffelung (Normal-Map aus High-Poly), Gummipuffer um den Bandaustritt, Feststelltaste (Bernstein),
Gürtelclip und Bandführung (Stahl); Band (1 m, über scale.z ausziehbar) und Haken wie bisher.

Vertrag (docs/art/assets-phase1.md): Massband › Gehaeuse, Band, Haken, Bandaustritt; Ursprung = Gehäusemitte;
Band zeigt nach −Z; Band.scale.z = mm/1000 (im Ruhezustand 0); Band-UV u in Kacheln à 100 mm, u = 0 am Hakenende.
Materialien Massband_Gehaeuse (Gehäuse + Haken, ein Atlas), Massband_Band (Skala aus tools/assets/texturen/werkzeug.mjs).
Aufruf: .venv-blender/bin/python tools/blender/massband.py [--ohne-vorschau]
"""
import math
import os
import sys

import bpy  # noqa: I001 – bpy muss vor bmesh/mathutils geladen sein
import bmesh
import mathutils

sys.path.insert(0, os.path.dirname(__file__))
import hcl  # noqa: E402

MODELL = 'massband'
MUND_A, MUND_B = 36.0, -29.5  # Bandaustritt (Unterseite Band, Mitte): glTF (0, −29.5, −36)
DICKE = 38.0
BAND_B = 19.0
BAND_VORNE_V, BAND_RUECK_V = 0.8, 0.9  # wie BAND in tools/assets/texturen/werkzeug.mjs

# (a, b, x) in mm → Blender: a → +Y (glTF −Z), b → +Z, x → X
M_SEITE = hcl.achsen_matrix((0, 1, 0), (0, 0, 1), (1, 0, 0))


def verschoben(ob, a=0.0, b=0.0, x=0.0):
    hcl.transformiere(ob, mathutils.Matrix.Translation((x / 1000, a / 1000, b / 1000)))
    return ob


def gehaeuse_umriss():
    """Seitenansicht (a nach vorn, b oben): 69 × 69 mm, grosse Radien, vorne unten knapp (Bandaustritt)."""
    w = h = 69.0
    x0, x1, y0, y1 = -w / 2, w / 2, -h / 2, h / 2
    r, rv = 17.0, 4.0
    p = hcl.Pfad(x0 + r, y0)
    p.linie(x1 - rv, y0).quad(x1, y0, x1, y0 + rv, 3)
    p.linie(x1, y1 - r, 2).quad(x1, y1, x1 - r, y1, 7)
    p.linie(x0 + r, y1, 2).quad(x0, y1, x0, y1 - r, 7)
    p.linie(x0, y0 + r, 2).quad(x0, y0, x0 + r, y0, 7)
    return p.punkte()


def teile(fein=False):
    s = 2 if fein else 1
    out = []
    # Schale: Dicke 38 mm, Rundung 7 mm (seitlich weich), Silhouette 69 × 69
    schale = hcl.profil_koerper('Schale', gehaeuse_umriss(), (), DICKE, 7.0, 8 if fein else 3, M_SEITE, rundung_z=6.0)
    out.append((schale, 'kunststoff'))
    # Gummierung beidseitig: runde Griffmulde Ø 50, 2,2 mm dick, sitzt 1,2 mm erhaben auf der Seitenfläche
    for seite in (1, -1):
        g = hcl.profil_koerper(f'Gummi_{seite}', hcl.kreis(24.0, 28 * s), (), 2.4, 1.1, 4 if fein else 2, M_SEITE)
        verschoben(g, -3.0, 3.0, seite * (DICKE / 2 + 0.0))
        out.append((g, 'gummi'))
        # Mittelschraube (Stahl)
        sc = hcl.drehteil(f'Schraube_{seite}', [(4.2, -0.6), (4.2, 0.5), (3.4, 1.2), (0, 1.4)], 16 * s)
        hcl.transformiere(sc, mathutils.Matrix.Translation((seite * (DICKE / 2 + 1.0) / 1000, -0.003, 0.003)) @ mathutils.Matrix.Rotation(seite * math.pi / 2, 4, 'Y'))
        out.append((sc, 'stahl'))
    # Gummipuffer vorne um den Bandaustritt (umläuft die Unterkante vorn)
    puffer = hcl.profil_koerper('Puffer', hcl.gerundetes_rechteck(10.0, 16.0, 3.5, 3 * s), (), DICKE + 1.6, 2.0, 4 if fein else 2, M_SEITE)
    verschoben(puffer, 31.0, -16.0, 0)
    out.append((puffer, 'gummi'))
    # Bandführung (Stahl) unter dem Austritt
    fu = hcl.quader('Fuehrung', 26.0, 2.4, 6.0, (0, MUND_B - 1.6, -(MUND_A - 1.0)), fase=0.6)
    out.append((fu, 'stahl'))
    # Feststelltaste (Bernstein) oben vorne, in einer Mulde
    taste = hcl.profil_koerper('Taste', hcl.gerundetes_rechteck(16.0, 7.0, 3.0, 3 * s), (), 13.0, 1.6, 4 if fein else 2, M_SEITE)
    verschoben(taste, 16.0, 34.0, 0)
    out.append((taste, 'taste'))
    # Gürtelclip (Stahl) auf −x: flache Feder, oben umgebogen
    clip = hcl.quader('Clip', 1.4, 44.0, 14.0, (-(DICKE / 2 + 2.6), 2.0, 12.0), fase=0.5)
    out.append((clip, 'stahl'))
    kopf = hcl.quader('Clipkopf', 4.6, 6.0, 14.0, (-(DICKE / 2 + 0.9), 24.0, 12.0), fase=0.8, segmente=2)
    out.append((kopf, 'stahl'))
    return out


def haken_teile(fein=False):
    """Haken am Bandende: Ursprung = Bandende (Unterkante Band, Mitte); Lasche zeigt nach +Z ins Band."""
    out = []
    out.append((hcl.quader('Lasche', 20.0, 0.8, 14.0, (0, 2.0, 7.0), fase=0.25), 'stahl'))
    out.append((hcl.quader('Lippe', 22.0, 11.0, 1.0, (0, -3.2, -0.5), fase=0.3), 'stahl'))
    for x in (-5, 5):
        n = hcl.drehteil(f'Niet_{x}', [(1.6, -0.2), (1.6, 0.3), (1.1, 0.7), (0, 0.8)], 16 if fein else 8)
        hcl.transformiere(n, mathutils.Matrix.Translation(hcl.G(x, 2.3, 9.0)))
        out.append((n, 'stahl'))
    return out


def band():
    """1 m Band von z = 0 (Austritt) bis z = −1 m, 19 mm breit, gewölbt; UV wie tools/assets/modelle/massband.mjs."""
    B = BAND_B
    segs = 6
    dicke = 0.13
    wolb = lambda x: 1.6 * (x / (B / 2)) ** 2
    v_vorne = lambda x: BAND_VORNE_V * ((B / 2 - x) / B)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')

    def quad(pts, uvs, soll):
        vs = [bm.verts.new(hcl.G(*p)) for p in pts]
        f = bm.faces.new(vs)
        f.normal_update()
        if f.normal.dot(soll) < 0:
            f.normal_flip()
        zu_uv = dict(zip(vs, uvs))
        for l in f.loops:
            u, v = zu_uv[l.vert]
            l[uvl].uv = (u, 1 - v)  # glTF-v = 1 − Blender-v
    oben = mathutils.Vector((0, 0, 1))
    for i in range(segs):
        xa = -B / 2 + B * i / segs
        xb = -B / 2 + B * (i + 1) / segs
        quad([(xa, wolb(xa), 0), (xb, wolb(xb), 0), (xb, wolb(xb), -1000), (xa, wolb(xa), -1000)],
             [(10, v_vorne(xa)), (10, v_vorne(xb)), (0, v_vorne(xb)), (0, v_vorne(xa))], oben)
        quad([(xa, wolb(xa) - dicke, 0), (xb, wolb(xb) - dicke, 0), (xb, wolb(xb) - dicke, -1000), (xa, wolb(xa) - dicke, -1000)],
             [(10, BAND_RUECK_V), (10, BAND_RUECK_V + 0.02), (0, BAND_RUECK_V + 0.02), (0, BAND_RUECK_V)], -oben)
    for x in (-B / 2, B / 2):
        y = wolb(x)
        quad([(x, y, 0), (x, y - dicke, 0), (x, y - dicke, -1000), (x, y, -1000)], [(10, 0.82)] * 4, mathutils.Vector((1 if x > 0 else -1, 0, 0)))
    me = bpy.data.meshes.new('Band')
    bm.to_mesh(me)
    bm.free()
    ob = hcl.mesh_objekt('Band', me)
    hcl.glaetten(ob, 30)
    return ob


def mat_kunststoff():
    def aufbau(nt):
        n = hcl.knoten(nt, 'ShaderNodeTexNoise', Scale=2500.0, Detail=2.0)
        nt.links.new(hcl.koord(nt), n.inputs['Vector'])
        n2 = hcl.knoten(nt, 'ShaderNodeTexNoise', Scale=60.0, Detail=3.0)
        nt.links.new(hcl.koord(nt), n2.inputs['Vector'])
        farbe = hcl.rampe(nt, n2.outputs['Fac'], [(0.35, '#2B5243'), (0.65, '#33604F')])
        return {'farbe': farbe, 'rauheit': hcl.mathe(nt, 'MULTIPLY_ADD', n.outputs['Fac'], 0.12, 0.34),
                'hoehe': n.outputs['Fac'], 'bump_staerke': 0.08, 'bump_abstand': 0.0001}
    return hcl.pbr('Kunststoff', '#2F5A4A', 0.4, 0.0, aufbau)


def mat_gummi():
    def aufbau(nt):
        k = hcl.koord(nt)
        # Riffelung: feine Rillen quer zur Griffrichtung (Wellen entlang Blender-Z) + Körnung
        wl = hcl.knoten(nt, 'ShaderNodeTexWave', Scale=180.0, Distortion=0.0, _wave_type='BANDS', _bands_direction='Z', _wave_profile='SIN')
        nt.links.new(k, wl.inputs['Vector'])
        kn = hcl.knoten(nt, 'ShaderNodeTexNoise', Scale=3000.0, Detail=1.0)
        nt.links.new(k, kn.inputs['Vector'])
        hoehe = hcl.mathe(nt, 'ADD', hcl.mathe(nt, 'POWER', wl.outputs['Fac'], 2.0), hcl.mathe(nt, 'MULTIPLY', kn.outputs['Fac'], 0.3))
        farbe = hcl.rampe(nt, kn.outputs['Fac'], [(0.3, '#1A1B19'), (0.7, '#242522')])
        return {'farbe': farbe, 'rauheit': hcl.mathe(nt, 'MULTIPLY_ADD', kn.outputs['Fac'], 0.08, 0.8),
                'hoehe': hoehe, 'bump_staerke': 0.6, 'bump_abstand': 0.0004}
    return hcl.pbr('Gummi', '#1E1F1D', 0.85, 0.0, aufbau)


def mat_stahl():
    def aufbau(nt):
        n = hcl.knoten(nt, 'ShaderNodeTexNoise', Scale=4000.0, Detail=2.0)
        nt.links.new(hcl.koord(nt), n.inputs['Vector'])
        return {'farbe': hcl.rampe(nt, n.outputs['Fac'], [(0.35, '#AEB5B9'), (0.65, '#BEC4C7')]),
                'rauheit': hcl.mathe(nt, 'MULTIPLY_ADD', n.outputs['Fac'], 0.08, 0.26)}
    return hcl.pbr('Stahl', '#A7AEB2', 0.35, 1.0, aufbau)


def mat_taste():
    return hcl.pbr('Taste', '#D9A35B', 0.38, 0.0)


def baue(fein, mats):
    tg = teile(fein)
    for ob, m in tg:
        ob.data.materials.append(mats[m])
    ht = haken_teile(fein)
    for ob, m in ht:
        ob.data.materials.append(mats[m])
    g = hcl.vereine([o for o, _ in tg], 'Gehaeuse' + ('_hp' if fein else ''))
    h = hcl.vereine([o for o, _ in ht], 'Haken' + ('_hp' if fein else ''))
    return g, h


def main():
    vorschau = '--ohne-vorschau' not in sys.argv
    hcl.neu()
    mats = {'kunststoff': mat_kunststoff(), 'gummi': mat_gummi(), 'stahl': mat_stahl(), 'taste': mat_taste()}
    geh, hak = baue(False, mats)
    mund = hcl.G(0, MUND_B, -MUND_A)
    # Haken-Geometrie liegt relativ zum Bandende; für das Backen an den Austritt (Ruhelage) schieben
    hak.location = mund
    hcl.glaetten(geh, 40)
    hcl.glaetten(hak, 40)
    hcl.uv_smart([geh, hak], 60, 0.006)
    hcl.uv_packen([geh, hak], 0.006)
    ghp, hhp = baue(True, mats)
    hhp.location = mund
    for o in (ghp, hhp):
        o.data.shade_smooth()
    hp = hcl.vereine([ghp, hhp], 'Massband_hp')
    hak.matrix_world = mathutils.Matrix.Translation(mund)  # vereine() hat hhp eingebacken; Haken bleibt Objekt mit Ort
    hp.hide_render = True
    k = hcl.backe([geh, hak], (1024, 1024), ('farbe', 'rauheit', 'metall', 'ao'), ao_abstand_mm=10, ao_samples=64)
    hp.hide_render = False
    k.update(hcl.backe([geh, hak], (1024, 1024), ('normal',), hochpoly=hp, kaefig_mm=1.2))
    bpy.data.objects.remove(hp)
    karten = hcl.karten(k, ao_min=0.25)

    bd = band()
    wurzel = hcl.leer('Massband')
    m_geh = hcl.export_material('Massband_Gehaeuse')
    m_band = hcl.export_material('Massband_Band', 1.0, 0.0)
    hcl.setze_material(geh, m_geh)
    hcl.setze_material(hak, m_geh)
    hcl.setze_material(bd, m_band)
    geh.parent = wurzel
    hak.parent = wurzel
    hak.location = mund
    bd.parent = wurzel
    bd.location = mund
    hcl.leer('Bandaustritt', (0, MUND_B, -MUND_A), wurzel)
    man = {
        'modell': MODELL,
        'materialien': {
            'Massband_Gehaeuse': {'karten': hcl.speichere_karten(MODELL, 'gehaeuse', karten)},
            'Massband_Band': {'generator': 'bandSkala', 'kachelU': True, 'metall': 0},
        },
        'knoten': {'Band': {'scale': [1, 1, 0]}},
        'dreiecke': {'Gehaeuse': hcl.dreiecke(geh), 'Band': hcl.dreiecke(bd), 'Haken': hcl.dreiecke(hak)},
    }
    print('Dreiecke', man['dreiecke'])
    hcl.exportiere(MODELL, wurzel, man)

    if vorschau:
        geh.data.materials[0] = hcl.vorschau_material('Massband_Gehaeuse', karten)
        hak.data.materials[0] = geh.data.materials[0]
        # Band 240 mm ausgezogen, Skala mit einfacher Ersatzfarbe (die echte Skala entsteht in optimiere.mjs)
        bd.scale = (1, 0.24, 1)  # Blender-Y = glTF −Z
        hak.location = hcl.G(0, MUND_B, -MUND_A - 240)
        bd.data.materials[0] = hcl.pbr('V_Band', '#E8C23F', 0.45, 0.0)
        wurzel.location = (0, 0, 0.0345)
        wurzel.rotation_euler = (0, 0, math.radians(-120))
        hcl.vorschau('massband', 'Massband, 240 mm ausgezogen · massband.glb', (0.2, 0.15, 0.15), (-0.04, -0.05, 0.022), linse=45)


if __name__ == '__main__':
    main()
