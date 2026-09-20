Visor de ortofoto: LUGAR_01_orto
Generado: 2026-09-20T11:41:44-0600
Origen:   F:\ALMA\INEGI_CAMPO\CAMPO_ORGANIZADO\agisoft\LUGAR_01_NORTE_24AUG_TARDE.files\orto\LUGAR_01_NORTE_24AUG_TARDE.jp2

ESTRUCTURA
----------
F:\geoportal_Alma_Campo\visor_web_export\ortofoto_lugar_01/
  tiles/{z}/{x}/{y}.png     Piramide XYZ (15..21, 256px)
  manifest.json                  Metadatos del tilset
  josm_imagery.json              Snippet para registrar como Custom imagery en JOSM
  sample.html                    Visor minimo (Leaflet) para verificar
  README.txt                     Este archivo

EXTENT (WGS84)
---------------
SW: -97.672593, 18.565040
NE: -97.670485, 18.568590
Centro: -97.671539, 18.566815

COMO VER LOCALMENTE
-------------------
1) Doble click en sample.html  (NO funciona bien por CORS, ver opcion 2)
2) Servidor local (recomendado):
     cd F:\geoportal_Alma_Campo\visor_web_export\ortofoto_lugar_01
     python -m http.server 8000
     Abrir http://localhost:8000/sample.html

COMO USAR EN JOSM
-----------------
1) Levantar el servidor local (paso 2 anterior)
2) JOSM > Edit > Preferences > Imagery > + (Custom)
3) Tile URL: http://localhost:8000/tiles/{z}/{x}/{y}.png
4) Name:     LUGAR_01_orto
5) Attribution: Ortofoto UAV LUGAR_01 2026
6) Max zoom: 21

COMO INTEGRAR CON TU VISOR (visor_fa o visor_web_export)
--------------------------------------------------------
En FastAPI (visor_fa/app.py) montar la carpeta /tiles como estatico:
    from fastapi.staticfiles import StaticFiles
    app.mount("/ortofoto", StaticFiles(directory=r"F:\geoportal_Alma_Campo\visor_web_export\ortofoto_lugar_01"))
Y en el HTML del visor:
    L.tileLayer('/ortofoto/tiles/{z}/{x}/{y}.png', { attribution: 'Ortofoto UAV LUGAR_01 2026' })

ESTADISTICAS
------------
{
  "tiles": 469,
  "bytes": 53890326,
  "per_zoom": {
    "15": 1,
    "16": 2,
    "17": 6,
    "18": 12,
    "19": 30,
    "20": 96,
    "21": 322
  },
  "zmax_natural": 6
}

LICENCIA / ATRIBUCION
---------------------
Atribucion obligatoria: Ortofoto UAV LUGAR_01 2026
Para publicar el tile server publicamente, la ortofoto debe tener una
licencia compatible (CC-BY-SA, ODbL, etc.). Revisar la licencia del
vuelo UAV antes de cualquier publicacion externa.
