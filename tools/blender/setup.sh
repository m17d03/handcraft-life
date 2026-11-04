#!/usr/bin/env bash
# Installiert Blender als Python-Modul (bpy) in .venv-blender – ohne Bildschirm, für Asset-Skripte (ADR 0005).
# Aufruf: bash tools/blender/setup.sh   → danach: .venv-blender/bin/python tools/blender/<skript>.py
set -euo pipefail
cd "$(dirname "$0")/../.."
PY=python3.13
command -v "$PY" >/dev/null || PY=python3.11
"$PY" -m venv .venv-blender
.venv-blender/bin/pip install -q --upgrade pip
.venv-blender/bin/pip install -q "bpy==5.2.3"
.venv-blender/bin/python -c "import bpy; print('Blender', bpy.app.version_string, 'bereit')"
