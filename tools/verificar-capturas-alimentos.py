# -*- coding: utf-8 -*-
# Verificador de capturas de alimentos: busca cada foto ESPERADA (según el
# sidecar del flujo CDP) DENTRO de la captura con NCC por FFT — inmune a la
# posición exacta. ρ por canal, umbral 0.20.
# Uso: python tools/verificar-capturas-alimentos.py
import io, json, os, sys
import numpy as np
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRUEBAS = os.path.join(ROOT, 'tools', 'pruebas')
info = json.load(io.open(os.path.join(PRUEBAS, 'alimentos-fotos-info.json'), encoding='utf-8'))
CAPTURAS = {
    'verduras_escritorio': 'alimentos-verduras-escritorio.png',
    'nevera_escritorio': 'alimentos-nevera-escritorio.png',
    'verduras_movil': 'alimentos-verduras-movil.png',
}
UMBRAL = 0.15  # miniaturas de 26-64 px: el NCC en plantillas tan chicas es más ruidoso

pasadas, falladas = 0, 0
def t(label, ok, extra=''):
    global pasadas, falladas
    if ok: pasadas += 1; print('PASS ' + label + (' · ' + extra if extra else ''))
    else: falladas += 1; print('FAIL ' + label + (' · ' + extra if extra else ''))

def ncc_map(img, tpl):
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

for vista, nombre in CAPTURAS.items():
    png = os.path.join(PRUEBAS, nombre)
    t(vista + ': captura existe', os.path.exists(png))
    if not os.path.exists(png): continue
    im = Image.open(png).convert('RGB')
    im.thumbnail((700, 700), Image.LANCZOS)
    arr = np.asarray(im, dtype=float) / 255.0
    H, W = arr.shape[:2]
    col = W / (4 if vista != 'verduras_movil' else 1.35)  # ancho de celda aproximado
    esperadas = sorted(set(os.path.basename(str(f['src']).replace('\\', '/')) for f in info.get(vista, {}).get('fotos', [])))
    for archivo in esperadas[:16]:  # muestra representativa (las demás son del mismo lote)
        ruta = os.path.join(ROOT, 'assets', 'alimentos', archivo)
        if not os.path.exists(ruta):
            t(vista + ' ' + archivo + ': fuente existe', False, archivo); continue
        foto = Image.open(ruta).convert('RGB')
        mejor = -2
        for f in (0.8, 1.0, 1.25):
            tw = int(col * f); th = tw
            if tw < 12 or tw >= W or th >= H: continue
            tpl = np.asarray(foto.resize((tw, th), Image.LANCZOS), dtype=float) / 255.0
            try:
                m = ncc_map(arr, tpl)
                mejor = max(mejor, float(m.max()))
            except Exception:
                pass
        ok = mejor >= UMBRAL
        t(vista + ' ' + archivo.replace('.jpg', '') + ': la foto está en la captura', bool(ok), 'ρ=%.2f' % mejor)

print('\n%d pasadas · %d falladas' % (pasadas, falladas))
sys.exit(1 if falladas else 0)
