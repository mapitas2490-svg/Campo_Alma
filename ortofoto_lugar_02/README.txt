Visor de ortofoto: LUGAR_02_orto
Generado: 2026-09-20T18:38:26-0600
Origen:   F:\ALMA\INEGI_CAMPO\CAMPO_ORGANIZADO\agisoft\LUGAR_02_CENTRO_24AUG_TARDE.files\orto\LUGAR_02_CENTRO_24AUG_TARDE.jp2

ESTRUCTURA
----------
F:\geoportal_Alma_Campo\visor_web_export\ortofoto_lugar_02/
  tiles/{z}/{x}/{y}.png     Piramide XYZ (15..22, 256px)
  manifest.json                  Metadatos del tilset
  josm_imagery.json              Snippet para registrar como Custom imagery en JOSM
  sample.html                    Visor minimo (Leaflet) para verificar
  README.txt                     Este archivo

EXTENT (WGS84)
---------------
SW: -97.747053, 18.484434
NE: -97.741044, 18.486760
Centro: -97.744049, 18.485597

COMO VER LOCALMENTE
-------------------
1) Doble click en sample.html  (NO funciona bien por CORS, ver opcion 2)
2) Servidor local (recomendado):
     cd F:\geoportal_Alma_Campo\visor_web_export\ortofoto_lugar_02
     python -m http.server 8000
     Abrir http://localhost:8000/sample.html

COMO USAR EN JOSM
-----------------
1) Levantar el servidor local (paso 2 anterior)
2) JOSM > Edit > Preferences > Imagery > + (Custom)
3) Tile URL: http://localhost:8000/tiles/{z}/{x}/{y}.png
4) Name:     LUGAR_02_orto
5) Attribution: Ortofoto UAV LUGAR_02 2026 - Resolucion Nativa (1.7 cm/px)
6) Max zoom: 22

COMO INTEGRAR CON TU VISOR (visor_fa o visor_web_export)
--------------------------------------------------------
En FastAPI (visor_fa/app.py) montar la carpeta /tiles como estatico:
    from fastapi.staticfiles import StaticFiles
    app.mount("/ortofoto", StaticFiles(directory=r"F:\geoportal_Alma_Campo\visor_web_export\ortofoto_lugar_02"))
Y en el HTML del visor:
    L.tileLayer('/ortofoto/tiles/{z}/{x}/{y}.png', { attribution: 'Ortofoto UAV LUGAR_02 2026 - Resolucion Nativa (1.7 cm/px)' })

ESTADISTICAS
------------
{
  "tiles": 2813,
  "bytes": 281054417,
  "per_zoom": {
    "15": 2,
    "16": 4,
    "17": 6,
    "18": 18,
    "19": 40,
    "20": 144,
    "21": 540,
    "22": 2059
  },
  "zmax_natural": 8
}

LICENCIA / ATRIBUCION
---------------------
Atribucion obligatoria: Ortofoto UAV LUGAR_02 2026 - Resolucion Nativa (1.7 cm/px)
Para publicar el tile server publicamente, la ortofoto debe tener una
licencia compatible (CC-BY-SA, ODbL, etc.). Revisar la licencia del
vuelo UAV antes de cualquier publicacion externa.
