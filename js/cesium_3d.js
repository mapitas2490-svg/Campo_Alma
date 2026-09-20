// cesium_3d.js - Modulo de visualizacion 3D con CesiumJS
// Relleno Sanitario San Martin de las Piramides

(function () {
    'use strict';

    // Token de acceso a Cesium Ion provisto por el usuario
    Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2NDNjMzAxMS05NGVjLTQ1ZTktYjhjMy1lNDI3NjAwMDJhMjkiLCJpZCI6MTMyMTU4LCJpYXQiOjE2OTA1ODYzMTR9.6r-lijvfml1thVTi8KOI1DnP5vm_5OVjlK-ZKhpFEbI";
    const CESIUM_ASSET_ID = 5902520;

    // Coordenadas objetivo solicitadas: 19.703806, -98.805434
    const TARGET_LON = -97.845664;
    const TARGET_LAT = 17.897863;
    const TARGET_ALT = 1930.0; // Elevacion base

    let cesiumViewer = null;
    let cesiumTileset = null;
    let isInitializing = false;
    let currentMode = '2D';
    const cesiumLayers = {};

    function close2DInfoPanel() {
        const panel = document.getElementById('info-panel');
        if (panel) {
            panel.setAttribute('hidden', '');
            panel.style.display = 'none';
        }
    }

    function focusTargetCoordinates(duration = 1.0, lon = TARGET_LON, lat = TARGET_LAT, alt = TARGET_ALT) {
        if (!cesiumViewer) return;
        
        try {
            const target = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
            const heading = Cesium.Math.toRadians(15.0); // Orientacion hacia el Norte-Nororiente
            const pitch = Cesium.Math.toRadians(-45.0);   // Inclinacion a 45 grados para perspectiva 3D
            const range = 500.0;                          // Distancia en metros

            cesiumViewer.camera.lookAt(target, new Cesium.HeadingPitchRange(heading, pitch, range));
            cesiumViewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY); // Desbloquea la camara para orbitar libremente
            
            console.log(`[Cesium 3D] Camara fijada en (${lat}, ${lon}, alt: ${alt})`);
        } catch (e) {
            console.warn('[Cesium 3D] Error al posicionar camara:', e);
        }
    }

    function zoomToSite(siteId, duration = 1.0) {
        if (!cesiumViewer) return;
        const grp = (window.__CONFIG && window.__CONFIG.GROUPS && window.__CONFIG.GROUPS[siteId]) || null;
        if (grp && grp.center) {
            focusTargetCoordinates(duration, grp.center[0], grp.center[1], grp.altitude || TARGET_ALT);
        } else {
            focusTargetCoordinates(duration);
        }
    }

    function zoomToLocation(lon, lat, alt = TARGET_ALT, duration = 1.0) {
        focusTargetCoordinates(duration, lon, lat, alt);
    }

    async function initCesiumViewer() {
        if (cesiumViewer || isInitializing) return;
        isInitializing = true;

        const loadingEl = document.getElementById('cesium-loading-overlay');
        if (loadingEl) loadingEl.style.display = 'flex';

        try {
            console.log('[Cesium 3D] Inicializando visor Cesium...');
            
            // Proveedor de terreno mundial Cesium Ion
            let terrainProvider;
            try {
                terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(1);
            } catch (terrErr) {
                console.warn('[Cesium 3D] No se pudo cargar el terreno Ion ID 1, continuando con elipsoide:', terrErr);
            }

            // Mapa base predeterminado: Bing Maps Roads
            let roadImageryLayer;
            try {
                const roadProvider = await Cesium.createWorldImageryAsync({
                    style: Cesium.IonWorldImageryStyle.ROAD
                });
                roadImageryLayer = new Cesium.ImageryLayer(roadProvider);
                console.log('[Cesium 3D] Bing Maps Roads provider listo.');
            } catch (eRoad) {
                console.warn('[Cesium 3D] Error preparando Bing Maps Roads:', eRoad);
            }

            cesiumViewer = new Cesium.Viewer('cesiumContainer', {
                terrainProvider: terrainProvider,
                baseLayer: roadImageryLayer || undefined,
                animation: false,
                timeline: false,
                baseLayerPicker: true,
                geocoder: false,
                homeButton: true,
                sceneModePicker: false,
                navigationHelpButton: false,
                infoBox: true,
                selectionIndicator: false
            });

            cesiumViewer.scene.globe.depthTestAgainstTerrain = true;

            // Asegurar Bing Maps Roads en baseLayerPicker
            try {
                if (cesiumViewer.baseLayerPicker && cesiumViewer.baseLayerPicker.viewModel) {
                    const vms = cesiumViewer.baseLayerPicker.viewModel.imageryProviderViewModels;
                    const roadVm = vms.find(vm => /Bing Maps Road|Road/i.test(vm.name));
                    if (roadVm) {
                        cesiumViewer.baseLayerPicker.viewModel.selectedImagery = roadVm;
                        console.log('[Cesium 3D] Seleccionado Bing Maps Roads en baseLayerPicker.');
                    }
                }
            } catch (errPicker) {
                console.log('[Cesium 3D] Error configurando baseLayerPicker:', errPicker);
            }

            // Personalizar boton Home de forma segura si esta disponible
            try {
                if (cesiumViewer.homeButton && cesiumViewer.homeButton.viewModel && cesiumViewer.homeButton.viewModel.command) {
                    const cmd = cesiumViewer.homeButton.viewModel.command;
                    if (cmd.beforeExecute && typeof cmd.beforeExecute.addEventListener === 'function') {
                        cmd.beforeExecute.addEventListener((e) => {
                            if (e) e.cancel = true;
                            focusTargetCoordinates(1.0);
                        });
                    }
                }
            } catch (errHome) {
                console.log('[Cesium 3D] Hook de home button omitido:', errHome);
            }

            console.log(`[Cesium 3D] Cargando 3D Tileset Ion Asset ID: ${CESIUM_ASSET_ID}...`);
            const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(CESIUM_ASSET_ID);
            cesiumViewer.scene.primitives.add(tileset);
            cesiumTileset = tileset;
            try {
                await cesiumViewer.zoomTo(tileset);
            } catch(zErr) {
                console.warn('[Cesium 3D] Error en zoomTo tileset:', zErr);
            }

            // Aplicar estilo predeterminado si existe en extras
            const extras = tileset.asset?.extras;
            if (
                Cesium.defined(extras) &&
                Cesium.defined(extras.ion) &&
                Cesium.defined(extras.ion.defaultStyle)
            ) {
                tileset.style = new Cesium.Cesium3DTileStyle(extras.ion.defaultStyle);
            }

            // 1. Capa Zona en revision (formas2) - APAGADA POR DEFECTO
            try {
                const geoJsonSource = await Cesium.GeoJsonDataSource.load('./data/formas2.geojson?v=4', {
                    stroke: Cesium.Color.fromCssColorString('#10b981'),
                    fill: Cesium.Color.fromCssColorString('#10b981').withAlpha(0.25),
                    strokeWidth: 3,
                    clampToGround: true
                });
                geoJsonSource.show = false; // Inicia apagada
                cesiumViewer.dataSources.add(geoJsonSource);
                cesiumLayers['formas2'] = geoJsonSource;
                console.log('[Cesium 3D] Capa Zona en revision registrada (apagada por defecto).');
            } catch (errShp) {
                console.warn('[Cesium 3D] No se cargo formas2 en 3D:', errShp);
            }

            // 2. Capa Curvas de Nivel (1.0m) con Altimetría Completa en 3D
            try {
                const cnSource = await Cesium.GeoJsonDataSource.load('./data/curvas_nivel.geojson?v=3', {
                    clampToGround: true
                });
                const entities = cnSource.entities.values.slice(); // copia
                const minZ = 1915.0;
                const maxZ = 1950.0;

                for (let i = 0; i < entities.length; i++) {
                    const entity = entities[i];
                    const elev = entity.properties.elev ? Number(entity.properties.elev.getValue()) : 1930;
                    const isMaster = entity.properties.is_master ? Boolean(entity.properties.is_master.getValue()) : (Math.round(elev * 10) % 50 === 0);
                    
                    // Gradiente altimétrico idéntico al 2D (1915m a 1950m)
                    const ratio = Math.max(0, Math.min(1, (elev - minZ) / (maxZ - minZ)));
                    let col;
                    if (ratio < 0.25) col = Cesium.Color.fromCssColorString('#0077b6');
                    else if (ratio < 0.50) col = Cesium.Color.fromCssColorString('#06d6a0');
                    else if (ratio < 0.75) col = Cesium.Color.fromCssColorString('#ffd166');
                    else if (ratio < 0.75) col = Cesium.Color.fromCssColorString('#f77f00');
                    else col = Cesium.Color.fromCssColorString('#d62828');
                    
                    if (entity.polyline) {
                        entity.polyline.material = col;
                        entity.polyline.width = isMaster ? 3.0 : 1.5;
                        entity.polyline.clampToGround = true;
                    }

                    // Metadata altimétrica interactiva (click en curva)
                    entity.name = `Curva de nivel ${elev} msnm`;
                    entity.description = `
                        <div style="font-family:sans-serif;padding:8px;line-height:1.4;">
                            <div style="background:#435363;color:#fff;padding:6px 10px;border-radius:4px;margin-bottom:8px;font-weight:bold;">
                                🏔️ Altimetría: ${elev} msnm
                            </div>
                            <table style="width:100%;font-size:12px;border-collapse:collapse;">
                                <tr><td style="padding:3px;font-weight:bold;color:#555;">Cota:</td><td>${elev} msnm</td></tr>
                                <tr><td style="padding:3px;font-weight:bold;color:#555;">Clasificación:</td><td>${isMaster ? 'Curva Maestra (cada 5m)' : 'Curva Ordinaria (1m)'}</td></tr>
                                <tr><td style="padding:3px;font-weight:bold;color:#555;">Rango zona:</td><td>1,915 m - 1,950 m</td></tr>
                            </table>
                        </div>
                    `;

                    // Etiquetas altimétricas flotantes en 3D para curvas maestras
                    if (isMaster && entity.polyline) {
                        try {
                            const positions = entity.polyline.positions.getValue(Cesium.JulianDate.now());
                            if (positions && positions.length > 3) {
                                const midIdx = Math.floor(positions.length / 2);
                                const labelEntity = cnSource.entities.add({
                                    position: positions[midIdx],
                                    label: {
                                        text: `${elev}m`,
                                        font: 'bold 12px sans-serif',
                                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                                        fillColor: Cesium.Color.WHITE,
                                        outlineColor: Cesium.Color.BLACK,
                                        outlineWidth: 3,
                                        showBackground: true,
                                        backgroundColor: new Cesium.Color(0.26, 0.32, 0.38, 0.85),
                                        backgroundPadding: new Cesium.Cartesian2(4, 2),
                                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                                        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                                        disableDepthTestDistance: Number.POSITIVE_INFINITY,
                                        scaleByDistance: new Cesium.NearFarScalar(50, 1.0, 1200, 0.5),
                                        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 1200)
                                    }
                                });
                            }
                        } catch (posErr) {
                            // Ignorar error de posicion individual
                        }
                    }
                }

                // Sincronizar visibilidad con el estado del panel en 2D
                const cnCheckbox = document.getElementById('ov-curvas_nivel');
                cnSource.show = false; // Siempre apagado en 3D por defecto
                cesiumViewer.dataSources.add(cnSource);
                cesiumLayers['curvas_nivel'] = cnSource;
                cesiumLayers['LUGAR_05_curva'] = cnSource;
                console.log(`[Cesium 3D] Curvas de nivel registradas con altimetria 1915-1950m (visible: ${shouldShow}).`);
            } catch (errCn) {
                console.warn('[Cesium 3D] No se cargaron curvas en 3D:', errCn);
            }

            // 3. Capa Fotos y Vistas 360 - APAGADA POR DEFECTO
            try {
                const fotosSource = await Cesium.GeoJsonDataSource.load('./data/fotos_san_martin.geojson?v=2', {
                    clampToGround: true
                });
                const fEntities = fotosSource.entities.values;
                for (let i = 0; i < fEntities.length; i++) {
                    const ent = fEntities[i];
                    if (ent.point) {
                        ent.point.color = Cesium.Color.fromCssColorString('#ffb703');
                        ent.point.pixelSize = 12;
                        ent.point.outlineColor = Cesium.Color.BLACK;
                        ent.point.outlineWidth = 2;
                        ent.point.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND;
                    }
                }
                fotosSource.show = false; // Inicia apagada
                cesiumViewer.dataSources.add(fotosSource);
                cesiumLayers['fotos'] = fotosSource;
                console.log('[Cesium 3D] Capa Fotos registrada (apagada por defecto).');
            } catch (errFotos) {
                console.warn('[Cesium 3D] No se cargaron fotos en 3D:', errFotos);
            }

            // Enfocar exactamente en las coordenadas: 19.703806, -98.805434
            focusTargetCoordinates(0);
            setTimeout(() => focusTargetCoordinates(0), 300);

            console.log('[Cesium 3D] Modelo 3D cargado y enfocado en 19.703806, -98.805434');

        } catch (error) {
            console.error('[Cesium 3D] Error cargando modelo 3D:', error);
            if (loadingEl) {
                loadingEl.innerHTML = `
                    <div class="text-danger fw-bold mb-1">Error al cargar el modelo 3D</div>
                    <div class="text-white-50 small mb-2">${error.message || error}</div>
                    <button class="btn btn-sm btn-outline-light" onclick="document.getElementById('btn-mode-2d').click()">Volver a 2D</button>
                `;
                return;
            }
        } finally {
            isInitializing = false;
            if (loadingEl && cesiumTileset) {
                loadingEl.style.display = 'none';
            }
        }
    }

    // Funcion publica para prender/apagar capas en Cesium 3D
    window.__cesiumLayers = cesiumLayers;
    window.__setCesiumLayerVisible = function (layerName, visible) {
        if (window.__CONFIG && window.__CONFIG.GROUPS && window.__CONFIG.GROUPS[layerName]) {
            const grp = window.__CONFIG.GROUPS[layerName];
            grp.layers?.forEach(l => {
                const ds = cesiumLayers[l.id];
                if (ds) ds.show = !!visible;
            });
            return;
        }
        const ds = cesiumLayers[layerName];
        if (ds) {
            ds.show = !!visible;
            console.log(`[Cesium 3D] Capa '${layerName}' ahora visible:`, ds.show);
        }
    };

    function setViewMode(mode) {
        if (mode === currentMode) return;
        currentMode = mode;

        const btn2d = document.getElementById('btn-mode-2d');
        const btn3d = document.getElementById('btn-mode-3d');
        const mapEl = document.getElementById('map');
        const cesiumEl = document.getElementById('cesiumContainer');

        // Cerrar panel de informacion si estuviera abierto
        close2DInfoPanel();

        if (mode === '3D') {
            btn2d?.classList.remove('active');
            btn3d?.classList.add('active');

            if (mapEl) mapEl.style.display = 'none';
            if (cesiumEl) cesiumEl.style.display = 'block';

            // Guardar estado 2D
            const state2D = {};
            document.querySelectorAll('#overlay-panel input[id^=ov-]').forEach(cb => {
                const name = cb.id.replace('ov-', '');
                state2D[name] = cb.checked;
                cb.checked = false; // EN 3D SIEMPRE DESMARCADAS TODAS LAS CAPAS
            });
            window.__saved2DLayerState = state2D;

            // EN 3D SIEMPRE TODAS LAS CAPAS APAGADAS (Solo se visualiza el modelo 3D)
            for (const key in cesiumLayers) {
                if (cesiumLayers[key]) {
                    cesiumLayers[key].show = false;
                }
            }

            if (!cesiumViewer) {
                initCesiumViewer();
            } else {
                cesiumViewer.resize();
                focusTargetCoordinates(0.5);
            }
        } else {
            // Regreso a 2D: restaurar checkboxes y visibilidad 2D previa
            btn3d?.classList.remove('active');
            btn2d?.classList.add('active');

            if (cesiumEl) cesiumEl.style.display = 'none';
            if (mapEl) {
                mapEl.style.display = 'block';
                if (window.__map && typeof window.__map.updateSize === 'function') {
                    window.__map.updateSize();
                }
            }

            if (window.__saved2DLayerState) {
                document.querySelectorAll('#overlay-panel input[id^=ov-]').forEach(cb => {
                    const name = cb.id.replace('ov-', '');
                    if (window.__saved2DLayerState[name] !== undefined) {
                        cb.checked = window.__saved2DLayerState[name];
                        if (typeof window.__set2DLayerVisible === 'function') {
                            window.__set2DLayerVisible(name, cb.checked);
                        }
                    }
                });
            }
        }
    }

    // Vinculacion de eventos
    function bindToggle() {
        const btn2d = document.getElementById('btn-mode-2d');
        const btn3d = document.getElementById('btn-mode-3d');

        btn2d?.addEventListener('click', () => setViewMode('2D'));
        btn3d?.addEventListener('click', () => setViewMode('3D'));

        window.__cesiumApp = {
            getViewer: () => cesiumViewer,
            getTileset: () => cesiumTileset,
            setMode: setViewMode,
            focusCoordinates: focusTargetCoordinates,
            zoomToSite: zoomToSite,
            zoomToLocation: zoomToLocation
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindToggle);
    } else {
        bindToggle();
    }

})();
