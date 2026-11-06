"""Sammelskript (Ticket 019): baut alle Blender-Modelle nacheinander (je eigener Prozess = frische Szene) und setzt sie
mit tools/blender/optimiere.mjs (KTX2 + meshopt) nach public/assets/modelle/ um.

Aufruf (nach `bash tools/blender/setup.sh`):
  .venv-blender/bin/python tools/blender/alle.py                 # Modelle + Vorschauen (Cycles, CPU; ca. 20–25 min)
  .venv-blender/bin/python tools/blender/alle.py --ohne-vorschau # nur Modelle (ca. 8 min)
  .venv-blender/bin/python tools/blender/alle.py saege massband  # Auswahl
Fester Seed (hcl.SEED) für Cycles, Generatoren und UV-Versätze.
"""
import os
import subprocess
import sys
import time

HIER = os.path.dirname(os.path.abspath(__file__))
WURZEL = os.path.abspath(os.path.join(HIER, '..', '..'))
MODELLE = ['saege', 'massband', 'bleistift', 'werkbank']


def main():
    flags = [a for a in sys.argv[1:] if a.startswith('--')]
    wahl = [a for a in sys.argv[1:] if not a.startswith('--')] or MODELLE
    for m in wahl:
        t0 = time.time()
        subprocess.run([sys.executable, os.path.join(HIER, f'{m}.py'), *flags], check=True, cwd=WURZEL)
        print(f'== {m}: {time.time() - t0:.0f} s')
    subprocess.run(['node', os.path.join(HIER, 'optimiere.mjs'), *wahl], check=True, cwd=WURZEL)


if __name__ == '__main__':
    main()
