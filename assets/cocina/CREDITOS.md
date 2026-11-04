# Créditos de las fotografías de los modos de cocina

Las imágenes de esta carpeta se descargaron de Wikimedia Commons y se
recortaron/re-dimensionaron localmente (tools/preparar-fotos-cocina.py).
Son recursos locales de la app (funcionan sin internet).

| Archivo | Título original | Autor | Licencia | Fuente |
|---|---|---|---|---|
| tm6.jpg | Thermomix TM6.jpg | EinAnonymerBenutzerVonVielen | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Thermomix_TM6.jpg |
| horno.jpg | Braeter im Herd (fcm).jpg | Frank C. Müller | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Braeter_im_Herd_(fcm).jpg |
| airfryer.jpg | Air Fryer 2020.jpg | I am R. | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Air_Fryer_2020.jpg |
| sarten.jpg | Pan-fried Rib Eye Steak.JPG | Ceeseven | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Pan-fried_Rib_Eye_Steak.JPG |

## Cómo cambiar las fotos

Reemplaza el archivo .jpg de cada modo por tu propia foto y vuelve a ejecutar
`python tools/preparar-fotos-cocina.py` (ajusta las rutas en SRC), o simplemente
sobrescribe el .jpg final conservando el nombre:

- `tm6.jpg` — 1200×900 (4:3)
- `horno.jpg` — 1200×900 (4:3)
- `airfryer.jpg` — 1200×900 (4:3)
- `sarten.jpg` — 1200×900 (4:3)

Los nombres de archivo se configuran en `COCINA_MODOS` dentro de index.html
(campo `img`), así que también puedes apuntar cada modo a otra ruta sin
renombrar nada. Si la imagen no existe, la tarjeta muestra su emoji grande.
