Visor de ortofoto: LUGAR_04_orto
Generado: 2026-09-20T19:18:54-0600
Origen:   F:\ALMA\INEGI_CAMPO\CAMPO_ORGANIZADO\agisoft\LUGAR_04_CENTRO_26AUG_MEDIODIA.files\orto\orto_04.jp2

ESTRUCTURA
----------
F:\geoportal_Alma_Campo\visor_web_export\ortofoto_lugar_04/
  tiles/{z}/{x}/{y}.png     Piramide XYZ (15..22, 256px)
  manifest.json                  Metadatos del tilset
  josm_imagery.json              Snippet para registrar como Custom imagery en JOSM
  sample.html                    Visor minimo (Leaflet) para verificar
  README.txt                     Este archivo

EXTENT (WGS84)
---------------
SW: -97.527528, 18.317269
NE: -97.522982, 18.319546
Centro: -97.525255, 18.318408

COMO VER LOCALMENTE
-------------------
1) Doble click en sample.html  (NO funciona bien por CORS, ver opcion 2)
2) Servidor local (recomendado):
     cd F:\geoportal_Alma_Campo\visor_web_export\ortofoto_lugar_04
     python -m http.server 8000
     Abrir http://localhost:8000/sample.html

COMO USAR EN JOSM
-----------------
1) Levantar el servidor local (paso 2 anterior)
2) JOSM > Edit > Preferences > Imagery > + (Custom)
3) Tile URL: http://localhost:8000/tiles/{z}/{x}/{y}.png
4) Name:     LUGAR_04_orto
5) Attribution: Ortofoto UAV LUGAR_04 2026 - Resolucion Nativa (2.8 cm/px)
6) Max zoom: 22

COMO INTEGRAR CON TU VISOR (visor_fa o visor_web_export)
--------------------------------------------------------
En FastAPI (visor_fa/app.py) montar la carpeta /tiles como estatico:
    from fastapi.staticfiles import StaticFiles
    app.mount("/ortofoto", StaticFiles(directory=r"F:\geoportal_Alma_Campo\visor_web_export\ortofoto_lugar_04"))
Y en el HTML del visor:
    L.tileLayer('/ortofoto/tiles/{z}/{x}/{y}.png', { attribution: 'Ortofoto UAV LUGAR_04 2026 - Resolucion Nativa (2.8 cm/px)' })

ESTADISTICAS
------------
{
  "tiles": 2155,
  "bytes": 187291804,
  "per_zoom": {
    "15": 2,
    "16": 4,
    "17": 4,
    "18": 12,
    "19": 35,
    "20": 112,
    "21": 420,
    "22": 1566
  },
  "zmax_natural": 7
}

LICENCIA / ATRIBUCION
---------------------
Atribucion obligatoria: Ortofoto UAV LUGAR_04 2026 - Resolucion Nativa (2.8 cm/px)
Para publicar el tile server publicamente, la ortofoto debe tener una
licencia compatible (CC-BY-SA, ODbL, etc.). Revisar la licencia del
vuelo UAV antes de cualquier publicacion externa.
