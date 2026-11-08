"""Render ikon Power dari model 3D (assets/js/power3d) ke data/power/3d/<gameKey>.png.
Jalankan dari akar repo:  python3 tools/power-icons/bake.py [key ...]   (butuh playwright + Chrome/Chromium; tanpa argumen = semua power).
Power baru: tambahkan di KEY_TO_POWER3D (power-show.js), lalu jalankan dengan key-nya saja agar ikon lain tidak berubah."""
import base64, http.server, os, socketserver, threading, sys
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'data', 'power', '3d'); os.makedirs(OUT, exist_ok=True)
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(s, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as p:
    exe = '/usr/bin/google-chrome' if os.path.exists('/usr/bin/google-chrome') else None
    b = p.chromium.launch(executable_path=exe, args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 400, 'height': 400})
    pg.on('console', lambda m: print('[console]', m.text) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: print('[pageerror]', e))
    pg.goto(f'http://127.0.0.1:{port}/tools/power-icons/bake.html')
    pg.wait_for_function('window.ready === true', timeout=60000)
    want = sys.argv[1:]
    for k in pg.evaluate('window.keys'):
        if want and k not in want: continue
        d = pg.evaluate(f'window.bake({k!r})')
        open(os.path.join(OUT, k + '.png'), 'wb').write(base64.b64decode(d.split(',', 1)[1])); print('ok', k)
    b.close()
srv.shutdown()
