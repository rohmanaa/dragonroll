/* friendship.html (README bagian 6): tab Online / Semua / Permintaan, pencarian, Tambah Teman, daftar kartu teman.
   Data TIRUAN di localStorage (di proyek utama: listFriends / listRequests / acceptFriendRequest + Presence). 
   Tombol MAIN -> room.html?mode=online&format=solo&count=4&invite=<id teman>. */
const COL=['#3d8bff','#ff5468','#43b63a','#f1b21f','#b07cff','#2fd1a8'];
const KEY='dragonroll:friends';
const SEED={friends:[
  {id:'u101',name:'Budi_Blox',lv:14,st:'lobby',pos:48,tr:1240,lk:36},{id:'u102',name:'SiNaga99',lv:22,st:'lobby',pos:17,tr:2860,lk:91},{id:'u103',name:'Mira',lv:9,st:'lobby',pos:112,tr:610,lk:12},
  {id:'u104',name:'Kevin_X',lv:31,st:'busy',pos:5,tr:4120,lk:204},{id:'u105',name:'Zoro_MC',lv:18,st:'off',seen:'2 jam lalu',pos:29,tr:2105,lk:58},{id:'u106',name:'PixelQueen',lv:27,st:'off',seen:'kemarin',pos:9,tr:3540,lk:147}],
  req:[{id:'u201',name:'EnderLord',lv:12},{id:'u202',name:'Nyx',lv:7}]};
let S=LS(KEY,null)||SEED;
const save=()=>SAVE(KEY,S);
let tab='online',query='';
const ST={lobby:['Di lobi','#6be04a'],busy:['Sibuk — dalam game','#ffb02a'],off:['Offline','#8d86ad']};
const col=n=>COL[[...n].reduce((a,c)=>a+c.charCodeAt(0),0)%6];
const av=(n,sz,fs)=>`<div class="avc" style="width:${sz}px;height:${sz}px;font-size:${fs}px;background:${col(n)}">${n[0].toUpperCase()}</div>`;
const fmtN=n=>Number(n).toLocaleString('en-US');
function list(){
  const q=query.trim().toLowerCase();
  if(tab==='req')return S.req.filter(r=>r.name.toLowerCase().includes(q));
  return S.friends.filter(f=>(tab==='all'||f.st!=='off')&&f.name.toLowerCase().includes(q));
}
function draw(){
  const on=S.friends.filter(f=>f.st!=='off').length;
  $('#tabs').innerHTML=`<button class="tabb${tab==='online'?' on':''}" data-k="online">ONLINE<i>${on}</i></button><button class="tabb${tab==='all'?' on':''}" data-k="all">SEMUA</button><button class="tabb${tab==='req'?' on':''}" data-k="req">PERMINTAAN${S.req.length?`<i>${S.req.length}</i>`:''}</button>`;
  $('#sum').textContent=`${S.friends.length} teman · ${on} online`;
  const a=list();
  $('#list').innerHTML=a.length?a.map(p=>{
    if(tab==='req')return `<div class="row fc">${av(p.name,92,48)}<div class="grow"><div class="nm ttl">${p.name}</div><div class="sb">Level ${p.lv} · ingin berteman</div></div><button class="btn sm ok" data-acc="${p.id}"><img src="${IC}tombol-dan-kontrol/tombol-hijau-polos.webp" alt=""><span>TERIMA</span></button><button class="btn sm no" data-rej="${p.id}"><img src="${IC}tombol-dan-kontrol/tombol-merah-polos.webp" alt=""><span>TOLAK</span></button></div>`;
    const s=ST[p.st],G=IC+'glyph-putih/';
    const act=p.st==='lobby'?`<button class="btn sm ok" data-play="${p.id}"><img src="${IC}tombol-dan-kontrol/tombol-hijau-polos.webp" alt=""><span>MAIN</span></button>`:`<button class="btn sm off"><img src="${IC}tombol-dan-kontrol/tombol-abu-polos.webp" alt=""><span>${p.st==='busy'?'SIBUK':'OFFLINE'}</span></button>`;
    return `<div class="row fc">${av(p.name,84,44)}<div class="grow"><div class="nm ttl">${p.name}</div><div class="sb"><i class="dot" style="background:${s[1]}"></i>${p.st==='off'?'Terakhir online '+p.seen:s[0]}</div></div><div class="cell"><b>#${p.pos}</b><small>POSISI</small></div><div class="cell"><b>${p.lv}</b><small>LEVEL</small></div><div class="stat tr"><img src="${G}piala.webp" alt=""><b>${fmtN(p.tr)}</b></div><button class="stat lk${p.liked?' on':''}" data-like="${p.id}" aria-label="Suka"><img src="${G}${p.liked?'hati.webp':'hati-garis.webp'}" alt=""><b>${fmtN(p.lk)}</b></button>${act}<button class="rm" data-del="${p.id}" aria-label="Hapus teman"><img src="${G}tong-sampah.webp" alt=""></button></div>`}).join('')
   :`<div class="empty">${tab==='req'?'Tidak ada permintaan pertemanan.':query?'Teman tidak ditemukan.':'Belum ada teman online.'}</div>`;
}
$('#tabs').onclick=e=>{const b=e.target.closest('.tabb');if(b){tab=b.dataset.k;draw()}};
$('#q').oninput=e=>{query=e.target.value;draw()};
$('#list').onclick=e=>{
  const g=a=>e.target.closest(`[${a}]`)?.getAttribute(a);
  let id;
  if(id=g('data-acc')){const r=S.req.find(x=>x.id===id);S.req=S.req.filter(x=>x.id!==id);S.friends.push({id:r.id,name:r.name,lv:r.lv,st:'lobby',pos:200+Math.floor(Math.random()*300),tr:Math.floor(Math.random()*800),lk:0});save();draw();toast(r.name+' jadi temanmu')}
  else if(id=g('data-rej')){S.req=S.req.filter(x=>x.id!==id);save();draw();toast('Permintaan ditolak')}
  else if(id=g('data-like')){const f=S.friends.find(x=>x.id===id);f.liked=!f.liked;f.lk+=f.liked?1:-1;save();draw()}
  else if(id=g('data-play'))nav(`room.html?mode=online&format=solo&count=4&invite=${encodeURIComponent(id)}`);
  else if(id=g('data-del')){const f=S.friends.find(x=>x.id===id);modal('Hapus teman',`Hapus ${f.name}<br>dari daftar temanmu?`,'BATAL','HAPUS',()=>{S.friends=S.friends.filter(x=>x.id!==id);save();draw();toast(f.name+' dihapus')})}
};
$('#add').onclick=()=>{
  modal('Tambah teman','Masukkan nama atau ID pengguna:<input id="nin" class="field" type="text" maxlength="20" placeholder="Nama / ID" autocomplete="off">','BATAL','KIRIM',()=>{
    const v=($('#nin')||{}).value?.trim();if(!v){toast('Nama kosong');return}
    if(S.friends.some(f=>f.name.toLowerCase()===v.toLowerCase())){toast(v+' sudah jadi temanmu');return}
    toast('Permintaan dikirim ke '+v)});
  setTimeout(()=>{const i=$('#nin');if(i)i.focus()},50);
};
draw();
