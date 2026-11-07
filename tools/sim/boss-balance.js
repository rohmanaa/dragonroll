/* Simulasi match penuh: papan -> 6 Crystal -> HP boss (balapan per pemain). Pakai: node game/tools/sim/boss-balance.js
   Asumsi: tiap pemain berlomba menghabiskan HP boss-nya sendiri; angka 6 tidak memberi giliran tambahan di fase boss;
   "diarahkan" = bidikan Special Dice sempurna. Mob, peti, power, totem belum dimodelkan. */
const C=require('../../gameplay/game-core.js');
function m32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const B={world:{opts:{},hp:100},nether:{opts:{goal:120,ladders:{5:26,20:46,40:64,59:88,78:106,100:116},snakes:{28:3,50:18,66:36,82:61,102:80,118:94}},hp:120}};
const DMG=5,q=(a,p)=>a[Math.min(a.length-1,Math.floor(p*a.length))];
function game(b,n,aim,rng){
  const ids=Array.from({length:n},(_,i)=>'p'+i);
  let s=C.create(Object.assign({players:ids,onGoal:'stop'},B[b].opts)),goal=s.cfg.goal;
  const bs=ids.map(()=>({cd:Array(6).fill(false),k:0,hp:B[b].hp})),r={t:0,first:null};
  for(let i=0;i<4000;i++){
    const p=s.players[s.cur],st=bs[s.cur];r.t++;
    if(p.pos===goal){
      if(r.first===null)r.first=r.t;
      const v=1+Math.floor(rng()*6);
      if(st.k<6){ let u=v; if(aim){u=st.cd.indexOf(false)+1} if(!st.cd[u-1]){st.cd[u-1]=true;st.k++} }
      else{ const d=aim?6:v; st.hp-=d*DMG; if(st.hp<=0)return r; }
      s.cur=(s.cur+1)%n;
    } else { s=C.roll(s,rng).state; }
    if(s.players[s.cur].pos===goal&&r.first===null){}
  }
  return r;
}
const N=10000;
for(const b of ['world','nether'])for(const n of [2,4]){
  for(const aim of [false,true]){
    const rng=m32(77+n),tot=[],fst=[];
    for(let g=0;g<N;g++){const r=game(b,n,aim,rng);tot.push(r.t);fst.push(r.first)}
    tot.sort((a,b)=>a-b);fst.sort((a,b)=>a-b);
    console.log(b,n+'p',aim?'diarahkan':'acak   ','sampai100 median',q(fst,.5),'| total median',q(tot,.5),'p90',q(tot,.9),'| per pemain',(q(tot,.5)/n).toFixed(0),'| porsi boss ~',Math.round(100*(1-q(fst,.5)/q(tot,.5)))+'%');
  }
}
