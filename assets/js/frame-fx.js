/* Frame profil beranimasi (desain: tools/frame-design/Character_Frames.html).
   Frame digambar lewat kode (pixel 56x56 sel, bingkai 3 sel, lubang avatar 26x26) + efek hidup: kilau, partikel, petir, halo, api, bintang.
   Mode "ringkas" (42x42 sel) dipakai di game: lubang avatar = 26/42 = 61.9% lebar gambar, di tengah (19.05% dari tiap sisi).

   Cara pakai: tidak perlu mengubah halaman. Setiap <img src="data/frame/<nama>.webp"> otomatis diganti <canvas> beranimasi
   (class/id/style dipertahankan, dan properti .src tetap bisa diganti seperti <img>). Satu loop rAF bersama; canvas di luar layar dilewati.
   API: FrameFX.keyOf(frameId|path), FrameFX.dataURL(key), FrameFX.upgrade(root). prefers-reduced-motion: digambar sekali (statis). */
(function (g) {
  'use strict';
  if (g.FrameFX) return;
const G=56,O=12,B=32,S=6;
const H=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const mixc=(a,b,t)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t));
const css=(c,a=1)=>`rgba(${c[0]},${c[1]},${c[2]},${a})`;
const rngf=s=>()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);
const rot=rows=>{const W=rows[0].length,Hh=rows.length,o=[];for(let i=0;i<W;i++){let r='';for(let j=0;j<Hh;j++)r+=rows[j][W-1-i];o.push(r)}return o};
const CRY=[".. h..".replace(/ /g,''),".hch.",".hcc.","hcccd","hcccd","hccdd","hccdd","hcddd","ddddd"];

let CP=false;
const CRY_S=['..h..','.hch.','.hcc.','hccdd','hcddd','ddddd'];
const CRYX=()=>CP?CRY_S:CRY;
function build(def){
  const R=rngf(def.seed*977+13);
  const g=new Array(G*G).fill(null),emis=[];
  const set=(x,y,c)=>{x=Math.round(x);y=Math.round(y);if(x>=0&&y>=0&&x<G&&y<G)g[y*G+x]=c};
  const em=(x,y,c)=>{set(x,y,c);emis.push([Math.round(x),Math.round(y),c])};
  const band=[];
  for(let y=O;y<O+B;y++)for(let x=O;x<O+B;x++){
    const dl=x-O,dr=O+B-1-x,dt=y-O,db=O+B-1-y,d=Math.min(dl,dr,dt,db);
    if(d>2)continue;
    if(d===0&&Math.min(dl,dr)===0&&Math.min(dt,db)===0)continue;
    const side=Math.min(dt,db)<=Math.min(dl,dr)?'h':'v';
    const ang=Math.atan2(y-(O+B/2),x-(O+B/2));
    let c=def.fill({x,y,d,side,R,ang,em});
    const lit=(dt===d||dl===d),shd=(db===d||dr===d);
    if(d===0)c=def.outline;else if(d===1&&lit)c=mixc(c,[255,255,255],.25);else if(d===2)c=mixc(c,[0,0,0],.38);else if(d===1&&shd)c=mixc(c,[0,0,0],.12);
    set(x,y,c);band.push([x,y,ang,d]);
  }
  // ornament helpers: s4 mirrors to 4 corners
  const s4=(fn)=>{for(let k=0;k<4;k++){const fx=k&1,fy=k>>1;fn((x,y,c,e)=>{const X=fx?G-1-x:x,Y=fy?G-1-y:y;e?em(X,Y,c):set(X,Y,c)})}};
  const blit=(p,rows,pal,ox,oy,e)=>rows.forEach((r,j)=>[...r].forEach((ch,i)=>{if(ch!=='.'&&pal[ch])p(ox+i,oy+j,pal[ch],e&&e.includes(ch))}));
  const crystals=(p,pal,big)=>{const up=CP?CRY_S:(big?CRY:CRY.slice(1));blit(p,up,pal,O-2,O+2-up.length);const l=rot(up);blit(p,l,pal,O+1-l[0].length+1,O-2);};
  const gem=(cx,cy,pal)=>{const rows=["..h..",".hch.","hcccd",".cdd.","..d.."];blit(set,rows,pal,cx-2,cy-2,'hc')};
  const mid={set,em,R,s4,blit,crystals,gem,H,mixc,G,O,B};
  def.orn&&def.orn(mid);
  const cv=document.createElement('canvas');cv.width=cv.height=G;const x=cv.getContext('2d');
  const id=x.createImageData(G,G);
  for(let i=0;i<G*G;i++)if(g[i]){id.data[i*4]=g[i][0];id.data[i*4+1]=g[i][1];id.data[i*4+2]=g[i][2];id.data[i*4+3]=255}
  x.putImageData(id,0,0);
  const big=document.createElement('canvas');big.width=big.height=G*S;const bx=big.getContext('2d');bx.imageSmoothingEnabled=false;bx.drawImage(cv,0,0,G*S,G*S);
  return {cv:big,emis,band,R};
}

// ---------- wings (procedural)
function wings(set,pal,o={}){
  const n=o.n||6,len=o.len||15,ax=O-1,ay=O+(o.ay||9),jag=o.jag||0;
  for(const side of[-1,1]){
    for(let pass=0;pass<2;pass++){
      for(let k=0;k<n;k++){
        const L=len-k*(len/(n+3)),a=Math.PI+1.05-k*(1.5/n),dx=Math.cos(a),dy=Math.sin(a);
        const sx=ax,sy=ay+k*1.6;
        for(let t=0;t<=L;t+=.5){
          const x=sx+dx*t,y=sy+dy*t+(jag?Math.sin(t*1.3+k)*jag:0),X=side<0?x:G-1-x;
          const f=t/L,col=mixc(pal.a,pal.b,f);
          if(pass===0){for(const[ox,oy]of[[-1,0],[1,0],[0,-1],[0,1],[0,2],[0,-0]])set(X+ox,y+oy,pal.edge)}
          else{set(X,y,col);set(X,y+1,mixc(col,pal.a,.3))}
        }
      }
    }
  }
}

// ---------- frame definitions
const D=(id,tier,name,mat,ident,efek,def)=>({id,tier,name,mat,ident,efek,...def});
const FR=[
D('wood',1,'Wooden Frame','Oak Wood','Natural dan klasik','Tidak ada animasi khusus',{seed:1,outline:H('#2a1608'),
 fill:({side,R,d,x,y})=>{let c=mixc(H('#b07a40'),H('#7e5226'),R()*.55);if(((side==='h'?y:x)*5+((side==='h'?x:y)>>2))%4===0)c=mixc(c,H('#4a2c12'),.3);return c},
 orn:({s4,set,R})=>{s4((p)=>{p(O+3,O+3,H('#8a8f98'));p(O+4,O+3,H('#d0d4da'));const L=[H('#3fa04a'),H('#2c7a35'),H('#6fd05a')];for(const[a,b]of[[0,0],[-1,0],[0,-1],[-2,0],[0,-2],[1,-1],[-1,1],[-1,-1],[-3,0],[0,-3]])p(O+a,O+b,L[(a+b+9)%3])})},
 fx:{glow:null}}),
D('stone',1,'Stone Frame','Stone Block','Sederhana dan kokoh','Debu batu sesekali muncul',{seed:2,outline:H('#1c1d22'),
 fill:({x,y,R,d})=>{const row=(y>>2),off=(row%2)*2;let c=mixc(H('#9a9ea6'),H('#666a72'),R()*.5);if(y%4===0||(x+off)%6===0)c=mixc(c,H('#2e3036'),.3);return c},
 orn:({s4,set,R})=>{s4((p)=>{for(const[a,b]of[[1,2],[2,1],[2,2],[3,2],[2,3],[4,3]])p(O+a,O+b,H('#b4b8c0'));p(O+1,O+4,H('#2c2e34'));p(O+2,O+5,H('#2c2e34'))});for(let i=0;i<9;i++){const x=O+4+((R()*24)|0);set(x,O+((R()*3)|0),H('#25272c'))}},
 fx:{parts:{kind:'dust',rate:1.2}}}),

D('copper',2,'Copper Frame','Copper Block','Industrial','Kilau tembaga sesekali',{seed:3,outline:H('#2a1006'),
 fill:({R})=>{let c=mixc(H('#e08840'),H('#a84a22'),R()*.7);if(R()<.07)c=H('#3fc4a0');return c},
 orn:({s4,set})=>{s4((p)=>{for(let i=-1;i<5;i++)for(let j=-1;j<5;j++)p(O+i,O+j,(i===-1||j===-1||i===4||j===4)?H('#5a2a10'):(i<=0||j<=0?H('#f2a460'):H('#c4662c')));p(O+1,O+1,H('#5a2a10'));p(O+2,O+2,H('#5a2a10'));p(O+1,O+2,H('#ffd0a0'))});for(const x of[27,28])for(const y of[O-1,O+B]){set(x,y,H('#5a2a10'))}for(const y of[27,28])for(const x of[O-1,O+B])set(x,y,H('#5a2a10'));for(const[x,y]of[[27,O+1],[28,O+1],[27,O+B-2],[28,O+B-2],[O+1,27],[O+1,28],[O+B-2,27],[O+B-2,28]])set(x,y,H('#ffd0a0'))},
 fx:{sweep:{color:[255,220,170],speed:.12,w:.05,every:3}}}),
D('iron',2,'Iron Frame','Iron Block','Medieval / Warrior','Kilatan metalik',{seed:4,outline:H('#15171c'),
 fill:({x,y,side,R})=>{let c=mixc(H('#c4c9d0'),H('#7a808a'),R()*.4+(side==='h'?((y*2)%3)*.08:0));if(((side==='h'?x:y)%8)===0)c=mixc(c,H('#2e3238'),.4);return c},
 orn:({s4,set})=>{s4((p)=>{for(let i=0;i<7;i++)for(let j=0;j<7;j++){if(i>3&&j>3)continue;const e=(i===0||j===0||(i===6&&j<=3)||(j===6&&i<=3));p(O-2+i,O-2+j,e?H('#20232a'):(i<2||j<2?H('#dfe3e8'):H('#8a909a')))}p(O,O,H('#20232a'));p(O+1,O,H('#fff'));p(O+3,O+3,H('#20232a'))});for(const[x,y]of[[27,O+1],[28,O+1],[27,O+B-2],[28,O+B-2]])set(x,y,H('#20232a'))},
 fx:{sweep:{color:[255,255,255],speed:.35,w:.035,every:2.2}}}),

D('gold',3,'Gold Frame','Gold Block','Royal','Kilau emas bergerak di pinggiran',{seed:5,outline:H('#3a2604'),
 fill:({x,y,R,side,d})=>{let c=mixc(H('#ffd84e'),H('#d49a1a'),R()*.55);if((x+y)%11<2)c=mixc(c,H('#fff6c0'),.6);if(d===1&&((side==='h'?x:y)%4===0))c=mixc(c,H('#7a5208'),.45);return c},
 orn:({s4,set,gem,em,blit})=>{s4((p)=>{for(let i=-1;i<5;i++)for(let j=-1;j<5;j++){if(i<=-1&&j<=-1)continue;const e=(i===-1||j===-1||i===4||j===4);p(O+i,O+j,e?H('#5a3a04'):((i+j)%3===0?H('#fff2a8'):H('#e8b22a')))}p(O+1,O+1,H('#e03a4a'));p(O+2,O+1,H('#ff9aa5'))});gem(28,O-1,{h:H('#bff8ff'),c:H('#27d8f2'),d:H('#0e7a98')});for(const x of[17,21,34,38]){set(x,O+1,H('#7a5208'));set(x+1,O+1,H('#7a5208'))}},
 fx:{glow:{c:[255,210,80],a:.7},sweep:{color:[255,250,210],speed:.22,w:.07,every:0},sparkle:{n:5,c:[255,245,190]},pulse:true}}),
D('diamond',3,'Diamond Frame','Diamond Block','Precious Crystal','Kilauan kristal dan partikel kecil',{seed:6,outline:H('#06303a'),
 fill:({x,y,R})=>{let c=mixc(H('#3ee4ee'),H('#17a0c0'),((x*3+y*2)%7)/7*.7+R()*.2);if(R()<.08)c=H('#e8ffff');return c},
 orn:({s4,crystals,set})=>{const pal={h:H('#e8ffff'),c:H('#3ee4ee'),d:H('#0e8aa8')};s4((p)=>crystals(p,pal,false));const up=CRYX();for(let j=0;j<up.length;j++)[...up[j]].forEach((ch,i)=>{if(ch!=='.')set(26+i,O+2-up.length+j,pal[ch])})},
 fx:{glow:{c:[80,230,240],a:.55},sparkle:{n:7,c:[230,255,255]},parts:{kind:'crystal',rate:2,cols:[[170,250,255],[255,255,255]]}}}),

D('amethyst',4,'Amethyst Frame','Amethyst','Arcane','Kristal berkilau dan partikel ungu',{seed:7,outline:H('#1a0b2e'),
 fill:({x,y,R,side})=>{let c=mixc(H('#b070f0'),H('#6a2ab8'),(((side==='h'?x:y)>>2)%2)*.35+R()*.35);if(R()<.07)c=H('#f0d0ff');return c},
 orn:({s4,crystals,set})=>{const pal={h:H('#f4d8ff'),c:H('#b46af0'),d:H('#5a22a0')};s4((p)=>{crystals(p,pal,true);if(!CP){const sm=CRY.slice(2);for(let j=0;j<sm.length;j++)[...sm[j]].forEach((ch,i)=>{if(ch!=='.')p(O+5+i,O-1+j-sm.length+4,pal[ch])})}});{const up=CRYX();for(let j=0;j<up.length;j++)[...up[j]].forEach((ch,i)=>{if(ch!=='.')set(26+i,O+2-up.length+j,pal[ch])})}},
 fx:{glow:{c:[190,100,255],a:.9},sparkle:{n:8,c:[245,215,255]},parts:{kind:'crystal',rate:3.5,cols:[[220,160,255],[255,200,255],[170,110,255]]},pulse:true}}),
D('nether',4,'Nether Frame','Nether Brick dan Magma','Infernal','Bara api dan asap tipis',{seed:8,outline:H('#120408'),
 fill:({x,y,R,em,side})=>{const row=y>>2,off=(row%2)*3;let c=mixc(H('#5a1218'),H('#2e0a10'),R()*.7);if(y%4===0||(x+off)%7===0)c=mixc(c,H('#12040a'),.5);if(R()<.07){return H('#ff9a1a')}return c},
 orn:({s4,set,em,R})=>{s4((p)=>{for(let i=-1;i<6;i++)for(let j=-1;j<6;j++){if((i>3&&j>3)||(i<0&&j<0))continue;const e=(i===-1||j===-1);p(O+i,O+j,e?H('#120408'):((i+j)%2?H('#4a0e16'):H('#3a0a12')))}p(O+1,O+2,H('#ff7a18'),true);p(O+2,O+2,H('#ffd24a'),true);p(O+2,O+3,H('#ff5a10'),true);p(O+1,O+5,H('#ff7a18'),true);p(O+2,O+6,H('#ff5a10'),true);p(O+5,O+1,H('#ff7a18'),true)});for(let i=0;i<14;i++){const x=O+5+((R()*22)|0),y=O+((R()*3)|0);em(x,y,H('#ff7a18'));}},
 fx:{glow:{c:[255,110,30],a:.7},pulse:true,parts:{kind:'ember',rate:5},smoke:true}}),

D('ender',5,'Ender Frame','End Stone dan Crying Obsidian','End Dimension','Partikel Ender muncul dan menghilang',{seed:9,outline:H('#06020c'),
 fill:({x,y,R})=>{let c=mixc(H('#1c1030'),H('#0c0618'),R()*.8);if(R()<.09)c=H('#8a30e0');if((x+y*2)%13===0)c=mixc(c,H('#a43cff'),.5);return c},
 orn:({s4,crystals,set,em,R})=>{const pal={h:H('#f0c8ff'),c:H('#b040ff'),d:H('#5a14a8')};s4((p)=>{crystals(p,pal,true);for(let i=-1;i<5;i++)for(let j=-1;j<5;j++){if(i<=0&&j<=0&&0)continue;if(i>=3||j>=3)p(O+i,O+j,((i+j)%2)?H('#12081e'):H('#1c1030'))}p(O+1,O+1,H('#ff40d8'),true);p(O+2,O+2,H('#ff9af0'),true)});for(let i=0;i<20;i++){const x=O+4+((R()*24)|0),y=O+((R()*3)|0);if(R()<.5)em(x,y,H('#ff40d8'))}},
 fx:{glow:{c:[190,60,255],a:1},pulse:true,parts:{kind:'ender',rate:6},energy:{c:[200,90,255]}}}),
D('storm',5,'Storm Frame','Storm Steel dan Lightning Crystal','Thunder Lord','Petir menyambar di tepi frame',{seed:10,outline:H('#080c18'),
 fill:({x,y,R,side})=>{let c=mixc(H('#5a6a8a'),H('#2e3850'),R()*.7+(((side==='h'?x:y)>>3)%2)*.15);if(R()<.06)c=H('#c8e8ff');return c},
 orn:({s4,set,em})=>{s4((p)=>{const L=CP?3:10;for(let j=0;j<L;j++){const w=j<3?1:2;for(let i=0;i<w+1;i++)p(O+1+i,O-j-1,i===0?H('#a8b8d8'):H('#3a4666'))}p(O+1,O-L-1,H('#e8f8ff'),true);p(O+2,O-L-1,H('#7fd0ff'),true);if(!CP)p(O+1,O-12,H('#ffffff'),true);for(let j=0;j<L;j++){p(O-j-1,O+1,j%2?H('#a8b8d8'):H('#6a7898'))}p(O-L-1,O+1,H('#e8f8ff'),true);p(O-L-2,O+1,H('#7fd0ff'),true);for(let i=0;i<5;i++)for(let j=0;j<5;j++)p(O+i-1,O+j-1,(i+j)%2?H('#4a5878'):H('#2e3850'))});set(27,O,H('#7fd0ff'));set(28,O,H('#7fd0ff'));set(27,O+B-1,H('#7fd0ff'));set(28,O+B-1,H('#7fd0ff'))},
 fx:{glow:{c:[110,200,255],a:.9},lightning:{c:[190,235,255]},parts:{kind:'spark',rate:3},pulse:true}}),

D('dragon',6,'Dragon Frame','Dragon Scale dan Obsidian','Dragon Lord','Bara merah, energi naga, kilatan crimson',{seed:11,outline:H('#0a0206'),
 fill:({x,y,R,side})=>{const k=((x+(y%2)*2)%4===0);let c=mixc(H('#1a0c14'),H('#0a0408'),R()*.8);if(k)c=mixc(c,H('#a0182c'),.8);return c},
 orn:({s4,set,em,blit,R})=>{const hd=["r............r","rr..........rr",".rr.kkkkkk.rr.","..rkkkkkkkkr..","..kkeekkeekk..","..kkkkkkkkkk..","...kkhddhkk...","...kkkkkkkk...","....k.kk.k...."];const pal={r:H('#7a0f1e'),k:H('#18080e'),e:H('#ffd24a'),d:H('#3a0a14'),h:H('#4a1220')};if(CP){const hs=['r......r','rr.kk.rr','.rkkkkr.','.kekkek.','..kddk..','..kkkk..'];blit(set,hs,pal,24,O-4,'e')}else blit(set,hd.map(r=>r.padEnd(14,'.').slice(0,14)),pal,21,O-8,'e');
  s4((p)=>{if(!CP){blit(p,["...rr","..rrr",".rrr.","rrr..","rr..."],{r:H('#a0182c')},O-4,O-6);blit(p,["...h","..rh",".rrh","rrr."],{r:H('#7a0f1e'),h:H('#e03a4a')},O-3,O-4)}for(let i=0;i<5;i++)for(let j=0;j<5;j++)p(O+i-1,O+j-1,(i+j)%2?H('#220c14'):H('#14080e'));p(O+1,O+1,H('#ff2a3a'),true);p(O+2,O+2,H('#ffd0a0'),true)});
  for(let x=14;x<42;x+=4)em(x,O+B-1,H('#ff2a3a'))},
 fx:{glow:{c:[255,40,60],a:1},pulse:true,parts:{kind:'ember',rate:6,cols:[[255,50,60],[255,140,60],[255,220,140]]},flash:{c:[255,60,80]},sweep:{color:[255,80,100],speed:.2,w:.06,every:0}}}),
D('phoenix',6,'Phoenix Frame','Phoenix Feather dan Magma Gold','Rebirth Flame','Api hidup, bulu membara naik',{seed:12,outline:H('#2a0804'),
 fill:({ang,R,x,y})=>{const t=(Math.sin(ang*2+1)+1)/2;let c=mixc(H('#e0301a'),H('#ffc030'),t*.9);c=mixc(c,H('#7a1008'),R()*.35);if((x+y)%9<2)c=mixc(c,H('#fff0a0'),.4);return c},
 orn:({set,s4,em})=>{wings(set,{a:H('#ffd24a'),b:H('#e0301a'),edge:H('#5a1208')},CP?{n:4,len:6,ay:9,jag:.5}:{n:5,len:10,ay:10,jag:.8});s4((p)=>{for(let i=-1;i<5;i++)for(let j=-1;j<5;j++){if(i>=3||j>=3||i<0||j<0)p(O+i,O+j,(i+j)%2?H('#ff8a1a'):H('#c8200e'))}p(O+1,O+1,H('#fff0a0'),true)})},
 fx:{glow:{c:[255,130,30],a:1.1},flames:true,parts:{kind:'ember',rate:8,cols:[[255,220,90],[255,130,30],[255,70,30]]},pulse:true,flash:{c:[255,180,60]}}}),

D('celestial',7,'Celestial Frame','Divine Crystal dan Gold','Celestial Guardian','Partikel bintang, cahaya emas, halo berputar',{seed:13,outline:H('#7a5a10'),
 fill:({x,y,R,d,side})=>{let c=mixc(H('#ffffff'),H('#d8e8f4'),R()*.6);if(d===1&&((side==='h'?x:y)%6===0))c=H('#ffd24a');return c},
 orn:({set,s4,em,gem})=>{wings(set,{a:H('#ffffff'),b:H('#9ae8ff'),edge:H('#c89a24')},CP?{n:4,len:6,ay:8}:{n:6,len:10,ay:8});for(const[x,y]of band(O,B))set(x,y,H('#e8b22a'));gem(28,O-1,{h:H('#e8ffff'),c:H('#4adcff'),d:H('#1a8ac0')});s4((p)=>{for(let i=-1;i<5;i++)for(let j=-1;j<5;j++){if(i>=3||j>=3||i<0||j<0)p(O+i,O+j,(i===-1||j===-1||i===4||j===4)?H('#a87a14'):((i+j)%3===0?H('#fff6c0'):H('#ffd24a')))}p(O+1,O+1,H('#4adcff'),true);p(O+2,O+1,H('#e8ffff'),true)})},
 fx:{glow:{c:[255,230,140],a:1.2},halo:true,stars:true,rays:true,sweep:{color:[255,255,255],speed:.18,w:.08,every:0},pulse:true,parts:{kind:'star',rate:5,cols:[[255,255,255],[255,226,138],[150,240,255]]}}}),
D('cosmic',7,'Cosmic Frame','Star Fragment dan Void Crystal','Cosmic Wanderer','Bintang mengorbit, nebula bergerak',{seed:14,outline:H('#080414'),
 fill:({ang,R,x,y})=>{const t=(Math.sin(ang*3+x*.05)+1)/2;let c=mixc(H('#2a1060'),H('#103a7a'),t);c=mixc(c,H('#05030f'),R()*.5);if(R()<.1)c=H('#e8e0ff');return c},
 orn:({set,s4,em,R})=>{s4((p)=>{p(O-3,O+1,H('#ffffff'),true);p(O-2,O+1,H('#9ae0ff'),true);p(O-4,O+1,H('#9ae0ff'),true);p(O-3,O,H('#9ae0ff'),true);p(O-3,O+2,H('#9ae0ff'),true);p(O+1,O-3,H('#ffffff'),true);p(O+1,O-2,H('#d0a0ff'),true);p(O+1,O-4,H('#d0a0ff'),true);p(O,O-3,H('#d0a0ff'),true);p(O+2,O-3,H('#d0a0ff'),true);for(let i=0;i<5;i++)for(let j=0;j<5;j++)p(O+i-1,O+j-1,(i+j)%2?H('#1a0c40'):H('#10082a'));p(O+1,O+1,H('#ff9af0'),true);p(O+2,O+2,H('#9ae0ff'),true)});for(let i=0;i<22;i++){const x=O+3+((R()*26)|0),y=O+((R()*3)|0);if(R()<.7)em(x,y,R()<.5?H('#ffffff'):H('#a0e0ff'))}},
 fx:{glow:{c:[140,110,255],a:1.1},orbit:true,stars:true,rainbow:true,pulse:true,parts:{kind:'star',rate:4,cols:[[255,255,255],[190,150,255],[130,220,255]]}}}),
];
function band(o,b){const out=[];for(let y=o;y<o+b;y++)for(let x=o;x<o+b;x++){const d=Math.min(x-o,o+b-1-x,y-o,o+b-1-y);if(d===0&&!(Math.min(x-o,o+b-1-x)===0&&Math.min(y-o,o+b-1-y)===0))out.push([x,y])}return out}

const TIERS=[['Common',1,'--t1'],['Uncommon',2,'--t2'],['Rare',3,'--t3'],['Epic',4,'--t4'],['Legendary',5,'--t5'],['Mythic',6,'--t6'],['Divine',7,'--t7']];
const TC={1:'#2fa84a',2:'#22b8a4',3:'#3a86f0',4:'#a24ae8',5:'#f0a020',6:'#ee3a4e',7:'linear-gradient(90deg,#ffe08a,#fff,#9ae8ff)'};
function ensure(f){if(!f.imgC){CP=false;f.img=build(f);CP=true;f.imgC=build(f);CP=false}return f}
function rngS(){return Math.random()}
class Inst{
  constructor(def,cv,opts={}){this.def=def;this.cv=cv;this.x=cv.getContext('2d');this.parts=[];this.t=0;this.acc=0;this.opts=opts;this.burst=null;this.eq=null;this.lt=0;this.bolt=null;this.boltT=2+Math.random()*2;this.sw=0;this.fl=0;this.nextFlash=3}
  spawnPos(){const a=Math.random()*4,s=Math.floor(a),u=a-s,p=O,q=O+B;return s===0?[p+u*B,p]:s===1?[q,p+u*B]:s===2?[q-u*B,q]:[p,q-u*B]}
  addPart(kind,cols,burstK){
    const [x,y]=this.spawnPos(),c=cols?cols[(Math.random()*cols.length)|0]:[255,255,255];
    const o={x,y,c,k:kind,life:0,max:1.2,vx:0,vy:0,sz:1,add:true};
    const r=Math.random;
    if(kind==='dust'){o.vx=(r()-.5)*2;o.vy=-1-r()*1.5;o.max=1.8;o.c=[200,200,205];o.add=false;o.sz=1;}
    else if(kind==='crystal'){o.vx=(r()-.5)*3;o.vy=-3-r()*5;o.max=1.4;o.sz=1;}
    else if(kind==='ember'){o.vx=(r()-.5)*3;o.vy=-4-r()*6;o.max=1.4;o.sz=r()<.3?2:1;}
    else if(kind==='ender'){const a=r()*6.28,d=(this.opts.compact?15+r()*4:14+r()*10);o.x=28+Math.cos(a)*d*1.0;o.y=28+Math.sin(a)*d;o.vx=(r()-.5)*4;o.vy=(r()-.5)*4;o.max=1.3;o.sz=1+(r()<.4);o.c=r()<.5?[255,64,216]:[164,60,255];}
    else if(kind==='star'){const a=r()*6.28,d=(this.opts.compact?17+r()*3:17+r()*9);o.x=28+Math.cos(a)*d;o.y=28+Math.sin(a)*d;o.vx=(r()-.5)*1.5;o.vy=-1-r()*2;o.max=1.6;o.star=true}
    else if(kind==='spark'){o.vx=(r()-.5)*10;o.vy=(r()-.5)*10;o.max=.4;}
    else if(kind==='smoke'){o.vx=(r()-.5)*1.5;o.vy=-2-r();o.max=2;o.c=[70,60,70];o.add=false;o.sz=2}
    if(burstK){const a=Math.random()*6.28,s=8+Math.random()*14;const cx=28,cy=28;o.x=cx+Math.cos(a)*16;o.y=cy+Math.sin(a)*16;o.vx=Math.cos(a)*s;o.vy=Math.sin(a)*s;o.max=.9+Math.random()*.5}
    this.parts.push(o);
  }
  doBurst(n){const fx=this.def.fx||{};const kind=fx.parts?fx.parts.kind:'crystal';const cols=fx.parts&&fx.parts.cols||(fx.glow?[fx.glow.c,[255,255,255]]:[[255,255,255]]);for(let i=0;i<n;i++)this.addPart(kind==='dust'?'crystal':kind,cols,true)}
  preview(){this.burst={t:0};this.doBurst(70)}
  equip(){this.eq={t:0};this.doBurst(40)}
  update(dt){
    this.t+=dt;const fx=this.def.fx||{};
    if(fx.parts){this.acc+=fx.parts.rate*dt*(this.opts.rich?1:.8);while(this.acc>=1){this.acc--;this.addPart(fx.parts.kind,fx.parts.cols||(fx.glow?[fx.glow.c]:null));if(fx.smoke&&Math.random()<.4)this.addPart('smoke')}}
    for(const p of this.parts){p.life+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.k!=='spark'&&p.k!=='ender'){p.vx*=.995}}
    this.parts=this.parts.filter(p=>p.life<p.max);
    if(fx.lightning){this.boltT-=dt;if(this.boltT<=0){this.boltT=1.5+Math.random()*2.5;this.bolt={t:0,pts:this.mkBolt()}}if(this.bolt){this.bolt.t+=dt;if(this.bolt.t>.25)this.bolt=null;else if(((this.bolt.t*40)|0)%2===0)this.bolt.pts=this.mkBolt()}}
    if(fx.flash){this.nextFlash-=dt;if(this.nextFlash<=0){this.nextFlash=3.5+Math.random()*2;this.fl=1}}this.fl=Math.max(0,this.fl-dt*2.2);
    if(this.burst){this.burst.t+=dt;if(this.burst.t>1.3)this.burst=null}
    if(this.eq){this.eq.t+=dt;if(this.eq.t>.9)this.eq=null}
  }
  mkBolt(){const e=(Math.random()*4)|0,p=O,q=O+B,pts=[];const n=18;for(let i=0;i<=n;i++){const u=i/n,j=(Math.random()-.5)*5*(i===0||i===n?0:1);let x,y;if(e===0){x=p+u*B;y=p-2+j}else if(e===1){x=q+2+j;y=p+u*B}else if(e===2){x=q-u*B;y=q+2+j}else{x=p-2+j;y=q-u*B}pts.push([x,y])}return pts}
  draw(){
    const cp=!!this.opts.compact,M=cp?(this.def.mC||5):O,off=O-M,reg=B+2*M;const x=this.x,cv=this.cv,W=cv.width,sc=W/(reg*S),f=this.def.fx||{},img=cp?this.def.imgC:this.def.img;
    x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,W,W);x.imageSmoothingEnabled=false;
    const k=sc*S,FW=G*k; // px per cell
    let pop=1;if(this.eq)pop=1+.12*Math.sin(Math.PI*Math.min(1,this.eq.t/.5));
    x.save();x.translate(W/2,W/2);x.scale(pop,pop);x.translate(-W/2,-W/2);x.translate(-off*k,-off*k);
    const pulse=.5+.5*Math.sin(this.t*2.4+this.def.seed);
    const bst=this.burst?Math.sin(Math.PI*Math.min(1,this.burst.t/1.3)):0;
    // avatar behind
    if(this.opts.avatar)this.avatar(x,k);
    // glow
    if(f.glow&&!this.opts.clean&&!this.opts.lite){x.save();x.shadowColor=css(f.glow.c,1);x.shadowBlur=k*(2+3*f.glow.a*(.6+.4*pulse)+bst*6);x.drawImage(img.cv,0,0,FW,FW);x.restore()}else x.drawImage(img.cv,0,0,FW,FW);
    // emissive pulse
    if(img.emis.length&&!this.opts.clean){x.save();x.globalCompositeOperation='lighter';for(const[ex,ey,c]of img.emis){const ph=pulse*(.5+.5*Math.sin(ex*.7+ey*.4+this.t*3));x.fillStyle=css(c,(f.pulse?.15+.5*ph:.15)+bst*.3);x.fillRect(ex*k,ey*k,k,k)}x.restore()}
    // sweep
    if(f.sweep){const s=f.sweep;let u;if(s.every){const cyc=this.t%s.every;u=cyc<1/s.speed*0.5?cyc*s.speed*2:-1}else u=(this.t*s.speed)%1;if(u>=0){x.save();x.globalCompositeOperation='lighter';for(const[bx,by,ang]of img.band){let a=(ang/(Math.PI*2)+.5);let dd=Math.abs(a-u);dd=Math.min(dd,1-dd);if(dd<s.w){x.fillStyle=css(s.color,(1-dd/s.w)*.85);x.fillRect(bx*k,by*k,k,k)}}x.restore()}}
    // energy border (ender)
    if(f.energy){x.save();x.globalCompositeOperation='lighter';for(const[bx,by,ang,d]of img.band){if(d!==1)continue;const a=(ang/(Math.PI*2)+.5);const w=.5+.5*Math.sin(a*40-this.t*5);if(w>.8){x.fillStyle=css(f.energy.c,(w-.8)*3.5);x.fillRect(bx*k,by*k,k,k)}}x.restore()}
    // rainbow shimmer (cosmic)
    if(f.rainbow){x.save();x.globalCompositeOperation='lighter';for(const[bx,by,ang,d]of img.band){if(d!==1)continue;const a=(ang/(Math.PI*2)+.5)+this.t*.15;const hh=(a%1)*360;x.fillStyle=`hsla(${hh},90%,60%,.28)`;x.fillRect(bx*k,by*k,k,k)}x.restore()}
    // sparkle
    if(f.sparkle){x.save();x.globalCompositeOperation='lighter';const bl=img.band.filter(b=>b[3]<=1);for(let i=0;i<f.sparkle.n;i++){const ph=(this.t*.7+i*.37+this.def.seed*.1)%1;if(ph>.35)continue;const b=bl[(i*131+Math.floor((this.t*.7+i*.37)/1)*47)%bl.length];const a=Math.sin(ph/.35*Math.PI);x.fillStyle=css(f.sparkle.c,a);x.fillRect(b[0]*k,b[1]*k,k,k);x.fillStyle=css(f.sparkle.c,a*.6);x.fillRect((b[0]-1)*k,b[1]*k,k,k);x.fillRect((b[0]+1)*k,b[1]*k,k,k);x.fillRect(b[0]*k,(b[1]-1)*k,k,k);x.fillRect(b[0]*k,(b[1]+1)*k,k,k)}x.restore()}
    // halo
    if(f.halo)this.halo(x,k);
    if(f.rays){x.save();x.globalCompositeOperation='lighter';for(let i=-3;i<=3;i++){const a=-Math.PI/2+i*.22,L=((cp?3.5:8)+(cp?1:3)*Math.sin(this.t*2+i))*k;x.strokeStyle=css([255,235,160],.18+.1*pulse);x.lineWidth=k;x.beginPath();x.moveTo(28*k,(O-1)*k);x.lineTo(28*k+Math.cos(a)*L,(O-1)*k+Math.sin(a)*L);x.stroke()}x.restore()}
    if(f.flames)this.flames(x,k);
    if(f.orbit)this.orbit(x,k);
    // lightning
    if(this.bolt){x.save();x.globalCompositeOperation='lighter';for(const[w,c,a]of[[3,[90,170,255],.5],[1.4,f.lightning.c,1]]){x.strokeStyle=css(c,a);x.lineWidth=w*k*.6;x.lineJoin='miter';x.beginPath();this.bolt.pts.forEach((p,i)=>i?x.lineTo(p[0]*k,p[1]*k):x.moveTo(p[0]*k,p[1]*k));x.stroke()}x.restore()}
    // particles
    for(const p of this.parts){const u=p.life/p.max;let a=u<.15?u/.15:1-(u-.15)/.85;a=Math.max(0,a);x.globalCompositeOperation=p.add?'lighter':'source-over';x.fillStyle=css(p.c,a*(p.add?1:.5));const sz=p.sz*k*(p.k==='smoke'?1+u*1.5:1);if(p.star){const s=k;x.fillRect(p.x*k,p.y*k,s,s);x.fillStyle=css(p.c,a*.6);x.fillRect((p.x-1)*k,p.y*k,s,s);x.fillRect((p.x+1)*k,p.y*k,s,s);x.fillRect(p.x*k,(p.y-1)*k,s,s);x.fillRect(p.x*k,(p.y+1)*k,s,s)}else x.fillRect(Math.round(p.x)*k,Math.round(p.y)*k,sz,sz)}
    x.globalCompositeOperation='source-over';
    // periodic flash
    if(this.fl>0&&f.flash){x.save();x.globalCompositeOperation='lighter';x.globalAlpha=this.fl*.55;x.drawImage(img.cv,0,0,FW,FW);x.restore()}
    // preview ring + flash
    if(this.burst){const p=this.burst.t/1.3;x.save();x.globalCompositeOperation='lighter';const c=(f.glow?f.glow.c:[255,255,255]);x.globalAlpha=(1-p)*.7;x.drawImage(img.cv,0,0,FW,FW);x.globalAlpha=1;const r=p*(cp?4.5:14);x.strokeStyle=css(c,(1-p)*.9);x.lineWidth=k*1.5;x.strokeRect((O-r)*k,(O-r)*k,(B+2*r)*k,(B+2*r)*k);x.restore()}
    if(this.eq){const p=this.eq.t/.9;x.save();x.globalCompositeOperation='lighter';x.globalAlpha=(1-p)*.8;x.drawImage(img.cv,0,0,FW,FW);x.restore()}
    if(!this.opts.avatar&&!this.opts.clean){x.save();x.globalCompositeOperation='destination-out';x.fillStyle='#000';x.fillRect((O+3)*k,(O+3)*k,26*k,26*k);x.restore()} /* efek tidak masuk ke area avatar (lubang 26x26) */
    x.restore();
  }
  avatar(x,k){const ox=(O+3)*k,oy=(O+3)*k,s=26*k;x.fillStyle='#120c18';x.fillRect(ox,oy,s,s);x.fillStyle='#c040e8';for(const ex of[7,16]){x.fillRect(ox+ex*k,oy+13*k,4*k,2*k)}x.fillStyle='#1c1426';x.fillRect(ox,oy+s-4*k,s,4*k)}
  halo(x,k){x.save();x.globalCompositeOperation='lighter';const cp=!!this.opts.compact,cx=28,cy=cp?O-2:O-3,rx=cp?9:12,ry=cp?2.4:3.6,N=64;for(let i=0;i<N;i++){const a=i/N*6.283+this.t*.6;const px=cx+Math.cos(a)*rx,py=cy+Math.sin(a)*ry;const front=Math.sin(a)>0;const br=.5+.5*Math.sin(a*3-this.t*3);x.fillStyle=css([255,226,138],(front?.9:.45)*(.5+.5*br));x.fillRect(Math.round(px)*k,Math.round(py)*k,k,k)}x.restore()}
  flames(x,k){x.save();x.globalCompositeOperation='lighter';const pos=[[O+1,O-1],[28,O-1],[O+B-2,O-1],[O+1,O+B],[O+B-2,O+B]];pos.forEach(([fx,fy],i)=>{for(let c=-1;c<=1;c++){const h=this.opts.compact?Math.min(4,2+Math.floor(1.5+1.5*Math.sin(this.t*9+i*2+c*1.7)+(i===1?1:0))):3+Math.floor(3+3*Math.sin(this.t*9+i*2+c*1.7)+(i===1?3:0));for(let j=0;j<h;j++){const t=j/h;const col=t<.3?[255,240,150]:t<.65?[255,150,40]:[230,50,30];x.fillStyle=css(col,.8*(1-t*.6));x.fillRect((fx+c)*k,(fy-j-1)*k,k,k)}}});x.restore()}
  orbit(x,k){x.save();x.globalCompositeOperation='lighter';for(let s=0;s<3;s++){for(let tr=0;tr<7;tr++){const a=this.t*(.8+s*.15)+s*2.09-tr*.09;const RR=(this.opts.compact?18:23)+s*.5,px=28+Math.cos(a)*RR,py=28+Math.sin(a*1.0)*RR*(s===1?.92:1);const col=[[255,255,255],[150,230,255],[255,160,240]][s];x.fillStyle=css(col,(1-tr/7)*.9);x.fillRect(Math.round(px)*k,Math.round(py)*k,k,k);if(tr===0){x.fillStyle=css(col,.6);for(const[a1,b1]of[[-1,0],[1,0],[0,-1],[0,1]])x.fillRect(Math.round(px+a1)*k,Math.round(py+b1)*k,k,k)}}}x.restore()}
}

  var FRAMES = {}; FR.forEach(function (f) { FRAMES[f.id] = f; });
  /* Margin jendela mode ringkas per frame (default 5 sel). Sayap Phoenix/Surgawi melebar sampai 1 sel di luar jendela -> kepotong;
     jendela diperlebar, lalu kanvas diskalakan (setKey) sehingga badan frame & lubang avatar tetap sama ukurannya. */
  var MARGIN_C = { phoenix: 7, celestial: 7, storm: 6 }; FR.forEach(function (f) { if (MARGIN_C[f.id]) f.mC = MARGIN_C[f.id]; });
  /* nama file gambar -> id desain */
  var FILE2KEY = { 'frame-default': 'wood', 'stone': 'stone', 'copper': 'copper', 'iron': 'iron', 'frame-gold': 'gold', 'diamond': 'diamond', 'amethyst': 'amethyst',
    'nether': 'nether', 'ender': 'ender', 'storm': 'storm', 'dragon': 'dragon', 'phoenix': 'phoenix', 'celestial': 'celestial', 'cosmic': 'cosmic' };
  var RE = /data\/frame\/([a-z-]+)\.webp/;
  function keyOf(x) {
    if (!x) return null; x = String(x);
    var m = x.match(RE); if (m) return FILE2KEY[m[1]] || null;
    if (x.indexOf('frame.') === 0) x = x.slice(6);
    if (x === 'default') x = 'wood';
    return FRAMES[x] ? x : null;
  }
  var reduce = false; try { reduce = g.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var live = [], io = null, last = 0, running = false;
  function ensureIO() {
    if (io || !g.IntersectionObserver) return;
    io = new IntersectionObserver(function (es) { es.forEach(function (e) { var i = e.target.__ffx; if (i) i.vis = e.isIntersecting; }); });
  }
  function setKey(cv, key) {
    var f = FRAMES[key] || FRAMES.wood; ensure(f);
    var inst = cv.__ffx;
    if (!inst) { inst = cv.__ffx = new Inst(f, cv, { compact: true, lite: cv.__lite }); inst.vis = true; inst.fps = cv.__lite ? 12 : 30; inst.acc2 = 0; live.push(inst); ensureIO(); if (io) io.observe(cv); }
    else { inst.def = f; inst.parts = []; }
    inst.key = key; cv.style.scale = f.mC ? String((B + 2 * f.mC) / (B + 10)) : ''; inst.draw();
    start();
  }
  function start() { if (running || reduce) return; running = true; last = performance.now(); g.requestAnimationFrame(loop); }
  function loop(now) {
    var dt = Math.min(.05, (now - last) / 1000); last = now;
    for (var n = live.length - 1; n >= 0; n--) {
      var i = live[n];
      if (!i.cv.isConnected) { live.splice(n, 1); if (io) io.unobserve(i.cv); continue; }
      if (i.vis === false || document.hidden) continue;
      i.acc2 += dt; if (i.acc2 < 1 / i.fps) continue;
      var d = Math.min(.1, i.acc2); i.acc2 = 0; i.update(d); i.draw();
    }
    g.requestAnimationFrame(loop);
  }
  /* <img> frame -> <canvas>; .src tetap bisa diganti (lobby.applyFrame) */
  function upgrade(img) {
    if (!img || img.tagName !== 'IMG' || img.__ffxDone) return;
    var key = keyOf(img.getAttribute('src')); if (!key) return;
    var cv = document.createElement('canvas'); cv.width = cv.height = 252;
    cv.className = img.className; if (img.id) cv.id = img.id;
    var st = img.getAttribute('style'); if (st) cv.setAttribute('style', st);
    cv.setAttribute('aria-hidden', 'true'); cv.draggable = false; cv.setAttribute('data-frame-fx', key);
    cv.__lite = /\bfa-img\b/.test(img.className);   /* avatar daftar (leaderboard/teman): tanpa glow berat, 12 fps */
    Object.defineProperty(cv, 'src', { configurable: true, get: function () { return 'data/frame/' + cv.getAttribute('data-frame-fx') + '.webp'; },
      set: function (v) { var k = keyOf(v); if (k) { cv.setAttribute('data-frame-fx', k); setKey(cv, k); } } });
    img.__ffxDone = true;
    if (img.parentNode) img.parentNode.replaceChild(cv, img);
    setKey(cv, key);
  }
  function scan(root) {
    if (!root || root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.tagName === 'IMG') { upgrade(root); return; }
    var l = root.querySelectorAll ? root.querySelectorAll('img[src*="data/frame/"]') : []; for (var i = 0; i < l.length; i++) upgrade(l[i]);
  }
  function dataURL(key, full) {
    var f = FRAMES[keyOf(key) || 'wood']; ensure(f);
    var c = document.createElement('canvas'); c.width = c.height = (full ? G : B + 2 * (f.mC || 5)) * S;
    var i = new Inst(f, c, { clean: true, compact: !full }); i.draw(); return c.toDataURL();
  }
  g.FrameFX = { keyOf: keyOf, upgrade: scan, dataURL: dataURL, frames: FRAMES, ready: true };
  function init() {
    scan(document);
    try { new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) { scan(n); }); }); }).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
