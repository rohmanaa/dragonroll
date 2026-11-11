/* settings.html (README bagian 6): disimpan ke localStorage 'dragonroll:pref:*' (di proyek utama: PlayerData + PrefsSync). */
const $=s=>document.querySelector(s);
function fit(){$('#stage').style.transform=`scale(${Math.min(innerWidth/1920,innerHeight/1080)})`}addEventListener('resize',fit);fit();
const DEF={graphics:'high',musicVol:'30',sfxVol:'100',musicOn:'1',sfxOn:'1',vibrate:'1',theme:'system',lang:'en'};
const get=k=>{try{return localStorage.getItem('dragonroll:pref:'+k)??DEF[k]}catch(e){return DEF[k]}};
const set=(k,v)=>{try{localStorage.setItem('dragonroll:pref:'+k,v)}catch(e){}};
document.querySelectorAll('.seg').forEach(s=>{
  const k=s.dataset.k,draw=()=>s.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v===get(k)));
  s.onclick=e=>{const b=e.target.closest('button');if(b){set(k,b.dataset.v);draw()}};draw();
});
['musicVol','sfxVol'].forEach(k=>{const r=$('#'+k),v=$('#'+k+'V');r.value=get(k);v.textContent=r.value;r.oninput=()=>{v.textContent=r.value;set(k,r.value)}});
document.querySelectorAll('.tg').forEach(t=>{const k=t.dataset.k,draw=()=>t.classList.toggle('on',get(k)==='1');t.onclick=()=>{set(k,get(k)==='1'?'0':'1');draw()};draw()});
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),1800)}
const nav=u=>{$('#fade').classList.add('on');setTimeout(()=>location.href=u,330)};
/* kembali ke halaman asal (profil, toko, dll.); bila tidak ada, ke lobby */
const home=()=>{let to='lobby.html';try{const r=new URL(document.referrer);if(r.origin===location.origin){const n=r.pathname.split('/').pop();if(/^[a-z0-9_-]+\.html$/i.test(n)&&!/^(settings|splash|index|play)\.html$/i.test(n))to=n+r.search}}catch(e){}nav(to)};
$('#back').onclick=home;
/* ikon mengikuti status toggle */
const IC='assets/komponen/';
function icons(){
  $('#ic-sfx').src=IC+(get('sfxOn')==='1'?'ikon-pengaturan/ikon-speaker.webp':'glyph-putih/speaker-mati.webp');
  $('#ic-music').src=IC+(get('musicOn')==='1'?'glyph-putih/nada.webp':'ikon-pengaturan/ikon-musik-mati.webp');
}
document.querySelectorAll('.tg').forEach(t=>t.addEventListener('click',icons));icons();
/* keluar akun: wajib konfirmasi */
const cf=$('#confirm'),openCf=()=>cf.classList.add('on'),closeCf=()=>cf.classList.remove('on');
$('#logout').onclick=openCf;
$('#cf-no').onclick=closeCf;
cf.addEventListener('click',e=>{if(e.target===cf)closeCf()});
addEventListener('keydown',e=>{if(e.key==='Escape')closeCf()});
$('#cf-ok').onclick=()=>{closeCf();try{localStorage.removeItem('dragonroll:auth');sessionStorage.removeItem('dragonroll:auth')}catch(e){}nav('splash.html')};

/* bahasa: pilihan disimpan di pref 'lang' (teks game belum diterjemahkan; hanya menyimpan pilihan) */
const BF='assets/komponen/bendera-bahasa/';
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
const GLB='assets/komponen/glyph-putih/bola-dunia-garis.webp';
const lgModal=$('#lang'),lgrid=$('#lgrid');
const curLang=()=>LANGS.find(l=>l.id===get('lang'))||LANGS[0];
function drawLangBtn(){
  const l=curLang(),f=$('#langFlag');
  f.src=l.flag||GLB;f.classList.toggle('glb',!l.flag);$('#langName').textContent=l.name;
}
function drawLangGrid(){
  lgrid.innerHTML='';
  LANGS.forEach(l=>{
    const b=document.createElement('button');b.className='kcard lc'+(l.id===curLang().id?' sel':'');
    b.innerHTML=`<img class="${l.flag?'':'glb'}" src="${l.flag||GLB}" alt=""><b>${l.name}</b>`;
    b.onclick=()=>{set('lang',l.id);drawLangBtn();closeLang();toast('Bahasa: '+l.name)};
    lgrid.appendChild(b);
  });
}
function openLang(){drawLangGrid();lgModal.classList.add('on')}
function closeLang(){lgModal.classList.remove('on')}
$('#langBtn').onclick=openLang;$('#lg-x').onclick=closeLang;
lgModal.addEventListener('click',e=>{if(e.target===lgModal)closeLang()});
addEventListener('keydown',e=>{if(e.key==='Escape')closeLang()});
drawLangBtn();

/* catatan suasana */
function drawAmb(){
  const t=get('theme'),n=$('#sysn');
  const night=matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches;
  n.innerHTML=t==='system'?'Mengikuti perangkat — sekarang: <b>'+(night?'Malam':'Siang')+'</b>':t==='night'?'Malam: bintang, bulan &amp; cahaya bulan di lobby.':'Siang: matahari &amp; sinar emas di lobby.';
}
document.querySelectorAll('[data-k="theme"]').forEach(s=>s.addEventListener('click',drawAmb));drawAmb();
