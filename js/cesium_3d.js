// cesium_3d.js - Modulo de visualizacion 3D con CesiumJS
// Relleno Sanitario San Martin de las Piramides

(function () {
    'use strict';

    // Token de acceso a Cesium Ion provisto por el usuario
    Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2NDNjMzAxMS05NGVjLTQ1ZTktYjhjMy1lNDI3NjAwMDJhMjkiLCJpZCI6MTMyMTU4LCJpYXQiOjE2OTA1ODYzMTR9.6r-lijvfml1thVTi8KOI1DnP5vm_5OVjlK-ZKhpFEbI";
    const CESIUM_ASSET_ID = 5900012;

    // Coordenadas objetivo solicitadas: 19.703806, -98.805434
    const TARGET_LON = -98.805434;
    const TARGET_LAT = 19.703806;
    const TARGET_ALT = 2305.0; // Elevacion base

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

    function focusTargetCoordinates(duration = 1.0) {
        if (!cesiumViewer) return;
        
        try {
            const target = Cesium.Cartesian3.fromDegrees(TARGET_LON, TARGET_LAT, TARGET_ALT);
            const heading = Cesium.Math.toRadians(15.0); // Orientacion hacia el Norte-Nororiente
            const pitch = Cesium.Math.toRadians(-45.0);   // Inclinacion a 45 grados para perspectiva 3D
            const range = 500.0;                          // Distancia en metros

            // Posiciona la camara apuntando exactamente al punto especificado (19.703806, -98.805434)
            cesiumViewer.camera.lookAt(target, new Cesium.HeadingPitchRange(heading, pitch, range));
            cesiumViewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY); // Desbloquea la camara para orbitar libremente
            
            console.log(`[Cesium 3D] Camara fijada en (${TARGET_LAT}, ${TARGET_LON})`);
        } catch (e) {
            console.warn('[Cesium 3D] Error al posicionar camara:', e);
        }
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
                infoBox: false,
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

            // 2. Capa Curvas de Nivel (1.0m) - APAGADA POR DEFECTO
            try {
                const cnSource = await Cesium.GeoJsonDataSource.load('./data/curvas_nivel.geojson?v=2', {
                    clampToGround: true
                });
                const entities = cnSource.entities.values;
                for (let i = 0; i < entities.length; i++) {
                    const entity = entities[i];
                    const elev = entity.properties.elev ? entity.properties.elev.getValue() : 2300;
                    const ratio = Math.max(0, Math.min(1, (elev - 2300.0) / 16.0));
                    let col;
                    if (ratio < 0.25) col = Cesium.Color.fromCssColorString('#0077b6');
                    else if (ratio < 0.50) col = Cesium.Color.fromCssColorString('#06d6a0');
                    else if (ratio < 0.75) col = Cesium.Color.fromCssColorString('#ffd166');
                    else col = Cesium.Color.fromCssColorString('#d62828');
                    
                    if (entity.polyline) {
                        entity.polyline.material = col;
                        const isMaster = entity.properties.is_master && entity.properties.is_master.getValue();
                        entity.polyline.width = isMaster ? 2.5 : 1.2;
                    }
                }
                cnSource.show = false; // Inicia apagada
                cesiumViewer.dataSources.add(cnSource);
                cesiumLayers['curvas_nivel'] = cnSource;
                console.log('[Cesium 3D] Curvas de nivel registradas (apagadas por defecto).');
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

            // Guardar estado de las capas en 2D antes de apagar
            const state2D = {};
            document.querySelectorAll('#overlay-panel input[id^=ov-]').forEach(cb => {
                const name = cb.id.replace('ov-', '');
                state2D[name] = cb.checked;
                cb.checked = false; // En 3D inician apagadas para evitar saturacion
            });
            const flightCb = document.getElementById('toggle-flight-layer');
            if (flightCb) {
                state2D['vuelo'] = flightCb.checked;
                flightCb.checked = false;
            }
            window.__saved2DLayerState = state2D;

            // Asegurar que todas las capas 3D esten apagadas
            for (const key in cesiumLayers) {
                if (cesiumLayers[key]) cesiumLayers[key].show = false;
            }

            if (!cesiumViewer) {
                initCesiumViewer();
            } else {
                cesiumViewer.resize();
                focusTargetCoordinates(0.5);
            }
        } else {
            btn3d?.classList.remove('active');
            btn2d?.classList.add('active');

            if (cesiumEl) cesiumEl.style.display = 'none';
            if (mapEl) {
                mapEl.style.display = 'block';
                if (window.__map && typeof window.__map.updateSize === 'function') {
                    window.__map.updateSize();
                }
            }

            // Restaurar estado de capas en 2D
            if (window.__saved2DLayerState) {
                for (const [name, isChecked] of Object.entries(window.__saved2DLayerState)) {
                    const cb = document.getElementById('ov-' + name);
                    if (cb) {
                        cb.checked = isChecked;
                        const o = window.__overlays && window.__overlays[name];
                        if (o && o.layer) o.layer.setVisible(isChecked);
                        if (name === 'fotos' && window.__fotosLayer) {
                            window.__fotosLayer.setVisible(isChecked);
                        }
                    }
                }
                const flightCb = document.getElementById('toggle-flight-layer');
                if (flightCb && window.__saved2DLayerState['vuelo'] !== undefined) {
                    flightCb.checked = window.__saved2DLayerState['vuelo'];
                    if (window.__flightVectorLayer) {
                        window.__flightVectorLayer.setVisible(window.__saved2DLayerState['vuelo']);
                    }
                }
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
            focusCoordinates: focusTargetCoordinates
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindToggle);
    } else {
        bindToggle();
    }

})();
