Visor de ortofoto: LUGAR_05_orto
Generado: 2026-09-20T15:35:57-0600
Origen:   F:\ALMA\INEGI_CAMPO\CAMPO_ORGANIZADO\agisoft\LUGAR_05_SUR_26AUG_TARDE.files\orto\LUGAR_05_SUR_26AUG_TARDE.jp2

ESTRUCTURA
----------
F:\geoportal_Alma_Campo\visor_web_export\ortofoto_alma_campo/
  tiles/{z}/{x}/{y}.png     Piramide XYZ (15..22, 256px)
  manifest.json                  Metadatos del tilset
  josm_imagery.json              Snippet para registrar como Custom imagery en JOSM
  sample.html                    Visor minimo (Leaflet) para verificar
  README.txt                     Este archivo

EXTENT (WGS84)
---------------
SW: -97.846943, 17.896546
NE: -97.844385, 17.899180
Centro: -97.845664, 17.897863

COMO VER LOCALMENTE
-------------------
1) Doble click en sample.html  (NO funciona bien por CORS, ver opcion 2)
2) Servidor local (recomendado):
     cd F:\geoportal_Alma_Campo\visor_web_export\ortofoto_alma_campo
     python -m http.server 8000
     Abrir http://localhost:8000/sample.html

COMO USAR EN JOSM
-----------------
1) Levantar el servidor local (paso 2 anterior)
2) JOSM > Edit > Preferences > Imagery > + (Custom)
3) Tile URL: http://localhost:8000/tiles/{z}/{x}/{y}.png
4) Name:     LUGAR_05_orto
5) Attribution: Ortofoto UAV LUGAR_05 2026 - Resolucion Nativa (3.7 cm/px)
6) Max zoom: 22

COMO INTEGRAR CON TU VISOR (visor_fa o visor_web_export)
--------------------------------------------------------
En FastAPI (visor_fa/app.py) montar la carpeta /tiles como estatico:
    from fastapi.staticfiles import StaticFiles
    app.mount("/ortofoto", StaticFiles(directory=r"F:\geoportal_Alma_Campo\visor_web_export\ortofoto_alma_campo"))
Y en el HTML del visor:
    L.tileLayer('/ortofoto/tiles/{z}/{x}/{y}.png', { attribution: 'Ortofoto UAV LUGAR_05 2026 - Resolucion Nativa (3.7 cm/px)' })

ESTADISTICAS
------------
{
  "tiles": 1397,
  "bytes": 194546911,
  "per_zoom": {
    "15": 1,
    "16": 1,
    "17": 2,
    "18": 6,
    "19": 20,
    "20": 72,
    "21": 272,
    "22": 1023
  },
  "zmax_natural": 5
}

LICENCIA / ATRIBUCION
---------------------
Atribucion obligatoria: Ortofoto UAV LUGAR_05 2026 - Resolucion Nativa (3.7 cm/px)
Para publicar el tile server publicamente, la ortofoto debe tener una
licencia compatible (CC-BY-SA, ODbL, etc.). Revisar la licencia del
vuelo UAV antes de cualquier publicacion externa.
