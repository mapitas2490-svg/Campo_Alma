Visor de ortofoto: LUGAR_03_orto
Generado: 2026-09-20T17:35:24-0600
Origen:   F:\ALMA\INEGI_CAMPO\CAMPO_ORGANIZADO\agisoft\LUGAR_03_ESTE_25AUG_MEDIODIA.files\orto\LUGAR_03_ESTE_25AUG_MEDIODIA.jp2

ESTRUCTURA
----------
F:\geoportal_Alma_Campo\visor_web_export\ortofoto_lugar_03/
  tiles/{z}/{x}/{y}.png     Piramide XYZ (15..22, 256px)
  manifest.json                  Metadatos del tilset
  josm_imagery.json              Snippet para registrar como Custom imagery en JOSM
  sample.html                    Visor minimo (Leaflet) para verificar
  README.txt                     Este archivo

EXTENT (WGS84)
---------------
SW: -97.280518, 18.260350
NE: -97.276952, 18.265737
Centro: -97.278735, 18.263044

COMO VER LOCALMENTE
-------------------
1) Doble click en sample.html  (NO funciona bien por CORS, ver opcion 2)
2) Servidor local (recomendado):
     cd F:\geoportal_Alma_Campo\visor_web_export\ortofoto_lugar_03
     python -m http.server 8000
     Abrir http://localhost:8000/sample.html

COMO USAR EN JOSM
-----------------
1) Levantar el servidor local (paso 2 anterior)
2) JOSM > Edit > Preferences > Imagery > + (Custom)
3) Tile URL: http://localhost:8000/tiles/{z}/{x}/{y}.png
4) Name:     LUGAR_03_orto
5) Attribution: Ortofoto UAV LUGAR_03 2026 - Resolucion Nativa (2.8 cm/px)
6) Max zoom: 22

COMO INTEGRAR CON TU VISOR (visor_fa o visor_web_export)
--------------------------------------------------------
En FastAPI (visor_fa/app.py) montar la carpeta /tiles como estatico:
    from fastapi.staticfiles import StaticFiles
    app.mount("/ortofoto", StaticFiles(directory=r"F:\geoportal_Alma_Campo\visor_web_export\ortofoto_lugar_03"))
Y en el HTML del visor:
    L.tileLayer('/ortofoto/tiles/{z}/{x}/{y}.png', { attribution: 'Ortofoto UAV LUGAR_03 2026 - Resolucion Nativa (2.8 cm/px)' })

ESTADISTICAS
------------
{
  "tiles": 3928,
  "bytes": 353370427,
  "per_zoom": {
    "15": 2,
    "16": 4,
    "17": 6,
    "18": 20,
    "19": 63,
    "20": 204,
    "21": 748,
    "22": 2881
  },
  "zmax_natural": 7
}

LICENCIA / ATRIBUCION
---------------------
Atribucion obligatoria: Ortofoto UAV LUGAR_03 2026 - Resolucion Nativa (2.8 cm/px)
Para publicar el tile server publicamente, la ortofoto debe tener una
licencia compatible (CC-BY-SA, ODbL, etc.). Revisar la licencia del
vuelo UAV antes de cualquier publicacion externa.
