// config.js - Configuracion del visor
// Relleno sanitario San Martin de las Piramides

window.__CONFIG = {
    "BASE_LAYERS": {
        "osm": {
            "attribution": "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors",
            "label": "Mapa base - OpenStreetMap",
            "type": "osm"
        },
        "ortofoto_san_martin": {
            "attribution": "Ortofoto UAV INyDES 2026 - Relleno San Martín de las Pirámides (GSD 2.4 cm/px)",
            "label": "Ortofoto UAV Alta Resolución (2.4 cm/px)",
            "maxZoom": 21,
            "minZoom": 14,
            "type": "xyz",
            "url": "./ortofoto_san_martin/tiles/{z}/{x}/{y}.png?v=2"
        }
    },
    "CENTER": [-98.804954, 19.704184],
    "ZOOM": 17.5,
    "MIN_ZOOM": 12,
    "MAX_ZOOM": 21,
    "DEFAULT_BASE_LAYERS": [
        "osm",
        "ortofoto_san_martin"
    ],
    "EXTENTS": {
        "san_martin": [
            -98.807058,
            19.702755,
            -98.802851,
            19.705613
        ]
    },
    "OVERLAY_LAYERS": {
        "fotos": {
            "color": "#ffb703",
            "label": "📸 Fotos y Vistas 360°",
            "url": "./data/fotos_san_martin.geojson?v=2",
            "visible": true
        }
    }
};
