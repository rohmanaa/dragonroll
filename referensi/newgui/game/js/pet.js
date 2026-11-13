/* pet.html: koleksi Pet — preview 3D, info, grid kartu, tombol aksi, dan pembelian demo di localStorage. */
const $=s=>document.querySelector(s);
function fit(){$('#stage').style.transform=`scale(${Math.min(innerWidth/1920,innerHeight/1080)})`}addEventListener('resize',fit);fit();
const IC='assets/komponen/';
const FROM=new URLSearchParams(location.search).get('from');
const BACK=FROM==='../../../lobby.html'?FROM:'lobby.html';
const LS=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}};
const RAW=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
const SAVE=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
const fmt=n=>Number(n).toLocaleString('en-US');

/* halaman yang sudah ada (sama dengan BUILT di lobby.js) */
const BUILT=['karakter.html','mode.html','settings.html','room.html','mission.html','shop.html','profile.html','frame.html','dadu.html','efek.html','powerup.html','leaderboard.html','friendship.html','tambang.html','mail.html','pet.html'];
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),1900)}
const nav=u=>{$('#fade').classList.add('on');setTimeout(()=>location.href=u,330)};
const go=u=>BUILT.includes(u.split('?')[0])?nav(u):toast('Segera hadir');

/* ---- dompet (sama dengan lobby/shop) ---- */
const WK='dragonroll:lobby:demo';
const wallet=()=>{const w=LS(WK,{});return{emerald:w.emerald??120,coin:w.coin??2500}};
function setCurrency(currency,amount){const w=LS(WK,{}),cur=wallet();w.emerald=cur.emerald;w.coin=cur.coin;w[currency]=amount;SAVE(WK,JSON.stringify(w));showWallet(true,currency)}
function showWallet(bump,currency='coin'){const w=wallet();$('#v-em').textContent=fmt(w.emerald);$('#v-co').textContent=fmt(w.coin);
  if(bump){const e=$(currency==='emerald'?'#cur-em':'#cur-co');e.classList.remove('bump');void e.offsetWidth;e.classList.add('bump')}}
showWallet();

/* ---- katalog pet ---- */
const TIERS=['Common','Uncommon','Rare','Epic','Legendary','Mythic','Divine'];
const TC=['#2fa84a','#22b8a4','#3a86f0','#a24ae8','#f0a020','#ee3a4e','#ffe08a'];
const DC=[
  {id:'forest_pup',tier:1,n:'Forest Pup',e:'🐶',c:'#6fd05a',material:'Oak Wood dan Daun',identity:'Ramah dan setia',role:'Pengendus',skill:{name:'Hidung Penuntun',type:'passive',effect:'Saat digigit ular, mundur 1 kotak lebih sedikit (minimal tetap mundur 1).',limit:'Tanpa batas',params:{snake_penalty_reduction:1}},adv:'Stabil dan mudah dipakai pemula. Mengurangi kerugian kecil secara konsisten.',visual:'Anak anjing hutan berbulu cokelat dan krem, kalung kulit dengan papan kayu, ranting daun di kepala.',animations:['bernapas','kepala miring','ekor mengibas','telinga bergoyang','lidah terjulur','berkedip'],effect_summary:'Ekor bergoyang, daun jatuh pelan',effects:'Daun hijau jatuh pelan, jarang.',sounds:['guk guk','yip pendek','rengekan'],palette:['#b8803f','#f0dcb0','#3fa04a'],lore:'Anak anjing hutan dengan kalung papan kayu. Gerakannya sederhana: bernapas, mengibas ekor, berkedip.',price_currency:'coin',price_amount:100000},
  {id:'copper_golem',tier:2,n:'Copper Golem',e:'🤖',c:'#ff9a30',material:'Copper Block dan Verdigris',identity:'Industrial dan rajin',role:'Pelindung',skill:{name:'Perisai Tembaga',type:'active',effect:'Menahan 1 gigitan ular sehingga pemain tidak turun.',limit:'1 kali per game',params:{snake_bites_blocked:1,uses_per_game:1}},adv:'Pertahanan yang pasti. Cocok untuk menyelamatkan posisi di dekat garis akhir.',visual:'Golem tembaga dengan bercak karat hijau, panel pengukur di dada, roda gigi di punggung, antena berlampu oranye.',animations:['roda gigi berputar','jarum pengukur bergerak','lengan mengayun','kepala menoleh','lampu antena berdenyut'],effect_summary:'Roda gigi berputar, uap, lampu antena berdenyut',effects:'Uap putih dari pipa bahu, percikan tembaga.',sounds:['denting logam','desis uap','bunyi servo'],palette:['#c8703a','#3fbf9f','#ffb040'],lore:'Golem tembaga dengan bercak karat hijau, panel pengukur di dada, dan roda gigi di punggung.',price_currency:'coin',price_amount:250000},
  {id:'crystal_axolotl',tier:3,n:'Crystal Axolotl',e:'🦎',c:'#40e8f4',material:'Diamond Crystal',identity:'Tenang dan berkilau',role:'Penyembuh',skill:{name:'Regenerasi Kristal',type:'passive',effect:'Setelah turun karena ular, otomatis maju +2 kotak di giliran berikutnya.',limit:'Tanpa batas',params:{bonus_move_after_snake:2}},adv:'Memperkecil kerugian dari ular. Kuat untuk permainan panjang.',visual:'Axolotl biru es dengan insang merah muda berujung kristal, kristal tumbuh di punggung, permata di dahi.',animations:['mengambang naik turun','ekor berombak','insang bergetar','kristal berdenyut','berkedip'],effect_summary:'Insang bergetar, ekor berombak, gelembung kristal',effects:'Gelembung dan kilau kristal naik ke atas.',sounds:['gelembung','lonceng air','cicit pendek'],palette:['#8fe8f2','#d8fbff','#ff9ad8','#40e8f4'],lore:'Axolotl berwarna es dengan kristal tumbuh di punggung dan permata di dahi. Mengambang pelan di atas panggung.',price_currency:'coin',price_amount:600000},
  {id:'arcane_owl',tier:4,n:'Arcane Owl',e:'🦉',c:'#b46af0',material:'Amethyst dan Rune',identity:'Bijak dan arcane',role:'Peramal',skill:{name:'Mata Ramalan',type:'active',effect:'Melihat hasil dadu berikutnya dan boleh menggesernya 1 angka ke atas atau ke bawah.',limit:'Jeda 3 giliran',params:{dice_adjust:1,cooldown_turns:3}},adv:'Bisa mengatur langkah dengan perhitungan, misalnya menghindari kotak ular atau mengejar tangga.',visual:'Burung hantu ungu bertengger di gugus amethyst, mata emas bercahaya, dua cincin rune di belakang kepala.',animations:['kepala menoleh lebar','sayap berkedip','cincin rune berputar berlawanan','kristal mengorbit','berkedip'],effect_summary:'Cincin rune berputar, kristal mengorbit, kilau ungu',effects:'Kilau ungu naik pelan.',sounds:['hu-hu','denting arcane','kepakan sayap'],palette:['#6a4a7a','#b46af0','#ffd24a'],lore:'Burung hantu bertengger di gugus amethyst. Dua cincin rune berputar berlawanan di belakang kepalanya.',price_currency:'coin',price_amount:1500000},
  {id:'storm_wolf',tier:5,n:'Storm Wolf',e:'🐺',c:'#7fd0ff',material:'Storm Steel dan Lightning Crystal',identity:'Thunder Lord',role:'Penyerang',skill:{name:'Sambaran Badai',type:'active',effect:'Pilih salah satu: lawan terdekat mundur 3 kotak, atau lempar dadu dua kali dan ambil yang terbesar.',limit:'3 kali per game, jeda 4 giliran',params:{push_back:3,alt_roll_twice_take_max:true,uses_per_game:3,cooldown_turns:4}},adv:'Satu-satunya pet yang menekan lawan. Bisa membalik keadaan saat tertinggal.',visual:'Serigala baja kebiruan dengan surai duri petir kuning, mata biru menyala, garis listrik di kaki. Awan badai melayang di atasnya.',animations:['bernapas','kepala menoleh','ekor bergelombang','telinga bergerak','surai berdenyut','petir menyambar dari awan'],effect_summary:'Petir menyambar dari awan, surai listrik',effects:'Percikan listrik dari surai, kilat dari awan ke tanah atau surai.',sounds:['lolongan','guntur','setrum'],palette:['#5a6a8a','#e8f4ff','#7fd0ff','#fff2a0'],lore:'Serigala baja dengan surai duri petir. Awan badai di atasnya menyambar tanah dan surainya secara acak.',price_currency:'coin',price_amount:4000000},
  {id:'inferno_dragon',tier:6,n:'Inferno Dragon',e:'🐉',c:'#ff4a3a',material:'Dragon Scale dan Obsidian',identity:'Dragon Lord',role:'Pembakar Ular',skill:{name:'Napas Api',type:'active',effect:'Menghanguskan 1 ular di jalurmu. Ular itu tidak aktif selama 3 giliran.',limit:'1 kali per game',params:{burn_snake_turns:3,uses_per_game:1}},adv:'Mematikan ancaman terbesar di papan, dan efeknya juga menguntungkan pemain lain yang lewat.',visual:'Naga obsidian dengan sisik merah tua, retakan lava di dada, tanduk gading, sayap lebar, ekor berujung api.',animations:['bernapas','leher bergoyang','sayap mengepak','ekor bergelombang','rahang terbuka menyemburkan api tiap beberapa detik'],effect_summary:'Kepakan sayap, napas api, bara menyala',effects:'Bara api naik, semburan api dari mulut.',sounds:['raungan','semburan api','kepakan sayap'],palette:['#1b0a10','#a0182c','#ff7a18','#ffd24a'],lore:'Naga obsidian dengan retakan lava di dada. Setiap beberapa detik rahangnya terbuka dan menyemburkan api.',price_currency:'coin',price_amount:10000000},
  {id:'celestial_kitsune',tier:7,n:'Celestial Kitsune',e:'🦊',c:'#ffe08a',material:'Divine Crystal dan Gold',identity:'Celestial Guardian',role:'Pengubah Takdir',skill:{name:'Sembilan Ekor',type:'active',effect:'Membuat tangga bayangan dari posisimu ke kotak mana pun dalam 9 kotak di depan.',limit:'1 kali per game',params:{shadow_ladder_range:9,uses_per_game:1}},adv:'Lompatan terbesar dan bisa dipakai kapan saja, termasuk untuk melewati ular.',visual:'Rubah putih dan emas yang melayang di atas lingkaran sihir. Sembilan ekor tebal mengembang seperti kipas, ujungnya bintang bercahaya.',animations:['melayang naik turun','sembilan ekor bergelombang','telinga bergerak','bintang mengorbit','api roh biru melayang'],effect_summary:'Sembilan ekor tebal bergelombang, bintang mengorbit',effects:'Bintang putih, emas, dan biru naik ke atas.',sounds:['lonceng arpeggio','lengkingan rubah','kilau'],palette:['#fdfbf4','#ffcf4a','#6ae8ff'],lore:'Rubah sembilan ekor melayang di atas lingkaran sihir. Ekornya besar, berbulu tebal, mengembang seperti kipas dan berujung bintang.',price_currency:'emerald',price_amount:3000}
];
const OWN_K='dragonroll:own:pet',USE_K='dragonroll:pref:pet';
let owned=LS(OWN_K,[]);if(!Array.isArray(owned))owned=[];owned=owned.filter(id=>DC.some(f=>f.id===id));SAVE(OWN_K,JSON.stringify(owned));
let used=RAW(USE_K);if(!DC.some(f=>f.id===used&&owned.includes(f.id)))used=null;
let sel=used||DC[0].id;
const has=id=>owned.includes(id);
/* ---- tab kategori koleksi ---- */

/* ---- gambar ulang ---- */
function draw(){
  const f=DC.find(x=>x.id===sel),mine=has(f.id),on=f.id===used;
  let html=DC.map(x=>{
    const m=has(x.id);
    const icon=x.price_currency==='emerald'?'ikon-gem-medali/berlian-hijau.webp':'hud/ikon-koin-emas.webp';
    const pr=m?'':`<div class="pr${x.price_currency==='emerald'?' emt':''}"><img src="${IC}${icon}" alt="">${fmt(x.price_amount)}</div>`;
    const tag=x.id===used?'<span class="tag">DIPAKAI</span>':m?'<span class="tag own">DIMILIKI</span>':'';
    return `<button class="fslot${x.id===sel?' sel':''}${m?'':' lk'}" data-id="${x.id}">${tag}<div class="dc"><img src="assets/pet3d/${x.id}.png" alt="${x.n}" loading="lazy"></div>${pr}</button>`}).join('');
  for(let i=DC.length;i<18;i++)html+='<div class="slot empty"></div>';
  $('#grid').innerHTML=html;
  if(window.PetViewer)PetViewer.select(f.id);
  $('#nm').textContent=f.n;
  $('#rar').textContent=TIERS[f.tier-1]+' · Tier '+f.tier;$('#rar').style.color=TC[f.tier-1];
  $('#ds').textContent=f.lore;
  const rows=[
    ['Peran',f.role],
    ['Skill',f.skill.name+' ('+f.skill.type+'): '+f.skill.effect],
    ['Batas',f.skill.limit],
    ['Keunggulan',f.adv],
    ['Harga',fmt(f.price_amount)+' '+(f.price_currency==='emerald'?'Emerald':'Coin')]
  ];
  const info=$('#petInfoBody'),close=document.createElement('button');info.replaceChildren();close.id='petInfoClose';close.type='button';close.className='pet-info-close';close.setAttribute('aria-label','Tutup detail pet');close.textContent='×';close.onclick=()=>$('#petInfo').open=false;info.appendChild(close);
  for(const [label,value] of rows){
    const row=document.createElement('div'),name=document.createElement('b'),text=document.createElement('span');
    row.className='pet-info-row';name.textContent=label;text.textContent=value;row.append(name,text);info.appendChild(row);
  }
  const b=$('#use'),sp=b.querySelector('span');
  b.classList.remove('off');
  if(mine){sp.textContent=on?'DIGUNAKAN':'GUNAKAN';b.classList.toggle('off',on)}
  else{const icon=f.price_currency==='emerald'?'ikon-gem-medali/berlian-hijau.webp':'hud/ikon-koin-emas.webp';sp.innerHTML=`<img src="${IC}${icon}" alt="">${fmt(f.price_amount)}`}
}
$('#grid').onclick=e=>{const c=e.target.closest('.fslot');if(c){sel=c.dataset.id;draw()}};

/* ---- aksi: pakai / beli ---- */
function equip(id){used=id;SAVE(USE_K,id)}
$('#use').onclick=()=>{
  const f=DC.find(x=>x.id===sel);
  if(has(f.id)){if(f.id!==used){equip(f.id);draw();toast(f.n+' dipakai')}return}
  const currency=f.price_currency,label=currency==='emerald'?'Emerald':'Coin',balance=wallet()[currency];
  if(balance<f.price_amount)modal(label+' tidak cukup',`Butuh ${fmt(f.price_amount)} ${label} untuk ${f.n}.<br>Saldo kamu ${fmt(balance)} ${label}.`,'TUTUP',currency==='emerald'?'DAPATKAN EMERALD':'DAPATKAN COIN',()=>go(currency==='emerald'?'tambang.html':'shop.html?coin=1'));
  else modal('Konfirmasi',`Beli ${f.n}<br>seharga ${fmt(f.price_amount)} ${label}?`,'BATAL','BELI',()=>{
    setCurrency(currency,balance-f.price_amount);owned.push(f.id);SAVE(OWN_K,JSON.stringify(owned));equip(f.id);draw();toast(f.n+' dibeli dan dipakai')});
};

/* ---- modal ---- */
let okFn=null;
function modal(t,x,noL,okL,ok){
  $('#mt').textContent=t;$('#mx').innerHTML=x;
  $('#m-no span').textContent=noL;$('#m-ok span').textContent=okL;
  okFn=ok;$('#md').classList.add('on');
}
const closeM=()=>$('#md').classList.remove('on');
$('#m-no').onclick=closeM;
$('#m-ok').onclick=()=>{closeM();if(okFn)okFn()};
$('#md').onclick=e=>{if(e.target.id==='md')closeM()};

$('#back').onclick=$('#home').onclick=()=>nav(BACK);
$('#cur-co').onclick=()=>go('shop.html?coin=1');
$('#cur-em').onclick=()=>go('tambang.html');
draw();
