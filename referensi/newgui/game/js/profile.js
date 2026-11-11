/* profile.html — informasi akun: nama, level + progres, foto profil, koleksi, aktivitas.
   Data tiruan dari localStorage (di proyek utama: PlayerData + RPC get_my_profile). Tanpa achievement. */
const $=s=>document.querySelector(s);
function fit(){$('#stage').style.transform=`scale(${Math.min(innerWidth/1920,innerHeight/1080)})`}addEventListener('resize',fit);fit();
const LS=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}};
const wal=LS('dragonroll:lobby:demo',{});
const fmt=n=>Number(n).toLocaleString('en-US');
$('#v-em').textContent=fmt(wal.emerald??120);$('#v-co').textContent=fmt(wal.coin??2500);

/* halaman yang sudah ada (sama dengan BUILT di lobby.js) — tambahkan saat halaman baru selesai */
const BUILT=['karakter.html','mode.html','settings.html','room.html','mission.html','shop.html','profile.html','frame.html','dadu.html','efek.html','powerup.html','leaderboard.html','friendship.html','tambang.html','mail.html','pet.html'];
const IC='assets/komponen/',G=IC+'glyph-putih/';
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),1800)}
const nav=u=>{$('#fade').classList.add('on');setTimeout(()=>location.href=u,330)};
const go=u=>BUILT.includes(u.split('?')[0])?nav(u):toast('Segera hadir');
$('#back').onclick=$('#home').onclick=()=>nav('lobby.html');

/* ---- kiri: tab ---- */
const TABS=[['akun','Akun','profil-bulat.webp'],['koleksi','Koleksi','tas-kulit.webp'],['statistik','Statistik','grafik-batang.webp']];
$('#menu').innerHTML=TABS.map(([k,n,ic])=>`<button class="mb" data-k="${k}" aria-label="${n}"><div class="ic"><img src="${G}${ic}" alt=""></div><div class="lb">${n}</div></button>`).join('');
function tab(k){
  document.querySelectorAll('.mb').forEach(b=>b.classList.toggle('on',b.dataset.k===k));
  document.querySelectorAll('.pane').forEach(p=>p.classList.toggle('on',p.id==='p-'+k));
}
$('#menu').onclick=e=>{const b=e.target.closest('.mb');if(b)tab(b.dataset.k)};
tab('akun');

/* ---- tengah: karakter terpasang ---- */
const h=getHero();
const cyl=(cx,cy,rx,ry,hh,top,side)=>`<path d="M${cx-rx},${cy} v${hh} a${rx},${ry} 0 0 0 ${rx*2},0 v${-hh} Z" fill="${side}" stroke="#17122b" stroke-width="3" stroke-linejoin="round"/><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${top}" stroke="#17122b" stroke-width="3"/>`;
const PED=`<svg viewBox="0 0 500 190" aria-hidden="true"><ellipse cx="250" cy="168" rx="236" ry="22" fill="rgba(8,4,20,.35)"/>${cyl(250,104,222,46,30,'#4b4370','#2f2949')}${cyl(250,82,176,36,24,'#5d5486','#3b3459')}${cyl(250,62,128,27,20,'#6f66a0','#463e6b')}<ellipse cx="250" cy="62" rx="100" ry="20" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="3"/></svg>`;
$('#art').innerHTML=PED+`<img src="${h.art||heroIcon(h)}" alt="" style="height:${h.art?440:250}px">`;
$('#mnm').textContent=h.name;$('#mcls').textContent=h.cls;

/* ---- kanan: AKUN ---- */
const S=Object.assign({id:'482913',sejak:'12 Okt 2026',bahasa:'Indonesia'},LS('dragonroll:profile:stats',{}));
const name=wal.name||'Ryuen';
$('#hnm').textContent=name;$('#hid').innerHTML=`ID #${S.id}<br>Bergabung ${S.sejak}`;
function lvInfo(xp){let lv=1,need=400;while(xp>=need&&lv<999){xp-=need;lv++;need=400+100*(lv-1)}return{lv,cur:lv>=999?need:xp,need}}
const L=lvInfo(wal.xp??683),pct=Math.min(100,L.cur/L.need*100);
$('#lvn').textContent=L.lv;$('#lvp').textContent=pct.toFixed(1)+'%';
$('#xpnote').textContent=`${L.cur} / ${L.need} XP · butuh ${L.need-L.cur} XP lagi ke Level ${Math.min(999,L.lv+1)}`;
requestAnimationFrame(()=>requestAnimationFrame(()=>$('#lvf').style.width=pct+'%'));
$('#info').innerHTML=[['Nama',name],['ID Pemain','#'+S.id],['Bergabung',S.sejak],['Karakter aktif',h.name+' · '+h.cls],['Bahasa',S.bahasa]].map(([a,b])=>`<div class="ir"><span>${a}</span><b>${b}</b></div>`).join('');

/* foto profil: pilih gambar, dipotong persegi 256px, disimpan di localStorage (di proyek utama: unggah ke server) */
const PK='dragonroll:profile:photo';
function showPhoto(){
  const p=(()=>{try{return localStorage.getItem(PK)}catch(e){return null}})();
  const im=$('#avimg');
  if(p){im.src=p;im.className=''}else{im.src=heroIcon(h);im.className='ico'}
}
showPhoto();
$('#up').onclick=()=>$('#file').click();
$('#file').onchange=e=>{
  const f=e.target.files[0];e.target.value='';
  if(!f)return;
  if(!/^image\//.test(f.type)){toast('File harus gambar');return}
  const r=new FileReader();
  r.onerror=()=>toast('Gagal membaca file');
  r.onload=()=>{
    const img=new Image();
    img.onerror=()=>toast('Gambar tidak valid');
    img.onload=()=>{
      const c=document.createElement('canvas');c.width=c.height=256;
      const s=Math.min(img.width,img.height),x=(img.width-s)/2,y=(img.height-s)/2;
      c.getContext('2d').drawImage(img,x,y,s,s,0,0,256,256);
      try{localStorage.setItem(PK,c.toDataURL('image/jpeg',.85));showPhoto();toast('Foto profil diperbarui')}
      catch(err){toast('Gagal menyimpan foto')}
    };
    img.src=r.result;
  };
  r.readAsDataURL(f);
};

/* ---- kanan: KOLEKSI (dimiliki / total; tiruan) ---- */
const K=Object.assign({karakter:3,frame:Math.max(1,LS('dragonroll:own:frame',[]).length),dadu:Math.max(1,LS('dragonroll:own:dice',[]).length),efek:2,powerup:9},LS('dragonroll:profile:koleksi',{}));
const KOL=[
  ['Karakter',K.karakter,HEROES.length,'ikon-item/helm-ksatria.webp','#e5604e','karakter.html'],
  ['Frame',K.frame,6,'new-icon/frame.webp','#e89a52','frame.html'],
  ['Dadu',K.dadu,8,'new-icon/dadu.webp','#3fc6a8','dadu.html'],
  ['Efek',K.efek,15,'ikon-gem-medali/kristal-api.webp','#d26f9c','efek.html'],
  ['Power-up',K.powerup,17,'ikon-gem-medali/petir-ungu.webp','#4db3e6','powerup.html']
];
$('#kol').innerHTML=KOL.map(([n,a,t,ic,c,u],i)=>`<button class="kr" data-u="${u}" style="--c:${c}"><div class="ic"><img src="${IC}${ic}" alt=""></div><div class="nm">${n}</div><i><b data-w="${Math.min(100,a/t*100)}"></b></i><em>${a}/${t}</em></button>`).join('');
$('#kol').onclick=e=>{const b=e.target.closest('.kr');if(b)go(b.dataset.u)};
requestAnimationFrame(()=>requestAnimationFrame(()=>document.querySelectorAll('.kr b').forEach(b=>b.style.width=b.dataset.w+'%')));

/* ---- kanan: STATISTIK (tiruan; di proyek utama dari get_my_profile / leaderboard) ---- */
const ST=Object.assign({rank:1,menang:9,kalah:5,streak:2,misi:4},LS('dragonroll:profile:stats',{}));
const total=ST.menang+ST.kalah,wr=total?Math.round(ST.menang/total*100):0;
const row=(ic,label,v,go,bar)=>`<${go?'button':'div'} class="sr"${go?` data-u="${go}"`:''}><div class="ic"><img src="${ic}" alt=""></div><div class="nm">${label}</div>${bar!=null?`<i class="bar"><b data-w="${bar}"></b></i>`:''}<div class="v">${v}</div></${go?'button':'div'}>`;
$('#sg').innerHTML=
  row(G+'globe-meja.webp','Peringkat Global','#'+ST.rank+(ST.rank===1?`<img src="${IC}ikon-item/mahkota.webp" alt="">`:''),'leaderboard.html')+
  row(G+'pedang-silang.webp','Rasio Kemenangan',wr+'%<small>'+ST.menang+'/'+total+'</small>')+
  row(G+'target-panah.webp','Misi',ST.misi+`<img class="go" src="${G}segitiga-kanan.webp" alt="">`,'mission.html')+
  row(IC+'ikon-item/piala.webp','Win / Lose',ST.menang+' / '+ST.kalah)+
  row(G+'api.webp','Win Streak',ST.streak);
$('#sg').onclick=e=>{const b=e.target.closest('button.sr');if(b)go(b.dataset.u)};
requestAnimationFrame(()=>requestAnimationFrame(()=>document.querySelectorAll('.sr i.bar b').forEach(b=>b.style.width=b.dataset.w+'%')));
