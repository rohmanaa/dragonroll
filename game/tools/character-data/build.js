/* Jalankan dari folder game/:  node tools/character-data/build.js
   Membaca gameplay.html (makePawn, addCreeper, ..., makeHostile) lalu menulis assets/js/character-data.js. */
const fs=require('fs'),path=require('path'); const raw=require('./extract.js'); const ROOT=path.join(__dirname,'..','..');
function merge(boxes){ const out=[]; for(let i=0;i<boxes.length;){ const b=boxes[i];
  if(b[3]===0.1&&b[4]===0.1&&b[5]===0.1&&i+26<boxes.length&&boxes.slice(i,i+27).every(x=>x[3]===0.1&&x[6]===b[6])){ const ys=boxes.slice(i,i+27).map(x=>x[1]); const cy=Math.round(((Math.min(...ys)+Math.max(...ys))/2)*1000)/1000; out.push([0,cy,0,0.3,0.3,0.3,b[6],0,3]); i+=27; } else { out.push(b); i++; } }
  return out; }
const data={}; for(const g of ['players','mobs','wild']){ data[g]={}; for(const k in raw[g]) data[g][k]=merge(raw[g][k]); }
const G={player:'players',mob:'mobs',wild:'wild'};
const DATA={player:data.players,mob:data.mobs,wild:data.wild};
const META={
 player:{steve:{name:'Steve',hex:'#2F80FF',css:'#2a78d6'},alex:{name:'Alex',hex:'#FF8A1A',css:'#d9791c'},creeper:{name:'Creeper',hex:'#4DB84A',css:'#3f9f2a'},ender:{name:'Enderman',hex:'#A855F7',css:'#3a2a52'},zombie:{name:'Zombie',hex:'#2DB5A6',css:'#2b8f87'},skeleton:{name:'Skeleton',hex:'#D0D0D0',css:'#6f7378'},villager:{name:'Villager',hex:'#C9A24A',css:'#a8832f'}},
 mob:{creeper:{name:'Creeper',hex:'#3E8E3A',css:'#3f9f2a'},ender:{name:'Enderman',hex:'#3A1F5C',css:'#3a2a52'},skeleton:{name:'Skeleton',hex:'#B8B8B8',css:'#6f7378'},zombie:{name:'Zombie',hex:'#4F8F3F',css:'#2b8f87'},warden:{name:'Warden',hex:'#0E3A44',css:'#1f7f7a'},villager:{name:'Villager',hex:'#C9A24A',css:'#a8832f'},blaze:{name:'Blaze',hex:'#E0561A',css:'#e0561a'}},
 wild:{golem:{name:'Iron Golem',hex:'#C9C9C2',css:'#9a9a92'},spider:{name:'Spider',hex:'#2A2024',css:'#3a2e32'},zombie:{name:'Zombie',hex:'#5E9E4A',css:'#2b8f87'},skeleton:{name:'Skeleton',hex:'#DADADA',css:'#6f7378'},creeper:{name:'Creeper',hex:'#4DB84A',css:'#3f9f2a'}}};
const SEATS=[{name:'Merah',hex:'#E5484D',css:'#e5484d'},{name:'Biru',hex:'#3B7DDD',css:'#3b7ddd'},{name:'Kuning',hex:'#F2B632',css:'#f2b632'},{name:'Hijau',hex:'#3FB36B',css:'#3fb36b'}];
// data ringkas: satu baris per karakter
function fmt(o){ let s='{\n'; for(const g in o){ s+='  '+g+': {\n'; for(const k in o[g]){ s+='    '+k+': ['+o[g][k].map(b=>'['+b.slice(0,6).join(',')+',"'+b[6]+'",'+b[7]+','+b[8]+']').join(',')+'],\n'; } s+='  },\n'; } return s+'}'; }
let api=fs.readFileSync(path.join(__dirname,'template.js'),'utf8').replace('/*DATA*/',()=>fmt(DATA)).replace('/*META*/',()=>JSON.stringify(META)).replace('/*SEATS*/',()=>JSON.stringify(SEATS));
fs.writeFileSync(path.join(ROOT,'assets/js/character-data.js'),api); console.log('bytes',api.length);
