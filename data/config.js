// config.js - Configuracion del visor
// Geoportal Campo

window.__CONFIG = {
    "GOOGLE_SHEETS_WEBHOOK_URL": "https://script.google.com/macros/s/AKfycbzQ-n6r5bw9RMX5qP1vIpLaFQ4OE3qY-0bDege33YH4XoqamUwvtbQCp5d9xOjrH7_qTw/exec",
    "CENTER": [
        -97.845664,
        17.897863
    ],
    "ZOOM": 18.0,
    "MIN_ZOOM": 12,
    "MAX_ZOOM": 21,
    "DEFAULT_BASE_LAYERS": [
        "osm",
        "LUGAR_05_orto"
    ],
    "EXTENTS": {
        "campo": [
            -97.846943,
            17.896546,
            -97.844386,
            17.89918
        ],
        "LUGAR_05": [
            -97.846943,
            17.896546,
            -97.844386,
            17.89918
        ]
    },
    "BASE_LAYERS": {
        "osm": {
            "attribution": "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors",
            "label": "Mapa base - OpenStreetMap",
            "type": "osm"
        },
        "LUGAR_05_orto": {
            "attribution": "Ortofoto UAV LUGAR_05 (GSD 3.8 cm/px)",
            "label": "LUGAR_05_orto",
            "maxZoom": 21,
            "minZoom": 14,
            "type": "xyz",
            "url": "./ortofoto_alma_campo/tiles/{z}/{x}/{y}.png?v=2",
            "groupId": "LUGAR_05"
        }
    },
    "OVERLAY_LAYERS": {
        "LUGAR_05_curva": {
            "type": "contour",
            "color": "#0077b6",
            "label": "LUGAR_05_curva",
            "url": "./data/curvas_nivel.geojson?v=2",
            "visible": true,
            "groupId": "LUGAR_05",
            "minAlt": 1915,
            "maxAlt": 1950,
            "step": 1.0
        }
    },
    "GROUPS": {
        "LUGAR_05": {
            "id": "LUGAR_05",
            "label": "LUGAR_05",
            "extent": [
                -97.846943,
                17.896546,
                -97.844386,
                17.89918
            ],
            "center": [
                -97.845664,
                17.897863
            ],
            "altitude": 1930.0,
            "cesiumAssetId": 5902520,
            "layers": [
                {
                    "id": "LUGAR_05_orto",
                    "type": "base",
                    "kind": "orto",
                    "label": "LUGAR_05_orto"
                },
                {
                    "id": "LUGAR_05_curva",
                    "type": "overlay",
                    "kind": "curva",
                    "label": "LUGAR_05_curva"
                }
            ]
        }
    }
};
