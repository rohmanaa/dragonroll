"""Smoke test modul halaman (SPA tahap 1) dengan Chrome headless.
Memuat lobby.html dan karakter.html lewat play.html (pembungkus iframe), lalu: cek mounted, hitung draw call WebGL,
unmount -> draw call harus 0, mount ulang -> render lagi.
Syarat: pip install playwright (Chrome sistem di /usr/bin/google-chrome; ubah executable_path bila beda).
Jalankan: python3 -I tools/smoke-page-module.py   (dari mana saja; ROOT dihitung dari lokasi file)
Catatan: boot-guard.js mengalihkan halaman ke splash bila tidak ada sessionStorage 'ut:booted'=1 dan localStorage 'ut-auth';
skrip ini menanam keduanya lewat init script. Error 'ERR_TUNNEL_CONNECTION_FAILED' = permintaan jaringan (Supabase) yang diblok, wajar."""
import sys, json, threading, http.server, socketserver, functools, os
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
H=functools.partial(Q,directory=ROOT)
srv=socketserver.TCPServer(('127.0.0.1',0),H); port=srv.server_address[1]
threading.Thread(target=srv.serve_forever,daemon=True).start()
INIT='''
try{localStorage.setItem('ut-auth',JSON.stringify({id:'testuser-0001',username:'tester'}));sessionStorage.setItem('ut:booted','1')}catch(e){}
window.__draws=0;window.__raf=0;
for(const C of [window.WebGLRenderingContext,window.WebGL2RenderingContext]){if(!C)continue;
 for(const m of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const o=C.prototype[m];if(o)C.prototype[m]=function(){window.__draws++;return o.apply(this,arguments)}}}
const R=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=function(f){window.__raf++;return R(f)};
'''
out={}
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    for name,mod in [('lobby.html','lobby'),('karakter.html','karakter')]:
        pg=b.new_context(viewport={'width':1280,'height':720}).new_page()
        errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
        pg.on('console',lambda m:errs.append('console:'+m.text[:200]) if m.type=='error' else None)
        pg.add_init_script(INIT)
        pg.goto(f'http://127.0.0.1:{port}/play.html?go={name}',wait_until='load')
        pg.wait_for_timeout(4000)
        fr=[f for f in pg.frames if f.url.split('?')[0].endswith('/'+name)][0]
        r={}
        r['mounted']=fr.evaluate(f"UT.PageModule.isMounted('{mod}')")
        d0=fr.evaluate('window.__draws'); pg.wait_for_timeout(1000); d1=fr.evaluate('window.__draws')
        r['draws_per_s_mounted']=d1-d0
        r['unmount_returned']=fr.evaluate(f"UT.PageModule.unmount('{mod}')")
        pg.wait_for_timeout(300)
        d2=fr.evaluate('window.__draws'); r0=fr.evaluate('window.__raf'); pg.wait_for_timeout(1500); d3=fr.evaluate('window.__draws'); r1=fr.evaluate('window.__raf')
        r['draws_after_unmount_1.5s']=d3-d2; r['raf_after_unmount_1.5s']=r1-r0
        r['mounted_after']=fr.evaluate(f"UT.PageModule.isMounted('{mod}')")
        # mount ulang tidak melempar error & render lagi
        fr.evaluate(f"UT.PageModule.mount('{mod}')"); pg.wait_for_timeout(1500)
        d4=fr.evaluate('window.__draws'); pg.wait_for_timeout(1000); r['draws_per_s_remounted']=fr.evaluate('window.__draws')-d4
        r['errors']=errs[:6]
        out[name]=r
    b.close()
print(json.dumps(out,indent=1,ensure_ascii=False))
