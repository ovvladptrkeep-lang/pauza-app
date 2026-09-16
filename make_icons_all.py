# -*- coding: utf-8 -*-
"""
Из icon-master-1024.png делает все нужные размеры в папку icons/.
"""
from PIL import Image
import os

SIZES = {
    "favicon-32.png": 32,
    "icon-48.png":    48,
    "icon-72.png":    72,
    "icon-96.png":    96,
    "icon-144.png":   144,
    "icon-180.png":   180,   # apple-touch-icon
    "icon-192.png":   192,
    "icon-512.png":   512,
}

SRC = "icon-master-1024.png"
OUT_DIR = "icons"

if not os.path.exists(SRC):
    raise SystemExit(f"Нет {SRC}. Сначала запусти make_icon.py")

os.makedirs(OUT_DIR, exist_ok=True)
master = Image.open(SRC).convert("RGBA")

for name, size in SIZES.items():
    resized = master.resize((size, size), Image.LANCZOS)
    path = os.path.join(OUT_DIR, name)
    resized.save(path, "PNG", optimize=True)
    print(f"✓ {path} ({size}×{size})")

print(f"\nГотово. Иконки в ./{OUT_DIR}/")