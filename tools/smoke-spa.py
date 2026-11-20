"""Smoke test SPA tahap 2 (Chrome headless): buka play.html?go=lobby.html, pindah Lobby <-> Karakter 20x lewat UT.Spa.go.
Yang diukur: jumlah konteks WebGL (harus 1), permintaan ulang three.min.js (harus 0 setelah muat awal), draw call halaman yang di-unmount,
error konsol/halaman, memori (performance.memory, Chrome), waktu klik -> mount selesai.
Syarat: pip install playwright; Chrome sistem di /usr/bin/google-chrome (ubah executable_path bila beda).
Jalankan: python3 -I tools/smoke-spa.py   |   Viewport HARUS landscape (HP portrait memakai jalur iframe, bukan view).
Error 'ERR_TUNNEL_CONNECTION_FAILED' = permintaan Supabase yang diblok, wajar."""
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
window.__ctx=0;window.__draws=0;
const gc=HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext=function(t){if(/webgl/.test(t))window.__ctx++;return gc.apply(this,arguments)};
for(const C of [window.WebGLRenderingContext,window.WebGL2RenderingContext]){if(!C)continue;
 for(const m of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const o=C.prototype[m];if(o)C.prototype[m]=function(){window.__draws++;return o.apply(this,arguments)}}}
'''
N=int(os.environ.get('N','20'))
out={}
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-precise-memory-info'])
    pg=b.new_context(viewport={'width':1280,'height':720}).new_page()
    errs=[]; three=[]
    pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    pg.on('console',lambda m:errs.append('console:'+m.text[:200]) if m.type=='error' and 'ERR_TUNNEL' not in m.text else None)
    pg.on('request',lambda r:three.append(r.url) if r.url.endswith('three.min.js') else None)
    pg.add_init_script(INIT)
    pg.goto(f'http://127.0.0.1:{port}/play.html?go=lobby.html',wait_until='load')
    pg.wait_for_function("UT&&UT.Spa&&UT.Spa.viewActive&&UT.PageModule.isMounted('lobby')",timeout=15000)
    pg.wait_for_timeout(2000)
    out['view_aktif_tanpa_iframe']=pg.evaluate("UT.Spa.viewActive && document.getElementById('f').classList.contains('off')")
    out['konteks_awal']=pg.evaluate('window.__ctx'); three0=len(three)
    mem0=pg.evaluate('performance.memory?performance.memory.usedJSHeapSize:0'); times=[]
    for i in range(N):
        tgt='karakter' if i%2==0 else 'lobby'
        t=pg.evaluate(f"""new Promise(res=>{{const t0=performance.now();UT.Spa.go('{tgt}.html').then(()=>{{
            const w=()=>UT.PageModule.isMounted('{tgt}')?res(performance.now()-t0):setTimeout(w,16);w()}})}})""")
        times.append(round(t))
        pg.wait_for_timeout(400)
    old='lobby' if N%2==0 else 'karakter'
    out['mounted_akhir']=pg.evaluate("['lobby','karakter'].filter(n=>UT.PageModule.isMounted(n))")
    out['konteks_akhir']=pg.evaluate('window.__ctx')
    out['three_dimuat_ulang']=len(three)-three0
    d0=pg.evaluate('window.__draws'); pg.wait_for_timeout(1000); out['draw_per_dtk_halaman_aktif']=pg.evaluate('window.__draws')-d0
    out['sharedgl']=pg.evaluate('UT.SharedGL.stats()')
    out['waktu_pindah_ms']={'rata2':round(sum(times)/len(times)),'maks':max(times)}
    out['memori_MB']={'awal':round(mem0/1e6,1),'akhir':round(pg.evaluate('performance.memory?performance.memory.usedJSHeapSize:0')/1e6,1)}
    # Back: harus kembali ke rute sebelumnya
    pg.go_back(); pg.wait_for_timeout(1500)
    out['setelah_back']=pg.evaluate("UT.Spa.current()")
    out['errors']=errs[:8]
    ok=out['konteks_akhir']==1 and out['three_dimuat_ulang']==0 and not errs
    out['LULUS']=bool(ok)
    b.close()
print(json.dumps(out,indent=1,ensure_ascii=False)); sys.exit(0 if out['LULUS'] else 1)
