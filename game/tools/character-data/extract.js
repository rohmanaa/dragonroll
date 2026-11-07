/* Mengekstrak data box karakter/mob dari gameplay.html (tanpa menjalankan game). Dipanggil oleh build.js. */
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..','..'); /* = folder game/ */
const src=fs.readFileSync(path.join(ROOT,'gameplay.html'),'utf8');
function fn(name){ const i=src.indexOf('function '+name+'('); if(i<0) throw new Error('no '+name);
  let d=0,j=src.indexOf('{',i),k=j; for(;k<src.length;k++){ if(src[k]==='{')d++; else if(src[k]==='}'){ d--; if(d===0) break; } } return src.slice(i,k+1); }
// makePawn: potong sebelum pembuatan THREE.Group akhir
let mp=fn('makePawn'); const cut=mp.indexOf("const g=new THREE.Group();\n  const pal=buildBatch(b);"); if(cut<0) throw new Error('cut'); mp=mp.slice(0,cut)+"return b;}";
const code=[mp,fn('addCreeper'),fn('addEnderman'),fn('addSkeleton'),fn('addZombie'),fn('addWarden'),fn('addVillager'),fn('addBlaze'),fn('makeHostile')].join('\n');
const hex=c=>{ if(typeof c!=='number') throw new Error('color '+c); return '#'+c.toString(16).padStart(6,'0'); };
const r=n=>Math.round(n*1000)/1000;
function mk(){ return {boxes:[],ox:0,oy:0,oz:0}; }
const sb={ Math, console,
  makeBatch:mk,
  addBox(b,cx,cy,cz,sx,sy,sz,c,o){ b.boxes.push([r(cx+b.ox),r(cy+b.oy),r(cz+b.oz),r(sx),r(sy),r(sz),hex(c),(o&&o.edge===false)?1:0,b.tag||0]); },
  jit:(c)=>c, ljit:(c)=>c,
  mkPart(g,px,py,pz,draw){ const b=mk(); b.ox=px;b.oy=py;b.oz=pz; draw(b); sb.LIST.push(...b.boxes); return {rotation:{x:0,y:0,z:0},position:{}}; },
  THREE:{ Group:function(){ this.add=()=>{}; this.position={set(){}}; this.rotation={}; } },
  HZ:{},GZ:{}, rnd:Math.random, LIST:null };
vm.createContext(sb); vm.runInContext(code,sb);
const out={players:{},mobs:{},wild:{}};
for(const k of ['steve','alex','creeper','ender','zombie','skeleton','villager']){ out.players[k]=sb.makePawn({key:k}).boxes; }
for(const [k,f] of [['creeper','addCreeper'],['ender','addEnderman'],['skeleton','addSkeleton'],['zombie','addZombie'],['warden','addWarden'],['villager','addVillager']]){ const B=mk(); sb[f](B,0,0,0); out.mobs[k]=B.boxes; }
{ const B=mk(),R=mk(); R.tag=2; sb.addBlaze(B,R); out.mobs.blaze=B.boxes.concat(R.boxes); }
for(const k of ['golem','spider','zombie','skeleton','creeper']){ sb.LIST=[]; sb.makeHostile(k); out.wild[k]=sb.LIST; }
module.exports=out;
