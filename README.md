# Documentación Técnica Integral - Geoportal Relleno Sanitario San Martín de las Pirámides

## 📌 1. Resumen Ejecutivo del Proyecto
El **Geoportal Relleno Sanitario San Martín de las Pirámides** es una plataforma SIG web de monitoreo y análisis geoespacial basada en datos de vuelos fotogramétricos UAV (Drones) realizada para **INyDES**. Integra visualización dual en **2D (OpenLayers)** y **3D fotorrealista (CesiumJS)**, sincronización multimedia (video DJI con trayectoria, vistas 360° en alta resolución), análisis altimétrico por curvas de nivel y un sistema de auditoría de visitantes con geolocalización en la nube mediante **Google Sheets**.

El repositorio de despliegue se encuentra publicado y sincronizado en GitHub:
* **Repositorio Remoto:** [https://github.com/mapitas2490-svg/Relleno.git](https://github.com/mapitas2490-svg/Relleno.git)
* **Rama Principal:** `main`

---

## 📂 2. Estructura General de Directorios (`F:\geoportal_Relleno_San_Martin`)

```text
F:\geoportal_Relleno_San_Martin\
├── DOCUMENTACION_PROYECTO.md       # Este documento técnico integral
├── README.md                       # Resumen ejecutivo y guía rápida
├── admin_app.py                    # Aplicación administrativa de escritorio / servidor
├── admin/                          # Módulos del panel administrativo
├── arcgis_toolbox/                 # Herramientas y scripts de geoprocesamiento ArcGIS
├── FileGeodatabase/                # Geodatabase ESRI con capas maestras vectoriales
├── ortofoto_S1/                    # Insumos ráster de ortomosaico de alta resolución
├── tools/                          # Scripts auxiliares y utilidades de conversión
├── visor_app/                      # Componentes de escritorio / aplicación empaquetada
├── visor_fa/                       # Recursos auxiliares y estilos FA
└── visor_web_export/               # NÚCLEO WEB (Desplegado en producción / GitHub)
    ├── index.html                  # Interfaz principal del visor 2D / 3D
    ├── visitas.html                # Panel de auditoría y analítica de visitantes
    ├── server.py                   # Servidor multihilo Python con soporte HTTP 206 y visitas
    ├── css/
    │   └── style.css               # Sistema de diseño, conmutador 2D/3D y responsividad
    ├── js/
    │   ├── app.js                  # Lógica del visor 2D, tablas de atributos, video y 360
    │   └── cesium_3d.js            # Módulo de visualización 3D (CesiumJS y Bing Maps Roads)
    ├── data/
    │   ├── config.js               # Parámetros globales, capas, tokens y webhook URL
    │   ├── curvas_nivel.geojson    # Curvas de nivel a 1.0 m (CN_1) con clasificación altimétrica
    │   ├── formas2.geojson         # Polígono delimitador "Zona en revisión"
    │   ├── fotos_san_martin.geojson# Ubicaciones de fotografías aéreas y vistas 360°
    │   ├── arboles.geojson         # Capa de arbolado censado y clusters
    │   └── visitas.json            # Histórico local de visitas
    ├── media/
    │   ├── fotos/                  # Fotografías UAV en alta definición y panorámicas
    │   └── videos/                 # Video de vuelo DJI georreferenciado
    └── bower_components/           # Librerías estáticas empaquetadas (Bootstrap, Pannellum, OL)
```

---

## 🗺️ 3. Módulo 2D (OpenLayers)

### 3.1 Tecnologías y Renderizado
* **Motor:** OpenLayers 4.6.5 + Proj4js 2.9.0.
* **Proyección de Visualización:** Pseudo-Mercator (`EPSG:3857`), consumiendo GeoJSON en WGS84 (`EPSG:4326`).
* **Sistemas de Coordenadas de Origen:** UTM Zona 14N (`EPSG:32614`), convertidos y optimizados a GeoJSON.

### 3.2 Capas y Simbología
1. **Curvas de Nivel 1.0 m (`CN_1.shp` $ightarrow$ `curvas_nivel.geojson`)**:
   * **Entidades:** 2,329 líneas vectoriales.
   * **Rango Altimétrico:** 2,300.0 m a 2,316.0 m.
   * **Rampa Hipsométrica Continua:** Azul (`#0077b6`) $ightarrow$ Verde menta (`#06d6a0`) $ightarrow$ Amarillo (`#ffd166`) $ightarrow$ Naranja (`#f77f00`) $ightarrow$ Rojo (`#d62828`).
   * **Curvas Maestras (cada 5.0 m):** 576 líneas con trazo reforzado de 2.5 px y etiqueta de cota en metros (`2300m`, `2305m`, `2310m`, `2315m`) con contorno de contraste oscuro `#133c2e`.
   * **Curvas Ordinarias (cada 1.0 m):** 1,753 líneas con trazo de 1.2 px.
   * **Leyenda en Panel:** Barra de gradiente visual con indicación de cotas mínimas/máximas y grosores.
2. **Zona en Revisión (`formas2.geojson`)**:
   * Polígono delimitador del área de celda/disposición en revisión.
   * Trazo perimetral `#10b981` (verde esmeralda) con relleno translúcido y etiqueta automática.
3. **Fotos y Vistas 360° (`fotos_san_martin.geojson`)**:
   * Marcadores fotográficos georreferenciados vinculados a visor inmersivo **Pannellum** y modales HD.
   * Sincronización completa con el panel lateral: el checkbox `📸 Fotos y Vistas 360°` enciende o apaga las marcas instantáneamente.
4. **Vuelo de Inspección UAV**:
   * Trayectoria de vuelo sincronizada, cono de orientación de cámara y reproductor flotante minificable de video DJI.
   * Control independiente de encendido/apagado en el panel lateral mediante el switch `🛸 Vuelo inspección UAV`.
5. **Árboles Censados**:
   * Capa agrupada en clusters dinámicos por densidad y colores graduados según concentración.

### 3.3 Herramientas GIS Interactivas
* **Tabla de Atributos Dinámica:** Modal emergente con filtro instantáneo en todas las columnas, paginación rápida, ordenación y exportación de datos a formato **CSV**.
* **Medición de Distancias y Áreas:** Herramienta interactiva de trazo métrico sobre el terreno.
* **Control de Capas y Opacidad:** Sliders de transparencia y menú contextual para cada capa.

---

## 🌐 4. Módulo 3D (CesiumJS)

### 4.1 Infraestructura 3D y Cesium Ion
* **Librería:** CesiumJS v1.119.
* **Token Cesium Ion:** Configurado y activo en `js/cesium_3d.js`.
* **Activo 3D Tileset (Ion Asset ID):** `5900012` (Modelo fotogramétrico 3D de alta densidad).
* **Terreno Mundial:** Proveedor Cesium World Terrain (`CesiumTerrainProvider.fromIonAssetId(1)`).
* **Profundidad de Relieve:** Activado `viewer.scene.globe.depthTestAgainstTerrain = true`.

### 4.2 Mapa Base: "Bing Maps Roads"
* El visor 3D carga por defecto la cartografía vial de carreteras **Bing Maps Roads** (`Cesium.IonWorldImageryStyle.ROAD` / Asset ID 4) tanto en el globo como en el selector interactivo de mapas base (`baseLayerPicker`).

### 4.3 Encuadre y Coordenadas Objetivo
* **Coordenadas de enfoque inicial y botón Home:**
  * **Latitud:** `19.703806`
  * **Longitud:** `-98.805434`
  * **Elevación base:** `2,305.0 msnm`
  * **Inclinación de Cámara (Pitch):** `-45.0°` para perspectiva tridimensional oblicua.
  * **Orientación (Heading):** `15.0°` (Norte-Nororiente).
  * **Distancia de visualización:** `500.0 m`.

### 4.4 Política de Inicio Ligero y Control Dinámico de Capas
* **Carga Inicial Ultraligera:** Al cambiar a modo 3D, todas las capas vectoriales (*Curvas de nivel 1.0m*, *Zona en revisión*, *Fotos*) se inicializan en estado **`show = false`** (apagadas) y las casillas del panel lateral aparecen desmarcadas. Esto evita la saturación de memoria GPU/WebGL y garantiza que el modelo 3D abra inmediatamente.
* **Sincronización en Tiempo Real:** El usuario puede marcar cualquier casilla en el panel lateral durante la sesión 3D para proyectar las capas sobre el terreno adheridas al relieve (`clampToGround: true`), o desmarcarlas para ocultarlas al instante.
* **Retorno Fluido a 2D:** Al conmutar de regreso a 2D, el sistema restaura automáticamente el estado de las capas activas previas.

---

## 👥 5. Sistema de Auditoría y Registro de Visitas con Geolocalización

### 5.1 Acceso Oculto y Discreto
* Se removió el botón público visible de la barra de navegación para mantener la analítica como una herramienta confidencial para los administradores.
* **Enlace Secreto:** En la esquina inferior derecha del visor (en la línea de atribución de derechos de autor), justo después del correo electrónico `jhonson2490@gmail.com`, se encuentra un punto discreto `.` (`jhonson2490@gmail.com.`).
* Al hacer clic en este punto `.`, se abre el panel de control de visitantes en [`visitas.html`](file:///F:/geoportal_Relleno_San_Martin/visor_web_export/visitas.html).

### 5.2 Integración en la Nube con Google Sheets (Serverless)
Para permitir que el monitoreo de visitantes funcione en **GitHub Pages** (donde no se ejecutan servidores Python de backend):
1. **Google Apps Script Webhook:**
   * URL de implementación web:
     `https://script.google.com/macros/s/AKfycbzQ-n6r5bw9RMX5qP1vIpLaFQ4OE3qY-0bDege33YH4XoqamUwvtbQCp5d9xOjrH7_qTw/exec`
   * Conectada a la hoja de cálculo privada de Google Drive: **`Visitas Geoportal San Martin`**.
2. **Captura en Cliente (`js/app.js`):**
   * Al acceder cualquier usuario al visor, se ejecuta una consulta en segundo plano a la API de geolocalización IP (`freeipapi.com`).
   * Se recopila: Fecha y hora, Dirección IP, Ciudad, Estado, País, Latitud, Longitud y Huella de dispositivo/navegador.
   * Los datos se envían por método `POST` al Webhook de Google Sheets y se añaden como un nuevo renglón.
   * Se almacena una bandera en `sessionStorage` para evitar duplicar registros en caso de que el usuario recargue la página.
3. **Panel de Monitoreo (`visitas.html`):**
   * Lee en tiempo real el endpoint `GET` del Webhook de Google Sheets (con fallback al servidor local).
   * Presenta KPIs de: **Total de visitas**, **Ciudades únicas** y **Último acceso**.
   * Tabla interactiva con badges de IP, ubicación geográfica y enlace directo a Google Maps (`📍 lat, lon`).
   * Auto-refresco automático cada 15 segundos y botón manual de actualización.

---

## 🚀 6. Guía de Uso y Operación

### 6.1 Ejecutar el Visor Localmente
Para pruebas de desarrollo local con soporte de streaming de video MP4 y servidor multihilo:
1. Abrir PowerShell o la consola en la carpeta del proyecto:
   ```powershell
   cd F:\geoportal_Relleno_San_Martin\visor_web_export
   ```
2. Iniciar el servidor local en el puerto 8005:
   ```powershell
   python server.py 8005
   ```
3. Abrir en el navegador:
   * **Visor 2D / 3D:** [http://127.0.0.1:8005/](http://127.0.0.1:8005/)
   * **Panel de Visitas:** [http://127.0.0.1:8005/visitas.html](http://127.0.0.1:8005/visitas.html)

### 6.2 Despliegue y Sincronización en GitHub
Para publicar nuevas modificaciones en la nube:
```powershell
cd F:\geoportal_Relleno_San_Martin\visor_web_export
git add .
git commit -m "Descripcion de las mejoras realizadas"
git push origin main
```
El portal se actualizará automáticamente en la URL pública configurada en GitHub Pages.

### 6.3 Actualización de Capas Shapefile a GeoJSON
Si en el futuro se generan nuevos shapefiles (por ejemplo en `F:\INYDES\Relleno_Sanitario_San_Martin\shp`):
```python
import geopandas as gpd

# 1. Leer shapefile en coordenadas proyectadas
gdf = gpd.read_file('ruta_a_nuevo_archivo.shp')

# 2. Reproyectar a WGS84 para compatibilidad web
if gdf.crs and gdf.crs.to_epsg() != 4326:
    gdf = gdf.to_crs(epsg=4326)

# 3. Guardar como GeoJSON en visor_web_export/data/
gdf.to_file('F:/geoportal_Relleno_San_Martin/visor_web_export/data/nombre_capa.geojson', driver='GeoJSON')
```

---

## 📋 7. Historial de Versiones y Cambios Recientes

| Versión / Commit | Componentes Afectados | Descripción del Cambio |
| :--- | :--- | :--- |
| `bf53e12` | `index.html`, `js/cesium_3d.js` | Implementación del botón central 2D/3D e integración de CesiumJS con 3D Tileset 5900012. |
| `0e41b21` | `js/cesium_3d.js`, `index.html` | Remoción de popups heredados de Chapultepec y centrado de cámara en `19.703806, -98.805434`. |
| `4a18e03` | `visor_web_export` | Retiro de tarjeta Galería UAV y adición de capa *Zona en revisión* (`formas2.geojson`). |
| `72fd002` | `data/curvas_nivel.geojson`, `cesium_3d.js`, `app.js` | Sustitución de curvas de 0.5m por `CN_1.shp` (1.0m, 2,329 líneas), mapa base **Bing Maps Roads** en 3D, inicio ligero de capas y ocultamiento del botón de visitas con punto discreto `.`. |
| `a4da5a2` | `data/config.js`, `js/app.js`, `visitas.html` | Conexión e integración del sistema de auditoría con **Google Sheets Webhook** en tiempo real. |

---
**Desarrollado y mantenido por:** INyDES / Edgar Flores  
**Contacto técnico:** jhonson2490@gmail.com  
**Última actualización:** Septiembre 2026
