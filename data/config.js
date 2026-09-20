// config.js - Configuracion del visor
// Geoportal Campo

window.__CONFIG = {
    "GOOGLE_SHEETS_WEBHOOK_URL": "https://script.google.com/macros/s/AKfycbzQ-n6r5bw9RMX5qP1vIpLaFQ4OE3qY-0bDege33YH4XoqamUwvtbQCp5d9xOjrH7_qTw/exec",
    "CENTER": [
        -97.671539,
        18.566815
    ],
    "ZOOM": 17.5,
    "MIN_ZOOM": 12,
    "MAX_ZOOM": 24,
    "DEFAULT_BASE_LAYERS": [
        "osm",
        "LUGAR_01_orto",
        "LUGAR_03_orto",
        "LUGAR_05_orto"
    ],
    "EXTENTS": {
        "LUGAR_01": [
            -97.672593,
            18.56504,
            -97.670485,
            18.56859
        ],
        "LUGAR_03": [
            -97.280518,
            18.26035,
            -97.276951,
            18.265737
        ],
        "LUGAR_05": [
            -97.846943,
            17.896546,
            -97.844386,
            17.89918
        ],
        "campo": [
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
        "LUGAR_01_orto": {
            "attribution": "Ortofoto UAV LUGAR_01 - Resolución Nativa (2.9 cm/px)",
            "label": "LUGAR_01_orto (2.9 cm/px Nativa)",
            "maxZoom": 24,
            "minZoom": 14,
            "type": "xyz",
            "url": "./ortofoto_lugar_01/tiles/{z}/{x}/{y}.png?v=3",
            "groupId": "LUGAR_01"
        },
        "LUGAR_03_orto": {
            "attribution": "Ortofoto UAV LUGAR_03 - Resolución Nativa (2.8 cm/px)",
            "label": "LUGAR_03_orto (2.8 cm/px Nativa)",
            "maxZoom": 24,
            "minZoom": 14,
            "type": "xyz",
            "url": "./ortofoto_lugar_03/tiles/{z}/{x}/{y}.png?v=1",
            "groupId": "LUGAR_03"
        },
        "LUGAR_05_orto": {
            "attribution": "Ortofoto UAV LUGAR_05 - Resolución Nativa (3.7 cm/px)",
            "label": "LUGAR_05_orto (3.7 cm/px Nativa)",
            "maxZoom": 24,
            "minZoom": 14,
            "type": "xyz",
            "url": "./ortofoto_alma_campo/tiles/{z}/{x}/{y}.png?v=3",
            "groupId": "LUGAR_05"
        }
    },
    "OVERLAY_LAYERS": {
        "LUGAR_01_curva": {
            "type": "contour",
            "color": "#0077b6",
            "label": "LUGAR_01_curva",
            "url": "./data/lugar_01_curvas.geojson?v=1",
            "visible": true,
            "groupId": "LUGAR_01",
            "minAlt": 2103,
            "maxAlt": 2140,
            "step": 1.0
        },
        "LUGAR_03_curva": {
            "type": "contour",
            "color": "#0077b6",
            "label": "LUGAR_03_curva",
            "url": "./data/lugar_03_curvas.geojson?v=1",
            "visible": true,
            "groupId": "LUGAR_03",
            "minAlt": 1142,
            "maxAlt": 1167,
            "step": 1.0
        },
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
        "LUGAR_01": {
            "id": "LUGAR_01",
            "label": "LUGAR_01",
            "extent": [
                -97.672593,
                18.56504,
                -97.670485,
                18.56859
            ],
            "center": [
                -97.671539,
                18.566815
            ],
            "altitude": 2120.0,
            "cesiumAssetId": 5902582,
            "layers": [
                {
                    "id": "LUGAR_01_orto",
                    "type": "base",
                    "kind": "orto",
                    "label": "LUGAR_01_orto"
                },
                {
                    "id": "LUGAR_01_curva",
                    "type": "overlay",
                    "kind": "curva",
                    "label": "LUGAR_01_curva"
                }
            ]
        },
        "LUGAR_03": {
            "id": "LUGAR_03",
            "label": "LUGAR_03",
            "extent": [
                -97.280518,
                18.26035,
                -97.276951,
                18.265737
            ],
            "center": [
                -97.278735,
                18.263044
            ],
            "altitude": 1155.0,
            "cesiumAssetId": 5902658,
            "layers": [
                {
                    "id": "LUGAR_03_orto",
                    "type": "base",
                    "kind": "orto",
                    "label": "LUGAR_03_orto"
                },
                {
                    "id": "LUGAR_03_curva",
                    "type": "overlay",
                    "kind": "curva",
                    "label": "LUGAR_03_curva"
                }
            ]
        },
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
