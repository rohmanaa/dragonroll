/* settings.js — dipindah dari blok script inline (settings.html). Tahap 3 SPA: dibungkus UT.PageModule ('settings'); halaman mandiri otomatis mount,
   unmount() melepas listener, timer, dan langganan (Ambience, Prefs, layar penuh). */
UT.PageModule.define('settings',function(env){
const {setTimeout,clearTimeout,addEventListener}=env;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],PD=window.PlayerData,A=UT.Ambience;
const S=()=>PD.settings();
const buzz=()=>{try{if(S().vibration&&navigator.vibrate)navigator.vibrate(15)}catch(e){}};
const PF=()=>UT.Prefs;
const vol=(k,d)=>{const v=parseInt(PF().get(k,d),10);return isNaN(v)?d:Math.max(0,Math.min(100,v))};
function paintVol(){[['musicVol','musicVolV','musicVol',30],['sfxVol','sfxVolV','sfxVol',100]].forEach(([i,p,k,d])=>{const v=vol(k,d),el=$('#'+i);if(el&&document.activeElement!==el)el.value=v;$('#'+p).textContent=v+'%'})}
const shellSync=()=>{try{if(parent&&parent!==window&&parent.UTShell)parent.UTShell.syncMusic()}catch(e){}};
$('#musicVol').addEventListener('input',e=>{PF().set('musicVol',+e.target.value);$('#musicVolV').textContent=e.target.value+'%';shellSync()});
$('#sfxVol').addEventListener('input',e=>{PF().set('sfxVol',+e.target.value);$('#sfxVolV').textContent=e.target.value+'%'});
$('#sfxVol').addEventListener('change',()=>{try{UT.Audio.play('button')}catch(e){}});
/* transparansi panel hub: 0% pekat .. 70%; langsung terlihat (hub memakai --panel-a di <html>), disimpan di Prefs 'panelTransparency' */
const trVal=()=>{const v=parseInt(PF().get('panelTransparency',16),10);return isNaN(v)?16:Math.max(0,Math.min(70,v))};
const trApply=v=>document.documentElement.style.setProperty('--panel-a',(1-v/100).toFixed(2));
(function(){const el=$('#panelTr');if(!el)return;
 const paint=()=>{const v=trVal();if(document.activeElement!==el)el.value=v;$('#panelTrV').textContent=v+'%'};
 paint();trApply(trVal());
 el.addEventListener('input',e=>{const v=+e.target.value;PF().set('panelTransparency',v);trApply(v);$('#panelTrV').textContent=v+'%'});
})();
const IC='assets/images/ui/';
const GA=()=>UT.GraphicsAuto,GTN={low:'Rendah',normal:'Normal',high:'Tinggi',ultra:'Ultra'};
const GN={auto:'Otomatis: memilih tingkat sesuai perangkat dan menurunkannya sendiri bila game terasa berat.',low:'Paling ringan. Pilih ini bila game terasa berat di HP kamu.',normal:'Seimbang antara tampilan dan performa.',high:'Efek visual penuh, menyesuaikan kemampuan perangkat.',ultra:'Kualitas tertinggi. Butuh perangkat yang kuat.'};
function render(){
 paintVol();
 {const el=$('#panelTr');if(el){const v=trVal();if(document.activeElement!==el)el.value=v;$('#panelTrV').textContent=v+'%'}}
 const T=S();
 $$('[data-tg]').forEach(b=>{const on=!!T[b.dataset.tg];b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});
 const AUTO=!!(GA()&&GA().enabled());
 $$('[data-gfx]').forEach(b=>{const on=AUTO?b.dataset.gfx==='auto':T.graphics===b.dataset.gfx;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});
 $('#ic-sfx').src=IC+(T.sound?'settings-icons/ikon-speaker.webp':'white-glyphs/speaker-mati.webp');
 $('#ic-music').src=IC+(T.music?'white-glyphs/nada.webp':'settings-icons/ikon-musik-mati.webp');
 $('#gfxn').textContent=AUTO?GN.auto+' Sekarang: '+(GTN[T.graphics]||'Tinggi')+'.':(GN[T.graphics]||GN.high);
}
$$('[data-tg]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.tg;PD.setSettings({[k]:!S()[k]});buzz();render()}));
$$('[data-gfx]').forEach(b=>b.addEventListener('click',()=>{const g=b.dataset.gfx;if(g==='auto'){if(GA())GA().setEnabled(true)}else{if(GA())GA().setEnabled(false);A.set({graphics:g})}buzz();render()}));
env.own(A.on(render));
/* kembali ke halaman asal (profil, toko, dll.); bila tidak ada, ke lobby */
/* di shell (play.html) SEMUA target lewat UT.Spa.go (view atau iframe) agar shell tidak ditinggalkan; halaman mandiri: fade 330 ms lalu pindah halaman biasa */
const go=u=>{if(UT.Spa&&UT.Spa.go){UT.Spa.go(u);return}$('#fade').classList.add('on');setTimeout(()=>{location.href=u},330)};
/* di shell location.search milik play.html (?go=...): ?from= diambil dari URL rute aktif */
const search=()=>{if(UT.AccountHub&&UT.AccountHub.query&&UT.AccountHub.active&&UT.AccountHub.active())return UT.AccountHub.query();const c=UT.Spa&&UT.Spa.current&&UT.Spa.current();if(c&&c.name==='settings'){const i=c.url.indexOf('?');return i<0?'':c.url.slice(i).split('#')[0]}return location.search};
const fromParam=()=>{const f=new URLSearchParams(search()).get('from');return f&&/^[a-z0-9_-]+\.html(\?[^#]*)?$/i.test(f)&&!/^(settings|splash|index|play)\.html/i.test(f)?f:null};
const home=()=>{let to=fromParam()||'lobby.html';if(!fromParam())try{const r=new URL(document.referrer);if(r.origin===location.origin){const n=r.pathname.split('/').pop();if(/^[a-z0-9_-]+\.html$/i.test(n)&&!/^(settings|splash|index|play)\.html$/i.test(n))to=n+r.search}}catch(e){}go(to)};
$('#back').addEventListener('click',()=>{buzz();home()});
/* keluar akun: wajib konfirmasi (logika sama dengan profil) */
const cf=$('#confirm'),openCf=()=>cf.classList.add('on'),closeCf=()=>cf.classList.remove('on');
$('#logout').onclick=openCf;$('#cf-no').onclick=closeCf;
cf.addEventListener('click',e=>{if(e.target===cf)closeCf()});
/* Esc: hanya menutup dialog dalam panel; Esc tanpa dialog = kembali ke halaman asal, dikelola UT.AccountHub */
addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(lgModal.classList.contains('on'))closeLang();else if(cf.classList.contains('on'))closeCf()});
$('#cf-ok').onclick=()=>{closeCf();import('../auth.js').then(()=>UT.Auth.signOut()).catch(()=>{}).then(()=>{try{sessionStorage.removeItem('ut:booted')}catch(e){}UT.Session.clear();location.replace('splash.html')})};
/* bahasa: pilihan disimpan di pref 'lang' (teks game belum diterjemahkan; hanya menyimpan pilihan) */
const BF=IC+'language-flags/',GLB=IC+'white-glyphs/bola-dunia-garis.webp';
const LANGS=[
 {id:'en',name:'English',flag:BF+'bendera-inggris.webp'},
 {id:'id',name:'Indonesia',flag:BF+'bendera-indonesia.webp'},
 {id:'de',name:'Deutsch',flag:BF+'bendera-jerman.webp'},
 {id:'fr',name:'Français',flag:BF+'bendera-prancis.webp'},
 {id:'es',name:'Español',flag:BF+'bendera-spanyol.webp'},
 {id:'pt',name:'Português',flag:BF+'bendera-portugal.webp'},
 {id:'ru',name:'Русский',flag:BF+'bendera-rusia.webp'},
 {id:'hi',name:'हिन्दी',flag:BF+'bendera-india.webp'},
 {id:'zh',name:'简体中文',flag:BF+'bendera-cina.webp'}
];
const lgModal=$('#lang'),lgrid=$('#lgrid');
const curLang=()=>LANGS.find(l=>l.id===PF().get('lang','en'))||LANGS[0];
let tt;const toast=m=>{if(env.disposed)return;const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),1800)};
function drawLangBtn(){const l=curLang(),f=$('#langFlag');f.src=l.flag||GLB;f.classList.toggle('glb',!l.flag);$('#langName').textContent=l.name}
function closeLang(){lgModal.classList.remove('on')}
function drawLangGrid(){
 lgrid.innerHTML='';
 LANGS.forEach(l=>{
  const b=document.createElement('button');b.className='ut-tabv lc'+(l.id===curLang().id?' on sel':'');
  b.innerHTML='<img class="'+(l.flag?'':'glb')+'" src="'+(l.flag||GLB)+'" alt=""><b>'+l.name+'</b>';
  b.onclick=()=>{PF().set('lang',l.id);buzz();drawLangBtn();closeLang();toast('Bahasa: '+l.name)};
  lgrid.appendChild(b);
 });
}
$('#langBtn').onclick=()=>{buzz();drawLangGrid();lgModal.classList.add('on')};
$('#lg-x').onclick=closeLang;
lgModal.addEventListener('click',e=>{if(e.target===lgModal)closeLang()});
drawLangBtn();
/* skala kanvas 1920x1080 */
function fit(){$('#stage').style.transform='scale('+Math.min(innerWidth/1920,innerHeight/1080)+')'}
addEventListener('resize',fit);fit();
render();
/* pref berubah dari luar (prefs-sync menarik pengaturan lintas perangkat setelah halaman tampil) -> gambar ulang */
try{if(typeof PF().on==='function')env.own(PF().on(()=>{if(env.disposed)return;render();drawLangBtn()}))}catch(e){}

/* ---- tampilan: Fullscreen / Normal (UT.Display: Electron lewat electronAPI, web/PWA lewat Fullscreen API) ---- */
(function(){
 const D=UT.Display,btns=$$('[data-display]');if(!btns.length)return;
 const paint=full=>btns.forEach(b=>{const on=(b.dataset.display==='fullscreen')===!!full;b.classList.toggle('on',on);b.classList.toggle('active',on);b.setAttribute('aria-pressed',on)});
 const lock=v=>btns.forEach(b=>{b.disabled=v});
 if(!D||!D.supported()){
  lock(true);
  const ios=/iP(hone|od)/.test(navigator.userAgent);
  const note=ios?'Layar penuh tidak didukung di iPhone. Pasang game ke Layar Utama untuk tampilan penuh.':'Layar penuh tidak didukung di perangkat ini.';
  const row=$('#seg-display');if(row){row.title=note;row.setAttribute('aria-disabled','true')}
  toast(note);return}
 D.isFullscreen().then(v=>{if(!env.disposed)paint(v)}).catch(()=>{});
 env.own(D.on(v=>{if(!env.disposed)paint(v)}));
 btns.forEach(b=>b.addEventListener('click',async()=>{
  const want=b.dataset.display==='fullscreen';buzz();lock(true);
  try{const actual=await D.set(want);if(env.disposed)return;paint(actual);if(actual!==want)toast(want?'Layar penuh ditolak oleh browser.':'Keluar dari layar penuh lewat tombol sistem.')}
  catch(e){if(env.disposed)return;toast('Mode tampilan gagal diubah.');D.isFullscreen().then(paint).catch(()=>{})}
  finally{if(!env.disposed)lock(false)}}));
})();

/* versi game (= VERSION sw.js): elemen [data-app-version] ada di view ini, jadi isi tiap mount */
try{if(UT.Version&&UT.Version.apply)UT.Version.apply(document)}catch(e){}
document.documentElement.classList.add('ut-ready');
});
