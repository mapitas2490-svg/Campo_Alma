Visor de ortofoto: Relleno Sanitario San Martin
Generado: 2026-09-18T20:23:16-0600
Origen:   F:\INYDES\Relleno_Sanitario_San_Martin\Ortofoto\Relleno_Sanitario_San_Martin.jp2

ESTRUCTURA
----------
F:\geoportal_Relleno_San_Martin\visor_web_export\ortofoto_san_martin/
  tiles/{z}/{x}/{y}.png     Piramide XYZ (15..21, 256px)
  manifest.json                  Metadatos del tilset
  josm_imagery.json              Snippet para registrar como Custom imagery en JOSM
  sample.html                    Visor minimo (Leaflet) para verificar
  README.txt                     Este archivo

EXTENT (WGS84)
---------------
SW: -98.807058, 19.702755
NE: -98.802851, 19.705613
Centro: -98.804954, 19.704184

COMO VER LOCALMENTE
-------------------
1) Doble click en sample.html  (NO funciona bien por CORS, ver opcion 2)
2) Servidor local (recomendado):
     cd F:\geoportal_Relleno_San_Martin\visor_web_export\ortofoto_san_martin
     python -m http.server 8000
     Abrir http://localhost:8000/sample.html

COMO USAR EN JOSM
-----------------
1) Levantar el servidor local (paso 2 anterior)
2) JOSM > Edit > Preferences > Imagery > + (Custom)
3) Tile URL: http://localhost:8000/tiles/{z}/{x}/{y}.png
4) Name:     Relleno Sanitario San Martin
5) Attribution: Ortofoto UAV INyDES 2026
6) Max zoom: 21

COMO INTEGRAR CON TU VISOR (visor_fa o visor_web_export)
--------------------------------------------------------
En FastAPI (visor_fa/app.py) montar la carpeta /tiles como estatico:
    from fastapi.staticfiles import StaticFiles
    app.mount("/ortofoto", StaticFiles(directory=r"F:\geoportal_Relleno_San_Martin\visor_web_export\ortofoto_san_martin"))
Y en el HTML del visor:
    L.tileLayer('/ortofoto/tiles/{z}/{x}/{y}.png', { attribution: 'Ortofoto UAV INyDES 2026' })

ESTADISTICAS
------------
{
  "tiles": 624,
  "bytes": 52894275,
  "per_zoom": {
    "15": 2,
    "16": 4,
    "17": 4,
    "18": 12,
    "19": 35,
    "20": 117,
    "21": 450
  },
  "zmax_natural": 7
}

LICENCIA / ATRIBUCION
---------------------
Atribucion obligatoria: Ortofoto UAV INyDES 2026
Para publicar el tile server publicamente, la ortofoto debe tener una
licencia compatible (CC-BY-SA, ODbL, etc.). Revisar la licencia del
vuelo UAV antes de cualquier publicacion externa.
