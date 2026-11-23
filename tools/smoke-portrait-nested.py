"""Smoke test HP portrait: shell SPA bersarang (play.html?nested=1) di dalam iframe yang diputar.
Cek: view aktif, innerWidth/innerHeight landscape, pindah rute, dan tap sentuhan nyata (koordinat dikonversi dari rotasi 90deg).
Jalankan: python3 -I tools/smoke-portrait-nested.py (butuh playwright + google-chrome)."""
import json,threading,http.server,socketserver,functools,time
from playwright.sync_api import sync_playwright
import os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
srv=socketserver.ThreadingTCPServer(('127.0.0.1',0),functools.partial(Q,directory=ROOT)); port=srv.server_address[1]
threading.Thread(target=srv.serve_forever,daemon=True).start()
INIT="try{localStorage.setItem('ut-auth',JSON.stringify({id:'testuser-0001',username:'tester'}));sessionStorage.setItem('ut:booted','1')}catch(e){}"
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2); pg=c.new_page(); pg.add_init_script(INIT)
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    cdp=c.new_cdp_session(pg); cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
    pg.goto(f'http://127.0.0.1:{port}/play.html?go=lobby.html'); pg.wait_for_timeout(14000)
    print('frames:',[f.url.split('/')[-1][:60] for f in pg.frames])
    inner=[f for f in pg.frames if 'nested=1' in f.url]
    if not inner: print('NO NESTED'); raise SystemExit
    inn=inner[0]
    print('inner viewActive=',inn.evaluate('UT.Spa.viewActive'),'page=',inn.evaluate('UT.Spa.page'),'inner size=',inn.evaluate('[innerWidth,innerHeight]'),'webgl contexts patched? n/a')
    def wait_hide():
        for i in range(300):
            time.sleep(0.05)
            try:
                if inn.evaluate("document.getElementById('ov').classList.contains('hide')") and pg.evaluate("document.getElementById('ov').classList.contains('hide')"): return
            except Exception: pass
    for dst in ['karakter.html','lobby.html','shop.html','lobby.html','mode.html']:
        t0=time.time(); inn.evaluate(f"UT.Spa.go('{dst}')"); time.sleep(0.2); wait_hide()
        print('->',dst,'%.2fs'%(time.time()-t0),'viewActive=',inn.evaluate('UT.Spa.viewActive'))
    # sentuhan nyata: kembali ke lobby lalu tap tombol karakter
    inn.evaluate("UT.Spa.go('lobby.html')"); time.sleep(0.3); wait_hide(); time.sleep(1)
    r=inn.evaluate("(()=>{const e=document.querySelector('[data-act=karakter]');if(!e)return null;const b=e.getBoundingClientRect();return [b.left+b.width/2,b.top+b.height/2]})()")
    print('tombol karakter (koord inner)=',r)
    if r:
        W=390; ox=W-r[1]; oy=r[0]
        pg.touchscreen.tap(ox,oy); time.sleep(0.5); wait_hide(); time.sleep(0.5)
        print('setelah tap: page=',inn.evaluate('UT.Spa.page'))
    print('errors',errs[:5])
    b.close()
