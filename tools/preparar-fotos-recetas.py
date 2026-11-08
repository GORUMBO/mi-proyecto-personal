# -*- coding: utf-8 -*-
# Prepara las fotos del catálogo de recetas (muestra de 12).
# Entrada: descargas de Wikimedia Commons (tools/.fotos-prev)
# Salida: assets/recetas/<slug>.jpg — 4:3, 1200x900, JPEG q80 progresivo
# Recorte: ventana 4:3 centrada en la zona con más detalle (energía de bordes).
# Uso: python tools/preparar-fotos-recetas.py
from PIL import Image, ImageFilter
import numpy as np
import os

SRC = {
    'chilaquiles': 'tools/.fotos-prev/chilaquiles-1.jpg',
    'huevos-rancheros': 'tools/.fotos-prev/huevos-1.jpg',
    'molletes': 'tools/.fotos-prev/molletes-1.jpg',
    'quesadillas-pollo': 'tools/.fotos-prev/quesadilla-1.jpg',
    'enchiladas': 'tools/.fotos-prev/enchiladas-1.jpg',
    'pozole': 'tools/.fotos-prev/pozole-1.jpg',
    'sopa-fideo': 'tools/.fotos-prev/fideo-1.jpg',
    'guacamole': 'tools/.fotos-prev/guacamole-1.jpg',
    'hotcakes': 'tools/.fotos-prev/hotcakes-2.jpg',
    'agua-jamaica': 'tools/.fotos-prev/jamaica-1.jpg',
    'flan': 'tools/.fotos-prev/flan-1.jpg',
    'elote-esquite': 'tools/.fotos-prev/esquite-1.jpg',
}
OUT_DIR = 'assets/recetas'
TARGET = (1200, 900)          # 4:3
QUALITY = 80

def smart_crop_43(im):
    w, h = im.size
    tw, th = TARGET
    ratio = tw / th
    if w / h > ratio + 0.01:              # más ancho -> recortar a lo ancho
        cw = int(h * ratio)
        g = np.array(im.convert('L').filter(ImageFilter.FIND_EDGES), dtype=float)
        cum = g.cumsum(axis=1)
        energy = cum[:, cw:] - cum[:, :-cw]
        col = int(energy.sum(axis=0).argmax())
        return im.crop((col, 0, col + cw, h))
    elif w / h < ratio - 0.01:            # más alto -> recortar a lo alto
        ch = int(w / ratio)
        g = np.array(im.convert('L').filter(ImageFilter.FIND_EDGES), dtype=float)
        cum = g.cumsum(axis=0)
        energy = cum[ch:, :] - cum[:-ch, :]
        row = int(energy.sum(axis=1).argmax())
        return im.crop((0, row, w, row + ch))
    return im

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for slug, path in SRC.items():
        im = Image.open(path).convert('RGB')
        im = smart_crop_43(im)
        im = im.resize(TARGET, Image.LANCZOS)
        out = os.path.join(OUT_DIR, slug + '.jpg')
        im.save(out, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
        print('OK %s  %d KB' % (out, os.path.getsize(out) // 1024))

if __name__ == '__main__':
    main()
