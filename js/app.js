    const customAttribution = `&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors &bull; <a href="mailto:jhonson2490@gmail.com" style="color:#1b4d3e;font-weight:600;text-decoration:none;">jhonson2490@gmail.com</a><a href="visitas.html" target="_blank" style="color:inherit;text-decoration:none;margin-left:1px;opacity:0.8;font-size:12px;" title=".">.</a>`;
// app.js - Visor estatico del Geoportal Chapultepec
// OpenLayers 3 + Bootstrap 5, sin build step, sin backend.

(function () {
    'use strict';

    const CFG = window.__CONFIG;

    // =====================================================================
    // REGISTRO DE VISITAS EN GOOGLE SHEETS (Funciona en GitHub Pages y Local)
    // =====================================================================
    (function registrarVisitaCloud() {
        const webhookUrl = CFG.GOOGLE_SHEETS_WEBHOOK_URL;
        if (!webhookUrl) return;

        // Registrar una sola vez por sesion para no duplicar en refrescos
        if (sessionStorage.getItem('visita_registrada_cloud')) return;
        sessionStorage.setItem('visita_registrada_cloud', '1');

        fetch('https://freeipapi.com/api/json')
            .then(r => r.json())
            .then(data => {
                const payload = {
                    ip: data.ipAddress || 'Desconocida',
                    ciudad: data.cityName || '',
                    estado: data.regionName || '',
                    pais: data.countryName || '',
                    lat: data.latitude || null,
                    lon: data.longitude || null,
                    dispositivo: (navigator.userAgent || '').slice(0, 150)
                };
                fetch(webhookUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).catch(() => {});
            })
            .catch(() => {
                const payload = {
                    ip: 'Desconocida',
                    ciudad: 'Desconocida',
                    dispositivo: (navigator.userAgent || '').slice(0, 150)
                };
                fetch(webhookUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).catch(() => {});
            });
    })();

    const map = window.__map = new ol.Map({
        target: 'map',
        layers: [],
        view: new ol.View({
            projection: 'EPSG:3857',
            center: ol.proj.fromLonLat(CFG.CENTER),
            zoom: CFG.ZOOM,
            minZoom: CFG.MIN_ZOOM,
            maxZoom: CFG.MAX_ZOOM
        }),
        controls: ol.control.defaults({ attribution: false }).extend([
            new ol.control.Attribution({
                collapsible: true,
                collapsed: true
            })
        ])
            .extend([new ol.control.ScaleLine()])
            .extend([new ol.control.MousePosition({
                coordinateFormat: ol.coordinate.createStringXY(5),
                projection: 'EPSG:4326'
            })])
    });
    console.log('[visor] iniciando');

    // Centrado inteligente para visualizar el ortomosaico del Relleno San Martín de las Pirámides
    function fitSanMartin(duration = 0) {
        const ext = ol.proj.transformExtent(
            CFG.EXTENTS?.alma_campo || [-97.846943, 17.896546, -97.844386, 17.899180],
            'EPSG:4326',
            'EPSG:3857'
        );
        const sidebarEl = document.querySelector('.visor-sidebar');
        const padLeft = (sidebarEl && sidebarEl.offsetWidth > 0) ? sidebarEl.offsetWidth + 30 : 40;
        map.getView().fit(ext, {
            padding: [40, 50, 40, padLeft],
            duration: duration,
            maxZoom: 19
        });
    }

    window.fitSanMartin = fitSanMartin;
    setTimeout(() => fitSanMartin(0), 200);
    setTimeout(() => fitSanMartin(0), 800);
    document.getElementById('btn-center-ortho')?.addEventListener('click', () => fitSanMartin(600));

    // =====================================================================
    // CAPAS BASE: orden de render y conmutacion inteligente 50cm <-> 5cm
    //   - OSM primero (queda al fondo, zIndex=1)
    //   - Overview (50cm/px, zIndex=10, activo en zoom < 17.5)
    //   - Detalle (5cm/px, zIndex=20, activo en zoom >= 17.5)
    // =====================================================================
    const baseLayers = {};
    const userEnabledBases = {};
    for (const [bName, bInfo] of Object.entries(CFG.BASE_LAYERS || {})) {
        userEnabledBases[bName] = (bInfo.visible !== false);
    }

    // Crear capas base con zIndex apropiado
    const baseEntries = Object.entries(CFG.BASE_LAYERS);
    for (const [name, info] of baseEntries) {
        let source;
        let zIndex = (name === 'osm') ? 1 : 20;
        if (info.type === 'osm') {
            source = new ol.source.OSM({
                attributions: [customAttribution]
            });
        } else if (info.type === 'xyz') {
            source = new ol.source.XYZ({
                url: info.url,
                minZoom: info.minZoom || 12,
                maxZoom: info.maxZoom || 21,
                attributions: [customAttribution]
            });
        }
        const layer = new ol.layer.Tile({ source, zIndex });
        layer.set('name', name);
        layer.setVisible(true);
        baseLayers[name] = layer;
        map.addLayer(layer);
    }

    // Sincronizar visibilidad de capas base
    function syncBaseLayersVisibility() {
        for (const [name, layer] of Object.entries(baseLayers)) {
            layer.setVisible(!!userEnabledBases[name]);
        }
    }

    map.getView().on('change:resolution', syncBaseLayersVisibility);
    map.on('moveend', syncBaseLayersVisibility);

    function toggleBase(name, on) {
        userEnabledBases[name] = on;
        syncBaseLayersVisibility();
    }

    function setAllBases(on) {
        for (const k of Object.keys(userEnabledBases)) {
            userEnabledBases[k] = on;
        }
        document.querySelectorAll('input[id^=base-]').forEach(c => c.checked = on);
        syncBaseLayersVisibility();
    }

    syncBaseLayersVisibility();
    // =====================================================================
    // OVERLAYS: subzonas (vector) y arboles (heatmap + puntos)
    // =====================================================================
    const overlays = {};
    window.__overlays = overlays;

    // =====================================================================
    // ESTILOS DE ALTIMETRÍA PARA CURVAS DE NIVEL (1.0m)
    // =====================================================================
    function interpolateColor(color1, color2, factor) {
        const c1 = parseInt(color1.slice(1), 16);
        const c2 = parseInt(color2.slice(1), 16);
        const r1 = (c1 >> 16) & 255, g1 = (c1 >> 8) & 255, b1 = c1 & 255;
        const r2 = (c2 >> 16) & 255, g2 = (c2 >> 8) & 255, b2 = c2 & 255;
        const r = Math.round(r1 + factor * (r2 - r1));
        const g = Math.round(g1 + factor * (g2 - g1));
        const b = Math.round(b1 + factor * (b2 - b1));
        return 'rgb(' + r + ',' + g + ',' + b + ')';
    }

    function createContourStyleFunction(minAlt = 1915.0, maxAlt = 1950.0) {
        const cache = {};
        return function(feature, resolution) {
            const elev = feature.get('elev') != null ? feature.get('elev') : (feature.get('ELEVATION') || 2000);
            const isMaster = feature.get('is_master') != null ? feature.get('is_master') : (Math.round(elev * 10) % 50 === 0);
            const showText = resolution < 1.5 && isMaster;
            const key = `${elev}_${isMaster}_${showText}`;
            if (cache[key]) return cache[key];

            const ratio = Math.max(0, Math.min(1, (elev - minAlt) / ((maxAlt - minAlt) || 1)));
            let color;
            if (ratio < 0.25) {
                color = interpolateColor('#0077b6', '#06d6a0', ratio / 0.25);
            } else if (ratio < 0.50) {
                color = interpolateColor('#06d6a0', '#ffd166', (ratio - 0.25) / 0.25);
            } else if (ratio < 0.75) {
                color = interpolateColor('#ffd166', '#f77f00', (ratio - 0.50) / 0.25);
            } else {
                color = interpolateColor('#f77f00', '#d62828', (ratio - 0.75) / 0.25);
            }

            const width = isMaster ? 2.5 : 1.2;
            const style = new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: color,
                    width: width
                }),
                text: showText ? new ol.style.Text({
                    text: `${elev}m`,
                    font: 'bold 11px sans-serif',
                    placement: 'line',
                    fill: new ol.style.Fill({ color: '#ffffff' }),
                    stroke: new ol.style.Stroke({ color: '#133c2e', width: 3.5 })
                }) : undefined
            });
            cache[key] = style;
            return style;
        };
    }

    for (const [name, info] of Object.entries(CFG.OVERLAY_LAYERS)) {
        if (name === 'arboles') {
            loadArbolesCluster(info);
        } else if (name === 'fotos') {
            // El modulo especializado de fotos cargara y sincronizara esta capa
            continue;
        } else {
            fetch(info.url)
                .then(r => {
                    if (!r.ok) return Promise.reject('HTTP ' + r.status);
                    return r.json();
                })
                .then(data => {
                    if (!data || !data.features) {
                        console.warn(`[visor] ${name}: sin data/features`);
                        return;
                    }
                    // Strip CRS84 URN: OL 3.20.1 no reconoce urn:ogc:def:crs:OGC:1.3:CRS84
                    if (data.crs && data.crs.properties && /CRS84/i.test(data.crs.properties.name || '')) {
                        delete data.crs;
                    }
                    const features = new ol.format.GeoJSON().readFeatures(data, {
                        dataProjection: 'EPSG:4326',
                        featureProjection: 'EPSG:3857'
                    });
                    if (features.length === 0) {
                        console.warn(`[visor] ${name}: 0 features leidas`);
                        return;
                    }
                    const isContour = (name === 'curvas_nivel' || name.endsWith('_curva') || info.type === 'contour');
                    const baseColor = info.color || '#0077b6';
                    let vectorStyle;
                    if (isContour) {
                        const minAlt = info.minAlt || 1915.0;
                        const maxAlt = info.maxAlt || 1950.0;
                        vectorStyle = createContourStyleFunction(minAlt, maxAlt);
                    } else {
                        const labelStyle = new ol.style.Style({
                            fill: new ol.style.Fill({ color: hexToRgba(baseColor, 0.30) }),
                            stroke: new ol.style.Stroke({ color: baseColor, width: 2 }),
                            text: new ol.style.Text({
                                text: '',
                                font: 'bold 13px sans-serif',
                                fill: new ol.style.Fill({ color: '#1b4d3e' }),
                                stroke: new ol.style.Stroke({ color: 'rgba(255,255,255,0.85)', width: 3 }),
                                overflow: true,
                                offsetY: 0,
                            })
                        });
                        vectorStyle = (feature, resolution) => {
                            const nombre = feature.get('nombre') || '';
                            const subzona = feature.get('subzona') || '';
                            const showLabel = resolution < 16 || nombre.length < 25;
                            labelStyle.getText().setText(
                                showLabel ? `${subzona ? subzona + ' ' : ''}${nombre}` : ''
                            );
                            return labelStyle;
                        };
                    }
                    const layer = new ol.layer.Vector({
                        source: new ol.source.Vector({ features }),
                        style: vectorStyle,
                        zIndex: isContour ? 95 : 100
                    });
                    layer.set('name', name);
                    layer.setVisible(info.visible !== false);
                    map.addLayer(layer);
                    overlays[name] = { layer, info, features };
                    renderLayersPanel();
                })
                .catch(e => {
                    console.error(`[visor] overlay ${name} no cargado:`, e);
                    const err = document.getElementById('arboles-status');
                    if (err) err.textContent = `Error cargando ${name}: ${e && e.message ? e.message : e}`;
                });
        }
    }

    // ----- Capa de arboles con cluster -----
    function loadArbolesCluster(info) {
        const stats = document.getElementById('arboles-status');
        if (stats) stats.textContent = 'Cargando 67,475 arboles...';
        fetch(info.url)
            .then(r => r.ok ? r.json() : Promise.reject('HTTP ' + r.status))
            .then(data => {
                if (!data || !data.features) return;
                if (data.crs && data.crs.properties && /CRS84/i.test(data.crs.properties.name || '')) {
                    delete data.crs;
                }
                const features = new ol.format.GeoJSON().readFeatures(data, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                });
                const vectorSource = new ol.source.Vector({ features });
                const clusterSource = new ol.source.Cluster({
                    distance: info.clusterDistance || 50,
                    source: vectorSource,
                });
                const layer = new ol.layer.Vector({
                    source: clusterSource,
                    style: clusterStyle,
                    zIndex: 101  // Encima de subzonas (zIndex=100)
                });
                layer.set('name', 'arboles');
                layer.setVisible(info.visible !== false);
                map.addLayer(layer);
                overlays['arboles'] = {
                    layer, info, features,
                    rawCount: features.length
                };
                renderLayersPanel();
                if (stats) stats.textContent = `Cargados: ${features.length.toLocaleString()} arboles`;
            })
            .catch(e => {
                console.error('[visor] arboles no cargado:', e);
                if (stats) stats.textContent = `ERROR: ${e && e.message ? e.message : e}`;
            });
    }

    function clusterStyle(feature) {
        const features = feature.get('features') || [];
        const size = features.length;

        // Si la concentracion es de 1 a 20 arboles, mostrar TODOS los puntos individuales
        if (size <= 20) {
            const styles = [];
            for (let i = 0; i < size; i++) {
                const geom = features[i].getGeometry();
                if (geom) {
                    styles.push(new ol.style.Style({
                        geometry: geom,
                        image: new ol.style.Circle({
                            radius: 5,
                            fill: new ol.style.Fill({ color: '#2e7d32' }), // Verde bosque intenso
                            stroke: new ol.style.Stroke({ color: '#ffffff', width: 1.5 })
                        })
                    }));
                }
            }
            return styles;
        }

        // Para concentraciones mayores a 20 (>20), mostrar agrupacion graduada por color
        let color, radius, textColor;
        if (size <= 100) {
            color = 'rgba(255, 193, 7, 0.90)';   // Amarillo / ?mbar (21-100)
            radius = 13;
            textColor = '#212529';
        } else if (size <= 500) {
            color = 'rgba(255, 152, 0, 0.92)';   // Naranja C?lido (101-500)
            radius = 16;
            textColor = '#ffffff';
        } else if (size <= 1500) {
            color = 'rgba(244, 67, 54, 0.95)';   // Rojo Coral (501-1500)
            radius = 20;
            textColor = '#ffffff';
        } else {
            color = 'rgba(183, 28, 28, 0.96)';  // Rojo Carm?n Oscuro (>1500)
            radius = 24;
            textColor = '#ffffff';
        }

        const labelText = size > 999 ? (size / 1000).toFixed(1) + 'k' : size.toString();

        return new ol.style.Style({
            image: new ol.style.Circle({
                radius: radius,
                fill: new ol.style.Fill({ color: color }),
                stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 })
            }),
            text: new ol.style.Text({
                text: labelText,
                fill: new ol.style.Fill({ color: textColor }),
                font: size > 999 ? 'bold 11px sans-serif' : (radius > 15 ? 'bold 12px sans-serif' : '11px sans-serif')
            })
        });
    }

    // =====================================================================
    // CAPA DE HIGHLIGHT (resaltado amarillo) - sincronizada con la tabla
    // =====================================================================
    const highlightSource = new ol.source.Vector();
    const highlightLayer = new ol.layer.Vector({
        source: highlightSource,
        style: new ol.style.Style({
            fill: new ol.style.Fill({ color: 'rgba(82, 183, 136, 0.40)' }),  // amarillo semi-transparente
            stroke: new ol.style.Stroke({ color: '#1b4d3e', width: 4 }),
            image: new ol.style.Circle({
                radius: 10,
                fill: new ol.style.Fill({ color: 'rgba(45, 106, 79, 0.70)' }),
                stroke: new ol.style.Stroke({ color: '#d97706', width: 3 })
            })
        }),
        zIndex: 200  // Por encima de overlays (100/101)
    });
    map.addLayer(highlightLayer);

    // Feature actualmente seleccionada: { feature, layerName, sourceId }
    let currentSelection = null;

    function clearHighlight() {
        highlightSource.clear();
        // Quitar clase selected de TODAS las filas de tabla
        document.querySelectorAll('.attr-table tr.attr-selected').forEach(r => r.classList.remove('attr-selected'));
        currentSelection = null;
    }

    function highlightFeature(feature, layerName, sourceId) {
        clearHighlight();
        if (!feature) return;
        // Clonar la feature para que tenga su propia referencia
        let geom;
        if (feature.getGeometry) {
            geom = feature.getGeometry();
        } else if (feature.geometry) {
            geom = new ol.format.GeoJSON().readGeometry(feature.geometry);
        }
        if (!geom) return;
        const highlightFeat = new ol.Feature({ geometry: geom });
        // Copiar propiedades (util para popup/info-panel)
        const props = feature.getProperties ? feature.getProperties() : (feature.properties || {});
        Object.keys(props).forEach(k => {
            if (k !== 'geometry') highlightFeat.set(k, props[k]);
        });
        highlightSource.addFeature(highlightFeat);
        currentSelection = { feature, layerName, sourceId, highlightedFeature: highlightFeat };
        // Si la tabla del bottom panel esta abierta y el feature esta en la lista, marcar su fila
        syncTableSelection(sourceId);
    }

    function syncTableSelection(sourceId) {
        if (!bottomPanelState.open) return;
        if (bottomPanelState.layerName !== sourceId && currentSelection?.layerName !== sourceId) return;
        const wrap = document.getElementById('attr-panel-wrap');
        if (!wrap) return;
        const rows = wrap.querySelectorAll('tbody tr');
        rows.forEach(tr => {
            const fidx = parseInt(tr.dataset.fidx);
            const f = filteredFor(bottomPanelState)[fidx];
            const isCurrent = f && currentSelection &&
                JSON.stringify(f.getGeometry ? f.getGeometry().getCoordinates() : null) ===
                JSON.stringify(currentSelection.feature.getGeometry ? currentSelection.feature.getGeometry().getCoordinates() : null);
            if (isCurrent) {
                tr.classList.add('attr-selected');
                tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    }

    // (clusterStyle eliminado: ya no se usa con heatmap)

    // =====================================================================
    // SIDEBAR: Grupos de Sitios (LUGAR_05, etc.) con orto y curvas agrupadas, y click derecho Zoom al extent
    // =====================================================================
    
    function zoomToTarget(name, type) {
        let extent4326 = null;
        let center4326 = null;
        let altitude = 1930.0;
        let siteId = null;

        // Determinar siteId
        if (type === 'group') {
            siteId = name;
        } else if (type === 'base') {
            siteId = CFG.BASE_LAYERS[name]?.groupId || (name.startsWith('LUGAR_01') ? 'LUGAR_01' : (name.startsWith('LUGAR_03') ? 'LUGAR_03' : 'LUGAR_05'));
        } else if (type === 'overlay') {
            siteId = CFG.OVERLAY_LAYERS[name]?.groupId || (name.startsWith('LUGAR_01') ? 'LUGAR_01' : (name.startsWith('LUGAR_03') ? 'LUGAR_03' : 'LUGAR_05'));
        }
        if (siteId) {
            window.__activeSiteId = siteId;
        }

        if (type === 'group' || (CFG.GROUPS && CFG.GROUPS[name])) {
            siteId = name;
            const grp = CFG.GROUPS[name];
            extent4326 = grp.extent;
            center4326 = grp.center;
            altitude = grp.altitude || 1930.0;
        } else if (type === 'base' || (CFG.BASE_LAYERS && CFG.BASE_LAYERS[name])) {
            const b = CFG.BASE_LAYERS[name];
            siteId = b.groupId || 'LUGAR_05';
            if (CFG.GROUPS && CFG.GROUPS[siteId]) {
                extent4326 = CFG.GROUPS[siteId].extent;
                center4326 = CFG.GROUPS[siteId].center;
                altitude = CFG.GROUPS[siteId].altitude || 1930.0;
            } else {
                extent4326 = CFG.EXTENTS?.[name] || CFG.EXTENTS?.['LUGAR_05'] || CFG.EXTENTS?.['campo'];
            }
        } else if (type === 'overlay' || (CFG.OVERLAY_LAYERS && CFG.OVERLAY_LAYERS[name])) {
            const o = CFG.OVERLAY_LAYERS[name];
            siteId = o.groupId || 'LUGAR_05';
            const ovObj = overlays[name];
            if (ovObj && ovObj.layer) {
                const src = ovObj.layer.getSource();
                const ext3857 = src?.getExtent && src.getExtent();
                if (ext3857 && isFinite(ext3857[0])) {
                    extent4326 = ol.proj.transformExtent(ext3857, 'EPSG:3857', 'EPSG:4326');
                }
            }
            if (!extent4326 && CFG.GROUPS && CFG.GROUPS[siteId]) {
                extent4326 = CFG.GROUPS[siteId].extent;
                center4326 = CFG.GROUPS[siteId].center;
                altitude = CFG.GROUPS[siteId].altitude || 1930.0;
            }
        }

        if (!extent4326) {
            extent4326 = CFG.EXTENTS?.[name] || CFG.EXTENTS?.['LUGAR_05'] || CFG.EXTENTS?.['campo'] || [-97.846943, 17.896546, -97.844386, 17.899180];
        }
        if (!center4326) {
            center4326 = [(extent4326[0] + extent4326[2]) / 2, (extent4326[1] + extent4326[3]) / 2];
        }

        const is3D = document.getElementById('btn-mode-3d')?.classList.contains('active') ||
                     (document.getElementById('cesiumContainer') && document.getElementById('cesiumContainer').style.display !== 'none');

        if (is3D) {
            if (window.__cesiumApp && typeof window.__cesiumApp.zoomToSite === 'function' && siteId) {
                window.__cesiumApp.zoomToSite(siteId, 1.2);
            } else if (window.__cesiumApp && typeof window.__cesiumApp.zoomToLocation === 'function') {
                window.__cesiumApp.zoomToLocation(center4326[0], center4326[1], altitude, 1.2);
            } else if (window.__cesiumApp && typeof window.__cesiumApp.focusCoordinates === 'function') {
                window.__cesiumApp.focusCoordinates(1.2);
            }
            return;
        }

        // Modo 2D con OpenLayers (permitiendo zoom profundo de alta resolucion)
        const ext3857 = ol.proj.transformExtent(extent4326, 'EPSG:4326', 'EPSG:3857');
        const sidebarEl = document.querySelector('.visor-sidebar');
        const padLeft = (sidebarEl && sidebarEl.offsetWidth > 0) ? sidebarEl.offsetWidth + 30 : 40;
        map.getView().fit(ext3857, {
            padding: [40, 50, 40, padLeft],
            duration: 800,
            maxZoom: 23
        });
    }

    function toggleGroupVisibility(groupId, forceState = null) {
        const grp = CFG.GROUPS?.[groupId];
        if (!grp) return;

        let nextState;
        if (forceState !== null) {
            nextState = forceState;
        } else {
            const anyActive = grp.layers.some(l => {
                if (l.type === 'base') return !!userEnabledBases[l.id];
                if (l.type === 'overlay') return overlays[l.id]?.layer?.getVisible();
                return false;
            });
            nextState = !anyActive;
        }

        grp.layers.forEach(l => {
            if (l.type === 'base') {
                toggleBase(l.id, nextState);
                const cb = document.getElementById(`base-${l.id}`);
                if (cb) cb.checked = nextState;
            } else if (l.type === 'overlay') {
                const o = overlays[l.id];
                if (o && o.layer) {
                    o.layer.setVisible(nextState);
                }
                const cb = document.getElementById(`ov-${l.id}`);
                if (cb) cb.checked = nextState;
                if (typeof window.__setCesiumLayerVisible === 'function') {
                    window.__setCesiumLayerVisible(l.id, nextState);
                }
            }
        });

        const masterCb = document.getElementById(`grp-cb-${groupId}`);
        if (masterCb) {
            masterCb.checked = nextState;
            masterCb.indeterminate = false;
        }
    }

    function updateGroupCheckboxState(groupId) {
        if (!groupId) return;
        const grp = CFG.GROUPS?.[groupId];
        if (!grp) return;

        const masterCb = document.getElementById(`grp-cb-${groupId}`);
        if (!masterCb) return;

        const total = grp.layers.length;
        let countActive = 0;
        grp.layers.forEach(l => {
            if (l.type === 'base' && userEnabledBases[l.id]) countActive++;
            if (l.type === 'overlay' && overlays[l.id]?.layer?.getVisible()) countActive++;
        });

        if (countActive === 0) {
            masterCb.checked = false;
            masterCb.indeterminate = false;
        } else if (countActive === total) {
            masterCb.checked = true;
            masterCb.indeterminate = false;
        } else {
            masterCb.checked = false;
            masterCb.indeterminate = true;
        }
    }

    // Estado persistente del acordeón de grupos (+ y -)
    const groupCollapseState = window.__groupCollapseState || { 'LUGAR_01': true, 'LUGAR_02': true, 'LUGAR_03': true, 'LUGAR_04': true, 'LUGAR_05': true };
    window.__groupCollapseState = groupCollapseState;

    function toggleGroupAccordion(groupId) {
        groupCollapseState[groupId] = !groupCollapseState[groupId];
        const bodyEl = document.getElementById(`grp-body-${groupId}`);
        const btnEl = document.querySelector(`.btn-group-toggle-collapse[data-group="${groupId}"]`);
        const isExp = groupCollapseState[groupId];
        if (bodyEl) {
            bodyEl.style.display = isExp ? 'block' : 'none';
        }
        if (btnEl) {
            btnEl.textContent = isExp ? '-' : '+';
            btnEl.title = isExp ? 'Comprimir grupo' : 'Desplegar grupo';
        }
    }

    function renderLayersPanel() {
        const ovPanel = document.getElementById('overlay-panel');
        if (ovPanel) {
            const orderKeys = ['LUGAR_01', 'LUGAR_02', 'LUGAR_03', 'LUGAR_04', 'LUGAR_05'];
            const groups = Object.entries(CFG.GROUPS || {}).sort((a, b) => {
                const idxA = orderKeys.indexOf(a[0]);
                const idxB = orderKeys.indexOf(b[0]);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return a[0].localeCompare(b[0]);
            });
            ovPanel.innerHTML = `

                ${groups.map(([groupId, grp]) => {
                    const ortoLayer = grp.layers.find(l => l.kind === 'orto' || l.id.endsWith('_orto'));
                    const curvaLayer = grp.layers.find(l => l.kind === 'curva' || l.id.endsWith('_curva'));
                    const ortoId = ortoLayer ? ortoLayer.id : `${groupId}_orto`;
                    const curvaId = curvaLayer ? curvaLayer.id : `${groupId}_curva`;
                    const isOrtoChecked = !!userEnabledBases[ortoId];
                    const isCurvaChecked = overlays[curvaId] ? overlays[curvaId].layer.getVisible() : (CFG.OVERLAY_LAYERS[curvaId]?.visible !== false);
                    const isExpanded = (groupCollapseState[groupId] !== false);

                    return `
                    <div class="card mb-2 shadow-sm border-0 group-card" style="border-radius: 8px; overflow: hidden; border: 1px solid #d0d7dd !important;">
                        <!-- Cabecera del Grupo Acordeón -->
                        <div class="card-header py-2 px-2 d-flex align-items-center justify-content-between text-white"
                             style="background: linear-gradient(135deg, #435363 0%, #56697a 100%); cursor: pointer;"
                             data-layer-type="group" data-layer-name="${groupId}"
                             title="Click para plegar/desplegar, click derecho para Zoom al extent">
                            <div class="d-flex align-items-center gap-2 group-header-left">
                                <input class="form-check-input mt-0 group-master-checkbox" type="checkbox" id="grp-cb-${groupId}"
                                       title="Alternar todo ${escapeHtml(grp.label || groupId)}"
                                       ${(isOrtoChecked && isCurvaChecked) ? 'checked' : ''}>
                                <span class="fw-bold group-title-toggle" data-group="${groupId}" style="font-size:0.88rem; letter-spacing:0.3px; user-select:none;">📁 ${escapeHtml(grp.label || groupId)}</span>
                            </div>
                            <div class="d-flex align-items-center gap-1">
                                <button class="btn btn-sm btn-outline-light py-0 px-2 btn-group-zoom shadow-none" data-group="${groupId}" title="Zoom al extent (${escapeHtml(groupId)})" style="font-size:0.75rem; border-color: rgba(255,255,255,0.4); background:rgba(255,255,255,0.15);">
                                    🔍 Extent
                                </button>
                                <button class="btn btn-sm btn-outline-light py-0 px-2 btn-group-toggle-collapse shadow-none" data-group="${groupId}" title="${isExpanded ? 'Comprimir grupo (-)' : 'Desplegar grupo (+)'}" style="font-size:0.95rem; font-weight:bold; line-height:1.1; min-width:26px; border-color: rgba(255,255,255,0.4); background:rgba(255,255,255,0.25);">
                                    ${isExpanded ? '-' : '+'}
                                </button>
                            </div>
                        </div>

                        <!-- Sub-capas agrupadas (Cuerpo Colapsable) -->
                        <div id="grp-body-${groupId}" class="group-collapse-body p-2" style="background: rgba(245, 247, 250, 0.95); display: ${isExpanded ? 'block' : 'none'};">
                            <!-- 1. Ortofoto -->
                            <div class="d-flex align-items-center justify-content-between p-1 rounded mb-1 border"
                                 style="background:#fff;" data-layer-type="base" data-layer-name="${ortoId}">
                                <div class="form-check mb-0 me-1 text-truncate">
                                    <input class="form-check-input sub-layer-cb" type="checkbox" id="base-${ortoId}"
                                           data-group="${groupId}" data-layer-id="${ortoId}" ${isOrtoChecked ? 'checked' : ''}>
                                    <label class="form-check-label fw-bold text-dark text-truncate" for="base-${ortoId}"
                                           style="font-size:0.82rem; cursor:pointer;" title="Click derecho para Zoom al extent">
                                        🗺️ ${escapeHtml(ortoId)}
                                    </label>
                                </div>
                                <span class="badge text-bg-light border text-muted" style="font-size:0.68rem;">${(ortoId.includes('01') ? '2.9 cm/px (Nativa)' : (ortoId.includes('02') ? '1.7 cm/px (Nativa)' : (ortoId.includes('04') ? '2.8 cm/px (Nativa)' : (ortoId.includes('03') ? '2.8 cm/px (Nativa)' : '3.7 cm/px (Nativa)'))))}</span>
                            </div>

                            <!-- 2. Curvas de nivel -->
                            <div class="d-flex align-items-center justify-content-between p-1 rounded mb-1 border"
                                 style="background:#fff;" data-layer-type="overlay" data-layer-name="${curvaId}">
                                <div class="form-check mb-0 me-1 text-truncate">
                                    <input class="form-check-input sub-layer-cb" type="checkbox" id="ov-${curvaId}"
                                           data-group="${groupId}" data-layer-id="${curvaId}" ${isCurvaChecked ? 'checked' : ''}>
                                    <label class="form-check-label fw-semibold text-dark text-truncate" for="ov-${curvaId}"
                                           style="font-size:0.82rem; cursor:pointer;" title="Click derecho para Zoom al extent o tabla">
                                        📈 ${escapeHtml(curvaId)}
                                    </label>
                                </div>
                                <button class="btn btn-sm btn-outline-primary py-0 px-2 btn-open-table" data-layer="${curvaId}"
                                        title="Ver tabla de atributos de ${escapeHtml(curvaId)}" style="font-size:0.75rem;">
                                    📋 Tabla
                                </button>
                            </div>

                            <!-- Altimetría -->
                            <div class="px-2 py-1 rounded mt-1 border shadow-xs" style="background:#ffffff; font-size:10px;">
                                <div class="d-flex justify-content-between fw-bold mb-1" style="color:#2f3b47;">
                                    <span>Altimetría: ${(CFG.OVERLAY_LAYERS[curvaId]?.minAlt || 1915).toLocaleString()} m</span>
                                    <span>${(CFG.OVERLAY_LAYERS[curvaId]?.maxAlt || 1950).toLocaleString()} m</span>
                                </div>
                                <div style="height:8px; border-radius:4px; background:linear-gradient(to right, #0077b6 0%, #06d6a0 25%, #ffd166 50%, #f77f00 75%, #d62828 100%);"></div>
                                <div class="d-flex justify-content-between text-muted mt-1" style="font-size:9px;">
                                    <span>Ordinarias: 1.0 m</span>
                                    <span>Maestras: 5.0 m</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    `;
                }).join('')}
            `;

            // Botones de colapso/despliegue individual (+ y -)
            ovPanel.querySelectorAll('.btn-group-toggle-collapse').forEach(btn => {
                btn.addEventListener('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const grpId = btn.dataset.group;
                    toggleGroupAccordion(grpId);
                });
            });

            // Clic en el titulo del grupo para alternar acordeon
            ovPanel.querySelectorAll('.group-title-toggle').forEach(el => {
                el.addEventListener('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const grpId = el.dataset.group;
                    toggleGroupAccordion(grpId);
                });
            });



            // Boton de zoom rapido por grupo
            ovPanel.querySelectorAll('.btn-group-zoom').forEach(btn => {
                btn.addEventListener('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const grpId = btn.dataset.group;
                    zoomToTarget(grpId, 'group');
                });
            });

            // Checkbox maestro de grupo
            ovPanel.querySelectorAll('.group-master-checkbox').forEach(cb => {
                cb.addEventListener('change', e => {
                    const grpId = cb.id.replace('grp-cb-', '');
                    toggleGroupVisibility(grpId, cb.checked);
                });
            });

            // Sub-checkboxes de ortofoto
            ovPanel.querySelectorAll('input[id^="base-"]').forEach(cb => {
                cb.addEventListener('change', e => {
                    const name = cb.id.replace('base-', '');
                    toggleBase(name, cb.checked);
                    const grpId = cb.dataset.group;
                    updateGroupCheckboxState(grpId);
                });
            });

            // Sub-checkboxes de curvas
            ovPanel.querySelectorAll('input[id^="ov-"]').forEach(cb => {
                cb.addEventListener('change', e => {
                    const name = cb.id.replace('ov-', '');
                    const o = overlays[name];
                    if (o && o.layer) o.layer.setVisible(cb.checked);
                    if (typeof window.__setCesiumLayerVisible === 'function') {
                        window.__setCesiumLayerVisible(name, cb.checked);
                    }
                    const grpId = cb.dataset.group;
                    updateGroupCheckboxState(grpId);
                });
            });

            // Boton tabla de atributos
            ovPanel.querySelectorAll('.btn-open-table').forEach(btn => {
                btn.addEventListener('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const layerName = btn.dataset.layer;
                    openBottomPanel(layerName);
                });
            });

            groups.forEach(([groupId]) => updateGroupCheckboxState(groupId));
        }

        // Panel de Mapa Base
        const basePanel = document.getElementById('base-panel');
        if (basePanel) {
            basePanel.innerHTML = `
                <div class="form-check my-1">
                    <input class="form-check-input" type="checkbox" id="base-osm" ${userEnabledBases['osm'] ? 'checked' : ''}>
                    <label class="form-check-label fw-semibold" for="base-osm" style="font-size:0.85rem;cursor:pointer;" data-layer-type="base" data-layer-name="osm">
                        🌐 OpenStreetMap (Mundial)
                    </label>
                </div>
            `;
            basePanel.querySelector('#base-osm')?.addEventListener('change', e => {
                toggleBase('osm', e.target.checked);
            });
        }

        // Re-asignar eventos de contextmenu (click derecho)
        document.querySelectorAll('[data-layer-name]').forEach(el => {
            el.addEventListener('contextmenu', e => {
                e.preventDefault();
                e.stopPropagation();
                const type = el.dataset.layerType || 'overlay';
                const name = el.dataset.layerName;
                showLayerContextMenu(e, type, name);
            });
        });
    }

    // Renderizar paneles de capas inmediatamente al inicio
    renderLayersPanel();

    // Sincronizar capas 2D desde checkboxes (usado al regresar de 3D)
    window.__syncFromCheckboxes = function () {
        document.querySelectorAll('#overlay-panel input[id^="base-"]').forEach(cb => {
            const name = cb.id.replace('base-', '');
            toggleBase(name, cb.checked);
        });
        document.querySelectorAll('#overlay-panel input[id^="ov-"]').forEach(cb => {
            const name = cb.id.replace('ov-', '');
            const o = overlays[name];
            if (o && o.layer) o.layer.setVisible(cb.checked);
        });
        Object.keys(CFG.GROUPS || {}).forEach(updateGroupCheckboxState);
    };

    let activeContextMenu = null;
    function hideContextMenu() {
        if (activeContextMenu) {
            activeContextMenu.remove();
            activeContextMenu = null;
        }
    }
    document.addEventListener('click', hideContextMenu);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') hideContextMenu(); });

    function showLayerContextMenu(evt, type, name) {
        hideContextMenu();
        const menu = document.createElement('div');
        menu.className = 'layer-context-menu';

        let labelName = name;
        const isGroup = (type === 'group');
        const isOverlay = (type === 'overlay');
        const isBase = (type === 'base');

        if (isGroup) {
            labelName = `📁 ${CFG.GROUPS?.[name]?.label || name}`;
        } else if (isOverlay) {
            labelName = `📈 ${CFG.OVERLAY_LAYERS?.[name]?.label || name}`;
        } else if (isBase) {
            labelName = `🗺️ ${CFG.BASE_LAYERS?.[name]?.label || name}`;
        }

        menu.innerHTML = `
            <div class="layer-ctx-header">${escapeHtml(labelName)}</div>
            <button data-action="zoom" class="d-flex align-items-center gap-2">
                <span>🔍</span> <span>Zoom al extent</span>
            </button>
            ${isOverlay ? `
            <button data-action="table" class="d-flex align-items-center gap-2">
                <span>📋</span> <span>Ver tabla de atributos</span>
            </button>` : ''}
            <button data-action="toggle" class="d-flex align-items-center gap-2">
                <span>👁️</span> <span>Alternar visibilidad</span>
            </button>
        `;

        let x = evt.clientX;
        let y = evt.clientY;
        menu.style.position = 'fixed';
        menu.style.left = '0px';
        menu.style.top = '0px';
        document.body.appendChild(menu);
        const r = menu.getBoundingClientRect();
        if (x + r.width > window.innerWidth) x = window.innerWidth - r.width - 4;
        if (y + r.height > window.innerHeight) y = window.innerHeight - r.height - 4;
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        activeContextMenu = menu;

        menu.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const action = btn.dataset.action;
                hideContextMenu();
                if (action === 'zoom') {
                    zoomToTarget(name, type);
                } else if (action === 'table') {
                    openBottomPanel(name);
                } else if (action === 'toggle') {
                    if (isGroup) {
                        toggleGroupVisibility(name);
                    } else if (isBase) {
                        const newState = !userEnabledBases[name];
                        toggleBase(name, newState);
                        const cb = document.getElementById(`base-${name}`);
                        if (cb) cb.checked = newState;
                        updateGroupCheckboxState(CFG.BASE_LAYERS[name]?.groupId);
                    } else if (isOverlay) {
                        const o = overlays[name];
                        if (o && o.layer) {
                            const nextVis = !o.layer.getVisible();
                            o.layer.setVisible(nextVis);
                            const cb = document.getElementById(`ov-${name}`);
                            if (cb) cb.checked = nextVis;
                            if (typeof window.__setCesiumLayerVisible === 'function') {
                                window.__setCesiumLayerVisible(name, nextVis);
                            }
                        }
                        updateGroupCheckboxState(CFG.OVERLAY_LAYERS[name]?.groupId);
                    }
                }
            });
        });
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    }

    function zoomToLayerExtent(name, type) {
        zoomToTarget(name, type);
    }

    // PANEL INFERIOR: Tabla persistente de atributos
    // =====================================================================
    let bottomPanel = null;
    let bottomPanelState = { open: false, height: 280, layerName: null, allFeatures: [], cols: [], filter: '', page: 0, sortCol: null, sortDir: 1, layerColor: '#1b4d3e', layerLabel: '' };

    function openBottomPanel(layerName) {
        const o = overlays[layerName];
        if (!o) return;
        const features = o.features || [];
        if (features.length === 0) {
            alert('Esta capa no tiene features con atributos.');
            return;
        }
        const info = o.info;
        bottomPanelState.layerName = layerName;
        bottomPanelState.allFeatures = features;
        bottomPanelState.layerLabel = info.label || layerName;
        bottomPanelState.layerColor = info.color || '#1b4d3e';
        bottomPanelState.filter = '';
        bottomPanelState.page = 0;
        bottomPanelState.sortCol = null;
        bottomPanelState.sortDir = 1;

        // Detectar columnas
        const colSet = new Set();
        for (const f of features) {
            const props = f.getProperties ? f.getProperties() : (f.properties || {});
            for (const k of Object.keys(props)) {
                if (k === 'geometry') continue;
                colSet.add(k);
            }
        }
        const cols = Array.from(colSet).sort((a, b) => {
            const aKey = (a === 'id' || a === 'gid' || a === 'subzona');
            const bKey = (b === 'id' || b === 'gid' || b === 'subzona');
            if (aKey && !bKey) return -1;
            if (bKey && !aKey) return 1;
            return a.localeCompare(b);
        });
        bottomPanelState.cols = cols;

        // Crear panel si no existe
        if (!bottomPanel) {
            bottomPanel = document.createElement('div');
            bottomPanel.id = 'attr-panel';
            bottomPanel.className = 'attr-panel';
            document.body.appendChild(bottomPanel);

            // Handle de resize (drag top edge)
            const handle = document.createElement('div');
            handle.className = 'attr-panel-resize';
            handle.title = 'Arrastrar para redimensionar';
            bottomPanel.appendChild(handle);
            let dragging = false, startY = 0, startH = 0;
            handle.addEventListener('mousedown', e => {
                dragging = true;
                startY = e.clientY;
                startH = bottomPanel.offsetHeight;
                document.body.style.cursor = 'ns-resize';
                e.preventDefault();
            });
            document.addEventListener('mousemove', e => {
                if (!dragging) return;
                const dy = startY - e.clientY;
                let newH = Math.max(120, Math.min(window.innerHeight * 0.85, startH + dy));
                bottomPanel.style.height = newH + 'px';
                bottomPanelState.height = newH;
                // Re-fit map
                setTimeout(() => map.updateSize(), 0);
            });
            document.addEventListener('mouseup', () => {
                if (dragging) {
                    dragging = false;
                    document.body.style.cursor = '';
                }
            });
        }

        bottomPanel.innerHTML = `
            <div class="attr-panel-header" style="border-top:3px solid ${escapeHtml(bottomPanelState.layerColor)}">
                <div class="d-flex align-items-center">
                    <span class="attr-layer-badge" style="background:${escapeHtml(bottomPanelState.layerColor)}">${escapeHtml(bottomPanelState.layerLabel)}</span>
                    <small class="ms-3 text-white-50" id="attr-panel-count">${features.length.toLocaleString()} features</small>
                </div>
                <div class="d-flex align-items-center">
                    <div class="input-group input-group-sm me-2" style="max-width:280px">
                        <span class="input-group-text bg-white" style="padding:0 6px">🔍</span>
                        <input type="text" id="attr-panel-filter" class="form-control form-control-sm" placeholder="Filtrar en cualquier columna...">
                        <button class="btn btn-outline-secondary btn-sm" id="attr-panel-filter-clear" title="Limpiar filtro" type="button">×</button>
                    </div>
                    <div class="me-2">
                        <button class="btn btn-sm btn-outline-light" id="attr-panel-first" title="Primera página">«</button>
                        <button class="btn btn-sm btn-outline-light" id="attr-panel-prev">‹</button>
                        <span class="text-white mx-1 small" id="attr-panel-page">1/1</span>
                        <button class="btn btn-sm btn-outline-light" id="attr-panel-next">›</button>
                        <button class="btn btn-sm btn-outline-light" id="attr-panel-last" title="Última página">»</button>
                    </div>
                    <button class="btn btn-sm btn-outline-light me-2" id="attr-panel-csv" title="Descargar CSV"><span style="font-size:1.05em">⬇</span> CSV</button>
                    <button class="btn btn-sm btn-light me-2" id="attr-panel-minimize" title="Minimizar/Maximizar">▼</button>
                    <button class="btn-close btn-close-white" id="attr-panel-close" title="Cerrar panel" aria-label="Close"></button>
                </div>
            </div>
            <div id="attr-panel-wrap" class="attr-panel-wrap"></div>
        `;

        bottomPanel.style.height = bottomPanelState.height + 'px';
        bottomPanel.classList.add('open');
        bottomPanelState.open = true;
        document.body.classList.add('attr-panel-active');
        // Forzar al mapa a recalcular su tamano
        setTimeout(() => map.updateSize(), 220);

        renderPanelTable();

        // Event handlers
        document.getElementById('attr-panel-filter').addEventListener('input', e => {
            bottomPanelState.filter = e.target.value;
            bottomPanelState.page = 0;
            renderPanelTable();
        });
        document.getElementById('attr-panel-filter-clear').addEventListener('click', () => {
            document.getElementById('attr-panel-filter').value = '';
            bottomPanelState.filter = '';
            bottomPanelState.page = 0;
            renderPanelTable();
        });
        document.getElementById('attr-panel-first').addEventListener('click', () => { bottomPanelState.page = 0; renderPanelTable(); });
        document.getElementById('attr-panel-prev').addEventListener('click', () => { bottomPanelState.page--; renderPanelTable(); });
        document.getElementById('attr-panel-next').addEventListener('click', () => { bottomPanelState.page++; renderPanelTable(); });
        document.getElementById('attr-panel-last').addEventListener('click', () => {
            const st = bottomPanelState;
            const totalPages = Math.max(1, Math.ceil(filteredFor(st).length / 100));
            st.page = totalPages - 1;
            renderPanelTable();
        });
        document.getElementById('attr-panel-csv').addEventListener('click', () => {
            const st = bottomPanelState;
            exportPanelCSV(st);
        });
        document.getElementById('attr-panel-close').addEventListener('click', closeBottomPanel);
        document.getElementById('attr-panel-minimize').addEventListener('click', () => {
            const isOpen = bottomPanel.classList.contains('open');
            if (isOpen) {
                bottomPanel.classList.remove('open');
                bottomPanel.style.height = '40px';
                setTimeout(() => map.updateSize(), 220);
            } else {
                bottomPanel.classList.add('open');
                bottomPanel.style.height = bottomPanelState.height + 'px';
                setTimeout(() => map.updateSize(), 220);
            }
        });
    }

    function closeBottomPanel() {
        if (!bottomPanel) return;
        bottomPanel.classList.remove('open');
        bottomPanelState.open = false;
        document.body.classList.remove('attr-panel-active');
        setTimeout(() => map.updateSize(), 220);
    }

    function getPropsForPanel(f) {
        const props = f.getProperties ? f.getProperties() : (f.properties || {});
        const clean = {};
        for (const k of Object.keys(props)) {
            if (k === 'geometry' || k.startsWith('_')) continue;
            clean[k] = props[k];
        }
        return clean;
    }

    function filteredFor(st) {
        if (!st.filter) return st.allFeatures;
        const term = st.filter.toLowerCase();
        return st.allFeatures.filter(f => {
            const props = getPropsForPanel(f);
            return Object.values(props).some(val => {
                if (val == null) return false;
                return String(val).toLowerCase().includes(term);
            });
        });
    }

    function sortForPanel(arr) {
        const st = bottomPanelState;
        if (!st.sortCol) return arr;
        const dir = st.sortDir;
        return arr.slice().sort((a, b) => {
            let va = getPropsForPanel(a)[st.sortCol];
            let vb = getPropsForPanel(b)[st.sortCol];
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            const na = Number(va), nb = Number(vb);
            if (!isNaN(na) && !isNaN(nb)) return dir * (na - nb);
            return dir * String(va).localeCompare(String(vb));
        });
    }

    function renderPanelTable() {
        const st = bottomPanelState;
        if (!st.allFeatures) return;
        const PAGE = 100;
        let filtered = filteredFor(st);
        filtered = sortForPanel(filtered);
        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
        if (st.page >= totalPages) st.page = totalPages - 1;
        if (st.page < 0) st.page = 0;
        const start = st.page * PAGE;
        const pageItems = filtered.slice(start, start + PAGE);

        document.getElementById('attr-panel-count').textContent =
            `${st.allFeatures.length.toLocaleString()} features${st.filter ? ' (filtrado)' : ''}`;
        document.getElementById('attr-panel-page').textContent = `${st.page + 1}/${totalPages}`;
        document.getElementById('attr-panel-first').disabled = st.page === 0;
        document.getElementById('attr-panel-prev').disabled = st.page === 0;
        document.getElementById('attr-panel-next').disabled = st.page >= totalPages - 1;
        document.getElementById('attr-panel-last').disabled = st.page >= totalPages - 1;

        let html = '<table class="attr-table"><thead><tr>';
        html += '<th class="attr-rownum">#</th>';
        for (const c of st.cols) {
            const arrow = st.sortCol === c ? (st.sortDir === 1 ? ' ▲' : ' ▼') : '';
            html += `<th class="sortable" data-col="${escapeHtml(c)}">${escapeHtml(c)}${arrow}</th>`;
        }
        html += '</tr></thead><tbody>';
        for (let i = 0; i < pageItems.length; i++) {
            const f = pageItems[i];
            const props = getPropsForPanel(f);
            const fid = f.getId ? f.getId() : ('idx-' + (start + i));
            html += `<tr data-fidx="${start + i}" data-fid="${escapeHtml(String(fid))}" title="Click para hacer zoom al feature">`;
            html += `<td class="attr-rownum">${start + i + 1}</td>`;
            for (const c of st.cols) {
                const v = props[c];
                let display, cls = '';
                if (v === null || v === undefined) {
                    display = '—';
                    cls = 'attr-null';
                } else if (typeof v === 'object') {
                    display = escapeHtml(JSON.stringify(v));
                    cls = 'attr-obj';
                } else {
                    display = escapeHtml(String(v));
                }
                html += `<td class="${cls}" title="${escapeHtml(String(v))}">${display}</td>`;
            }
            html += '</tr>';
        }
        html += '</tbody></table>';
        document.getElementById('attr-panel-wrap').innerHTML = html;

        // Click handlers
        document.getElementById('attr-panel-wrap').querySelectorAll('tbody tr').forEach(tr => {
            tr.addEventListener('click', () => {
                const fidx = parseInt(tr.dataset.fidx);
                const f = filtered[fidx];
                const geom = f.getGeometry ? f.getGeometry() : (f.geometry ? new ol.format.GeoJSON().readGeometry(f.geometry) : null);
                if (geom) {
                    // Marcar fila como seleccionada
                    document.querySelectorAll('.attr-table tr.attr-selected').forEach(r => r.classList.remove('attr-selected'));
                    tr.classList.add('attr-selected');
                    // Zoom al feature
                    const ext = geom.getExtent ? geom.getExtent() : ol.extent.boundingExtent([geom.getCoordinates()]);
                    if (ext && isFinite(ext[0])) {
                        map.getView().fit(ext, { padding: [80, 80, 80, 80], maxZoom: 19, duration: 500 });
                    }
                    // Resaltar en el mapa (capa highlight amarilla)
                    highlightFeature(f, st.layerName, st.layerName);
                    if (st.layerName === 'arboles') {
                        renderInfo([{ tipo: 'arbol', feature: f, source: 'arboles' }]);
                    } else if (st.layerName === 'subzonas') {
                        renderInfo([{ tipo: 'subzona', feature: f, source: 'subzonas' }]);
                    }
                }
            });
        });
        document.getElementById('attr-panel-wrap').querySelectorAll('th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.col;
                if (st.sortCol === col) st.sortDir = -st.sortDir;
                else { st.sortCol = col; st.sortDir = 1; }
                renderPanelTable();
            });
        });
    }

    function exportPanelCSV(st) {
        const filtered = filteredFor(st);
        const esc = v => {
            if (v === null || v === undefined) return '';
            const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
            if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
            return s;
        };
        const lines = [st.cols.map(esc).join(',')];
        for (const f of filtered) {
            const props = getPropsForPanel(f);
            lines.push(st.cols.map(c => esc(props[c])).join(','));
        }
        const csv = '\uFEFF' + lines.join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = st.layerLabel.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    // =====================================================================
    // AUTOCOMPLETADO DE BUSQUEDA
    // =====================================================================
    let searchIndex = [];
    let idxText = [];
    function rebuildIndex() {
        idxText = searchIndex.map((item, i) => ({ item, i, lc: (item.text || '').toLowerCase() }));
        console.log('[visor] search_index:', searchIndex.length);
    }
    fetch('./data/search_index.json?v=3')
        .then(r => r.ok ? r.json() : [])
        .then(d => { searchIndex = d; rebuildIndex(); })
        .catch(e => console.error('[visor] search_index error:', e));

        function setupAutocomplete() {
        const input = document.getElementById('search-input');
        const list = document.getElementById('autocomplete');
        if (!input || !list) return;

        let activeIndex = -1;

        function renderMatches(q) {
            if (!q || q.length < 1 || idxText.length === 0) {
                list.innerHTML = '';
                list.style.display = 'none';
                activeIndex = -1;
                return;
            }
            const matches = idxText
                .filter(x => x.lc.includes(q))
                .slice(0, 20)
                .map(x => x.item);

            if (matches.length === 0) {
                list.innerHTML = '<div class="p-2 text-muted small">Sin resultados coincidentes</div>';
                list.style.display = 'block';
                activeIndex = -1;
                return;
            }

            list.innerHTML = matches.map((m, i) => {
                const extra = m.filter ? ` data-filter='${escapeHtml(JSON.stringify(m.filter))}'` : '';
                const icon = m.capa === 'subzonas' ? '📍' : '🌳';
                return `<div class="autocomplete-item ${i === activeIndex ? 'active' : ''}" data-idx="${i}" data-capa="${m.capa}" data-gid="${escapeHtml(m.gid)}"${extra}>
                    <span>${icon} <strong>${escapeHtml(m.text)}</strong></span>
                    <small class="text-muted d-block" style="font-size:0.75rem;">${escapeHtml(m.label || m.capa)}</small>
                </div>`;
            }).join('');

            list.style.display = 'block';

            list.querySelectorAll('.autocomplete-item').forEach(el => {
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const filter = el.dataset.filter ? JSON.parse(el.dataset.filter) : null;
                    selectItem(el.dataset.capa, el.dataset.gid, filter);
                });
            });
        }

        input.addEventListener('input', () => {
            const q = input.value.toLowerCase().trim();
            renderMatches(q);
        });

        input.addEventListener('focus', () => {
            const q = input.value.toLowerCase().trim();
            if (q.length >= 1) renderMatches(q);
        });

        input.addEventListener('keydown', (e) => {
            const items = list.querySelectorAll('.autocomplete-item');
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (items.length > 0) {
                    activeIndex = (activeIndex + 1) % items.length;
                    items.forEach((it, idx) => it.classList.toggle('active', idx === activeIndex));
                    items[activeIndex]?.scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (items.length > 0) {
                    activeIndex = (activeIndex - 1 + items.length) % items.length;
                    items.forEach((it, idx) => it.classList.toggle('active', idx === activeIndex));
                    items[activeIndex]?.scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const target = activeIndex >= 0 && items[activeIndex] ? items[activeIndex] : items[0];
                if (target) {
                    const filter = target.dataset.filter ? JSON.parse(target.dataset.filter) : null;
                    selectItem(target.dataset.capa, target.dataset.gid, filter);
                }
            } else if (e.key === 'Escape') {
                list.innerHTML = '';
                list.style.display = 'none';
            }
        });

        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !list.contains(e.target)) {
                list.style.display = 'none';
            }
        });
    }
    setupAutocomplete();

    function selectItem(capa, gid, filter) {
        const o = overlays[capa];
        if (!o) { console.warn('overlay', capa, 'no cargada'); return; }
        if (!o.layer.getVisible()) o.layer.setVisible(true);

        const list = document.getElementById('autocomplete');
        if (list) list.style.display = 'none';

        // Caso 1: filtro (arboles por especie / seccion / inventario)
        if (filter && typeof o.features[0]?.get === 'function') {
            const matches = o.features.filter(f => {
                for (const [k, v] of Object.entries(filter)) {
                    if (String(f.get(k) || '') !== String(v)) return false;
                }
                return true;
            });
            if (matches.length === 0) return;
            const input = document.getElementById('search-input');
            const sample = matches[0].getProperties();
            if (matches.length === 1) {
                const ext = matches[0].getGeometry().getExtent();
                map.getView().fit(ext, { padding: [80, 80, 80, 80], maxZoom: 19, duration: 800 });
                input.value = sample.inventario ? `Inv ${sample.inventario} (${sample.especie || '?'})` : (sample.especie || '');
                showTreeInfo(matches[0]);
                highlightFeature(matches[0], capa, sample.inventario);
            } else {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                for (const f of matches) {
                    const e = f.getGeometry().getExtent();
                    if (e[0] < minX) minX = e[0];
                    if (e[1] < minY) minY = e[1];
                    if (e[2] > maxX) maxX = e[2];
                    if (e[3] > maxY) maxY = e[3];
                }
                map.getView().fit([minX, minY, maxX, maxY], { padding: [60, 60, 60, 60], maxZoom: 18, duration: 800 });
                const tipo = Object.keys(filter)[0];
                input.value = `${matches.length.toLocaleString()} ${tipo === 'especie' ? sample.especie : tipo === 'seccion_bosque' ? 'árboles en ' + sample.seccion_bosque : 'árboles'}`;
                openBottomPanel('arboles');
                const val = sample[tipo] || '';
                if (val) {
                    bottomPanelState.filter = val;
                    const filterInput = document.getElementById('attr-panel-filter');
                    if (filterInput) filterInput.value = val;
                    bottomPanelState.page = 0;
                    renderPanelTable();
                }
            }
            return;
        }

        // Caso 2: subzona (gid = subzona)
        const key = String(gid).trim().toLowerCase();
        const feat = o.features.find(f => {
            const sz = String(f.get('subzona') || '').trim().toLowerCase();
            const id = String(f.get('gid') || f.get('id') || '').trim().toLowerCase();
            const nm = String(f.get('nombre') || '').trim().toLowerCase();
            return sz === key || id === key || nm === key || (key.length > 2 && nm.includes(key));
        });
        if (feat) {
            const ext = feat.getGeometry().getExtent();
            map.getView().fit(ext, { padding: [60, 60, 60, 60], maxZoom: 17, duration: 800 });
            const input = document.getElementById('search-input');
            input.value = (feat.get('subzona') || '') + ' ' + (feat.get('nombre') || '');
            showSubzonaInfo(feat);
            highlightFeature(feat, capa, key);
        } else {
            console.warn(`[visor] feature ${capa}/${gid} no encontrado`);
        }
    }

    // =====================================================================
    // CLICK-TO-IDENTIFY (siempre encuentra el feature mas cercano)
    // =====================================================================
    map.on('click', evt => {
        const visibleOverlayLayers = Object.values(overlays)
            .filter(o => o && o.layer && o.layer.getVisible())
            .map(o => o.layer);

        if (visibleOverlayLayers.length === 0) {
            closeInfo();
            return;
        }

        // Detección estricta bajo el cursor (tolerancia máxima 8px)
        const hits = map.getFeaturesAtPixel(evt.pixel, {
            hitTolerance: 8,
            layerFilter: (layer) => visibleOverlayLayers.includes(layer)
        });

        if (!hits || hits.length === 0) {
            // Click en espacio vacío: cerrar inmediatamente panel sin buscar nada lejano
            closeInfo();
            return;
        }

        // Mostrar únicamente la entidad directamente cliqueada
        renderCleanInfo(hits[0]);
    });

    function renderCleanInfo(feature) {
        const panel = document.getElementById('info-panel');
        const content = document.getElementById('info-content');
        if (!panel || !content || !feature) return;

        const props = feature.getProperties ? feature.getProperties() : {};
        const elev = props.elev != null ? props.elev : props.ELEVATION;
        const isMaster = props.is_master != null ? props.is_master : (elev != null && Math.round(elev * 10) % 50 === 0);

        let html = '';
        if (elev != null) {
            // Es una curva de nivel de Campo
            html = `
                <div class="p-2">
                    <div class="d-flex align-items-center mb-2 pb-1 border-bottom" style="border-color:#435363 !important;">
                        <span style="font-size:1.3rem;margin-right:8px;">🏔️</span>
                        <div>
                            <strong style="color:#2f3b47;font-size:0.95rem;">Curva de Nivel</strong>
                            <div class="text-muted" style="font-size:0.75rem;">Altimetría de precisión</div>
                        </div>
                    </div>
                    <table class="table table-sm table-borderless mb-2" style="font-size:0.85rem;">
                        <tr><th style="width:40%;color:#666;">Elevación:</th><td class="fw-bold" style="color:#435363;font-size:1rem;">${elev} msnm</td></tr>
                        <tr><th style="color:#666;">Tipo:</th><td><span class="badge ${isMaster ? 'bg-primary' : 'bg-secondary'}">${isMaster ? 'Maestra (5m)' : 'Ordinaria (1m)'}</span></td></tr>
                        <tr><th style="color:#666;">Zona:</th><td>Campo</td></tr>
                        <tr><th style="color:#666;">Rango zona:</th><td>1,915 m - 1,950 m</td></tr>
                    </table>
                </div>
            `;
        } else {
            // Entidad vectorial genérica o creada por el usuario (KML/SHP)
            const geom = feature.getGeometry ? feature.getGeometry() : null;
            const geomType = geom ? geom.getType() : 'Geometría';
            const title = props.nombre || props.name || `Entidad (${geomType})`;
            let rows = '';
            const ignored = ['geometry', 'features', 'style', 'subzona', 'arbol'];
            for (const [k, v] of Object.entries(props)) {
                if (ignored.includes(k) || v == null || typeof v === 'object') continue;
                rows += `<tr><th style="color:#666;width:40%;">${escapeHtml(k)}:</th><td>${escapeHtml(String(v))}</td></tr>`;
            }
            html = `
                <div class="p-2">
                    <div class="fw-bold mb-2 pb-1 border-bottom" style="color:#2f3b47;">📍 ${escapeHtml(title)}</div>
                    <table class="table table-sm table-bordered mb-0" style="font-size:0.8rem;">${rows || '<tr><td>Sin atributos adicionales</td></tr>'}</table>
                </div>
            `;
        }

        content.innerHTML = html;
        panel.removeAttribute('hidden');
        panel.style.display = 'block';
    }

    // Encuentra el feature del click en la lista filtrada del bottom panel,
    // lo selecciona (fila amarilla) y hace highlight en el mapa.
    // Si el panel esta cerrado, lo abre automaticamente.
    // Si el feature esta en otra pagina, navega a esa pagina.
    function syncSelectionWithPanel(hits) {
        if (!hits || hits.length === 0) return;
        for (const h of hits) {
            const layerName = h.source || (h.tipo === 'arbol' ? 'arboles' : (h.tipo === 'subzona' || h.tipo === 'subzonas' ? 'subzonas' : null));
            if (!layerName) continue;

            // Si el panel esta cerrado o es de otra capa, abrirlo/cambiarlo
            if (!bottomPanelState.open || bottomPanelState.layerName !== layerName) {
                if (CFG.OVERLAY_LAYERS[layerName] || overlays[layerName]) {
                    openBottomPanel(layerName);
                } else {
                    continue;
                }
            }

            const f = h.feature;
            if (!f) continue;

            const filtered = filteredFor(bottomPanelState);
            let targetIdx = -1;

            // 1. Coincidencia por referencia de objeto exacto
            for (let i = 0; i < filtered.length; i++) {
                if (filtered[i] === f) {
                    targetIdx = i;
                    break;
                }
            }

            // 2. Coincidencia por ID (getId())
            if (targetIdx === -1) {
                const targetFid = f.getId ? f.getId() : null;
                if (targetFid !== null && targetFid !== undefined && targetFid !== '') {
                    for (let i = 0; i < filtered.length; i++) {
                        if (filtered[i].getId && String(filtered[i].getId()) === String(targetFid)) {
                            targetIdx = i;
                            break;
                        }
                    }
                }
            }

            // 3. Coincidencia por clave de propiedad (inventario, gid, id, subzona)
            if (targetIdx === -1) {
                const propsF = f.getProperties ? f.getProperties() : (f.properties || {});
                const keyF = propsF.inventario || propsF.gid || propsF.id || propsF.subzona;
                if (keyF != null && keyF !== '') {
                    for (let i = 0; i < filtered.length; i++) {
                        const p = filtered[i].getProperties ? filtered[i].getProperties() : (filtered[i].properties || {});
                        const keyI = p.inventario || p.gid || p.id || p.subzona;
                        if (keyI != null && String(keyI) === String(keyF)) {
                            targetIdx = i;
                            break;
                        }
                    }
                }
            }

            // 4. Coincidencia por geometria
            if (targetIdx === -1) {
                for (let i = 0; i < filtered.length; i++) {
                    if (featuresMatch(filtered[i], f)) {
                        targetIdx = i;
                        break;
                    }
                }
            }

            if (targetIdx === -1) continue;

            // Navegar a la pagina que contiene el elemento
            const PAGE = 100;
            const targetPage = Math.floor(targetIdx / PAGE);
            if (bottomPanelState.page !== targetPage) {
                bottomPanelState.page = targetPage;
                renderPanelTable();
            }

            // Seleccionar fila en tabla y hacer scroll centrado
            const wrap = document.getElementById('attr-panel-wrap');
            if (wrap) {
                document.querySelectorAll('.attr-table tr.attr-selected').forEach(r => r.classList.remove('attr-selected'));
                const tr = wrap.querySelector(`tr[data-fidx="${targetIdx}"]`);
                if (tr) {
                    tr.classList.add('attr-selected');
                    tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }

            // Highlight amarillo en mapa
            highlightFeature(f, layerName, layerName);

            return; // sincronizado con la primera feature valida
        }
    }

    function featuresMatch(a, b) {
        // Comparar geometrias (mas confiable)
        try {
            const ga = a.getGeometry();
            const gb = b.getGeometry ? b.getGeometry() : (b.geometry ? new ol.format.GeoJSON().readGeometry(b.geometry) : null);
            if (ga && gb) {
                const ca = ga.getCoordinates();
                const cb = gb.getCoordinates();
                return JSON.stringify(ca) === JSON.stringify(cb);
            }
        } catch (e) { /* fallthrough */ }
        // Fallback: comparar por id
        const pa = a.getProperties ? a.getProperties() : (a.properties || {});
        const pb = b.getProperties ? b.getProperties() : (b.properties || {});
        for (const k of ['gid', 'id', 'subzona', 'inventario']) {
            if (pa[k] !== undefined && pa[k] === pb[k]) return true;
        }
        return false;
    }

    // Distancia minima entre un punto y una geometria (en coordenadas del mapa)
    function pointToFeatureDistance(coord, geom) {
        if (geom.getType && geom.getType() === 'Point') {
            const c = geom.getCoordinates();
            const dx = c[0] - coord[0], dy = c[1] - coord[1];
            return Math.sqrt(dx * dx + dy * dy);
        }
        // Para poligonos y lineas: extent al punto
        const ext = geom.getExtent();
        const x = Math.max(ext[0], Math.min(coord[0], ext[2]));
        const y = Math.max(ext[1], Math.min(coord[1], ext[3]));
        const dx = x - coord[0], dy = y - coord[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    function renderInfo(hits) {
        const panel = document.getElementById('info-panel');
        const content = document.getElementById('info-content');
        panel.removeAttribute('hidden');
        panel.style.display = 'block';

        let html = '';
        hits.forEach((h, idx) => {
            let cardHtml = '';
            cardHtml = featureCard(h.feature, h.label);
            html += `<div class="feature-info-card mb-2" data-hit-idx="${idx}" style="cursor:pointer;" title="Click para seleccionar en tabla de atributos">${cardHtml}</div>`;
        });
        if (!html) html = '<p class="text-muted small">No hay información para mostrar.</p>';
        content.innerHTML = html;

        content.querySelectorAll('.feature-info-card').forEach(card => {
            card.addEventListener('click', () => {
                const idx = parseInt(card.dataset.hitIdx);
                if (hits[idx]) {
                    syncSelectionWithPanel([hits[idx]]);
                }
            });
        });
    }

    function closeInfo() {
        const p = document.getElementById('info-panel');
        p.setAttribute('hidden', '');
        p.style.display = 'none';
    }

    function featureCard(f, label) {
        if (!f) return '';
        const p = f.getProperties ? f.getProperties() : (f.properties || {});
        const geom = f.getGeometry ? f.getGeometry() : null;
        const geomType = geom ? geom.getType() : 'Entidad';
        const title = label || p.nombre || p.name || p.id || `Elemento ${geomType}`;
        const ignored = ['geometry', 'features', 'style', 'subzona'];
        
        let rowsHtml = '';
        for (const [k, v] of Object.entries(p)) {
            if (ignored.includes(k) || v == null || typeof v === 'object') continue;
            rowsHtml += `<tr><td class="text-muted" style="width:40%;"><small>${escape(k)}</small></td><td><small>${escape(v)}</small></td></tr>`;
        }
        
        if (!rowsHtml) {
            rowsHtml = `<tr><td class="text-muted"><small>Tipo de entidad</small></td><td><small>${escape(geomType)}</small></td></tr>`;
        }

        return `<div class="mb-2"><strong>📍 ${escape(title)}</strong>
            <table class="table table-sm table-bordered mb-0">${rowsHtml}</table></div>`;
    }

    function treeCard(f) { return featureCard(f); }
    function subzonaCard(f, label) { return featureCard(f, label); }

    function showTreeInfo(f) {
        renderInfo([{ tipo: 'arbol', feature: f, source: 'arboles' }]);
        syncSelectionWithPanel([{ tipo: 'arbol', feature: f, source: 'arboles' }]);
    }
    function showSubzonaInfo(f) {
        renderInfo([{ tipo: 'subzona', feature: f, source: 'subzonas' }]);
        syncSelectionWithPanel([{ tipo: 'subzona', feature: f, source: 'subzonas' }]);
    }

    document.getElementById('close-info').addEventListener('click', closeInfo);

    // =====================================================================
    // UTIL
    // =====================================================================
    function hexToRgba(hex, a) {
        const n = parseInt(hex.slice(1), 16);
        return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    }
    function escape(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // Ajustar extent inicial al de las subzonas una vez que carguen
    // (Desactivado: el centro/zoom del config es la vista correcta para Chapultepec)
    // setTimeout(() => {
    //     if (overlays.subzonas && overlays.subzonas.features.length) {
    //         const view = map.getView();
    //         const curCenter = view.getCenter();
    //         const all_ext = overlays.subzonas.layer.getSource().getExtent();
    //         if (!ol.extent.containsCoordinate(all_ext, curCenter)) {
    //             view.fit(all_ext, { padding: [30, 30, 30, 30], duration: 0, maxZoom: 14 });
    //         }
    //     }
    // }, 2000);

    // Exponer para debug
    
    // =====================================================================
    // HERRAMIENTAS GIS: Dibujar en Mapa y Cargar KML / Shapefile / GeoJSON
    // =====================================================================
    const userDrawSource = new ol.source.Vector();
    const userDrawLayer = new ol.layer.Vector({
        source: userDrawSource,
        style: new ol.style.Style({
            fill: new ol.style.Fill({ color: 'rgba(82, 183, 136, 0.35)' }),
            stroke: new ol.style.Stroke({ color: '#1b4d3e', width: 3 }),
            image: new ol.style.Circle({
                radius: 7,
                fill: new ol.style.Fill({ color: '#2d6a4f' }),
                stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 })
            })
        }),
        zIndex: 250
    });
    map.addLayer(userDrawLayer);
    overlays['capa_usuario'] = { layer: userDrawLayer, info: { label: 'Mis Dibujos / Capas Cargadas', color: '#2d6a4f' }, features: [] };

    let drawInteraction = null;

    function saveUserDrawings() {
        try {
            const features = userDrawSource.getFeatures();
            if (features.length === 0) {
                localStorage.removeItem('visor_chapultepec_drawings');
                return;
            }
            const geojsonStr = new ol.format.GeoJSON().writeFeatures(features, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            });
            localStorage.setItem('visor_chapultepec_drawings', geojsonStr);
            overlays['capa_usuario'].features = features;
        } catch (e) {
            console.error('[GIS] Error guardando dibujos:', e);
        }
    }

    function loadUserDrawings() {
        try {
            const saved = localStorage.getItem('visor_chapultepec_drawings');
            if (saved) {
                const features = new ol.format.GeoJSON().readFeatures(saved, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                });
                userDrawSource.addFeatures(features);
                overlays['capa_usuario'].features = features;
                console.log('[GIS] Cargados ' + features.length + ' elementos del localStorage.');
            }
        } catch (e) {
            console.error('[GIS] Error cargando localStorage:', e);
        }
    }
    loadUserDrawings();

    function setDrawMode(type) {
        if (drawInteraction) map.removeInteraction(drawInteraction);
        document.querySelectorAll('.btn-draw').forEach(b => b.classList.remove('active', 'bg-success', 'text-white'));
        if (!type) return;

        const btn = document.querySelector(`.btn-draw[data-type="${type}"]`);
        if (btn) btn.classList.add('active', 'bg-success', 'text-white');

        drawInteraction = new ol.interaction.Draw({
            source: userDrawSource,
            type: type
        });

        drawInteraction.on('drawend', e => {
            const feat = e.feature;
            feat.set('nombre', `Elemento ${type} #${userDrawSource.getFeatures().length + 1}`);
            feat.set('fecha', new Date().toLocaleString());
            setTimeout(() => {
                saveUserDrawings();
                setDrawMode(null);
                const ext = feat.getGeometry().getExtent();
                map.getView().fit(ext, { padding: [80, 80, 80, 80], maxZoom: 18, duration: 600 });
            }, 50);
        });

        map.addInteraction(drawInteraction);
    }

    document.querySelectorAll('.btn-draw').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            if (btn.classList.contains('active')) setDrawMode(null);
            else setDrawMode(type);
        });
    });

    document.getElementById('btn-clear-draw')?.addEventListener('click', () => {
        if (userDrawSource.getFeatures().length === 0) return;
        if (confirm('¿Deseas borrar todos los elementos dibujados y cargados?')) {
            setDrawMode(null);
            userDrawSource.clear();
            saveUserDrawings();
            const status = document.getElementById('upload-status');
            if (status) status.textContent = 'Dibujos limpiados';
        }
    });

    document.getElementById('btn-export-draw')?.addEventListener('click', () => {
        const features = userDrawSource.getFeatures();
        if (features.length === 0) {
            alert('No hay elementos dibujados o cargados para exportar.');
            return;
        }
        const geojsonStr = new ol.format.GeoJSON().writeFeatures(features, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857'
        });
        const blob = new Blob([geojsonStr], { type: 'application/json;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `capa_usuario_chapultepec_${new Date().toISOString().slice(0,10)}.geojson`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });

    // File Upload Handler (.kml, .geojson, .zip Shapefile)
    const fileInput = document.getElementById('gis-file-input');
    const uploadBtn = document.getElementById('btn-upload-file');
    const uploadStatus = document.getElementById('upload-status');

    uploadBtn?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;

        const fname = file.name.toLowerCase();
        if (uploadStatus) uploadStatus.textContent = `Procesando ${file.name}...`;

        try {
            let features = [];
            if (fname.endsWith('.kml')) {
                const text = await file.text();
                features = new ol.format.KML({ extractStyles: true }).readFeatures(text, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                });
            } else if (fname.endsWith('.geojson') || fname.endsWith('.json')) {
                const text = await file.text();
                features = new ol.format.GeoJSON().readFeatures(text, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                });
            } else if (fname.endsWith('.zip')) {
                if (typeof shp !== 'undefined') {
                    const buffer = await file.arrayBuffer();
                    const geojson = await shp(buffer);
                    features = new ol.format.GeoJSON().readFeatures(geojson, {
                        dataProjection: 'EPSG:4326',
                        featureProjection: 'EPSG:3857'
                    });
                } else {
                    throw new Error('Librería Shapefile (shp.js) no cargada.');
                }
            } else {
                throw new Error('Formato no soportado. Usa KML, GeoJSON o ZIP (Shapefile).');
            }

            if (features.length === 0) {
                throw new Error('No se encontraron elementos válidos en el archivo.');
            }

            userDrawSource.addFeatures(features);
            saveUserDrawings();

            const ext = userDrawSource.getExtent();
            if (ext && isFinite(ext[0])) {
                map.getView().fit(ext, { padding: [60, 60, 60, 60], maxZoom: 18, duration: 800 });
            }

            if (uploadStatus) uploadStatus.textContent = `✅ Cargar éxito: ${features.length} elementos`;
            fileInput.value = '';

        } catch (err) {
            console.error('[GIS] Error cargando archivo:', err);
            if (uploadStatus) uploadStatus.textContent = `❌ Error: ${err.message || err}`;
            alert(`Error al cargar ${file.name}: ${err.message || err}`);
            fileInput.value = '';
        }
    });


    
    // =====================================================================
    // LOCALIZACION EN TIEMPO REAL (GPS / Geolocalizacion)
    // =====================================================================
    const locationSource = new ol.source.Vector();
    const accuracyFeature = new ol.Feature();
    const positionFeature = new ol.Feature();

    positionFeature.setStyle(new ol.style.Style({
        image: new ol.style.Circle({
            radius: 9,
            fill: new ol.style.Fill({ color: '#1b4d3e' }),
            stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 })
        })
    }));

    accuracyFeature.setStyle(new ol.style.Style({
        fill: new ol.style.Fill({ color: 'rgba(82, 183, 136, 0.25)' }),
        stroke: new ol.style.Stroke({ color: 'rgba(45, 106, 79, 0.6)', width: 2 })
    }));

    locationSource.addFeatures([accuracyFeature, positionFeature]);

    const locationLayer = new ol.layer.Vector({
        source: locationSource,
        zIndex: 300
    });
    map.addLayer(locationLayer);

    const geolocation = new ol.Geolocation({
        trackingOptions: {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        },
        projection: map.getView().getProjection()
    });

    let gpsActive = false;
    let followUser = true;
    let lastPosition = null;
    const SMOOTHING_FACTOR = 0.35; // Filtro suave de media móvil exponencial para eliminar rebotes GPS

    function smoothCoordinates(raw) {
        if (!lastPosition) {
            lastPosition = raw;
            return raw;
        }
        const smoothed = [
            lastPosition[0] + SMOOTHING_FACTOR * (raw[0] - lastPosition[0]),
            lastPosition[1] + SMOOTHING_FACTOR * (raw[1] - lastPosition[1])
        ];
        lastPosition = smoothed;
        return smoothed;
    }

    function toggleGPS() {
        gpsActive = !gpsActive;
        geolocation.setTracking(gpsActive);

        const gpsBtn = document.getElementById('gps-btn');
        const status = document.getElementById('upload-status');

        if (gpsActive) {
            if (gpsBtn) gpsBtn.classList.add('active');
            if (status) status.innerHTML = '🎯 <strong>Conectando GPS de Alta Precisión...</strong>';
        } else {
            if (gpsBtn) gpsBtn.classList.remove('active');
            positionFeature.setGeometry(null);
            accuracyFeature.setGeometry(null);
            lastPosition = null;
            if (status) status.textContent = 'GPS desactivado';
        }
    }

    geolocation.on('change:position', () => {
        const rawCoords = geolocation.getPosition();
        if (rawCoords) {
            const coords = smoothCoordinates(rawCoords);
            positionFeature.setGeometry(new ol.geom.Point(coords));

            const lonLat = ol.proj.toLonLat(coords);
            const latStr = lonLat[1].toFixed(6);
            const lonStr = lonLat[0].toFixed(6);
            const accuracy = (geolocation.getAccuracy() || 0).toFixed(1);

            if (followUser) {
                const targetZoom = accuracy < 15 ? 18.5 : 17;
                map.getView().animate({
                    center: coords,
                    zoom: Math.max(map.getView().getZoom(), targetZoom),
                    duration: 600
                });
            }

            const status = document.getElementById('upload-status');
            if (status) {
                status.innerHTML = `🎯 <strong>GPS Máxima Precisión (±${accuracy}m)</strong><br><small style="font-family:monospace; color:#1b4d3e;">Lat: ${latStr}° | Lon: ${lonStr}°</small>`;
            }
        }
    });

    geolocation.on('change:accuracyGeometry', () => {
        accuracyFeature.setGeometry(geolocation.getAccuracyGeometry());
    });

    geolocation.on('error', (error) => {
        console.error('[GPS] Error de geolocalización:', error);
        alert(`Error al obtener ubicación GPS: ${error.message || 'Sin permiso o señal GPS.'}`);
        gpsActive = true;
        toggleGPS();
    });

    // Agregar botón flotante de GPS sobre el mapa
    const gpsControlDiv = document.createElement('div');
    gpsControlDiv.className = 'ol-control-gps ol-unselectable ol-control';
    gpsControlDiv.innerHTML = `<button id="gps-btn" title="Mi ubicación GPS en tiempo real">🎯</button>`;
    document.getElementById('map').appendChild(gpsControlDiv);

    document.getElementById('gps-btn')?.addEventListener('click', toggleGPS);


    document.getElementById('btn-gps-panel')?.addEventListener('click', toggleGPS);

    window.__visor = { map, baseLayers, overlays, toggleBase, setAllBases, openBottomPanel };
})();


/* ==========================================================================
   MODULO REPRODUCTOR DE VIDEO Y TRAYECTORIA GPS DE DRON EN TIEMPO REAL
   ========================================================================== */

(function initFlightVideoModule() {

    function getMap() {
        if (window.__map && typeof window.__map.addLayer === 'function') return window.__map;
        if (window.__visor && window.__visor.map && typeof window.__visor.map.addLayer === 'function') return window.__visor.map;
        return null;
    }
    
    let flightTelemetry = null;
    let flightVectorSource = null;
    let flightVectorLayer = null;
    let droneMarkerFeature = null;
    let cameraFovFeature = null;
    let lineFeature = null;

    // Icono SVG reutilizable para el Dron
    const droneIcon = new ol.style.Icon({
        src: 'data:image/svg+xml;utf8,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="18" fill="rgba(16, 185, 129, 0.25)" stroke="#10b981" stroke-width="2"/>
                <circle cx="8" cy="8" r="4" fill="#00ff88" stroke="#133c2e"/>
                <circle cx="32" cy="8" r="4" fill="#00ff88" stroke="#133c2e"/>
                <circle cx="8" cy="32" r="4" fill="#00ff88" stroke="#133c2e"/>
                <circle cx="32" cy="32" r="4" fill="#00ff88" stroke="#133c2e"/>
                <path d="M12 12 L28 28 M28 12 L12 28" stroke="#ffffff" stroke-width="2.5"/>
                <polygon points="20,6 26,20 14,20" fill="#00ff88" stroke="#133c2e" stroke-width="1.5"/>
            </svg>
        `),
        anchor: [0.5, 0.5],
        scale: 1.1,
        rotation: 0
    });

    const droneText = new ol.style.Text({
        text: '🛸 Dron (56m)',
        font: 'bold 12px Arial, sans-serif',
        fill: new ol.style.Fill({ color: '#ffffff' }),
        stroke: new ol.style.Stroke({ color: '#133c2e', width: 3 }),
        offsetY: -26
    });

    const droneStyle = new ol.style.Style({
        image: droneIcon,
        text: droneText
    });

    // Estilo reutilizable para el Cono de Visión Focal (FOV 135m)
    const fovText = new ol.style.Text({
        text: '📐 Cobertura Focal: 135m (70°)',
        font: 'bold 12px Arial, sans-serif',
        fill: new ol.style.Fill({ color: '#ffffff' }),
        stroke: new ol.style.Stroke({ color: '#064e3b', width: 3.5 }),
        offsetY: 32
    });

    const fovStyle = new ol.style.Style({
        fill: new ol.style.Fill({
            color: 'rgba(0, 255, 136, 0.28)'
        }),
        stroke: new ol.style.Stroke({
            color: '#00ff88',
            width: 2.5
        }),
        text: fovText
    });

    // Calcular la geometría del cono de visión focal (FOV) del Dron
    function computeFovPolygon(lon, lat, headingDeg, altMeters) {
        const origin = ol.proj.fromLonLat([lon, lat]);
        const x0 = origin[0];
        const y0 = origin[1];
        
        // Alcance focal dinámico ampliado a ~135 metros según la altitud del vuelo
        const reachMeters = Math.max(85, (altMeters || 50) * 2.4); 
        const latRad = lat * Math.PI / 180;
        const mercatorReach = reachMeters / Math.cos(latRad);
        
        const fovAngle = 70; // Ángulo de apertura de la cámara (70°)
        const startAngle = (headingDeg || 0) - fovAngle / 2;
        const endAngle = (headingDeg || 0) + fovAngle / 2;
        
        const ring = [[x0, y0]];
        const steps = 11;
        for (let i = 0; i <= steps; i++) {
            const deg = startAngle + (endAngle - startAngle) * (i / steps);
            const rad = (90 - deg) * Math.PI / 180;
            const x = x0 + mercatorReach * Math.cos(rad);
            const y = y0 + mercatorReach * Math.sin(rad);
            ring.push([x, y]);
        }
        ring.push([x0, y0]);
        return new ol.geom.Polygon([ring]);
    }

    // Inicializar capas vectoriales para el mapa de OpenLayers
    function ensureFlightLayers() {
        if (!flightVectorSource) {
            flightVectorSource = new ol.source.Vector();
            flightVectorLayer = new ol.layer.Vector({
                source: flightVectorSource,
                zIndex: 999,
                title: 'Trayectoria Vuelo Video GPS'
            });
            window.__flightVectorLayer = flightVectorLayer;
        }
        const m = getMap();
        if (m && flightVectorLayer && !m.getLayers().getArray().includes(flightVectorLayer)) {
            m.addLayer(flightVectorLayer);
        }
    }

    // Cargar datos de telemetría JSON y dibujar trayectoria
    async function loadFlightTelemetry() {
        try {
            ensureFlightLayers();
            const res = await fetch('data/flight_telemetry.json?v=' + Date.now());
            if (!res.ok) throw new Error('No se pudo cargar la telemetría predeterminada');
            flightTelemetry = await res.json();
            
            drawTrajectoryOnMap(flightTelemetry);
            console.log('✅ Telemetría de vuelo cargada:', flightTelemetry.total_points, 'puntos');
        } catch (err) {
            console.warn('Carga de telemetría:', err);
        }
    }

    // Dibujar la polilínea del vuelo en OpenLayers
    function drawTrajectoryOnMap(data) {
        if (!data || !data.telemetry || data.telemetry.length === 0) return;
        ensureFlightLayers();
        flightVectorSource.clear();

        const coords = data.telemetry.map(p => ol.proj.fromLonLat([p.lon, p.lat]));

        // Feature Línea de Vuelo
        lineFeature = new ol.Feature({
            geometry: new ol.geom.LineString(coords),
            name: 'Trayectoria Vuelo Video'
        });

        // Estilo Neon Verde Glowing
        lineFeature.setStyle([
            new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: 'rgba(16, 185, 129, 0.4)',
                    width: 9
                })
            }),
            new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: '#00ff88',
                    width: 4
                })
            })
        ]);

        flightVectorSource.addFeature(lineFeature);

        // Marcador Inicio
        const startPoint = new ol.Feature({
            geometry: new ol.geom.Point(coords[0])
        });
        startPoint.setStyle(new ol.style.Style({
            image: new ol.style.Circle({
                radius: 7,
                fill: new ol.style.Fill({ color: '#10b981' }),
                stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 })
            }),
            text: new ol.style.Text({
                text: '🛫 Inicio',
                font: 'bold 11px sans-serif',
                fill: new ol.style.Fill({ color: '#10b981' }),
                stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 }),
                offsetY: 16
            })
        }));
        flightVectorSource.addFeature(startPoint);

        // Marcador Fin
        const endPoint = new ol.Feature({
            geometry: new ol.geom.Point(coords[coords.length - 1])
        });
        endPoint.setStyle(new ol.style.Style({
            image: new ol.style.Circle({
                radius: 7,
                fill: new ol.style.Fill({ color: '#ef4444' }),
                stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 })
            }),
            text: new ol.style.Text({
                text: '🛬 Fin',
                font: 'bold 11px sans-serif',
                fill: new ol.style.Fill({ color: '#ef4444' }),
                stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 }),
                offsetY: 16
            })
        }));
        flightVectorSource.addFeature(endPoint);

        // Cono de Visión Focal (FOV) de la Cámara (se agrega antes del dron para quedar por debajo)
        const p0 = data.telemetry[0];
        const initReach = Math.round(Math.max(85, (p0.alt || 50) * 2.4));
        fovText.setText('📐 Cobertura Focal: ' + initReach + 'm (70°)');
        
        cameraFovFeature = new ol.Feature({
            geometry: computeFovPolygon(p0.lon, p0.lat, p0.heading, p0.alt)
        });
        cameraFovFeature.setStyle(fovStyle);
        flightVectorSource.addFeature(cameraFovFeature);

        // Marcador Dron Móvil
        droneIcon.setRotation((p0.heading || 0) * Math.PI / 180);
        droneText.setText('🛸 Dron (' + (p0.alt ? p0.alt.toFixed(1) + 'm' : '56m') + ')');
        
        droneMarkerFeature = new ol.Feature({
            geometry: new ol.geom.Point(coords[0])
        });
        droneMarkerFeature.setStyle(droneStyle);
        flightVectorSource.addFeature(droneMarkerFeature);

        // Solo renderizar la trayectoria sin forzar zoom para mantener vista completa del ortomosaico
    }

    // Sincronizar posición del Dron según el tiempo actual del Video
    function syncDroneWithVideo(currentTime) {
        if (!flightTelemetry || !flightTelemetry.telemetry || !droneMarkerFeature) return;
        const pts = flightTelemetry.telemetry;

        // Búsqueda binaria rápida del punto más cercano al timestamp
        let low = 0, high = pts.length - 1;
        let idx = 0;

        while (low <= high) {
            let mid = (low + high) >> 1;
            if (pts[mid].t <= currentTime) {
                idx = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        const point = pts[idx];
        if (point) {
            const coords = ol.proj.fromLonLat([point.lon, point.lat]);
            
            // Actualizar punto y rotación del Dron de forma ultra rápida
            droneMarkerFeature.getGeometry().setCoordinates(coords);
            droneIcon.setRotation((point.heading || 0) * Math.PI / 180);
            droneText.setText('🛸 Dron (' + (point.alt ? point.alt.toFixed(1) + 'm' : '56m') + ')');

            // Actualizar geometría y etiqueta del Cono Focal (FOV 135m)
            if (cameraFovFeature) {
                const curReach = Math.round(Math.max(85, (point.alt || 50) * 2.4));
                cameraFovFeature.setGeometry(computeFovPolygon(point.lon, point.lat, point.heading, point.alt));
                fovText.setText('📐 Cobertura Focal: ' + curReach + 'm (70°)');
            }

            // Actualizar interfaz HUD
            const elTime = document.getElementById('hud-time');
            const elAlt = document.getElementById('hud-alt');
            const elSpeed = document.getElementById('hud-speed');
            const elFov = document.getElementById('hud-fov');
            const elCoords = document.getElementById('hud-coords');

            if (elTime) elTime.textContent = '⏱️ ' + formatSecs(currentTime) + ' / ' + formatSecs(flightTelemetry.duration || 0);
            if (elAlt) elAlt.textContent = '📏 Alt: ' + point.alt.toFixed(1) + 'm';
            if (elSpeed) elSpeed.textContent = '🧭 ' + Math.round(point.heading) + '°';
            if (elFov) elFov.textContent = '📐 Focal: ' + Math.round(Math.max(85, (point.alt || 50) * 2.4)) + 'm';
            if (elCoords) elCoords.textContent = '📍 Lat: ' + point.lat.toFixed(5) + ', Lon: ' + point.lon.toFixed(5);
        }
    }

    function formatSecs(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
    }

    // Hacer la ventana de video arrastrable (Drag & Drop)
    function makeWindowDraggable(modalEl, handleEl) {
        let posX = 0, posY = 0, mouseX = 0, mouseY = 0;
        if (!handleEl || !modalEl) return;

        handleEl.onmousedown = function(e) {
            if (e.target.tagName === 'BUTTON') return;
            e.preventDefault();
            mouseX = e.clientX;
            mouseY = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        };

        function elementDrag(e) {
            e.preventDefault();
            posX = mouseX - e.clientX;
            posY = mouseY - e.clientY;
            mouseX = e.clientX;
            mouseY = e.clientY;
            modalEl.style.top = (modalEl.offsetTop - posY) + 'px';
            modalEl.style.left = (modalEl.offsetLeft - posX) + 'px';
            modalEl.style.bottom = 'auto';
            modalEl.style.right = 'auto';
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    // Configurar Eventos DOM
    document.addEventListener('DOMContentLoaded', function() {
        const btnVideo = document.getElementById('btn-flight-video');
        const videoInput = document.getElementById('video-file-input');
        const modal = document.getElementById('flight-video-modal');
        const header = document.getElementById('video-window-header');
        const videoPlayer = document.getElementById('flight-video-player');
        const btnClose = document.getElementById('btn-close-video');
        const btnMin = document.getElementById('btn-minimize-video');
        const btnCenterDrone = document.getElementById('btn-center-drone-map');

        if (modal && header) {
            makeWindowDraggable(modal, header);
        }

        // Cargar telemetría al iniciar
        loadFlightTelemetry();

        // Botón principal "Vuelo inspección"
        if (btnVideo) {
            btnVideo.addEventListener('click', function() {
                if (modal) {
                    modal.style.display = 'flex';
                    modal.classList.remove('minimized');
                }
                ensureFlightLayers();
                if (!flightTelemetry) {
                    loadFlightTelemetry();
                } else {
                    drawTrajectoryOnMap(flightTelemetry);
                }
                // Centrar en la trayectoria del vuelo al abrir la herramienta
                setTimeout(() => {
                    const m = getMap();
                    if (m && flightVectorSource && flightVectorSource.getFeatures().length > 0) {
                        m.getView().fit(flightVectorSource.getExtent(), {
                            padding: [60, 60, 60, 60],
                            maxZoom: 19.5,
                            duration: 800
                        });
                    }
                }, 200);
                if (videoPlayer && (!videoPlayer.src || videoPlayer.src === '' || videoPlayer.src.endsWith('/'))) {
                    videoPlayer.src = 'data/video.mp4';
                }
            });
        }

        // Minimizar / Restaurar Ventana
        if (btnMin && modal) {
            btnMin.addEventListener('click', function() {
                modal.classList.toggle('minimized');
            });
        }

        // Cerrar Ventana
        if (btnClose && modal) {
            btnClose.addEventListener('click', function() {
                modal.style.display = 'none';
                if (videoPlayer) videoPlayer.pause();
            });
        }

        // Centrar mapa en la posición actual del Dron
        if (btnCenterDrone) {
            btnCenterDrone.addEventListener('click', function() {
                if (droneMarkerFeature) {
                    const m = getMap();
                    if (m) {
                        const coord = droneMarkerFeature.getGeometry().getCoordinates();
                        m.getView().animate({
                            center: coord,
                            zoom: 18.5,
                            duration: 600
                        });
                    }
                }
            });
        }

        // Sincronización en tiempo real del reproductor de video con la marca en el mapa
        if (videoPlayer) {
            videoPlayer.addEventListener('timeupdate', function() {
                syncDroneWithVideo(videoPlayer.currentTime);
            });
            videoPlayer.addEventListener('seeked', function() {
                syncDroneWithVideo(videoPlayer.currentTime);
            });
        }

        // Clic en la línea de trayectoria en el mapa para saltar al segundo del video
        const m = getMap();
        if (m) {
            m.on('singleclick', function(evt) {
                if (!flightTelemetry || !flightTelemetry.telemetry || !videoPlayer) return;
                const feature = m.forEachFeatureAtPixel(evt.pixel, f => f);
                if (feature === lineFeature) {
                    const clickCoord = ol.proj.toLonLat(evt.coordinate);
                    // Buscar punto de telemetría más cercano
                    let minDistance = Infinity;
                    let bestTime = 0;
                    flightTelemetry.telemetry.forEach(p => {
                        const d = Math.hypot(p.lon - clickCoord[0], p.lat - clickCoord[1]);
                        if (d < minDistance) {
                            minDistance = d;
                            bestTime = p.t;
                        }
                    });
                    videoPlayer.currentTime = bestTime;
                    if (modal) modal.style.display = 'flex';
                }
            });
        }
    });
})();


    
// =====================================================================
    // MÓDULO DE FOTOGRAFÍAS Y PANORAMAS 360° - RELLENO SAN MARTÍN
    // =====================================================================
    let activePannellumViewer = null;
    let fotosLayer = null;
    let fotosDataMap = {};

    function getActiveMap() {
        return window.__map || (window.visor && window.visor.map) || null;
    }

    function initFotosSanMartin() { return; }
    window.abrirModalFoto = function(props) {
        if (!props) return;
        if (props.tipo === 'foto_360') {
            abrirPanorama360(props);
        } else {
            abrirFotoHD(props);
        }
    };

    function showModalElement(modalEl) {
        if (window.bootstrap && window.bootstrap.Modal) {
            const m = bootstrap.Modal.getOrCreateInstance(modalEl);
            m.show();
            return m;
        } else {
            modalEl.classList.add('show');
            modalEl.style.display = 'block';
            modalEl.removeAttribute('aria-hidden');
            let backdrop = document.querySelector('.modal-backdrop');
            if (!backdrop) {
                backdrop = document.createElement('div');
                backdrop.className = 'modal-backdrop fade show';
                document.body.appendChild(backdrop);
            }
            return null;
        }
    }

    function hideModalElement(modalEl) {
        if (window.bootstrap && window.bootstrap.Modal) {
            const m = bootstrap.Modal.getInstance(modalEl);
            if (m) m.hide();
        } else {
            modalEl.classList.remove('show');
            modalEl.style.display = 'none';
            modalEl.setAttribute('aria-hidden', 'true');
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) backdrop.remove();
        }
    }

    function abrirPanorama360(props) {
        const modalEl = document.getElementById('modal-foto-360');
        if (!modalEl) return;
        
        document.getElementById('modal-360-title').textContent = props.titulo || 'Panorama 360° UAV';
        const coords = props.coordinates;
        const coordsText = coords ? `Lat: ${coords[1].toFixed(5)}, Lon: ${coords[0].toFixed(5)} (Alt: ${props.altitud_msnm || 2320}m)` : '';
        document.getElementById('modal-360-coords').textContent = coordsText;

        showModalElement(modalEl);

        setTimeout(() => {
            const container = document.getElementById('panorama-viewer');
            container.innerHTML = '';
            
            try {
                if (window.pannellum) {
                    activePannellumViewer = pannellum.viewer('panorama-viewer', {
                        type: 'equirectangular',
                        panorama: props.archivo_web || props.archivo,
                        autoLoad: true,
                        autoRotate: -2,
                        compass: true,
                        showZoomCtrl: true,
                        hfov: 100,
                        minHfov: 50,
                        maxHfov: 120
                    });

                    const btnAuto = document.getElementById('btn-360-autorotate');
                    if (btnAuto) {
                        btnAuto.onclick = () => {
                            if (activePannellumViewer) {
                                const curr = activePannellumViewer.getConfig().autoRotate;
                                activePannellumViewer.setAutoRotate(curr ? 0 : -2);
                            }
                        };
                    }
                    const btnFs = document.getElementById('btn-360-fullscreen');
                    if (btnFs) {
                        btnFs.onclick = () => {
                            if (activePannellumViewer) activePannellumViewer.toggleFullscreen();
                        };
                    }
                }
            } catch(e) {
                console.error('[visor] Error iniciando Pannellum:', e);
            }
        }, 150);

        // Close handlers
        modalEl.querySelectorAll('[data-bs-dismiss="modal"]').forEach(b => {
            b.onclick = () => {
                hideModalElement(modalEl);
                if (activePannellumViewer) {
                    try { activePannellumViewer.destroy(); } catch(e){}
                    activePannellumViewer = null;
                }
                const container = document.getElementById('panorama-viewer');
                if (container) container.innerHTML = '';
            };
        });
    }

    function abrirFotoHD(props) {
        const modalEl = document.getElementById('modal-foto-hd');
        if (!modalEl) return;
        
        document.getElementById('modal-hd-title').textContent = props.titulo || 'Fotografía Aérea';
        const img = document.getElementById('modal-hd-img');
        if (img) img.src = props.archivo;

        const downloadLink = document.getElementById('modal-hd-download');
        if (downloadLink) downloadLink.href = props.archivo;

        const metaSpan = document.getElementById('modal-hd-meta');
        if (metaSpan) {
            metaSpan.innerHTML = `<strong>Altitud:</strong> ${props.altitud_msnm || '--'} msnm &bull; <strong>Fecha:</strong> ${props.fecha || 'Septiembre 2026'}`;
        }

        showModalElement(modalEl);

        modalEl.querySelectorAll('[data-bs-dismiss="modal"]').forEach(b => {
            b.onclick = () => hideModalElement(modalEl);
        });
    }

    // Inicializar listeners al cargar DOM
    document.addEventListener('DOMContentLoaded', () => {
        initFotosSanMartin();

        document.querySelectorAll('.btn-quick-pano').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const p = fotosDataMap[id];
                if (p) {
                    abrirPanorama360(p);
                    const m = getActiveMap();
                    if (m && p.coordinates) {
                        m.getView().animate({
                            center: ol.proj.fromLonLat(p.coordinates),
                            zoom: 18.5,
                            duration: 700
                        });
                    }
                }
            });
        });

        document.querySelectorAll('.btn-quick-foto').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const p = fotosDataMap[id];
                if (p) {
                    abrirFotoHD(p);
                    const m = getActiveMap();
                    if (m && p.coordinates) {
                        m.getView().animate({
                            center: ol.proj.fromLonLat(p.coordinates),
                            zoom: 18.5,
                            duration: 700
                        });
                    }
                }
            });
        });
    });
