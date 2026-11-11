/* leaderboard.html (README bagian 6): podium 3 teratas, kartu "Posisi Kamu", tab Global / Teman / Mingguan, tabel # | Pemain | Skor | Rank.
   Data TIRUAN deterministik (di proyek utama: RoomService.getLeaderboard(scope, 50) + AppearanceService untuk avatar). */
const COL=['#3d8bff','#ff5468','#43b63a','#f1b21f','#b07cff','#2fd1a8'];
const NAMES=['RajaBlok','SiNaga99','Budi_Blox','Mira','Kevin_X','CreeperKing','PixelQueen','Zoro_MC','EnderLord','Nyx','Tarra','Bimo','Lunar','Kiko','Rangga','Sasha','Dimas','Vero','Fajar','Gita','Hana','Ilham','Jojo','Kayla','Lintang','Mawar','Naufal','Oki','Putri','Raka'];
const TIER=[[4200,'Master','#ff6a5e'],[3200,'Diamond','#6fd8ff'],[2400,'Platinum','#4be0d0'],[1600,'Gold','#ffd45a'],[900,'Silver','#cfc8ea'],[0,'Bronze','#c99a5b']];
const tier=s=>TIER.find(t=>s>=t[0]);
const ICO={global:'bola-dunia-garis',friends:'grup-pengguna',weekly:'jam-bulat'};
const SCOPE={global:{n:'GLOBAL',top:5200,step:118},friends:{n:'TEMAN',top:3300,step:340},weekly:{n:'MINGGUAN',top:1850,step:44}};
let scope='global';
const ME={global:{pos:17,score:1890},friends:{pos:4,score:1890},weekly:{pos:9,score:760}};
function data(sc){
  const c=SCOPE[sc],n=sc==='friends'?8:50,me=ME[sc];
  const off=sc==='global'?0:sc==='friends'?7:14;
  const arr=[];
  for(let i=0;i<n;i++){
    arr.push({name:NAMES[(i+off)%NAMES.length],score:Math.max(30,Math.round(c.top-i*c.step-((i*37+off)%23))),col:COL[(i+off)%6]});
  }
  /* sisipkan pemain di posisi tetap; skornya di antara tetangga supaya urutan = posisi */
  const w=wallet(),pos=Math.min(me.pos,n),hi=arr[pos-2]?arr[pos-2].score:c.top+50,lo=arr[pos-1]?arr[pos-1].score:0;
  arr.splice(pos-1,0,{name:w.name,score:Math.round((hi+lo)/2)||me.score,col:'#ffb81c',me:true});
  arr.length=n;
  return arr;
}
const avatar=(p,sz,fs)=>`<div class="avc" style="width:${sz}px;height:${sz}px;font-size:${fs}px;background:${p.col}">${p.name[0].toUpperCase()}</div>`;
function drawPodium(a){
  const order=[1,0,2],med=['medali-1','medali-2','medali-3'];
  $('#podium').innerHTML=order.map(i=>{const p=a[i];if(!p)return'';
    return `<div class="pd p${i+1}"><img class="md" src="${IC}ikon-gem-medali/${med[i]}.webp" alt="">${avatar(p,i===0?150:120,i===0?72:58)}<div class="pn ttl">${p.name}${p.me?' ★':''}</div><div class="ps">${fmt(p.score)}</div><div class="blk"><b>${i+1}</b></div></div>`}).join('');
}
function draw(){
  const a=data(scope);
  $('#ltabs').innerHTML=Object.keys(SCOPE).map(k=>`<button class="lt${k===scope?' on':''}" data-k="${k}"><img class="ul" src="${IC}ikon-navigasi/garis-bawah-tab-emas.webp" alt=""><img class="ic" src="${IC}glyph-putih/${ICO[k]}.webp" alt=""><span>${SCOPE[k].n}</span></button>`).join('');
  drawPodium(a);
  $('#rows').innerHTML=a.map((p,i)=>{const t=tier(p.score);
    return `<div class="row rw${p.me?' me':''}"><span class="no">${i+1}</span>${avatar(p,64,34)}<span class="nm grow">${p.name}${p.me?' (Kamu)':''}</span><span class="sc">${fmt(p.score)}</span><span class="rk" style="color:${t[2]}">${t[1]}</span></div>`}).join('');
  const mi=a.findIndex(p=>p.me),me=a[mi],t=tier(me.score);
  $('#mycard').innerHTML=`<div class="row me"><div class="lbl ttl">POSISI KAMU</div>${avatar(me,92,48)}<div class="grow"><div class="nm ttl">${me.name}</div><div class="sb" style="color:${t[2]}">${t[1]} · ${fmt(me.score)} poin</div></div><div class="big ttl">#${mi+1}</div></div>`;
}
$('#ltabs').onclick=e=>{const b=e.target.closest('.lt');if(b){scope=b.dataset.k;draw()}};
$('#reward').onclick=()=>modal('Hadiah Peringkat','Hadiah musiman dibagikan di akhir pekan<br>sesuai rank tertinggimu.','TUTUP','');
draw();
