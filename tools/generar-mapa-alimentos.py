# -*- coding: utf-8 -*-
# Genera a partir de tools/alimentos-eleccion.json:
#  1) assets/alimentos/<slug>.jpg  (recorte 4:3 por energía, 480x360, q78)
#  2) assets/alimentos/CREDITOS.md (atribuciones)
#  3) tools/.alimentos-map.js      (literal JS del mapa para index.html)
# Uso: python tools/generar-mapa-alimentos.py
import io, json, os, re, sys, time, urllib.parse, urllib.request
import numpy as np
from PIL import Image, ImageFilter
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
UA = {'User-Agent': 'MiProyectoPersonal/1.7 (offline app, single user)'}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'alimentos')
PREV = os.path.join(ROOT, 'tools', '.alimentos-prev')

sel = json.load(open(os.path.join(ROOT, 'tools', 'alimentos-eleccion.json'), encoding='utf-8'))

# 1) metadatos (autor) por lotes de 20 títulos
meta = {}
titulos = list(set(v['title'] for v in sel.values()))
for i in range(0, len(titulos), 20):
    lote = titulos[i:i + 20]
    url = ('https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo'
           + '&iiprop=extmetadata&titles=' + urllib.parse.quote('|'.join(lote)))
    for intento in range(4):
        try:
            d = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60))
            for p in (d.get('query', {}).get('pages') or {}).values():
                em = ((p.get('imageinfo') or [{}])[0].get('extmetadata') or {})
                artista = re.sub('<[^>]*>', '', em.get('Artist', {}).get('value', '?') or '?').strip()[:60]
                artista = re.sub(r'[\r\n\t]+', ' ', artista).strip()  # sin saltos dentro de la cadena JS
                lic = em.get('LicenseShortName', {}).get('value', '?')
                meta[p.get('title')] = (artista, lic)
            break
        except Exception as e:
            print('meta reintento', e); time.sleep(8)
    time.sleep(2)

def smart_crop(im, tw=480, th=360):
    w, h = im.size
    ratio = tw / th
    if w / h > ratio + 0.01:
        cw = int(h * ratio)
        g = np.array(im.convert('L').filter(ImageFilter.FIND_EDGES), dtype=float)
        cum = g.cumsum(axis=1); energy = cum[:, cw:] - cum[:, :-cw]
        col = int(energy.sum(axis=0).argmax())
        return im.crop((col, 0, col + cw, h))
    elif w / h < ratio - 0.01:
        ch = int(w / ratio)
        g = np.array(im.convert('L').filter(ImageFilter.FIND_EDGES), dtype=float)
        cum = g.cumsum(axis=0); energy = cum[ch:, :] - cum[:-ch, :]
        row = int(energy.sum(axis=1).argmax())
        return im.crop((0, row, w, row + ch))
    return im

os.makedirs(OUT, exist_ok=True)
os.makedirs(PREV, exist_ok=True)
creditos = []
entradas = []
for slug, v in sel.items():
    titulo = v['title'].replace('File:', '')
    artista, lic = meta.get(v['title'], ('?', v.get('lic', '?')))
    # descargar (ruta Special:FilePath, backoff)
    dst = os.path.join(PREV, slug + '.jpg')
    if not (os.path.exists(dst) and os.path.getsize(dst) > 8000):
        url = 'https://commons.wikimedia.org/wiki/Special:FilePath/' + urllib.parse.quote(v['title']) + '?width=640'
        ok = False
        for intento in range(4):
            try:
                data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read()
                if data[:4] == b'<htm':
                    time.sleep(10); continue
                open(dst, 'wb').write(data); ok = True; break
            except Exception as e:
                print('dl reintento', slug, str(e)[:50]); time.sleep(10)
        if not ok:
            print('SIN DESCARGAR:', slug); continue
        time.sleep(4)
    try:
        im = Image.open(dst).convert('RGB')
        im = smart_crop(im).resize((480, 360), Image.LANCZOS)
        im.save(os.path.join(OUT, slug + '.jpg'), 'JPEG', quality=78, optimize=True, progressive=True)
    except Exception as e:
        print('ERR procesar', slug, e); continue
    creditos.append((v['nombre'], slug + '.jpg', titulo, artista, lic, v['title']))
    entradas.append((slug, v['nombre'], artista, lic, titulo))
    print('OK', slug, '·', titulo[:50], '·', lic, '·', artista[:30])

# 2) CREDITOS.md
with io.open(os.path.join(OUT, 'CREDITOS.md'), 'w', encoding='utf-8') as f:
    f.write('# Créditos de las fotografías de alimentos\n\n')
    f.write('Descargadas de Wikimedia Commons y recortadas localmente (tools/generar-mapa-alimentos.py).\n')
    f.write('Recursos locales (funcionan sin internet). El crédito también se muestra dentro de la app\n')
    f.write('en «📷 Créditos de las fotografías».\n\n')
    f.write('| Alimento | Archivo | Título original | Autor | Licencia | Fuente |\n|---|---|---|---|---|---|\n')
    for nombre, archivo, titulo, artista, lic, title in creditos:
        url = 'https://commons.wikimedia.org/wiki/' + urllib.parse.quote(title)
        f.write('| %s | %s | %s | %s | %s | %s |\n' % (nombre, archivo, titulo, artista, lic, url))

# 3) literal JS
SINONIMOS = {
    'queso': ['queso cheddar', 'queso mozzarella', 'queso fresco', 'queso cottage'],
    'leche': ['leche entera', 'leche 2%', 'leches usa'],
    'yogurt': ['yogurt griego', 'yogurt natural', 'yogurt regular', 'yogurt vainilla', 'yogurt alto en proteína'],
    'pollo': ['pollo rostizado'],
    'elote': ['maíz'],
    'pimiento': ['pimiento morrón'],
    'frijol': ['frijoles'],
    'huevo': ['huevos'],
    'papa': ['papas'],
}
def clave(s):
    s = s.lower()
    s = re.sub(r'[áàä]', 'a', s); s = re.sub(r'[éèë]', 'e', s); s = re.sub(r'[íìï]', 'i', s)
    s = re.sub(r'[óòö]', 'o', s); s = re.sub(r'[úùü]', 'u', s); s = re.sub(r'ñ', 'n', s)
    s = re.sub(r'\([^)]*\)', ' ', s)
    s = re.sub(r'\b\d+(\.\d+)?%?\b', ' ', s)
    s = re.sub(r'\b(de|la|el|los|las|en|un|una|y|con|sin|taza|tazas|pieza|piezas|rebanada|rebanadas|oz|ml|kg|gr|g)\b', ' ', s)
    s = re.sub(r'[^a-z0-9]+', ' ', s).strip()
    return s
mapa = {}
for slug, nombre, artista, lic, titulo in entradas:
    ks = {clave(nombre)}
    for syn in SINONIMOS.get(slug, []):
        ks.add(clave(syn))
    ks = {k for k in ks if k}
    for k in ks:
        mapa[k] = {'img': 'assets/alimentos/' + slug + '.jpg', 'fuente': artista + ' · ' + lic + ' · Wikimedia Commons'}
lineas = []
for k in sorted(mapa):
    v = mapa[k]
    fuente = v['fuente'].replace('\\', '\\\\').replace("'", "\\'")
    lineas.append("'%s':{img:'%s',fuente:'%s'}," % (k, v['img'], fuente))
js = '//__ALIMENTO_FOTOS_GENERADO__//\n' + '\n'.join(lineas)
open(os.path.join(ROOT, 'tools', '.alimentos-map.js'), 'w', encoding='utf-8').write(js)
print('\nMapa generado: %d claves → tools/.alimentos-map.js' % len(mapa))
