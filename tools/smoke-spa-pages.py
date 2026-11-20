"""Smoke test SPA tahap 3 (Chrome headless): Lobby -> Profil -> Peringkat -> Tambang -> Teman -> Lobby berulang lewat UT.Spa.go.
Diukur: konteks WebGL baru (harus 0), three.min.js dimuat ulang (0), error konsol/halaman, memori, waktu mount,
tugas LiveSync 'board' setelah keluar leaderboard, kelas html yang bocor (pf-wide), CSS/DOM view yang tertinggal,
tombol Back/Coin/Gem bisa diketuk (tidak tertutup elemen lain), dan tombol menuju halaman non-view (shop/tambang):
shell play.html TIDAK boleh ditinggalkan.
Jalankan: CHROME=/path/ke/chrome N=20 python3 -I tools/smoke-spa-pages.py   (viewport landscape; syarat lain sama dengan smoke-spa.py)."""
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
    HIT="""(sel)=>{const e=document.querySelector(sel);if(!e)return false;const r=e.getBoundingClientRect(),t=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return !!(t&&(t===e||e.contains(t)))}"""
    def mount(n):
        pg.evaluate(f"UT.Spa.go('{n}.html')"); pg.wait_for_function(f"UT.PageModule.isMounted('{n}')",timeout=45000); pg.wait_for_timeout(600)
    pg.goto(f'http://127.0.0.1:{port}/play.html?go=lobby.html',wait_until='load')
    pg.wait_for_function("UT&&UT.Spa&&UT.Spa.viewActive&&UT.PageModule.isMounted('lobby')",timeout=45000); pg.wait_for_timeout(1500)
    for n in ('profile','leaderboard','tambang','friendship','lobby'): mount(n)          # pemanasan

    # tambang butuh MineService server: pasang stub (data palsu) agar pulau 3D + SharedGL benar-benar jalan, bukan mode-lokal
    STUB="""(()=>{const sl=(u)=>({unlocked:u,base_rate:1,unlock_cost:50,rate:u?2:0,stock:3,cap:20,speed_lv:u?3:1,cap_lv:1,next_speed_cost:100,next_cap_cost:100,full_in_secs:3600,boost:{active:false,left_secs:0,left_today:2,cost:10}});
      const d={ok:true,config:{boost_mult:2},slots:[sl(true),sl(true),sl(false)]};
      UT.MineService.get=()=>({get:async()=>JSON.parse(JSON.stringify(d)),collect:async()=>({ok:false,reason:'peti-kosong'}),unlock:async()=>({ok:false,reason:'saldo-kurang'}),boost:async()=>({ok:false,reason:'saldo-kurang'}),upgrade:async()=>({ok:false,reason:'saldo-kurang'})});return true})()"""
    mount('tambang'); mount('lobby')            # muat skrip tambang sekali, lalu timpa MineService
    pg.evaluate(STUB)
    mount('tambang'); pg.wait_for_function("document.querySelectorAll('.slot canvas.cvv').length==3",timeout=15000); pg.wait_for_timeout(1500)
    out['tambang_3d']=pg.evaluate("({owner:UT.SharedGL.owner(),slots:document.querySelectorAll('.slot').length,cv:!!document.querySelector('canvas#cv'),draws:window.__draws})")
    d0=pg.evaluate('window.__draws'); pg.wait_for_timeout(1200); out['tambang_3d']['menggambar']=pg.evaluate('window.__draws')>d0
    pg.click('.slot[data-s="1"] [data-a="collect"]',timeout=8000); pg.wait_for_timeout(500)
    mount('lobby')
    out['tambang_sesudah_keluar']=pg.evaluate("({mounted:UT.PageModule.isMounted('tambang'),cv:!!document.querySelector('canvas#cv'),owner:UT.SharedGL.owner(),tasks:(UT.LiveSync.status()||{}).tasks})")
    ctx0=pg.evaluate('window.__ctx'); three0=len(three); mem0=pg.evaluate('performance.memory?performance.memory.usedJSHeapSize:0'); times={}
    for i in range(N):
        for n in ('profile','leaderboard','tambang','friendship','lobby'):
            t=pg.evaluate(f"""new Promise(res=>{{const t0=performance.now();UT.Spa.go('{n}.html').then(()=>{{const w=()=>UT.PageModule.isMounted('{n}')?res(performance.now()-t0):setTimeout(w,16);w()}})}})""")
            times.setdefault(n,[]).append(round(t)); pg.wait_for_timeout(250)
    out['mounted_akhir']=pg.evaluate("['lobby','karakter','profile','leaderboard','tambang','friendship'].filter(n=>UT.PageModule.isMounted(n))")
    out['konteks_baru']=pg.evaluate('window.__ctx')-ctx0; out['three_dimuat_ulang']=len(three)-three0
    out['sharedgl']=pg.evaluate('UT.SharedGL.stats()')
    out['waktu_mount_ms']={k:{'rata2':round(sum(v)/len(v)),'maks':max(v)} for k,v in times.items()}
    out['memori_MB']={'awal':round(mem0/1e6,1),'akhir':round(pg.evaluate('performance.memory?performance.memory.usedJSHeapSize:0')/1e6,1)}
    mount('leaderboard'); mount('lobby')
    out['livesync_sesudah_keluar']=pg.evaluate("UT.LiveSync?UT.LiveSync.status():null")
    mount('profile'); mount('lobby')
    out['kelas_pf_wide_bocor']=pg.evaluate("document.documentElement.classList.contains('pf-wide')")
    out['link_css_spa']=pg.evaluate("[...new Set([...document.querySelectorAll('link[data-spa],style[data-spa]')].map(e=>e.dataset.spa))]")
    def tappable(n,sel):            # tunggu overlay 'Memuat' shell hilang (maks 4 dtk); tetap tertutup sesudahnya = gagal sungguhan
        mount(n)
        try: pg.wait_for_function("([f,sel])=>eval('('+f+')')(sel)",arg=[HIT,sel],timeout=4000); return True
        except Exception: return False
    out['tombol_bisa_diketuk']={f'{n}{sel}':tappable(n,sel) for n in ('profile','leaderboard','tambang','friendship') for sel in ('#back','#cur-em','#cur-co')}
    nav={}
    for src,sel,tgt in (('profile','#cur-co','shop.html'),('leaderboard','#cur-co','shop.html'),('tambang','#cur-co','shop.html'),('friendship','#cur-co','shop.html')):
        mount(src); pg.click(sel,timeout=8000); pg.wait_for_timeout(2500)
        nav[f'{src}{sel}->{tgt}']=pg.evaluate("({path:location.pathname.split('/').pop(),viewActive:UT.Spa.viewActive,page:UT.Spa.page})")
    out['navigasi_non_view']=nav
    mount('profile'); pg.click('#cur-em',timeout=8000); pg.wait_for_function("UT.PageModule.isMounted('tambang')",timeout=45000); pg.wait_for_timeout(800)
    out['tambang_dari_profil']=pg.evaluate("UT.Spa.current()"); pg.click('#back',timeout=8000); pg.wait_for_timeout(1500)
    out['tambang_back_ke_asal']=pg.evaluate("UT.Spa.current()")
    mount('friendship'); pg.click('#cur-em',timeout=8000); pg.wait_for_function("UT.PageModule.isMounted('tambang')",timeout=45000); pg.wait_for_timeout(800)
    pg.click('#back',timeout=8000); pg.wait_for_timeout(1500); out['tambang_back_ke_friendship']=pg.evaluate("UT.Spa.current()")
    mount('friendship'); pg.click('#back',timeout=8000); pg.wait_for_timeout(1500); out['friendship_back_ke']=pg.evaluate("UT.Spa.current()")
    mount('profile'); pg.click('#back',timeout=8000); pg.wait_for_timeout(1500); out['profil_back_ke']=pg.evaluate("UT.Spa.current()")
    mount('leaderboard'); pg.click('#back',timeout=8000); pg.wait_for_timeout(1500); out['peringkat_back_ke']=pg.evaluate("UT.Spa.current()")
    out['errors']=errs[:8]
    shell_ok=all(v['path']=='play.html' and not v['viewActive'] for v in nav.values())
    nonview_ok=[v['page'] for v in nav.values()]==['shop.html']*4
    ok=(out['konteks_baru']==0 and out['three_dimuat_ulang']==0 and not errs and out['sharedgl']['created']<=2
        and not out['kelas_pf_wide_bocor'] and all(out['tombol_bisa_diketuk'].values()) and out['mounted_akhir']==['lobby'] and shell_ok and nonview_ok
        and out['link_css_spa']==['lobby'] and out['tambang_back_ke_friendship']['name']=='friendship' and out['friendship_back_ke']['name']=='lobby' and out['tambang_3d']['owner']=='tambang' and out['tambang_3d']['slots']==3 and out['tambang_3d']['menggambar'] and not out['tambang_sesudah_keluar']['mounted'] and not out['tambang_sesudah_keluar']['cv'] and out['tambang_sesudah_keluar']['owner']=='lobby' and out['tambang_dari_profil']['name']=='tambang' and out['tambang_back_ke_asal']['name']=='profile' and out['profil_back_ke']['name']=='lobby' and out['peringkat_back_ke']['name']=='lobby'
        and 'board' not in ((out['livesync_sesudah_keluar'] or {}).get('tasks') or []))   # LiveSync boleh jalan (lobby memulainya sendiri); tugas 'board' milik leaderboard harus lepas
    out['LULUS']=bool(ok)
    b.close()
print(json.dumps(out,indent=1,ensure_ascii=False)); sys.exit(0 if out['LULUS'] else 1)
