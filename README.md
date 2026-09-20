# Geoportal Alma de Campo

Plataforma SIG web interactiva para monitoreo y análisis geoespacial de alta precisión con datos de vuelos fotogramétricos UAV y visualización 3D en CesiumJS.

* **Repositorio:** [https://github.com/mapitas2490-svg/Campo_Alma](https://github.com/mapitas2490-svg/Campo_Alma)
* **Rama de producción:** `main`

---

## 🚀 Características Principales

1. **Visor 2D Interactivo (OpenLayers):**
   * **Ortofoto UAV de Alta Resolución:** GSD 3.8 cm/px generada a partir de ortomosaico JP2, descompuesta en pirámide de tiles XYZ (zooms 15 al 21).
   * **Curvas de Nivel Altimétricas:** Curvas a 1.0 m equidistancia (882 curvas) con relieve graduado de 1,915 m a 1,950 msnm, etiquetas métricas y distinción de maestras cada 5 m.
   * **Herramientas SIG:** Medición de distancias y áreas métricas, importación y exportación de archivos (KML, GeoJSON, Shapefile ZIP), y control interactivo de capas y opacidad.

2. **Visor 3D Inmersivo (CesiumJS):**
   * **Modelo 3D Fotogramétrico (Cesium Ion Asset ID 5902520):** Malla 3D de alta densidad con relieve y texturas fotorrealistas.
   * **Cesium World Terrain:** Terreno mundial activo con detección de profundidad (`depthTestAgainstTerrain = true`).
   * **Perspectiva de cámara optimizada:** Orientación hacia la ladera en latitud `17.897863`, longitud `-97.845664` y elevación `1,930 msnm`.

3. **Arquitectura y Despliegue:**
   * Diseñado como aplicación web estática para despliegue directo en **GitHub Pages**.
   * Servidor Python local multihilo (`server.py`) incluido para desarrollo local.

---

## 🛠️ Ejecución Local

1. Abrir terminal en la carpeta del visor:
   ```bash
   python server.py 8005
   ```
2. Abrir en el navegador:
   * **Visor:** `http://127.0.0.1:8005/`
   * **Panel de Visitas:** `http://127.0.0.1:8005/visitas.html`

---
**Desarrollado para:** Alma de Campo / INyDES  
**Última actualización:** Septiembre 2026
