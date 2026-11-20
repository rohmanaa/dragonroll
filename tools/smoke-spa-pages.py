"""Smoke test SPA tahap 3 (Chrome headless): Lobby -> Profil -> Peringkat -> Tambang -> Teman -> Toko -> Mode -> Lobby berulang lewat UT.Spa.go.
Diukur: konteks WebGL baru (harus 0), three.min.js dimuat ulang (0), error konsol/halaman, memori, waktu mount,
tugas LiveSync 'board' setelah keluar leaderboard, kelas html yang bocor (pf-wide), CSS/DOM view yang tertinggal,
tombol Back/Coin/Gem bisa diketuk (tidak tertutup elemen lain), dan tombol menuju halaman non-view (inventory):
shell play.html TIDAK boleh ditinggalkan. Toko (?coin=1, tab, Back, Riwayat) dan Mode (peta, geser, flip, Quick Start, Coin/Gem/Back, pilih room) dicek sebagai view.
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
    URL={'room':'room.html?mode=vsc&format=solo&count=2'}
    def mount(n):
        pg.evaluate(f"UT.Spa.go('{URL.get(n,n+'.html')}')"); pg.wait_for_function(f"UT.PageModule.isMounted('{n}')",timeout=45000); pg.wait_for_timeout(600)
    pg.goto(f'http://127.0.0.1:{port}/play.html?go=lobby.html',wait_until='load')
    pg.wait_for_function("UT&&UT.Spa&&UT.Spa.viewActive&&UT.PageModule.isMounted('lobby')",timeout=45000); pg.wait_for_timeout(1500)
    for n in ('profile','leaderboard','tambang','friendship','shop','mode','hadiah-misi','chest','mail','settings','room','lobby'): mount(n)          # pemanasan

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
        for n in ('profile','leaderboard','tambang','friendship','shop','mode','hadiah-misi','chest','mail','settings','room','lobby'):
            t=pg.evaluate(f"""new Promise(res=>{{const t0=performance.now();UT.Spa.go('{URL.get(n,n+'.html')}').then(()=>{{const w=()=>UT.PageModule.isMounted('{n}')?res(performance.now()-t0):setTimeout(w,16);w()}})}})""")
            times.setdefault(n,[]).append(round(t)); pg.wait_for_timeout(250)
    out['mounted_akhir']=pg.evaluate("['lobby','karakter','profile','leaderboard','tambang','friendship','shop','mode','hadiah-misi','chest','mail','settings','room'].filter(n=>UT.PageModule.isMounted(n))")
    out['konteks_baru']=pg.evaluate('window.__ctx')-ctx0; out['three_dimuat_ulang']=len(three)-three0
    out['sharedgl']=pg.evaluate('UT.SharedGL.stats()')
    out['waktu_mount_ms']={k:{'rata2':round(sum(v)/len(v)),'maks':max(v)} for k,v in times.items()}
    out['memori_MB']={'awal':round(mem0/1e6,1),'akhir':round(pg.evaluate('performance.memory?performance.memory.usedJSHeapSize:0')/1e6,1)}
    mount('leaderboard'); mount('lobby')
    out['livesync_sesudah_keluar']=pg.evaluate("UT.LiveSync?UT.LiveSync.status():null")
    mount('profile'); mount('lobby')
    out['kelas_pf_wide_bocor']=pg.evaluate("document.documentElement.classList.contains('pf-wide')")
    out['link_css_spa']=pg.evaluate("[...new Set([...document.querySelectorAll('link[data-spa],style[data-spa]')].map(e=>e.dataset.spa))]")
    def tappable(n,sel):            # tunggu overlay 'Memuat' shell hilang (maks 10 dtk; SwiftShader lambat); tetap tertutup sesudahnya = gagal sungguhan
        mount(n)
        try: pg.wait_for_function("([f,sel])=>eval('('+f+')')(sel)",arg=[HIT,sel],timeout=10000); return True
        except Exception: return False
    out['tombol_bisa_diketuk']={f'{n}{sel}':tappable(n,sel) for n in ('profile','leaderboard','tambang','friendship','shop','mode','hadiah-misi','chest','mail') for sel in ('#back','#cur-em','#cur-co')}
    nav={}
    for src in ('profile','leaderboard','tambang','friendship'):       # tombol Coin kini membuka TOKO sebagai view (bukan iframe), shell tetap
        mount(src); pg.click('#cur-co',timeout=8000); pg.wait_for_function("UT.PageModule.isMounted('shop')",timeout=45000); pg.wait_for_timeout(500)
        nav[f'{src}#cur-co->shop']=pg.evaluate("({path:location.pathname.split('/').pop(),viewActive:UT.Spa.viewActive,cur:UT.Spa.current(),tab:(document.querySelector('.tabb.on')||{}).dataset&&document.querySelector('.tabb.on').dataset.k})")
    out['navigasi_ke_toko']=nav
    mount('lobby'); pg.evaluate("UT.Spa.go('inventory.html')"); pg.wait_for_timeout(2500)          # halaman non-view tetap lewat iframe di dalam shell
    out['navigasi_non_view']={'lobby->inventory':pg.evaluate("({path:location.pathname.split('/').pop(),viewActive:UT.Spa.viewActive,page:UT.Spa.page})")}
    mount('lobby')
    # TOKO: ?coin=1 -> tab Coin; ?tab=history; ?emerald -> tab Emerald (+ modal); Back ke lobby; Riwayat; pindah tab; tidak ada sisa DOM/CSS/kelas/langganan
    pg.evaluate("UT.Spa.go('shop.html?coin=1')"); pg.wait_for_function("UT.PageModule.isMounted('shop')",timeout=45000); pg.wait_for_timeout(500)
    out['toko_coin']=pg.evaluate("({tab:document.querySelector('.tabb.on').dataset.k,kartu:document.querySelectorAll('#cards .card').length,hl:!!document.querySelector('#cards .card.hl'),body:document.body.className})")
    pg.click('.tabb[data-k="history"]',timeout=8000); pg.click('#histbtn',timeout=8000); pg.wait_for_timeout(600)
    out['toko_riwayat']=pg.evaluate("({tab:document.querySelector('.tabb.on').dataset.k,ada_hasil:!!document.querySelector('#histlist .hempty')})")
    pg.click('#cur-em',timeout=8000); pg.wait_for_timeout(300); out['toko_klik_emerald']=pg.evaluate("document.querySelector('.tabb.on').dataset.k")
    pg.evaluate("UT.Spa.go('shop.html?emerald=1')"); pg.wait_for_timeout(1500)
    out['toko_emerald_modal']=pg.evaluate("({tab:document.querySelector('.tabb.on')&&document.querySelector('.tabb.on').dataset.k,modal:getComputedStyle(document.querySelector('#modal')).display})")
    pg.keyboard.press('Escape'); pg.wait_for_timeout(500)
    pg.click('#back',timeout=8000); pg.wait_for_function("UT.PageModule.isMounted('lobby')",timeout=45000); pg.wait_for_timeout(600)
    out['toko_sisa']=pg.evaluate("({mounted:UT.PageModule.isMounted('shop'),dom:!!document.querySelector('#cards,#tabs,#histbtn,#modal'),kelasSub:document.body.classList.contains('sub'),css:[...document.querySelectorAll('link[data-spa=\"shop\"],style[data-spa=\"shop\"]')].length,tasks:(UT.LiveSync.status()||{}).tasks})")
    # MODE (tahap 3-6): view (bukan iframe); #view tunggal (milik shell); peta/dots/tile/opsi; panah, geser, flip, Quick Start (game:start dicegat),
    # Back/Coin/Gem, pilih room lewat shell; tanpa sisa DOM/CSS. Geser di LUAR #mapview tidak boleh mengganti peta (regresi bentrok #view dengan shell).
    pg.evaluate("window.__launch=null;window.addEventListener('game:start',e=>{e.preventDefault();window.__launch=e.detail})")
    IDX="[...document.querySelectorAll('#dots i')].findIndex(e=>e.classList.contains('on'))"
    OPEN="[...document.querySelectorAll('.flip.open')].map(e=>e.dataset.id)"
    mount('lobby'); mount('mode')
    out['mode_awal']=pg.evaluate("""({path:location.pathname.split('/').pop(),viewActive:UT.Spa.viewActive,cur:UT.Spa.current(),idView:document.querySelectorAll('#view').length,
      shellView:!!document.querySelector('body > #view'),peta:document.querySelectorAll('#track .map').length,dots:document.querySelectorAll('#dots i').length,
      tile:document.querySelectorAll('.flip').length,opt:document.querySelectorAll('.opts .opt').length,dm:document.body.classList.contains('dm'),
      info:document.querySelector('#mapinfo').textContent.slice(0,40)})""")
    out['mode_awal']['aktif']=pg.evaluate(IDX)
    pg.click('#next',timeout=8000); pg.wait_for_timeout(250); a1=pg.evaluate(IDX)                      # 1 = NETHER
    pg.click('#next',timeout=8000); pg.wait_for_timeout(250); a2=pg.evaluate(IDX); toast=pg.evaluate("document.querySelector('#toast').classList.contains('on')")   # 2 = THE END (terkunci)
    pg.click('#next',timeout=8000); pg.wait_for_timeout(250); a3=pg.evaluate(IDX)                      # kembali ke 0 (WORLD)
    bb=pg.evaluate("(()=>{const r=document.querySelector('#mapview').getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height}})()")
    cx,cy=bb['x']+bb['w']/2,bb['y']+bb['h']/2
    pg.mouse.move(cx,cy); pg.mouse.down(); pg.mouse.move(cx-200,cy,steps=5); pg.mouse.up(); pg.wait_for_timeout(250); s1=pg.evaluate(IDX)   # geser kiri -> 1
    pg.mouse.move(cx,cy); pg.mouse.down(); pg.mouse.move(cx+200,cy,steps=5); pg.mouse.up(); pg.wait_for_timeout(250); s2=pg.evaluate(IDX)   # geser kanan -> 0
    qb=pg.evaluate("(()=>{const r=document.querySelector('#quick .hd').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()")
    pg.mouse.move(qb['x'],qb['y']); pg.mouse.down(); pg.mouse.move(qb['x']-160,qb['y'],steps=5); pg.mouse.up(); pg.wait_for_timeout(250); s3=pg.evaluate(IDX)   # di luar peta -> tetap 0
    out['mode_peta']={'panah':[a1,a2,a3],'toast_end':toast,'geser':[s1,s2],'geser_luar':s3}
    pg.click('.flip[data-id="q-solo"] .front',timeout=8000); pg.wait_for_timeout(300); f1=pg.evaluate(OPEN)
    pg.click('.flip[data-id="c-vsc"] .front',timeout=8000); pg.wait_for_timeout(300); f2=pg.evaluate(OPEN)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300); f3=pg.evaluate(OPEN)
    pg.click('.flip[data-id="q-solo"] .front',timeout=8000); pg.wait_for_timeout(500); pg.click('#quick .flip[data-id="q-solo"] .opt >> nth=0',timeout=8000); pg.wait_for_timeout(500)
    mm1=pg.evaluate("({on:document.querySelector('#modal').classList.contains('on'),mt:document.querySelector('#mt').textContent})")
    pg.click('#mcancel',timeout=8000); pg.wait_for_timeout(300); mm2=pg.evaluate("document.querySelector('#modal').classList.contains('on')")
    out['mode_flip']={'q_solo':f1,'c_vsc':f2,'escape':f3,'quick_modal':mm1,'sesudah_batal':mm2}
    nm={}
    pg.click('#cur-co',timeout=8000); pg.wait_for_function("UT.PageModule.isMounted('shop')",timeout=45000); pg.wait_for_timeout(500)
    nm['coin->shop']=pg.evaluate("({path:location.pathname.split('/').pop(),viewActive:UT.Spa.viewActive,cur:UT.Spa.current(),tab:(document.querySelector('.tabb.on')||{}).dataset&&document.querySelector('.tabb.on').dataset.k})")
    mount('mode'); pg.click('#cur-em',timeout=8000); pg.wait_for_function("UT.PageModule.isMounted('tambang')",timeout=45000); pg.wait_for_timeout(800)
    nm['gem->tambang']=pg.evaluate("({path:location.pathname.split('/').pop(),cur:UT.Spa.current()})")
    pg.click('#back',timeout=8000); pg.wait_for_function("UT.PageModule.isMounted('mode')",timeout=45000); pg.wait_for_timeout(800)
    nm['tambang_back->mode']=pg.evaluate("UT.Spa.current()")
    pg.click('#back',timeout=8000); pg.wait_for_function("UT.PageModule.isMounted('lobby')",timeout=45000); pg.wait_for_timeout(600)
    nm['back->lobby']=pg.evaluate("({path:location.pathname.split('/').pop(),cur:UT.Spa.current(),mode:UT.PageModule.isMounted('mode')})")
    mount('mode'); pg.click('.flip[data-id="c-vsc"] .front',timeout=8000); pg.wait_for_timeout(500); pg.click('#create .flip[data-id="c-vsc"] .opt >> nth=0',timeout=8000); pg.wait_for_timeout(3000)
    nm['vsc->room']=pg.evaluate("({path:location.pathname.split('/').pop(),viewActive:UT.Spa.viewActive,cur:UT.Spa.current(),mode:UT.PageModule.isMounted('mode'),room:UT.PageModule.isMounted('room')})")
    mount('mode'); pg.click('.flip[data-id="q-team"] .front',timeout=8000); pg.wait_for_timeout(500); pg.click('#quick .flip[data-id="q-team"] .opt >> nth=0',timeout=8000); pg.wait_for_timeout(4200)
    nm['quick_team->launch']=pg.evaluate("({lawan:document.querySelector('#mt').textContent,cfg:window.__launch&&{type:window.__launch.type,format:window.__launch.format,players:window.__launch.players.length,map:window.__launch.map},path:location.pathname.split('/').pop()})")
    out['mode_nav']=nm
    mount('lobby')
    out['mode_sisa']=pg.evaluate("""({mounted:UT.PageModule.isMounted('mode'),dom:!!document.querySelector('#track,#maps,#quick,#create,#mbox,#mapview'),dm:document.body.classList.contains('dm'),
      css:[...document.querySelectorAll('link[data-spa="mode"],style[data-spa="mode"]')].length,shellView:!!document.querySelector('body > #view')})""")
    mount('profile'); pg.click('#cur-em',timeout=8000); pg.wait_for_function("UT.PageModule.isMounted('tambang')",timeout=45000); pg.wait_for_timeout(800)
    out['tambang_dari_profil']=pg.evaluate("UT.Spa.current()"); pg.click('#back',timeout=8000); pg.wait_for_timeout(1500)
    out['tambang_back_ke_asal']=pg.evaluate("UT.Spa.current()")
    mount('friendship'); pg.click('#cur-em',timeout=8000); pg.wait_for_function("UT.PageModule.isMounted('tambang')",timeout=45000); pg.wait_for_timeout(800)
    pg.click('#back',timeout=8000); pg.wait_for_timeout(1500); out['tambang_back_ke_friendship']=pg.evaluate("UT.Spa.current()")
    mount('friendship'); pg.click('#back',timeout=8000); pg.wait_for_timeout(1500); out['friendship_back_ke']=pg.evaluate("UT.Spa.current()")
    mount('profile'); pg.click('#back',timeout=8000); pg.wait_for_timeout(1500); out['profil_back_ke']=pg.evaluate("UT.Spa.current()")
    mount('leaderboard'); pg.click('#back',timeout=8000); pg.wait_for_timeout(1500); out['peringkat_back_ke']=pg.evaluate("UT.Spa.current()")
    # ROOM (tahap 3-11): view; offline VS Computer (2 pemain), perlengkapan, modal Power/Equipment, Escape, START -> game:start (dicegat),
    # Back -> mode, KELUAR -> lobby; kelas html (dro/mp-online) dan DOM/CSS tidak tersisa. Mode ONLINE: modul multiplayer dimuat lewat import() di shell
    # (RoomService ada, RoomDiceArt ada); setup server gagal tanpa jaringan -> pesan galat room dibuang dari daftar galat.
    mount('lobby'); mount('room')
    pg.wait_for_function("window.RoomDiceArt",timeout=15000)
    out['room_awal']=pg.evaluate("""({path:location.pathname.split('/').pop(),viewActive:UT.Spa.viewActive,cur:UT.Spa.current(),idStage:document.querySelectorAll('#stage').length,
      pemain:document.querySelectorAll('#list .pl:not(.empty)').length,bot:document.querySelectorAll('#list .badge.bot').length,slotEq:document.querySelectorAll('#eq .slot').length,
      slotPower:document.querySelectorAll('#prow .ps').length,chips:document.querySelectorAll('#chips .chip').length,startOn:!document.querySelector('#start').disabled,
      peta:!!document.querySelector('#mArt img,#mArt svg'),dm:document.body.classList.contains('dm'),diceArt:!!(window.RoomDiceArt&&window.RoomDiceArt.thumb)})""")
    pg.click('#power',timeout=8000); pg.wait_for_timeout(400); pm=pg.evaluate("document.querySelector('#pm').classList.contains('on')")
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300); pm2=pg.evaluate("document.querySelector('#pm').classList.contains('on')")
    pg.click('.slot[data-k="dice"]',timeout=8000); pg.wait_for_timeout(400); em=pg.evaluate("({on:document.querySelector('#em').classList.contains('on'),n:document.querySelectorAll('#emL .it').length})")
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300); em2=pg.evaluate("document.querySelector('#em').classList.contains('on')")
    out['room_modal']={'power':pm,'power_esc':pm2,'dadu':em,'dadu_esc':em2}
    pg.click('#start',timeout=8000); pg.wait_for_timeout(800)
    out['room_start']=pg.evaluate("({cfg:window.__launch&&{type:window.__launch.type,mode:window.__launch.mode,players:window.__launch.players.length},path:location.pathname.split('/').pop()})")
    pg.click('#back',timeout=8000); pg.wait_for_function("UT.PageModule.isMounted('mode')",timeout=45000); pg.wait_for_timeout(600)
    out['room_back']=pg.evaluate("({cur:UT.Spa.current(),room:UT.PageModule.isMounted('room')})")
    mount('room'); pg.click('#leave',timeout=8000); pg.wait_for_function("UT.PageModule.isMounted('lobby')",timeout=45000); pg.wait_for_timeout(600)
    out['room_keluar']=pg.evaluate("({cur:UT.Spa.current(),room:UT.PageModule.isMounted('room')})")
    out['room_sisa']=pg.evaluate("""({dom:!!document.querySelector('#eq,#prow,#players,#pageModal,#pm,#em,#dr'),dro:document.documentElement.classList.contains('dro'),mp:document.documentElement.classList.contains('mp-online'),
      css:[...document.querySelectorAll('link[data-spa="room"],style[data-spa="room"]')].length,tasks:(UT.LiveSync.status()||{}).tasks})""")
    pg.evaluate("UT.Spa.go('room.html?mode=online&format=solo')"); pg.wait_for_function("UT.PageModule.isMounted('room')",timeout=45000); pg.wait_for_timeout(4000)
    out['room_online']=pg.evaluate("({mp:!!(UT.Multiplayer&&UT.Multiplayer.RoomService),presence:!!(UT.Multiplayer&&UT.Multiplayer.Presence),mpOnlineClass:document.documentElement.classList.contains('mp-online'),host:document.querySelector('#chips').textContent.indexOf('HOST')>0})")
    mount('lobby')
    out['room_online']['kelas_sisa']=pg.evaluate("document.documentElement.classList.contains('mp-online')")
    errs[:]=[e for e in errs if 'room setup failed' not in e]
    out['errors']=errs[:8]
    shell_ok=all(v['path']=='play.html' and not v['viewActive'] for v in out['navigasi_non_view'].values())
    nonview_ok=[v['page'] for v in out['navigasi_non_view'].values()]==['inventory.html']
    toko_nav_ok=all(v['path']=='play.html' and v['viewActive'] and v['cur']['name']=='shop' and v['tab']=='coin' for v in nav.values())
    toko_ok=(out['toko_coin']['tab']=='coin' and out['toko_coin']['kartu']==3 and out['toko_coin']['hl'] and out['toko_riwayat']['tab']=='history' and out['toko_riwayat']['ada_hasil']
        and out['toko_klik_emerald']=='emerald' and out['toko_emerald_modal']['tab']=='emerald' and out['toko_emerald_modal']['modal']!='none' and not out['toko_sisa']['mounted'] and not out['toko_sisa']['dom']
        and not out['toko_sisa']['kelasSub'] and out['toko_sisa']['css']==0)
    ma=out['mode_awal']; mp=out['mode_peta']; mf=out['mode_flip']; mn=out['mode_nav']
    mode_ok=(ma['path']=='play.html' and ma['viewActive'] and ma['cur']['name']=='mode' and ma['idView']==1 and ma['shellView'] and ma['peta']==3 and ma['dots']==3 and ma['tile']==5 and ma['opt']==12
        and ma['dm'] and ma['aktif']==0 and mp['panah']==[1,2,0] and mp['toast_end'] and mp['geser']==[1,0] and mp['geser_luar']==0
        and mf['q_solo']==['q-solo'] and mf['c_vsc']==['c-vsc'] and mf['escape']==[] and mf['quick_modal']['on'] and not mf['sesudah_batal']
        and mn['coin->shop']['path']=='play.html' and mn['coin->shop']['viewActive'] and mn['coin->shop']['cur']['name']=='shop' and mn['coin->shop']['tab']=='coin'
        and mn['gem->tambang']['cur']['name']=='tambang' and 'from=mode.html' in mn['gem->tambang']['cur']['url'] and mn['tambang_back->mode']['name']=='mode'
        and mn['back->lobby']['path']=='play.html' and mn['back->lobby']['cur']['name']=='lobby' and not mn['back->lobby']['mode']
        and mn['vsc->room']['path']=='play.html' and mn['vsc->room']['viewActive'] and mn['vsc->room']['cur']['name']=='room' and not mn['vsc->room']['mode'] and mn['vsc->room']['room'] and 'mode=vsc' in mn['vsc->room']['cur']['url'] and 'count=2' in mn['vsc->room']['cur']['url']
        and 'DITEMUKAN' in mn['quick_team->launch']['lawan'] and mn['quick_team->launch']['cfg'] and mn['quick_team->launch']['cfg']['type']=='ranked' and mn['quick_team->launch']['cfg']['format']=='team' and mn['quick_team->launch']['cfg']['players']==4 and mn['quick_team->launch']['path']=='play.html'
        and not out['mode_sisa']['mounted'] and not out['mode_sisa']['dom'] and not out['mode_sisa']['dm'] and out['mode_sisa']['css']==0 and out['mode_sisa']['shellView'])
    ra=out['room_awal']; rm=out['room_modal']; ro=out['room_online']
    room_ok=(ra['path']=='play.html' and ra['viewActive'] and ra['cur']['name']=='room' and ra['idStage']==1 and ra['pemain']==2 and ra['bot']==1 and ra['slotEq']==4 and ra['slotPower']==5 and ra['chips']==4
        and ra['startOn'] and ra['peta'] and ra['dm'] and ra['diceArt'] and rm['power'] and not rm['power_esc'] and rm['dadu']['on'] and not rm['dadu_esc']
        and out['room_start']['cfg'] and out['room_start']['cfg']['type']=='room' and out['room_start']['cfg']['mode']=='vsc' and out['room_start']['cfg']['players']==2 and out['room_start']['path']=='play.html'
        and out['room_back']['cur']['name']=='mode' and not out['room_back']['room'] and out['room_keluar']['cur']['name']=='lobby' and not out['room_keluar']['room']
        and not out['room_sisa']['dom'] and not out['room_sisa']['dro'] and not out['room_sisa']['mp'] and out['room_sisa']['css']==0
        and ro['mp'] and ro['presence'] and ro['mpOnlineClass'] and not ro['kelas_sisa'])
    ok=(room_ok and out['konteks_baru']==0 and out['three_dimuat_ulang']==0 and not errs and out['sharedgl']['created']<=2
        and not out['kelas_pf_wide_bocor'] and all(out['tombol_bisa_diketuk'].values()) and out['mounted_akhir']==['lobby'] and shell_ok and nonview_ok and toko_nav_ok and toko_ok and mode_ok
        and out['link_css_spa']==['lobby'] and out['tambang_back_ke_friendship']['name']=='friendship' and out['friendship_back_ke']['name']=='lobby' and out['tambang_3d']['owner']=='tambang' and out['tambang_3d']['slots']==3 and out['tambang_3d']['menggambar'] and not out['tambang_sesudah_keluar']['mounted'] and not out['tambang_sesudah_keluar']['cv'] and out['tambang_sesudah_keluar']['owner']=='lobby' and out['tambang_dari_profil']['name']=='tambang' and out['tambang_back_ke_asal']['name']=='profile' and out['profil_back_ke']['name']=='lobby' and out['peringkat_back_ke']['name']=='lobby'
        and 'board' not in ((out['livesync_sesudah_keluar'] or {}).get('tasks') or []))   # LiveSync boleh jalan (lobby memulainya sendiri); tugas 'board' milik leaderboard harus lepas
    out['LULUS']=bool(ok)
    b.close()
print(json.dumps(out,indent=1,ensure_ascii=False)); sys.exit(0 if out['LULUS'] else 1)
