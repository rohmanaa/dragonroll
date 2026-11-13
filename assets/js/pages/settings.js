/* settings.js — dipindah dari <script> inline (settings.html). */
(()=>{
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
const IC='assets/ng/komponen/';
function render(){
 paintVol();
 const T=S();
 $$('[data-tg]').forEach(b=>{const on=!!T[b.dataset.tg];b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});
 $$('[data-gfx]').forEach(b=>{const on=T.graphics===b.dataset.gfx;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});
 $$('[data-amb]').forEach(b=>{const on=T.ambience===b.dataset.amb;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});
 $('#ic-sfx').src=IC+(T.sound?'ikon-pengaturan/ikon-speaker.webp':'glyph-putih/speaker-mati.webp');
 $('#ic-music').src=IC+(T.music?'glyph-putih/nada.webp':'ikon-pengaturan/ikon-musik-mati.webp');
 $('#sysn').innerHTML=T.ambience==='system'?'Mengikuti perangkat — sekarang: <b>'+(A.resolved()==='night'?'Malam':'Siang')+'</b>':T.ambience==='night'?'Malam: bintang, bulan &amp; cahaya bulan di lobby.':'Siang: matahari &amp; sinar emas di lobby.';
}
$$('[data-tg]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.tg;PD.setSettings({[k]:!S()[k]});buzz();render()}));
$$('[data-gfx]').forEach(b=>b.addEventListener('click',()=>{A.set({graphics:b.dataset.gfx});buzz();render()}));
$$('[data-amb]').forEach(b=>b.addEventListener('click',()=>{A.set({ambience:b.dataset.amb});buzz();render()}));
A.on(render);
/* kembali ke halaman asal (profil, toko, dll.); bila tidak ada, ke lobby */
const go=u=>{$('#fade').classList.add('on');setTimeout(()=>{location.href=u},330)};
const home=()=>{let to='lobby.html';try{const r=new URL(document.referrer);if(r.origin===location.origin){const n=r.pathname.split('/').pop();if(/^[a-z0-9_-]+\.html$/i.test(n)&&!/^(settings|splash|index|play)\.html$/i.test(n))to=n+r.search}}catch(e){}go(to)};
$('#back').addEventListener('click',()=>{buzz();home()});
/* keluar akun: wajib konfirmasi (logika sama dengan profil) */
const cf=$('#confirm'),openCf=()=>cf.classList.add('on'),closeCf=()=>cf.classList.remove('on');
$('#logout').onclick=openCf;$('#cf-no').onclick=closeCf;
cf.addEventListener('click',e=>{if(e.target===cf)closeCf()});
addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(lgModal.classList.contains('on'))closeLang();else if(cf.classList.contains('on'))closeCf();else home()});
$('#cf-ok').onclick=()=>{closeCf();import('../../../assets/js/auth.js').then(()=>UT.Auth.signOut()).catch(()=>{}).then(()=>{try{sessionStorage.removeItem('ut:booted')}catch(e){}UT.Session.clear();location.replace('splash.html')})};
/* bahasa: pilihan disimpan di pref 'lang' (teks game belum diterjemahkan; hanya menyimpan pilihan) */
const BF=IC+'bendera-bahasa/',GLB=IC+'glyph-putih/bola-dunia-garis.webp';
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
let tt;const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),1800)};
function drawLangBtn(){const l=curLang(),f=$('#langFlag');f.src=l.flag||GLB;f.classList.toggle('glb',!l.flag);$('#langName').textContent=l.name}
function closeLang(){lgModal.classList.remove('on')}
function drawLangGrid(){
 lgrid.innerHTML='';
 LANGS.forEach(l=>{
  const b=document.createElement('button');b.className='kcard lc'+(l.id===curLang().id?' sel':'');
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
try{if(typeof PF().on==='function')PF().on(()=>{render();drawLangBtn()})}catch(e){}
document.documentElement.classList.add('ut-ready');
})();
