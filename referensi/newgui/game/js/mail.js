/* mail.html: kotak masuk — tab Semua / Hadiah / Sistem, baca (tandai dibaca), klaim hadiah (emerald/koin ke dompet), hapus (ikon sampah).
   Data TIRUAN di localStorage (di proyek utama: inbox dari server). Titik merah Mail di lobby = ada surat belum dibaca / hadiah belum diklaim. */
const KEY='dragonroll:mail';
const SEED=[
  {id:'m1',type:'reward',title:'Hadiah Login 7 Hari',body:'Terima kasih sudah bermain tiap hari! Ambil hadiah loyalitasmu.',time:'Hari ini',rw:{emerald:20,coin:500},read:false,claimed:false},
  {id:'m2',type:'reward',title:'Hadiah Peringkat Musim 3',body:'Selamat! Kamu masuk Top 20 musim lalu. Hadiah musiman dibagikan sesuai rank tertinggimu.',time:'Kemarin',rw:{emerald:50,coin:1500},read:false,claimed:false},
  {id:'m3',type:'system',title:'Selamat datang di Dragon Roll',body:'Lempar dadu, kalahkan lawan, dan kumpulkan koleksi karakter. Selamat bersenang-senang!',time:'3 hari lalu',read:false},
  {id:'m4',type:'system',title:'Pembaruan Versi 1.2',body:'Ada mode baru, bingkai profil baru, dan perbaikan bug. Cek Toko untuk item terbaru.',time:'5 hari lalu',read:true},
  {id:'m5',type:'reward',title:'Kompensasi Pemeliharaan',body:'Maaf atas gangguan server kemarin. Sebagai gantinya, kami kirim koin untukmu.',time:'1 minggu lalu',rw:{coin:800},read:true,claimed:true}
];
let S=LS(KEY,null)||{mails:SEED};
const save=()=>SAVE(KEY,S);
let tab='all';
const G=IC+'glyph-putih/';
const rwHtml=r=>`<div class="rw">${r.emerald?`<span><img src="${IC}ikon-gem-medali/berlian-hijau.webp" alt="">${fmt(r.emerald)}</span>`:''}${r.coin?`<span><img src="${IC}hud/ikon-koin-emas.webp" alt="">${fmt(r.coin)}</span>`:''}</div>`;
const pending=m=>m.rw&&!m.claimed;
function give(m){const w=wallet();setWallet({emerald:w.emerald+(m.rw.emerald||0),coin:w.coin+(m.rw.coin||0)});m.claimed=true;m.read=true}
function list(){return S.mails.filter(m=>tab==='all'||m.type===tab)}
function draw(){
  const un=S.mails.filter(m=>!m.read).length,pn=S.mails.filter(pending).length;
  $('#tabs').innerHTML=`<button class="tabb${tab==='all'?' on':''}" data-k="all">SEMUA${un?`<i>${un}</i>`:''}</button><button class="tabb${tab==='reward'?' on':''}" data-k="reward">HADIAH${pn?`<i>${pn}</i>`:''}</button><button class="tabb${tab==='system'?' on':''}" data-k="system">SISTEM</button>`;
  $('#sum').textContent=`${S.mails.length} surat · ${un} belum dibaca`;
  $('#readAll').classList.toggle('dis',!un);$('#claimAll').classList.toggle('dis',!pn);
  const a=list();
  $('#list').innerHTML=a.length?a.map(m=>{
    const ico=m.type==='reward'?'ikon-item/kado-merah':m.read?'glyph-putih/surat-terbuka':'ikon-item/surat-segel';
    const act=pending(m)?`<button class="btn sm ok" data-claim="${m.id}"><img src="${IC}tombol-dan-kontrol/tombol-hijau-polos.webp" alt=""><span>KLAIM</span></button>`:m.rw?`<button class="btn sm off"><img src="${IC}tombol-dan-kontrol/tombol-abu-polos.webp" alt=""><span>DIKLAIM</span></button>`:'';
    return `<div class="row mr${m.read?'':' unread'}" data-open="${m.id}"><div class="mi"><img src="${IC}${ico}.webp" alt=""></div><div class="grow"><div class="nm ttl">${m.title}${m.read?'':'<i></i>'}</div><div class="sb">${m.body}</div></div>${m.rw?rwHtml(m.rw):''}${act}<div class="tm">${m.time}</div><button class="rm" data-del="${m.id}" aria-label="Hapus"><img src="${G}tong-sampah.webp" alt=""></button></div>`}).join('')
   :`<div class="empty">Tidak ada surat.</div>`;
}
$('#tabs').onclick=e=>{const b=e.target.closest('.tabb');if(b){tab=b.dataset.k;draw()}};
$('#list').onclick=e=>{
  const g=a=>e.target.closest(`[${a}]`)?.getAttribute(a);let id;
  if(id=g('data-claim')){const m=S.mails.find(x=>x.id===id);give(m);save();draw();toast('Hadiah diklaim')}
  else if(id=g('data-del')){const m=S.mails.find(x=>x.id===id);
    const del=()=>{S.mails=S.mails.filter(x=>x.id!==id);save();draw();toast('Surat dihapus')};
    modal('Hapus surat',pending(m)?`Hadiah di surat ini belum diklaim.<br>Tetap hapus?`:`Hapus surat<br>"${m.title}"?`,'BATAL','HAPUS',del)}
  else if(id=g('data-open')){const m=S.mails.find(x=>x.id===id);m.read=true;save();draw();
    modal(m.title,`${m.body}${m.rw?rwHtml(m.rw):''}<span class="tmx">${m.time}</span>`,'TUTUP',pending(m)?'KLAIM':'',()=>{give(m);save();draw();toast('Hadiah diklaim')})}
};
$('#readAll').onclick=()=>{S.mails.forEach(m=>m.read=true);save();draw()};
$('#claimAll').onclick=()=>{const p=S.mails.filter(pending);if(!p.length)return;p.forEach(give);save();draw();toast(p.length+' hadiah diklaim')};
draw();
