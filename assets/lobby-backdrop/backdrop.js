/* lobby.js — animasi Lobby Backdrop (mode siang/malam + transisi, banner berkibar, api malam).
   Gambar dimuat dari folder lobby-images/. */

const s=document.getElementById('stage'), bar=document.getElementById('modebar'), fo=document.getElementById('fadeov');
const q=new URLSearchParams(location.search), fixed=q.has('fixed'), embed=q.has('embed');   // embed = dipakai sebagai latar halaman lain (lobby game): tanpa tombol, skala 'cover', mode digerakkan induk
function fit(){ if(fixed) return;
  if(embed){ const k=Math.max(innerWidth/1376,innerHeight/768);   // cover; sejajar dengan lobby game: horizontal 50%, vertikal 72%
    s.style.position='fixed'; s.style.transformOrigin='0 0'; s.style.left=((innerWidth-1376*k)*.5).toFixed(2)+'px'; s.style.top=((innerHeight-768*k)*.72).toFixed(2)+'px'; s.style.transform='scale('+k+')'; return; }
  const k=Math.min(innerWidth/1376,innerHeight/768); s.style.position='fixed';s.style.left='50%';s.style.top='50%';s.style.transform='translate(-50%,-50%) scale('+k+')'; }
addEventListener('resize',fit); fit();
if(fixed||embed){ bar.remove(); if(fo) fo.remove(); }
// ===== MODE HEMAT: matikan kabut/air terjun/debu/kedip obor yang bergerak, kanvas 20 fps. Otomatis aktif di HP/layar sentuh & bila "kurangi gerakan".
let eco=false;
(function(){ let v=null; try{ v=localStorage.getItem('lobby-eco'); }catch(e){}
  if(embed) v=q.has('eco')?'1':null;
  eco = v!==null ? v==='1' : (innerWidth<700 || matchMedia('(pointer:coarse)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches); })();
function setEco(on,save){ eco=on; window.lobbyEco=on; s.classList.toggle('eco',on);
  const b=bar.querySelector('[data-eco]'); if(b) b.setAttribute('aria-pressed',on);
  if(save){ try{ localStorage.setItem('lobby-eco',on?'1':'0'); }catch(e){} } }
setEco(eco,false);
const mq=matchMedia('(prefers-color-scheme: dark)');
let mode='system';
if(!embed){ try{ const v=localStorage.getItem('lobby-mode'); if(v) mode=v; }catch(e){} }
if(q.has('night')) mode='night'; if(q.has('day')) mode='day';
const sk=s.querySelector('.sky'), tsun=document.createElement('div'), tmoon=document.createElement('div'), dusk=document.createElement('div');
tsun.className='tsun'; tmoon.className='tmoon'; dusk.className='layer dusk'; sk.append(tsun,tmoon); s.appendChild(dusk);
const sunXY=u=>[151-170*u, 54+480*u*u], moonXY=u=>[246+934*u, 62+498*Math.pow(u,1.6)];   // u=0: posisi diam, u=1: tenggelam di balik horizon
const place=(el,xy,o)=>{ el.style.transform='translate('+xy[0].toFixed(1)+'px,'+xy[1].toFixed(1)+'px)'; el.style.opacity=o; };
const ease=p=>p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
let cur=null;
function trans(night){
  if(cur) cur();
  if(s.classList.contains('night')===night) return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){ s.classList.toggle('night',night); return; }
  const D=1500; let done=false, toggled=false, t0=null, raf=0;
  s.classList.add('fx-nomoon'); if(night) s.classList.add('sf','sft');          // siang->malam: sinar matahari memudar
  const finish=()=>{ if(done) return; done=true; cancelAnimationFrame(raf);
    s.classList.toggle('night',night); s.classList.remove('fx-nomoon','sf','sft');
    tsun.style.opacity=0; tmoon.style.opacity=0; dusk.style.opacity=0; cur=null; };
  cur=finish;
  const step=ts=>{ if(t0===null) t0=ts; const el=ts-t0;
    if(el<D){ const p=ease(el/D); dusk.style.opacity=(.62*p).toFixed(3);          // fase 1: benda langit yang lama bergelincir turun
      if(night){ place(tsun,sunXY(p),1); } else { place(tmoon,moonXY(p),1); } }
    else { if(!toggled){ toggled=true; s.classList.toggle('night',night);
        if(night) s.classList.remove('sf','sft'); else { s.classList.add('sf'); void s.offsetWidth; s.classList.add('sft'); s.classList.remove('sf'); } }
      const p=ease(Math.min(1,(el-D)/D)); dusk.style.opacity=(.62*(1-p)).toFixed(3);   // fase 2: yang baru naik
      if(night){ tsun.style.opacity=0; place(tmoon,moonXY(1-p),1); } else { tmoon.style.opacity=0; place(tsun,sunXY(1-p),1); }
      if(el>=2*D){ finish(); return; } }
    raf=requestAnimationFrame(step); };
  raf=requestAnimationFrame(step);
}
function apply(first){
  const night = mode==='night' || (mode==='system' && mq.matches);
  if(first) s.classList.toggle('night',night); else trans(night);
  bar.querySelectorAll('button[data-mode]').forEach(b=>b.setAttribute('aria-pressed', b.dataset.mode===mode));
}
bar.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return;
  if(b.hasAttribute('data-eco')){ setEco(!eco,true); return; }
  mode=b.dataset.mode;
  try{ localStorage.setItem('lobby-mode',mode); }catch(e){} apply(false); });
(mq.addEventListener?mq.addEventListener.bind(mq,'change'):mq.addListener.bind(mq))(()=>{ if(mode==='system') apply(false); });
apply(true);
// ---- embed: induk (lobby game) mengirim {ut:'backdrop', night, eco} saat Pengaturan > Suasana / Grafik berubah
if(embed) addEventListener('message',e=>{ const d=e.data; if(!d||d.ut!=='backdrop') return;
  if(typeof d.eco==='boolean') setEco(d.eco,false);
  if(typeof d.night==='boolean'){ mode=d.night?'night':'day'; apply(false); } });



(function(){
  const cv=document.getElementById('anim'); if(!cv) return;
  const small=Math.min(innerWidth,innerHeight)<900 || matchMedia('(pointer:coarse)').matches || window.lobbyEco;
  const bi=document.querySelector('img.base'); if(bi && !bi.getAttribute('src')) bi.src= small ? 'lobby-images/lobby-base-small.webp' : 'lobby-images/lobby-base-large.webp';
  const RS=small?0.5:0.75;                                  // layar kecil: kanvas setengah resolusi (cukup tajam, jauh lebih ringan)
  cv.width=Math.round(2752*RS); cv.height=Math.round(1536*RS);
  const ctx=cv.getContext('2d'); ctx.setTransform(RS,0,0,RS,0,0);
  const META={"big": {"type": "banner", "x0": 831, "y0": 289, "x1": 1023, "y1": 548, "top": 302, "shoulder": 441, "sx0": 840, "sx1": 1014, "sy0": 290, "sy1": 539}, "left": {"type": "banner", "x0": 570, "y0": 460, "x1": 733, "y1": 778, "top": 484, "shoulder": 699, "sx0": 579, "sx1": 724, "sy0": 469, "sy1": 769}, "mid": {"type": "banner", "x0": 1171, "y0": 537, "x1": 1304, "y1": 827, "top": 559, "shoulder": 695, "sx0": 1180, "sx1": 1295, "sy0": 546, "sy1": 818}, "far": {"type": "banner", "x0": 2391, "y0": 584, "x1": 2471, "y1": 740, "top": 601, "shoulder": 701, "sx0": 2400, "sx1": 2462, "sy0": 593, "sy1": 731}, "right": {"type": "banner", "x0": 2047, "y0": 631, "x1": 2162, "y1": 890, "top": 640, "shoulder": 818, "sx0": 2056, "sx1": 2153, "sy0": 640, "sy1": 881}, "f_tl": {"type": "flame", "x0": 386, "y0": 343, "x1": 451, "y1": 430, "sx0": 395, "sx1": 442, "sy0": 352, "sy1": 421}, "f_t2": {"type": "flame", "x0": 1099, "y0": 395, "x1": 1165, "y1": 469, "sx0": 1108, "sx1": 1156, "sy0": 404, "sy1": 460}, "f_t3": {"type": "flame", "x0": 1214, "y0": 444, "x1": 1264, "y1": 514, "sx0": 1223, "sx1": 1255, "sy0": 453, "sy1": 505}, "f_s1": {"type": "flame", "x0": 565, "y0": 846, "x1": 617, "y1": 913, "sx0": 574, "sx1": 608, "sy0": 855, "sy1": 904}, "f_s2": {"type": "flame", "x0": 729, "y0": 860, "x1": 805, "y1": 935, "sx0": 738, "sx1": 796, "sy0": 869, "sy1": 926}, "f_s3": {"type": "flame", "x0": 1134, "y0": 884, "x1": 1210, "y1": 945, "sx0": 1143, "sx1": 1201, "sy0": 893, "sy1": 936}, "f_bigL": {"type": "flame", "x0": 143, "y0": 803, "x1": 330, "y1": 956, "sx0": 152, "sx1": 321, "sy0": 812, "sy1": 947}, "f_bigR": {"type": "flame", "x0": 2417, "y0": 807, "x1": 2621, "y1": 996, "sx0": 2426, "sx1": 2612, "sy0": 816, "sy1": 987}};
  const spr0=new Image(), pat0=new Image(); let ok=0, spr=spr0, pat=pat0; const K=RS;
  const shrink=im=>{ const c=document.createElement('canvas'); c.width=Math.round(2752*K); c.height=Math.round(1536*K); c.getContext('2d').drawImage(im,0,0,c.width,c.height); return c; };
  const go=()=>{ if(++ok<2) return; if(K<1){ spr=shrink(spr0); pat=shrink(pat0); spr0.src=pat0.src=''; } cv.style.visibility='visible'; start(); };
  spr0.onload=pat0.onload=go; spr0.src='lobby-images/lobby-sprite.webp'; pat0.src='lobby-images/lobby-pattern.webp';

  // ---- pengaturan kekuatan (kecil = sepoi) ----
  const BANNER_SWAY = 0.030;   // simpangan maks di ujung bawah, sebagai fraksi tinggi banner
  const FLAME_SWAY  = 0.075;   // simpangan maks ujung api, sebagai fraksi tinggi api
  const STEP=3;                // tebal irisan (px, resolusi 2752)

  const keys=Object.keys(META); const seedOf={}; keys.forEach((k,i)=>seedOf[k]=i*1.93+.7);
  const tmp=document.createElement('canvas'); tmp.width=320; tmp.height=400; const tctx=tmp.getContext('2d');
  const gust=t=>0.72+0.28*Math.sin(t*.37+1.1)*Math.sin(t*.151+.4);   // hembusan pelan naik-turun

  function banner(k,m,t){
    const ph=seedOf[k], h=m.sy1-m.sy0, w=m.sx1-m.sx0, PAD=24;
    const A=BANNER_SWAY*h*(window.lobbyEco ? .5 : 1)*gust(t+ph*.3);
    const tw=w+PAD*2; tctx.clearRect(0,0,tmp.width,tmp.height);
    let prev=0;
    const off=v=>A*Math.pow(v,1.25)*(0.72*Math.sin(1.45*t-2.3*v+ph)+0.28*Math.sin(3.1*t-4.6*v+ph*1.7));
    for(let y=0;y<h;y+=STEP){
      const v=(y+STEP/2)/h, dx=off(v);
      const sc=1-0.010*v*Math.sin(1.45*t-2.3*v+ph+1.2);            // lebar sedikit berkerut
      const sw=w*sc, x=PAD+dx+(w-sw)/2;
      tctx.drawImage(spr,m.sx0*K,(m.sy0+y)*K,w*K,STEP*K,x,y,sw,STEP+.6);
      // bayangan lipatan kain: kemiringan geseran -> terang/gelap tipis
      const slope=(off(Math.min(1,v+.03))-off(Math.max(0,v-.03)))/(.06*h)*3;
      const a=Math.max(-.16,Math.min(.16,slope*.9));
      if(Math.abs(a)>.012){ tctx.globalCompositeOperation='source-atop';
        tctx.fillStyle=a>0?'rgba(255,236,190,'+a.toFixed(3)+')':'rgba(8,10,40,'+(-a).toFixed(3)+')';
        tctx.fillRect(0,y,tw,STEP+.6); tctx.globalCompositeOperation='source-over'; }
    }
    ctx.drawImage(tmp,0,0,tw,h,m.sx0-PAD,m.sy0,tw,h);
  }
  function flame(k,m,t){
    const ph=seedOf[k]*1.7, h=m.sy1-m.sy0, w=m.sx1-m.sx0, base=m.sy1;
    const A=FLAME_SWAY*h*(window.lobbyEco ? .45 : 1);
    const sway=window.lobbyEco ? .5 : 1;
    const sy=1+0.045*sway*Math.sin(5.1*t+ph)+0.025*sway*Math.sin(8.3*t+ph*2);  // tinggi api berdenyut halus
    for(let y=0;y<h;y+=STEP){
      const v=1-(y+STEP/2)/h;                                         // 0 di dasar, 1 di ujung
      const dx=A*Math.pow(v,1.4)*(0.7*Math.sin(2.1*t+ph-1.6*v)+0.3*Math.sin(4.7*t+ph*2+3*v));
      const dy=base-(base-(m.sy0+y))*sy-(m.sy0+y);
      ctx.drawImage(spr,m.sx0*K,(m.sy0+y)*K,w*K,STEP*K,m.sx0+dx,m.sy0+y+dy,w,STEP*sy+.8);
    }
  }
  // SIANG: api padam -> mangkuk berisi batubara (potongan dari gambar siang), tanpa animasi
  const DAY={"f_tl":[382,303,73,131,"lobby-images/lobby-coal-f_tl.webp"],"f_t2":[1095,355,74,118,"lobby-images/lobby-coal-f_t2.webp"],"f_t3":[1210,404,58,114,"lobby-images/lobby-coal-f_t3.webp"],"f_s1":[561,806,60,111,"lobby-images/lobby-coal-f_s1.webp"],"f_s2":[725,820,84,119,"lobby-images/lobby-coal-f_s2.webp"],"f_s3":[1130,844,84,105,"lobby-images/lobby-coal-f_s3.webp"],"f_bigL":[139,763,195,197,"lobby-images/lobby-coal-f_bigL.webp"],"f_bigR":[2413,767,212,233,"lobby-images/lobby-coal-f_bigR.webp"]};
  const coal={}; let coalReady=0; const nCoal=Object.keys(DAY).length;
  for(const k in DAY){ const d=DAY[k], im=new Image(); im.onload=()=>{
      const c=document.createElement('canvas'); c.width=d[2]; c.height=d[3]; const x=c.getContext('2d'); x.drawImage(im,0,0);
      x.globalCompositeOperation='destination-in'; const F=14;
      [[0,0,F,0],[d[2],0,d[2]-F,0],[0,0,0,F],[0,d[3],0,d[3]-F]].forEach(g=>{ const gr=x.createLinearGradient(g[0],g[1],g[2],g[3]);
        gr.addColorStop(0,'rgba(0,0,0,0)'); gr.addColorStop(1,'rgba(0,0,0,1)'); x.fillStyle=gr; x.fillRect(0,0,d[2],d[3]); });
      coal[k]=c; coalReady++; if(coalReady===nCoal && window.animFrame && window.__lastT!=null) window.animFrame(window.__lastT); };
    im.src=d[4]; }
  function frame(t){
    window.__lastT=t; const night=s.classList.contains('night');
    for(const k of keys){ const m=META[k];
      ctx.clearRect(m.x0-4,m.y0-(m.type==='flame'?40:4),m.x1-m.x0+8,m.y1-m.y0+(m.type==='flame'?44:8));
      if(m.type==='flame' && !night){ if(coal[k]) ctx.drawImage(coal[k],DAY[k][0],DAY[k][1]); continue; }
      ctx.drawImage(pat,m.x0*K,m.y0*K,(m.x1-m.x0)*K,(m.y1-m.y0)*K,m.x0,m.y0,m.x1-m.x0,m.y1-m.y0);
    }
    for(const k of keys){ const m=META[k]; if(m.type==='banner') banner(k,m,t); else if(night) flame(k,m,t); }
  }
  window.animFrame=frame;
  function start(){
    const still=new URLSearchParams(location.search).get('still');
    const redraw=t=>{ frame(t); new MutationObserver(()=>frame(t)).observe(s,{attributes:true,attributeFilter:['class']}); };   // gambar ulang saat siang/malam berganti
    if(still!==null){ redraw(parseFloat(still)||3); return; }
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){ redraw(3); return; }
    let t0=null,last=-1e9,ecoDrawn=false;
    new MutationObserver(()=>{ if(window.lobbyEco){ frame(3); ecoDrawn=true; } }).observe(s,{attributes:true,attributeFilter:['class']});
    (function tick(ts){
      requestAnimationFrame(tick);
      if(document.hidden) return;
      if(window.lobbyEco){
        if(t0===null) t0=ts;
        if(!ecoDrawn||ts-last>=125){ last=ts; frame((ts-t0)/1000+1); ecoDrawn=true; }
        return;
      }
      ecoDrawn=false;
      if(t0===null) t0=ts;
      if(ts-last<33) return;
      last=ts; frame((ts-t0)/1000+1);
    })(performance.now());
  }
})();
