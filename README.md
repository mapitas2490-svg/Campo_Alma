# Relleno Sanitario San Martín de las Pirámides
**Geoportal Web, Monitoreo Aéreo UAV y Vistas 360°**

Plataforma cartográfica interactiva de alta precisión para el monitoreo ambiental y levantamiento fotogramétrico del **Relleno Sanitario San Martín de las Pirámides**.

---

## 🛰️ Características Principales

* **Ortofoto Aérea de Alta Resolución (GSD 2.4 cm/px):**
  * Levantamiento fotogramétrico con Dron DJI (Septiembre 2026).
  * Pirámide de teselas XYZ (Web Mercator EPSG:3857, zooms 15 al 21).
  * Máscara alfa para transparencia en los bordes.
* **Mapa Base:**
  * OpenStreetMap integrado para referencias viales y territoriales.
* **Módulo de Vistas Panorámicas 360° y Fotografías HD:**
  * Panoramas esféricos equirectangulares (14,400 x 7,200 px) integrados con visor **Pannellum 360°** (rotación interactiva, zoom, auto-rotación y pantalla completa).
  * Fotografías aéreas HD con posicionamiento GPS exacto y metadatos de altitud.
* **Reproductor UAV con Telemetría Sincronizada:**
  * Video aéreo de inspección sincronizado con 1,190 puntos de telemetría de vuelo (latitud, longitud, altitud y rumbo).
  * Cono de visión focal dinámico (FOV) proyectado en tiempo real sobre el ortomosaico.
* **Herramientas GIS en Cliente:**
  * Medición de distancias y polígonos (área).
  * Digitalización y dibujo de geometrías (puntos, líneas y polígonos) con exportación a GeoJSON.
  * Carga de archivos externos (KML, Shapefiles en .zip, GeoJSON).
  * Geolocalización GPS del dispositivo en tiempo real.
* **Monitor de Visitas y Ubicaciones:**
  * Auditoría en tiempo real de accesos con geolocalización IP (isitas.html).

---

## 📁 Estructura del Repositorio

`
├── index.html                  # Interfaz principal del visor cartográfico
├── visitas.html                # Monitor de visitas y analítica geográfica
├── server.py                   # Servidor HTTP local con streaming de video y auditoría
├── data/
│   ├── config.js               # Configuración central de capas y encuadre
│   ├── fotos_san_martin.geojson# Coordenadas y metadatos de fotos y vistas 360°
│   ├── flight_telemetry.json   # Telemetría de vuelo UAV
│   └── video.mp4               # Video aéreo de inspección
├── media/
│   ├── fotos/                  # Fotografías aéreas HD y miniaturas
│   └── fotos360/               # Panoramas 360° esféricos
├── ortofoto_san_martin/        # Pirámide de teselas XYZ del ortomosaico
├── bower_components/           # Librerías cliente (OpenLayers, Pannellum, Bootstrap)
├── js/app.js                   # Lógica cartográfica y control de capas
└── css/style.css               # Estilos visuales del visor
`

---

## 🚀 Uso Local

`ash
python server.py 8005
`
Abrir en el navegador: http://127.0.0.1:8005/

**Contacto:** jhonson2490@gmail.com
