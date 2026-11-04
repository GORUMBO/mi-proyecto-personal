# ============================================================
# Prepara las fotografías de los modos de cocina (hub visual).
# Entrada: descargas de Wikimedia Commons (tools/pruebas/candidatos)
# Salida: assets/cocina/*.jpg — 4:3, 1200x900, JPEG q82 (locales/offline)
# Recorte: ventana 4:3 centrada en la zona con más detalle (energía
# de bordes) para que la foto quede bien compuesta sin recorte manual.
# Uso: python tools/preparar-fotos-cocina.py
# ============================================================
from PIL import Image, ImageFilter
import numpy as np
import os

SRC = {
    'tm6':     'tools/pruebas/candidatos/tm6.jpg',            # Thermomix TM6 (producto)
    'horno':   'tools/pruebas/candidatos/braeter.jpg',        # asador dentro del horno
    'airfryer':'tools/pruebas/candidatos/airfryer2020.jpg',   # air fryer
    'sarten':  'tools/pruebas/candidatos/steak.jpg',          # bistec dorándose en sartén
}
OUT_DIR = 'assets/cocina'
TARGET = (1200, 900)          # 4:3
QUALITY = 82

def smart_crop_43(im):
    w, h = im.size
    tw, th = TARGET
    ratio = tw / th                      # 4/3
    if w / h > ratio + 0.01:              # más ancho que 4:3 -> recortar a lo ancho
        cw = int(h * ratio)
        g = np.array(im.convert('L').filter(ImageFilter.FIND_EDGES), dtype=float)
        gs = g.reshape(h, -1)            # (h, w) ya es así
        # energía por ventana vertical deslizante de ancho cw
        cum = gs.cumsum(axis=1)
        energy = cum[:, cw:] - cum[:, :-cw]
        col = int(energy.sum(axis=0).argmax())
        return im.crop((col, 0, col + cw, h))
    elif w / h < ratio - 0.01:           # más alto que 4:3 -> recortar a lo alto
        ch = int(w / ratio)
        g = np.array(im.convert('L').filter(ImageFilter.FIND_EDGES), dtype=float)
        # energía por ventana deslizante de alto ch (sobre columnas)
        cum = g.cumsum(axis=0)
        energy = cum[ch:, :] - cum[:-ch, :]
        row = int(energy.sum(axis=1).argmax())
        return im.crop((0, row, w, row + ch))
    return im                             # ya es 4:3: sin recorte

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for nombre, path in SRC.items():
        im = Image.open(path).convert('RGB')
        # trabaja con la descarga de 1280px ya existente (suficiente para 1200x900)
        im = smart_crop_43(im)
        im = im.resize(TARGET, Image.LANCZOS)
        out = os.path.join(OUT_DIR, nombre + '.jpg')
        im.save(out, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
        kb = os.path.getsize(out) / 1024
        print(f'OK {out}  {im.size}  {kb:.0f} KB')

if __name__ == '__main__':
    main()
