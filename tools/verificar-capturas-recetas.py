# -*- coding: utf-8 -*-
# Verificador de capturas del catálogo de recetas (V3): busca cada foto de
# assets/recetas DENTRO de la captura con correlación cruzada normalizada
# (FFT, vectorizada) sobre la captura reducida — rápido e inmune a la
# posición/scroll exactos. Verifica la VERDAD de la imagen.
# Uso: python tools/verificar-capturas-recetas.py
import os, sys, io, json
import numpy as np
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRUEBAS = os.path.join(ROOT, 'tools', 'pruebas')
RECETAS = os.path.join(ROOT, 'assets', 'recetas')
CAPTURAS = {
    'escritorio': 'recetas-fotos-escritorio.png',
    'movil': 'recetas-fotos-movil.png',
}
UMBRAL = 0.20  # ρ real (media por canal); las fotos pequeñas/bajo overlay dan menos

pasadas, falladas = 0, 0
def t(label, ok, extra=''):
    global pasadas, falladas
    if ok: pasadas += 1; print('PASS ' + label + (' · ' + extra if extra else ''))
    else: falladas += 1; print('FAIL ' + label + (' · ' + extra if extra else ''))

def ncc_map(img, tpl):
    """ρ por canal (media cero, FFT) promediado — valor real en [-1,1]."""
    H, W = img.shape[:2]; th, tw = tpl.shape[:2]
    n = th * tw
    mapa = np.zeros((H - th + 1, W - tw + 1))
    for ch in range(3):
        a = img[:, :, ch]; b = tpl[:, :, ch]
        f = np.fft.rfft2(a - a.mean()); g = np.fft.rfft2(b - b.mean(), s=(H, W))
        num = np.fft.irfft2(f * np.conj(g), s=(H, W))[:H - th + 1, :W - tw + 1]
        c1 = np.zeros((H + 1, W + 1)); c1[1:, 1:] = a.cumsum(0).cumsum(1)
        c2 = np.zeros((H + 1, W + 1)); c2[1:, 1:] = (a * a).cumsum(0).cumsum(1)
        win1 = c1[th:, tw:] - c1[th:, :W - tw + 1] - c1[:H - th + 1, tw:] + c1[:H - th + 1, :W - tw + 1]
        win2 = c2[th:, tw:] - c2[th:, :W - tw + 1] - c2[:H - th + 1, tw:] + c2[:H - th + 1, :W - tw + 1]
        var = (win2 - win1 * win1 / n) / n
        den = np.sqrt(var.clip(min=1e-9)) * np.sqrt(b.var() + 1e-9)
        mapa += num / (den * n)
    return mapa / 3

# Fotos ESPERADAS en cada captura (nombres del sidecar del flujo CDP):
# solo se verifica lo que debería verse en ESA captura (la primera), no las 12.
sidecar = {}
try:
    info = json.load(io.open(os.path.join(PRUEBAS, 'recetas-fotos-info.json'), encoding='utf-8'))
    for vista in CAPTURAS:
        sidecar[vista] = sorted(set(os.path.basename(str(f['img']).replace('\\', '/')) for f in info.get(vista, {}).get('fotos', [])))
except Exception:
    sidecar = {v: sorted(f for f in os.listdir(RECETAS) if f.endswith('.jpg')) for v in CAPTURAS}

for vista, nombre in CAPTURAS.items():
    png = os.path.join(PRUEBAS, nombre)
    t(vista + ': captura existe', os.path.exists(png))
    if not os.path.exists(png): continue
    im = Image.open(png).convert('RGB')
    im.thumbnail((700, 700), Image.LANCZOS)  # escala de trabajo (rápido, robusto)
    arr = np.asarray(im, dtype=float) / 255.0
    H, W = arr.shape[:2]
    col = (W / 4) if vista == 'escritorio' else (W * 0.75)  # móvil: contenido ≈ 75% del ancho
    for archivo in sidecar[vista]:
        ruta = os.path.join(RECETAS, archivo)
        if not os.path.exists(ruta):
            t(vista + ' ' + archivo + ': fuente existe', False, archivo); continue
        foto = Image.open(ruta).convert('RGB')
        mejor = -2
        for f in (0.8, 1.0, 1.2):
            tw = int(col * f * 0.9); th = int(tw * 10 / 16)
            if tw < 24 or th < 18 or tw >= W or th >= H: continue
            ratio = tw / th
            sw, sh = foto.size
            if sw / sh > ratio:
                cw = int(sh * ratio); x0 = (sw - cw) // 2; rec = foto.crop((x0, 0, x0 + cw, sh))
            else:
                ch = int(sw / ratio); y0 = (sh - ch) // 2; rec = foto.crop((0, y0, sw, y0 + ch))
            tpl = np.asarray(rec.resize((tw, th), Image.LANCZOS), dtype=float) / 255.0
            try:
                m = ncc_map(arr, tpl)
                mejor = max(mejor, float(m.max()))
            except Exception:
                pass
        ok = mejor >= UMBRAL
        t(vista + ' ' + archivo.replace('.jpg', '') + ': la foto está en la captura', bool(ok),
          'ρ=%.2f' % mejor)

print('\n%d pasadas · %d falladas' % (pasadas, falladas))
sys.exit(1 if falladas else 0)
