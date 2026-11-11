const $=s=>document.querySelector(s);
function fit(){$('#stage').style.transform=`scale(${Math.min(innerWidth/1920,innerHeight/1080)})`}addEventListener('resize',fit);fit();
const wal=(()=>{try{return JSON.parse(localStorage.getItem('dragonroll:lobby:demo'))||{}}catch(e){return{}}})();
$('#v-em').textContent=(wal.emerald??120).toLocaleString('en-US');$('#v-co').textContent=(wal.coin??2500).toLocaleString('en-US');

/* level pemain: rumus sama dengan lobby (level 1 butuh 400 XP, tiap level +100) */
function lvInfo(xp){let lv=1,need=400;while(xp>=need&&lv<999){xp-=need;lv++;need=400+100*(lv-1)}return{lv,cur:lv>=999?need:xp,need}}
const L=lvInfo(wal.xp??683),pct=Math.min(100,L.cur/L.need*100);
$('#lvn').textContent=L.lv;$('#lvp').textContent=pct.toFixed(1)+'%';$('#lvf').style.width=pct+'%';

/* slot samping (seperti slot equipment di fcuBiA) */
const G='assets/komponen/glyph-putih/';
const eq=(g,lock)=>`<div class="eq${lock?' lock':''}"><img src="${G}${g}.webp" alt="">${lock?'<b>LV.10</b>':''}</div>`;
$('#eqL').innerHTML=['pedang-1','baju-zirah','perisai','cincin'].map(g=>eq(g)).join('');
$('#eqR').innerHTML=eq('kapak')+eq('sarung-tangan')+eq('sepatu-bot')+eq('gembok',1);

/* tab kategori (ikon tab dari kit) */
const GRP={pejuang:'petarung',gladiator:'petarung',assassin:'petarung',paladin:'penjaga',pendeta:'penjaga',pemanah:'penjelajah',ranger:'penjelajah',penyihir:'sihir','ahli-sihir':'sihir',gelap:'sihir'};
const TABS=[['all','ALL'],['petarung','tab-pedang'],['penjaga','tab-perisai'],['penjelajah','tab-sepatu'],['sihir','tab-cincin']];
let tab='all',sel=getHero().id;
$('#tabs').innerHTML=TABS.map(([k,ic],i)=>`<button class="tab" data-k="${k}" style="left:${i*180}px">${ic==='ALL'?'<span>ALL</span>':`<img src="assets/komponen/ikon-navigasi/${ic}.webp" alt="">`}<img class="ul" src="assets/komponen/ikon-navigasi/garis-bawah-tab-emas.webp" alt=""></button>`).join('');

/* pedestal batu bertingkat (sama dengan lobby) */
const cyl=(cx,cy,rx,ry,h,top,side)=>`<path d="M${cx-rx},${cy} v${h} a${rx},${ry} 0 0 0 ${rx*2},0 v${-h} Z" fill="${side}" stroke="#17122b" stroke-width="3" stroke-linejoin="round"/><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${top}" stroke="#17122b" stroke-width="3"/>`;
const PED=`<svg viewBox="0 0 500 190" aria-hidden="true"><ellipse cx="250" cy="168" rx="236" ry="22" fill="rgba(8,4,20,.35)"/>${cyl(250,104,222,46,30,'#4b4370','#2f2949')}${cyl(250,82,176,36,24,'#5d5486','#3b3459')}${cyl(250,62,128,27,20,'#6f66a0','#463e6b')}<ellipse cx="250" cy="62" rx="100" ry="20" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="3"/></svg>`;

function draw(){
  const used=getHero().id,h=HEROES.find(x=>x.id===sel);
  $('#tabs').querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.dataset.k===tab));
  const list=HEROES.filter(x=>tab==='all'||GRP[x.id]===tab);
  let html=list.map(x=>`<button class="slot ${x.id===sel?'sel':''}" data-id="${x.id}">${x.id===used?'<span class="tag">DIPAKAI</span>':''}<img src="${heroIcon(x)}" alt=""><span class="n">${x.name}</span></button>`).join('');
  for(let i=list.length;i<24;i++)html+='<div class="slot empty"></div>';
  $('#grid').innerHTML=html;
  $('#art').innerHTML=PED+`<img src="${h.art||heroIcon(h)}" alt="" style="height:${h.art?400:230}px">`;
  $('#nm').textContent=h.name;$('#cls').textContent=h.cls;$('#ds').textContent=h.desc;
  const C=['#e5604e','#3fc6a8','#4db3e6'];
  $('#stats').innerHTML=['Kekuatan','Kelincahan','Pertahanan'].map((n,i)=>`<div class="st" style="--c:${C[i]}"><span>${n}</span><i><b style="width:${h.stat[i]*20}%"></b></i></div>`).join('');
  const on=h.id===used;$('#use span').textContent=on?'DIGUNAKAN':'GUNAKAN';$('#use').classList.toggle('off',on);
}
$('#grid').onclick=e=>{const c=e.target.closest('.slot[data-id]');if(c){sel=c.dataset.id;draw()}};
$('#tabs').onclick=e=>{const t=e.target.closest('.tab');if(t){tab=t.dataset.k;draw()}};
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),1800)}
$('#use').onclick=()=>{setHero(sel);draw();toast('Karakter diganti: '+HEROES.find(h=>h.id===sel).name)};
const toLobby=()=>{$('#fade').classList.add('on');setTimeout(()=>location.href='lobby.html',330)};
$('#back').onclick=toLobby;$('#home').onclick=toLobby;
draw();
