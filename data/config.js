// config.js - Configuracion del visor
// Geoportal Alma de Campo

window.__CONFIG = {
    // Webhook de Google Sheets para registrar visitas en vivo (GitHub Pages y servidor)
    "GOOGLE_SHEETS_WEBHOOK_URL": "https://script.google.com/macros/s/AKfycbzQ-n6r5bw9RMX5qP1vIpLaFQ4OE3qY-0bDege33YH4XoqamUwvtbQCp5d9xOjrH7_qTw/exec",
    "BASE_LAYERS": {
        "osm": {
            "attribution": "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors",
            "label": "Mapa base - OpenStreetMap",
            "type": "osm"
        },
        "ortofoto_alma_campo": {
            "attribution": "Ortofoto UAV INyDES / Alma de Campo 2026 (GSD 3.8 cm/px)",
            "label": "Ortofoto UAV Alta Resolución (3.8 cm/px)",
            "maxZoom": 21,
            "minZoom": 14,
            "type": "xyz",
            "url": "./ortofoto_alma_campo/tiles/{z}/{x}/{y}.png?v=1"
        }
    },
    "CENTER": [-97.845664, 17.897863],
    "ZOOM": 18.0,
    "MIN_ZOOM": 12,
    "MAX_ZOOM": 21,
    "DEFAULT_BASE_LAYERS": [
        "osm",
        "ortofoto_alma_campo"
    ],
    "EXTENTS": {
        "alma_campo": [
            -97.846943,
            17.896546,
            -97.844386,
            17.899180
        ]
    },
    "OVERLAY_LAYERS": {
        "curvas_nivel": {
            "type": "contour",
            "color": "#0077b6",
            "label": "🏔️ Curvas de nivel 1.0m",
            "url": "./data/curvas_nivel.geojson?v=1",
            "visible": true
        },
        "formas2": {
            "color": "#10b981",
            "label": "📍 Zona en revision",
            "url": "./data/formas2.geojson?v=1",
            "visible": false
        },
        "fotos": {
            "color": "#ffb703",
            "label": "📷 Fotos y Vistas 360°",
            "url": "./data/fotos_san_martin.geojson?v=1",
            "visible": false
        }
    }
};
