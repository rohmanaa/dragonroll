"""Smoke test SPA tahap 2 (Chrome headless): buka play.html?go=lobby.html, pindah Lobby <-> Karakter 20x lewat UT.Spa.go.
Yang diukur: jumlah konteks WebGL (0 baru saat pindah; total <=2: renderer bersama + renderer luring), permintaan ulang three.min.js (harus 0 setelah muat awal), draw call halaman yang di-unmount,
error konsol/halaman, memori (performance.memory, Chrome), waktu klik -> mount selesai.
Syarat: pip install playwright; Chrome sistem di /usr/bin/google-chrome (atau set env CHROME=/path/ke/chrome).
Jalankan: python3 -I tools/smoke-spa.py   |   Viewport HARUS landscape (HP portrait memakai jalur iframe, bukan view).
Error jaringan (ERR_TUNNEL_CONNECTION_FAILED / ERR_NAME_NOT_RESOLVED = Supabase, font, CDN yang diblok) diabaikan."""
import sys, json, threading, http.server, socketserver, functools, os
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
H=functools.partial(Q,directory=ROOT)
srv=socketserver.TCPServer(('127.0.0.1',0),H); port=srv.server_address[1]
threading.Thread(target=srv.serve_forever,daemon=True).start()
INIT=r'''
try{localStorage.setItem('ut-auth',JSON.stringify({id:'testuser-0001',username:'tester'}));sessionStorage.setItem('ut:booted','1')}catch(e){}
window.__ctx=0;window.__draws=0;window.__ctxs=[];
const gc=HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext=function(t){if(/webgl/.test(t)){window.__ctx++;window.__ctxs.push((new Error().stack||'').split('\n').slice(2,5).map(x=>x.trim().replace(/^at /,'')).join(' <- '))}return gc.apply(this,arguments)};
for(const C of [window.WebGLRenderingContext,window.WebGL2RenderingContext]){if(!C)continue;
 for(const m of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const o=C.prototype[m];if(o)C.prototype[m]=function(){window.__draws++;return o.apply(this,arguments)}}}
'''
N=int(os.environ.get('N','20'))
out={}
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'),args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-precise-memory-info'])
    pg=b.new_context(viewport={'width':1280,'height':720}).new_page()
    errs=[]; three=[]
    pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    pg.on('console',lambda m:errs.append('console:'+m.text[:200]) if m.type=='error' and not any(x in m.text for x in ('ERR_TUNNEL','ERR_NAME_NOT_RESOLVED','ERR_INTERNET_DISCONNECTED')) else None)
    pg.on('request',lambda r:three.append(r.resource_type+'@'+(r.frame.url.split('/')[-1] if r.frame else '?')) if r.url.split('?')[0].endswith('three.min.js') else None)
    pg.add_init_script(INIT)
    pg.goto(f'http://127.0.0.1:{port}/play.html?go=lobby.html',wait_until='load')
    try:
        pg.wait_for_function("UT&&UT.Spa&&UT.Spa.viewActive&&UT.PageModule.isMounted('lobby')",timeout=45000)
    except Exception as e:
        st=pg.evaluate("({url:location.href,spa:!!(window.UT&&UT.Spa),viewActive:!!(window.UT&&UT.Spa&&UT.Spa.viewActive),page:window.UT&&UT.Spa&&UT.Spa.page,mounted:window.UT&&UT.PageModule&&UT.PageModule.isMounted('lobby'),iframe:(document.getElementById('f')||{}).src,viewHtml:(document.getElementById('view')||{innerHTML:''}).innerHTML.length})")
        print(json.dumps({'GAGAL_MUAT_AWAL':st,'errors':errs[:8]},indent=1,ensure_ascii=False)); sys.exit(2)
    pg.wait_for_timeout(2000)
    out['view_aktif_tanpa_iframe']=pg.evaluate("UT.Spa.viewActive && document.getElementById('f').classList.contains('off')")
    # pemanasan: kunjungi Karakter lalu kembali ke Lobby sekali (renderer luring dibuat malas saat Karakter pertama kali dibuka)
    for tgt in ('karakter','lobby'):
        pg.evaluate(f"UT.Spa.go('{tgt}.html')"); pg.wait_for_function(f"UT.PageModule.isMounted('{tgt}')",timeout=45000); pg.wait_for_timeout(800)
    out['konteks_setelah_pemanasan']=pg.evaluate('window.__ctx'); out['konteks_awal']=out['konteks_setelah_pemanasan']; three0=len(three); out['three_saat_muat_awal']=list(three)
    mem0=pg.evaluate('performance.memory?performance.memory.usedJSHeapSize:0'); times=[]
    for i in range(N):
        tgt='karakter' if i%2==0 else 'lobby'
        t=pg.evaluate(f"""new Promise(res=>{{const t0=performance.now();UT.Spa.go('{tgt}.html').then(()=>{{
            const w=()=>UT.PageModule.isMounted('{tgt}')?res(performance.now()-t0):setTimeout(w,16);w()}})}})""")
        times.append(round(t))
        pg.wait_for_timeout(400)
    old='lobby' if N%2==0 else 'karakter'
    out['mounted_akhir']=pg.evaluate("['lobby','karakter'].filter(n=>UT.PageModule.isMounted(n))")
    out['konteks_akhir']=pg.evaluate('window.__ctx'); out['konteks_baru_saat_pindah']=out['konteks_akhir']-out['konteks_awal']
    out['three_dimuat_ulang']=len(three)-three0; out['three_setelah_pemanasan']=list(three[three0:]); out['konteks_dibuat_oleh']=pg.evaluate('window.__ctxs')
    d0=pg.evaluate('window.__draws'); pg.wait_for_timeout(1000); out['draw_per_dtk_halaman_aktif']=pg.evaluate('window.__draws')-d0
    out['sharedgl']=pg.evaluate('UT.SharedGL.stats()')
    out['waktu_pindah_ms']={'rata2':round(sum(times)/len(times)),'maks':max(times)}
    out['memori_MB']={'awal':round(mem0/1e6,1),'akhir':round(pg.evaluate('performance.memory?performance.memory.usedJSHeapSize:0')/1e6,1)}
    # Back: harus kembali ke rute sebelumnya
    pg.go_back(); pg.wait_for_timeout(1500)
    out['setelah_back']=pg.evaluate("UT.Spa.current()")
    out['errors']=errs[:8]
    ok=out['konteks_baru_saat_pindah']==0 and out['three_dimuat_ulang']==0 and not errs and out['sharedgl']['created']<=2
    out['LULUS']=bool(ok)
    b.close()
print(json.dumps(out,indent=1,ensure_ascii=False)); sys.exit(0 if out['LULUS'] else 1)
