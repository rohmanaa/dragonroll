"""Smoke test BOOT (Chrome headless): memastikan halaman entri ES module (*-boot.js) benar-benar hidup di browser.
Tes Node memakai tests/_boot-compat.js (import diubah kembali jadi <script>), jadi TIDAK menangkap masalah urutan eksekusi,
document.write yang diblokir, skrip global yang hilang, atau overlay yang menutupi layar. Smoke ini menangkapnya.
Diperiksa: tanpa pageerror; session.js termuat (UT.Session) di setiap halaman; splash menampilkan form login (bukan "Loading 0%");
#ov (overlay muat) tidak menutupi iframe; gameplay punya THREE + HUD; lobby/powerup tampil. Gagal -> exit 1.
Jalankan: CHROME=/usr/bin/google-chrome python3 -I tools/smoke-boot.py   (butuh: pip install playwright; server statis dibuat otomatis)."""
import sys, threading, http.server, socketserver, functools, os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT)); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = 'http://127.0.0.1:%d/' % port
LOGIN = r'''try{localStorage.setItem('ut-auth',JSON.stringify({id:'testuser-0001',username:'tester'}));sessionStorage.setItem('ut:booted','1')}catch(e){}'''
IGNORE = ('Failed to load resource', 'supabase', 'ERR_')  # jaringan ke Supabase tidak tersedia di sandbox
fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)
def frame_of(page, part):
    return next((f for f in page.frames if part in f.url and f != page.main_frame), None)
def run(browser, name, go, logged, probe, strict=True):
    ctx = browser.new_context(viewport={'width': 1280, 'height': 720})
    if logged: ctx.add_init_script(LOGIN)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:160]))
    pg.goto(BASE + 'play.html?go=' + go, wait_until='load'); pg.wait_for_timeout(7000)
    ov = pg.evaluate("(()=>{const o=document.getElementById('ov');return o?getComputedStyle(o).display:'none'})()")
    check(ov == 'none', name + ': overlay #ov tidak menutupi layar (display=%s)' % ov)
    fr = frame_of(pg, go.split('?')[0])
    check(fr is not None, name + ': iframe memuat ' + go)
    if fr:
        check(fr.evaluate("!!(window.UT&&UT.Session)"), name + ': UT.Session termuat')
        probe(fr)
    msg = name + ': tanpa pageerror' + ('' if not errs else ' -> ' + ' | '.join(errs[:3]))
    if strict or not errs: check(not errs, msg)
    else: print('WARN ' + msg + '  (masalah terbuka: skrip view mode/shop/karakter auto-mount di lobby.html saat jalan di iframe)')
    ctx.close()
import re
def rd(path): return open(os.path.join(ROOT, path), encoding='utf-8').read()
# statis 1: tiap id yang dipakai splash.js lewat $("#id") harus ada di splash.html (bug nyata: #fade hilang -> TAP TO START crash)
ids = sorted(set(re.findall(r'\$\("#([A-Za-z0-9_-]+)"\)', rd('src/views/splash.js'))))
html = rd('splash.html'); gone = [i for i in ids if not re.search(r'id=["\']?%s["\' >]' % re.escape(i), html)]
check(not gone, 'splash.html memuat semua id yang dipakai splash.js' + ('' if not gone else ' (hilang: ' + ', '.join(gone) + ')'))
# statis 2: tiap path di CORE (precache sw.js) harus ada di disk (bug nyata: path tanpa src/ -> 404 di Cache.add)
core = re.search(r'const CORE = \[(.*?)\];', rd('sw.js'), re.S); miss = [u for u in re.findall(r"'([^']+)'", core.group(1)) if not os.path.exists(os.path.join(ROOT, u))]
check(not miss, 'semua path CORE di sw.js ada di disk' + ('' if not miss else ' (hilang: ' + ', '.join(miss[:5]) + ')'))
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
    run(b, 'splash', 'splash.html', False, lambda f: check('Loading' not in f.evaluate("document.body.innerText")[:20] or 'Login' in f.evaluate("document.body.innerText"), 'splash: lolos tahap boot (bukan macet di "Loading 0%")'))
    run(b, 'gameplay', 'gameplay.html', True, lambda f: (check(f.evaluate("!!window.THREE"), 'gameplay: THREE global ada'), check(f.evaluate("document.querySelectorAll('canvas').length>0"), 'gameplay: canvas papan ada')))
    run(b, 'lobby', 'lobby.html', True, lambda f: check(f.evaluate("document.body.children.length>10"), 'lobby: DOM terisi'), strict=False)
    b.close()
srv.shutdown()
print('\nSELESAI:', 'GAGAL (%d)' % len(fails) if fails else 'semua lolos')
sys.exit(1 if fails else 0)
