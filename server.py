"""
Servidor HTTP multi-hilo con charset=utf-8 en Content-Type
Soporta peticiones concurrentes, Streaming 206 para Video MP4 y Registro de Visitas con Geolocalización.
Geoportal Alma de Campo
"""
import http.server
import os
import sys
import re
import json
import threading
import urllib.request
from datetime import datetime

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
DIR = os.path.dirname(os.path.abspath(__file__))
VIDEO_PATH = os.path.join(DIR, "data", "video.mp4")
VISITAS_FILE = os.path.join(DIR, "data", "visitas.json")

if not os.path.exists(VIDEO_PATH):
    VIDEO_PATH = r"F:\INYDES\Relleno_Sanitario_San_Martin\DJI_202609181102_026\DJI_20260918110636_0001_V.MP4"

# Cache de IPs para no saturar la API
IP_CACHE = {}

def get_ip_geolocation(ip):
    if not ip or ip in ['127.0.0.1', '::1', 'localhost'] or ip.startswith(('192.168.', '10.', '172.16.')):
        return {"ubicacion": "Red Local / Servidor", "ciudad": "Local", "pais": "Local", "lat": None, "lon": None}
    
    if ip in IP_CACHE:
        return IP_CACHE[ip]
    
    try:
        url = f"http://ip-api.com/json/{ip}?fields=status,country,regionName,city,lat,lon,isp"
        req = urllib.request.Request(url, headers={'User-Agent': 'VisorSanMartin/1.0'})
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if data.get('status') == 'success':
                res = {
                    "ubicacion": f"{data.get('city', '')}, {data.get('regionName', '')}, {data.get('country', '')}",
                    "ciudad": data.get('city', ''),
                    "estado": data.get('regionName', ''),
                    "pais": data.get('country', ''),
                    "lat": data.get('lat'),
                    "lon": data.get('lon'),
                    "isp": data.get('isp', '')
                }
                IP_CACHE[ip] = res
                return res
    except Exception:
        pass
    
    return {"ubicacion": "Ubicación desconocida", "ciudad": "", "pais": "", "lat": None, "lon": None}

def registrar_visita(ip, user_agent, coords=None):
    def _worker():
        try:
            os.makedirs(os.path.dirname(VISITAS_FILE), exist_ok=True)
            visitas = []
            if os.path.exists(VISITAS_FILE):
                try:
                    with open(VISITAS_FILE, 'r', encoding='utf-8') as f:
                        visitas = json.load(f)
                except Exception:
                    visitas = []
            
            geo = get_ip_geolocation(ip)
            fecha_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            entry = {
                "fecha": fecha_str,
                "ip": ip,
                "dispositivo": user_agent[:120] if user_agent else "Desconocido",
                "ubicacion": geo.get("ubicacion", "Desconocida"),
                "ciudad": geo.get("ciudad", ""),
                "estado": geo.get("estado", ""),
                "pais": geo.get("pais", ""),
                "lat": coords.get("lat") if coords else geo.get("lat"),
                "lon": coords.get("lon") if coords else geo.get("lon")
            }
            
            visitas.append(entry)
            # Guardar ultimas 1000 visitas
            if len(visitas) > 1000:
                visitas = visitas[-1000:]
                
            with open(VISITAS_FILE, 'w', encoding='utf-8') as f:
                json.dump(visitas, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print("Error registrando visita:", e)
            
    threading.Thread(target=_worker, daemon=True).start()

class UTF8Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        if self.path.endswith(('.html', '.js', '.css', '.json', '.geojson', '.txt')):
            self._charset_added = True
        super().end_headers()

    def do_GET(self):
        clean_path = self.path.split('?')[0]
        
        # API de visitas
        if clean_path == '/api/visitas':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            if os.path.exists(VISITAS_FILE):
                with open(VISITAS_FILE, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.wfile.write(b'[]')
            return

        # Registrar visita al entrar al index
        if clean_path in ['/', '/index.html']:
            client_ip = self.headers.get('X-Forwarded-For', self.client_address[0]).split(',')[0].strip()
            user_agent = self.headers.get('User-Agent', '')
            registrar_visita(client_ip, user_agent)

        # Video streaming
        if clean_path in ['/data/video.mp4', '/video.mp4', '/dji_video.mp4'] and os.path.exists(VIDEO_PATH):
            self.serve_video_file(VIDEO_PATH)
            return
        
        super().do_GET()

    def do_POST(self):
        clean_path = self.path.split('?')[0]
        if clean_path == '/api/log_visit':
            try:
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length) if length > 0 else b'{}'
                data = json.loads(body.decode('utf-8'))
                client_ip = self.headers.get('X-Forwarded-For', self.client_address[0]).split(',')[0].strip()
                user_agent = self.headers.get('User-Agent', '')
                coords = data.get('coords') if isinstance(data, dict) else None
                registrar_visita(client_ip, user_agent, coords)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"status":"ok"}')
                return
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                return
                
        super().do_POST()

    def serve_video_file(self, video_file_path):
        try:
            file_size = os.path.getsize(video_file_path)
            range_header = self.headers.get('Range', None)

            if range_header:
                match = re.search(r'bytes=(\d+)-(\d*)', range_header)
                if match:
                    start = int(match.group(1))
                    end = int(match.group(2)) if match.group(2) else file_size - 1
                    end = min(end, file_size - 1)
                    length = end - start + 1

                    self.send_response(206)
                    self.send_header('Content-Type', 'video/mp4')
                    self.send_header('Content-Range', f'bytes {start}-{end}/{file_size}')
                    self.send_header('Content-Length', str(length))
                    self.send_header('Accept-Ranges', 'bytes')
                    self.end_headers()

                    with open(video_file_path, 'rb') as f:
                        f.seek(start)
                        chunk_size = 64 * 1024
                        bytes_left = length
                        while bytes_left > 0:
                            chunk = f.read(min(chunk_size, bytes_left))
                            if not chunk:
                                break
                            self.wfile.write(chunk)
                            bytes_left -= len(chunk)
                    return

            self.send_response(200)
            self.send_header('Content-Type', 'video/mp4')
            self.send_header('Content-Length', str(file_size))
            self.send_header('Accept-Ranges', 'bytes')
            self.end_headers()

            with open(video_file_path, 'rb') as f:
                chunk_size = 64 * 1024
                while True:
                    chunk = f.read(chunk_size)
                    if not chunk:
                        break
                    self.wfile.write(chunk)

        except (ConnectionResetError, BrokenPipeError):
            pass
        except Exception as e:
            print("Error sirviendo video:", e)

    def guess_type(self, path):
        result = super().guess_type(path)
        if path.endswith(('.html', '.js', '.css', '.json', '.geojson', '.txt', '.xml')):
            if result.startswith('text/'):
                return result + '; charset=utf-8'
            return 'text/plain; charset=utf-8'
        return result

    def log_message(self, format, *args):
        if len(args) >= 2 and str(args[1]) == '404' and '/tiles/' in str(args[0]):
            return
        super().log_message(format, *args)

os.chdir(DIR)
http.server.ThreadingHTTPServer.allow_reuse_address = True
print(f"Serving {DIR} at http://127.0.0.1:{PORT}/ (multithreaded + streaming + auditoria visitas)")
with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), UTF8Handler) as httpd:
    httpd.serve_forever()
