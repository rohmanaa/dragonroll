/* assets/js/blocky-character.js — GENERATED dari karakter.html oleh tools/blocky-character/build.js. JANGAN edit manual.
   Karakter blocky (rig + katalog item + builder + animasi) yang SAMA dengan halaman Karakter, tanpa UI/scene/kamera.
   Dipakai halaman lain (mis. efek.html) agar menampilkan karakter pemain yang sebenarnya.
   Regenerasi bila karakter.html berubah:  node tools/blocky-character/build.js
   Perlu: global THREE (r128), ItemCatalog, PlayerData (dimuat sebelum create() dipanggil).

   const c = UT.BlockyCharacter.create(THREE);   // c.root = THREE.Group (kaki di y=0, menghadap +z, tinggi ~2 satuan)
   c.loadFromPlayer();                           // pakai penampilan + gear milik pemain (PlayerData)
   c.setMode('idle'|'walk'|'run'); c.jump();     // per frame: c.tick(dt)
   c.loadFromData(look,equipped,gearDye);       // tampilan pemain lain dari server (room_appearance_get)
   c.loadPreset(n);                              // tampilan siap pakai deterministik (pemain lain/CPU), n = bilangan bulat
   c.setTool('pickaxe'|null);                       // alat di tangan kanan (tidak tersimpan di data pemain)
   c.strikes                                         // jumlah hantaman aksi 'mine' sejauh ini (untuk percikan batu)
   c.act('attack'|'block'|'sad'|'cheer'|'wave'|'flip'|'backflip'|'spin'|'roll'|'mine'[,detik]);
                                                 // aksi sekali: ayun senjata / bertahan / sedih / sorak / melambai / salto depan / salto belakang / putar di udara / berguling
   Mata berkedip otomatis (tiap tick).
*/
(function(){
window.UT=window.UT||{};
UT.BlockyCharacter={create:function(THREE,opts){
opts=opts||{};

const S=1/16;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const clone=o=>JSON.parse(JSON.stringify(o));
function hash(x,y,s){
  let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(s|0,982451653))|0;
  h=Math.imul(h^(h>>>13),1274126177);
  return ((h^(h>>>16))>>>0)/4294967295;
}
function shade(c,f){
  const r=clamp(((c>>16)&255)*f,0,255)|0,g=clamp(((c>>8)&255)*f,0,255)|0,b=clamp((c&255)*f,0,255)|0;
  return (r<<16)|(g<<8)|b;
}
function mix(a,b,t){
  const f=(s)=>Math.round(((a>>s)&255)*(1-t)+((b>>s)&255)*t);
  return (f(16)<<16)|(f(8)<<8)|f(0);
}
// palet turunan dari satu warna dasar
const pal=c=>({m:c,d:shade(c,0.78),dd:shade(c,0.58),l:shade(c,1.25)});
function mkTex(w,h,fn,yoff,seed,jit){
  yoff=yoff||0;seed=seed||1;jit=(jit===undefined)?0.07:jit;
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const g=c.getContext('2d');
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const col=fn(x,y+yoff);
    if(col===null||col===undefined)continue;
    const k=1+(hash(x,y+yoff,seed)-0.5)*2*jit;
    const r=clamp(((col>>16)&255)*k,0,255)|0,gg=clamp(((col>>8)&255)*k,0,255)|0,b=clamp((col&255)*k,0,255)|0;
    g.fillStyle='rgb('+r+','+gg+','+b+')';
    g.fillRect(x,y,1,1);
  }
  const t=new THREE.CanvasTexture(c);
  t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestFilter;
  return t;
}
function mat(t,alpha){return new THREE.MeshLambertMaterial({map:t,transparent:!!alpha,alphaTest:alpha?0.5:0});}
function solid(col){return new THREE.MeshLambertMaterial({color:col});}
function phong(col){return new THREE.MeshPhongMaterial({color:col,shininess:70,specular:0x777777});}
function glow(col){return new THREE.MeshLambertMaterial({color:col,emissive:col,emissiveIntensity:0.7});}
function glass(col){return new THREE.MeshPhongMaterial({color:col,transparent:true,opacity:0.35,shininess:100});}
function box(w,h,d,m,x,y,z){
  const o=new THREE.Mesh(new THREE.BoxGeometry(w*S,h*S,d*S),m);
  o.position.set((x||0)*S,(y||0)*S,(z||0)*S);
  o.castShadow=true;o.receiveShadow=true;return o;
}
// lengan/kaki: 6 sisi, paint(x,y,face) dengan y sudah termasuk yoff
function limbMats(w,h,yoff,paint,topC,botC,seed){
  const side=f=>mat(mkTex(w,h,(x,y)=>paint(x,y,f),yoff,seed));
  return[side('px'),side('nx'),mat(mkTex(w,w,()=>topC,0,seed)),mat(mkTex(w,w,()=>botC,0,seed)),side('pz'),side('nz')];
}
// kotak bertekstur generik (armor): ukuran tekstur tetap per jenis sisi
function faceMats(pf,seed,alpha){
  const T=(tw,th,f)=>mat(mkTex(tw,th,(x,y)=>pf(x,y,f),0,seed),alpha);
  return[T(4,8,'px'),T(4,8,'nx'),T(8,4,'py'),T(8,4,'ny'),T(8,8,'pz'),T(8,8,'nz')];
}



const GOLD=0xe8bb3c,LEA=0x6a4527,LEA_D=0x4a3019,LEA_L=0x8b5e34;
const mkDyes=a=>a.map(d=>({id:d[0],n:d[1],c:d[2]}));
const DYES={
  cloth:mkDyes([['red','Merah',0xa83a34],['orange','Oranye',0xd2702a],['yellow','Kuning',0xd4a62a],['green','Hijau',0x3f7a3a],['teal','Tosca',0x2f8a8a],['blue','Biru',0x3a6ea5],['navy','Navy',0x23305e],['purple','Ungu',0x5b3a8f],['brown','Cokelat',0x6b4a2b],['white','Putih',0xe9e5da],['black','Hitam',0x2a2a30],['pink','Pink',0xd96a96],['lilac','Lilac',0xa98bd1],['mint','Mint',0x7cc4a4]]),
  metal:mkDyes([['steel','Baja',0xb7bcc4],['gold','Emas',0xe8bb3c],['bronze','Perunggu',0xb87a45],['dark','Hitam',0x4a4f5a],['rose','Rose Gold',0xd99a8a]]),
  leather:mkDyes([['brown','Cokelat',0x6a4527],['black','Hitam',0x2c2420],['tan','Krem',0xb08a56],['red','Merah',0x7d3426],['white','Putih',0xe6e1d6],['pink','Pink',0xc77d93]]),
  hair:mkDyes([['black','Hitam',0x1f1b1a],['brown','Cokelat',0x5a3520],['blonde','Pirang',0xe0b64a],['red','Merah',0xb2432b],['silver','Perak',0xc9ced6],['pink','Pink',0xe58bb0],['lavender','Lavender',0x9a7fc8]]),
  eye:mkDyes([['blue','Biru',0x2b6cb0],['green','Hijau',0x2e8b4e],['brown','Cokelat',0x5a3520],['gray','Abu',0x7a8794],['red','Merah',0xa02020],['purple','Ungu',0x7a4fb0]]),
  straw:mkDyes([['straw','Jerami',0xd9b45a],['pale','Pucat',0xe8dcb0],['dark','Tua',0xa07f3a]])
};
const SKINS=[0xf6d5b8,0xe3b088,0xc48a56,0x8f5a35,0x5a3a26].map((c,i)=>({id:'s'+(i+1),n:'Kulit '+(i+1),c}));

// warna aktual sebuah item berdasarkan config slot-nya
function dyeC(o,it){
  const L=DYES[it.dyes];if(!L)return null;
  return (L.find(d=>d.id===o.dye)||L.find(d=>d.id===it.def)||L[0]).c;
}



const root=new THREE.Group();/* root tidak ditambahkan ke scene: pemakai yang menempatkan */;
const hips=new THREE.Group();root.add(hips);
const upper=new THREE.Group();hips.add(upper);
const head=new THREE.Group();head.position.y=12*S;upper.add(head);
function mkArmRig(side){
  const sh=new THREE.Group();sh.position.set(side*6*S,10*S,0);upper.add(sh);
  const el=new THREE.Group();el.position.y=-5*S;sh.add(el);
  return{sh,el,side};
}
function mkLegRig(side){
  const g=new THREE.Group();g.position.set(side*2*S,0,0);hips.add(g);
  const knee=new THREE.Group();knee.position.y=-6*S;g.add(knee);
  return{g,knee,side};
}
const armL=mkArmRig(1),armR=mkArmRig(-1),legL=mkLegRig(1),legR=mkLegRig(-1);
const cape1=new THREE.Group();cape1.position.set(0,11*S,-2.3*S);upper.add(cape1);
const cape2=new THREE.Group();cape2.position.y=-6*S;cape1.add(cape2);
// titik genggam di telapak tangan kanan; senjata dipasang di sini dan ikut gerak pergelangan
const hand=new THREE.Group();hand.position.y=-5.5*S;armR.el.add(hand);



const slots={head:[],hair:[],body:[],helm:[],chest:[],shoulder:[],cape:[],weapon:[],acc:[],tool:[]};
let torsoMesh=null,tails=[],wpg=null,wpBase=0;
let toolG=null; /* alat kerja di tangan kanan (beliung penambang) — bukan item katalog, tak ikut penyimpanan/pembelian */
let headMesh=null,blinkMats=null,blinkT=2.5,blinkClose=0; /* kedip: wajah (+z kepala) ditukar ke tekstur mata terpejam sesaat */
function add(slot,parent,obj){parent.add(obj);slots[slot].push([parent,obj]);return obj;}
function clear(slot){
  slots[slot].forEach(([p,o])=>{
    p.remove(o);
    o.traverse(n=>{if(n.isMesh){n.geometry.dispose();(Array.isArray(n.material)?n.material:[n.material]).forEach(m=>{if(m.map)m.map.dispose();m.dispose();});}});
  });
  slots[slot]=[];
  if(slot==='hair')tails=[];
  if(slot==='body')torsoMesh=null;
  if(slot==='head'){headMesh=null;blinkMats=null;blinkClose=0;}
  if(slot==='weapon')wpg=null;
  if(slot==='tool')toolG=null;
}



/* ---- mata ---- */
const EYES=[
  {id:'round',n:'Bulat',dyes:'eye',def:'blue',brow:3,px:(m,y,ic)=>y===4?(m===1?0xffffff:ic):undefined},
  {id:'dot',n:'Titik',dyes:'eye',def:'blue',brow:3,px:(m,y,ic)=>(y===4&&m===2)?shade(ic,0.3):undefined},
  {id:'sharp',n:'Tajam',dyes:'eye',def:'blue',brow:null,px:(m,y,ic)=>y===3?(m===2?0x2a1a12:undefined):(y===4?(m===1?0xffffff:ic):undefined)},
  {id:'big',n:'Besar',dyes:'eye',def:'blue',brow:2,px:(m,y,ic)=>y===3?0xffffff:(y===4?(m===1?ic:0x1c1c1c):undefined)},
  {id:'closed',n:'Tertutup',dyes:'eye',def:'blue',brow:3,px:(m,y)=>y===4?0x1c1c1c:undefined},
  {id:'lash',n:'Lentik',g:'f',dyes:'eye',def:'blue',brow:2,px:(m,y,ic)=>y===3?0x2a1a12:(y===4?(m===1?0xffffff:ic):undefined)},
  {id:'sparkle',n:'Berbinar',g:'f',dyes:'eye',def:'purple',brow:2,px:(m,y,ic)=>y===3?(m===1?0xffffff:ic):(y===4?(m===1?0xffffff:shade(ic,0.6)):undefined)}
];

/* ---- rambut ---- */
const hairCap=H=>H(8.7,1.7,8.7,0,7.3,0);
const hairSides=H=>{H(0.8,3,3.2,4.25,5,-2.4);H(0.8,3,3.2,-4.25,5,-2.4);};
const hairFringe=H=>{H(8.7,1.4,1.2,0,6.9,4.1);H(3,1,1.2,2.8,6.1,4.1);};
const HAIRS=[
  {id:'short',n:'Pendek',g:'m',dyes:'hair',def:'brown',f:H=>{hairCap(H);H(8.7,4.4,1.2,0,4.2,-4.1);hairSides(H);hairFringe(H);}},
  {id:'spiky',n:'Berduri',g:'m',dyes:'hair',def:'brown',f:H=>{
    hairCap(H);H(8.7,4.4,1.2,0,4.2,-4.1);hairSides(H);H(8.7,1.4,1.2,0,6.9,4.1);
    [[-2.5,-1.5,2.4],[0,-0.5,3.2],[2.5,1,2.2],[-1,2,2.8],[1.8,-2.5,2]].forEach(p=>H(1.8,p[2],1.8,p[0],8.2+p[2]/2-0.4,p[1]));
  }},
  {id:'long',n:'Panjang',dyes:'hair',def:'brown',f:H=>{
    hairCap(H);hairFringe(H);H(8.8,8,1.4,0,2,-4.0);
    H(0.9,5,3.4,4.3,3.5,-2.6);H(0.9,5,3.4,-4.3,3.5,-2.6);
  }},
  {id:'pony',n:'Kuncir',dyes:'hair',def:'brown',f:(H,hm,T)=>{
    hairCap(H);hairFringe(H);hairSides(H);H(8.7,3.6,1.2,0,4.8,-4.1);H(1.8,1.8,1.8,0,6.2,-4.9);
    T(0,6.2,-5.4,2.6,6.4,2.2);
  }},
  {id:'buzz',n:'Cepak',g:'m',dyes:'hair',def:'brown',f:H=>{H(8.35,2.3,8.35,0,7.0,0);H(8.3,2.4,0.5,0,5.2,-4.15);H(0.5,2.4,4.2,4.15,5.2,-1.9);H(0.5,2.4,4.2,-4.15,5.2,-1.9);}},
  /* --- khusus perempuan --- */
  {id:'bob',n:'Bob',g:'f',dyes:'hair',def:'brown',f:H=>{
    hairCap(H);hairFringe(H);H(8.8,6,1.4,0,3.4,-4.0);
    H(0.9,5,5,4.35,4.2,-1.3);H(0.9,5,5,-4.35,4.2,-1.3);
  }},
  {id:'twin',n:'Kuncir Dua',g:'f',dyes:'hair',def:'brown',f:(H,hm,T)=>{
    hairCap(H);hairFringe(H);hairSides(H);H(8.7,3.6,1.2,0,4.8,-4.1);
    [1,-1].forEach(s=>{
      const g=T(s*5.0,6.6,-1.2,2.4,6.2,2.4);
      g.add(box(2.9,1,2.9,solid(0xd96a96),0,-0.4,0));
    });
  }},
  {id:'bun',n:'Sanggul',g:'f',dyes:'hair',def:'brown',f:H=>{
    hairCap(H);hairFringe(H);hairSides(H);H(8.7,4.4,1.2,0,4.2,-4.1);
    H(4.4,4.4,3.4,0,6.4,-5.6);H(2.6,1,2.6,0,8.9,-5.6);
  }},
  {id:'braid',n:'Kepang',g:'f',dyes:'hair',def:'brown',f:(H,hm,T)=>{
    hairCap(H);hairFringe(H);hairSides(H);H(8.7,4.4,1.2,0,4.2,-4.1);
    const g=T(0,5.6,-5.3,2.6,3.4,2.2);
    g.add(box(2.1,3.2,1.9,hm,0,-5.0,0));
    g.add(box(2.6,3.2,2.2,hm,0,-8.0,0));
    g.add(box(2.1,3.2,1.9,hm,0,-11.0,0));
    g.add(box(2.8,1,2.4,solid(0xd96a96),0,-13.0,0));
  }},
  {id:'wavy',n:'Bergelombang',g:'f',dyes:'hair',def:'brown',f:H=>{
    hairCap(H);hairFringe(H);H(8.8,10,1.4,0,1,-4.0);
    H(0.9,6.5,3.6,4.3,2.9,-2.4);H(0.9,6.5,3.6,-4.3,2.9,-2.4);
    H(9.6,2,1.8,0,-4.4,-4.2);
  }}
];

// rok: menempel di badan atas (ikut bergerak); dr = tambahan panjang
const skirtB=(c,hemC,dr)=>{
  const fh=1.8+dr;
  add('body',upper,box(9,3.2,5,solid(c),0,0.4,0));
  add('body',upper,box(9.8,fh,5.8,solid(c),0,-1.0-fh/2,0));
  add('body',upper,box(10,0.7,6,solid(hemC),0,-1.0-fh-0.2,0));
};

/* ---- baju: paint(p) -> {torso(x,y,f), arm(x,y), extra?}; null = tampilkan kulit ---- */
const TOPS=[
  {id:'tee',n:'Kaus',dyes:'cloth',def:'blue',paint:p=>({
    torso:(x,y,f)=>y===11?p.d:(y===0?((f==='pz'&&x>=2&&x<=5)?null:p.d):p.m),
    arm:(x,y)=>y<=3?(y===3?p.d:p.m):null
  })},
  {id:'tunic',n:'Tunik',dyes:'cloth',def:'red',paint:p=>({
    torso:(x,y,f)=>{
      if(y===0)return p.d;if(y===11)return p.l;
      if(f==='pz'&&(x===3||x===4)&&y<=3)return p.l;
      return p.m;
    },
    arm:(x,y)=>y===0?p.d:(y<=7?p.m:(y===8?LEA_L:null))
  })},
  {id:'overall',n:'Overall',dyes:'cloth',def:'blue',paint:p=>{
    const SH=0xe9dfc4,SHD=0xcfc3a3;
    return{
      torso:(x,y,f)=>{
        if(y===0)return SHD;if(y===11)return p.l;
        if(y>=6)return p.m;
        if(f==='pz'&&y>=3)return(x>=2&&x<=5)?((y===3&&(x===2||x===5))?GOLD:p.m):SH;
        if(f==='pz'||f==='nz')return(x===2||x===5)?p.m:SH;
        return SH;
      },
      arm:(x,y)=>y<=4?(y===4?SHD:SH):null
    };
  }},
  {id:'vest',n:'Kemeja Tali',dyes:'cloth',def:'green',paint:p=>({
    torso:(x,y,f)=>{
      if(y===0)return p.d;if(y===11)return p.l;
      if(f==='pz'&&y>=1&&y<=8&&(x===y-1||x===y))return LEA;
      if(f==='nz'&&y>=1&&y<=8&&(x===7-y||x===8-y))return LEA;
      return p.m;
    },
    arm:(x,y)=>y<=1?p.d:(y<=5?p.m:(y===6?LEA_L:null))
  })},
  {id:'coat',n:'Jas',g:'m',dyes:'cloth',def:'navy',paint:p=>{
    const WH=0xf2f0ea,TR=0xc9a032;
    return{
      torso:(x,y,f)=>{
        if(y===0)return(f==='pz'&&x>=2&&x<=5)?WH:p.d;
        if(y===11)return p.l;
        if(f==='pz'){
          if(x===3||x===4){if(y<=3)return WH;if(y===5||y===7)return GOLD;return p.m;}
          if((x===2||x===5)&&y<=8)return TR;
          return p.m;
        }
        if(f==='nz')return(x===3||x===4)?p.d:p.m;
        return p.m;
      },
      arm:(x,y)=>y<=1?p.d:(y===9?WH:(y<=8?p.m:null))
    };
  }},
  {id:'robe',n:'Jubah Sihir',dyes:'cloth',def:'purple',paint:p=>{
    const ST=[[1,4],[6,3],[2,7],[5,6]],SA=0xd4a62a;
    const star=(x,y)=>ST.some(s=>s[0]===x&&s[1]===y);
    return{
      torso:(x,y,f)=>{
        if(y===0)return(f==='pz'&&(x===3||x===4))?null:GOLD;
        if(y===11)return p.l;
        if(y===9||y===10)return SA;
        if((f==='pz'||f==='nz')&&star(x,y))return GOLD;
        return p.m;
      },
      arm:(x,y)=>y<=1?p.d:(y===9?GOLD:(y<=8?p.m:null)),
      extra:()=>{
        add('body',upper,box(9,4.2,5.2,solid(p.m),0,-1.6,0));
        add('body',upper,box(9.3,0.7,5.5,solid(GOLD),0,-3.5,0));
      }
    };
  }},
  /* --- khusus perempuan --- */
  {id:'blouse',n:'Blus',g:'f',dyes:'cloth',def:'white',paint:p=>({
    torso:(x,y,f)=>{
      if(y===0||y===11)return p.d;
      if(f==='pz'&&y<=2&&(x===3||x===4))return y===1?0xd96a96:0xb5527a;
      return p.m;
    },
    arm:(x,y)=>y<=2?p.m:(y===3?p.l:null)
  })},
  {id:'dress',n:'Gaun',g:'f',dyes:'cloth',def:'pink',paint:p=>({
    torso:(x,y,f)=>{
      if(y===0)return(f==='pz'&&(x===3||x===4))?null:GOLD;
      if(y===11)return p.m;
      if(y===8)return GOLD;
      if(f==='pz'){
        if((x===3||x===4)&&y===9)return p.l;
        if((x===2||x===5)&&y>=1&&y<=7)return p.d;
      }
      return p.m;
    },
    arm:(x,y)=>y<=2?(y===2?p.l:p.m):null,
    extra:()=>skirtB(p.m,GOLD,1.6)
  })},
  {id:'sundress',n:'Terusan',g:'f',dyes:'cloth',def:'yellow',paint:p=>({
    torso:(x,y,f)=>{
      if(y<=1){
        if(f==='pz'||f==='nz')return(x===1||x===6)?p.m:null;
        return null;
      }
      if(y===2)return p.l;
      if(y===11)return p.m;
      if(f==='pz'&&y>=3&&y<=7&&(x===3||x===4))return p.l;
      if(y===8)return p.d;
      return p.m;
    },
    arm:()=>null,
    extra:()=>skirtB(p.m,p.l,1.2)
  })},
  {id:'cardigan',n:'Kardigan',g:'f',dyes:'cloth',def:'lilac',paint:p=>{
    const IN=0xf2ece4;
    return{
      torso:(x,y,f)=>{
        if(y===0||y===11)return p.d;
        if(f==='pz'){
          if(x===3||x===4)return(y===5||y===8)?GOLD:IN;
          if(x===2||x===5)return p.d;
        }
        return p.m;
      },
      arm:(x,y)=>y===0?p.d:(y<=8?p.m:(y===9?IN:null))
    };
  }}
];

/* ---- celana: paint(p)->(x,y,f), baris 0..7 ---- */
const LEGS=[
  {id:'pants',n:'Celana',dyes:'cloth',def:'navy',paint:p=>(x,y)=>y===7?p.d:p.m},
  {id:'shorts',n:'Pendek',dyes:'cloth',def:'brown',paint:p=>(x,y)=>y<=4?p.m:(y===5?p.d:null)},
  {id:'formal',n:'Formal',g:'m',dyes:'cloth',def:'black',paint:p=>(x,y,f)=>{
    if(y===7)return p.d;
    if((f==='px'||f==='nx')&&x===1)return GOLD;
    return p.m;
  }},
  /* --- khusus perempuan --- */
  {id:'tights',n:'Stoking',g:'f',dyes:'cloth',def:'black',paint:p=>(x,y)=>y===7?p.d:p.m},
  {id:'skirt',n:'Rok Mini',g:'f',dyes:'cloth',def:'red',paint:p=>(x,y)=>y>=5?(y===5?p.d:0xe9e5da):null,skirt:p=>skirtB(p.m,p.d,0)},
  {id:'lskirt',n:'Rok Panjang',g:'f',dyes:'cloth',def:'purple',paint:p=>()=>null,skirt:p=>skirtB(p.m,p.d,3.6)},
  {id:'bare',n:'Kaki Polos',dyes:null,paint:()=>()=>null}
];

/* ---- sepatu: from = baris awal sepatu di kaki (8..11), paint(p)->(x,y,f), null = kulit ---- */
const BOOTS=[
  {id:'shoes',n:'Sepatu',dyes:'leather',def:'brown',from:8,
    paint:p=>(x,y,f)=>{if(y===8)return p.l;if(y<=10)return(f==='pz'&&y===10&&(x===1||x===2))?p.d:p.m;return shade(p.m,0.45);},
    sole:p=>shade(p.m,0.45)},
  {id:'tall',n:'Bot Tinggi',dyes:'leather',def:'brown',from:6,
    paint:p=>(x,y,f)=>{if(y===6)return p.l;if(y===8&&f==='pz'&&(x===1||x===2))return GOLD;if(y<=10)return(f==='pz'&&y===10&&(x===1||x===2))?p.d:p.m;return shade(p.m,0.45);},
    sole:p=>shade(p.m,0.45)},
  {id:'cloth',n:'Sepatu Kain',dyes:'cloth',def:'brown',from:9,
    paint:p=>(x,y,f)=>y===11?shade(p.m,0.5):((f==='pz'&&y===10&&(x===1||x===2))?p.d:p.m),
    sole:p=>shade(p.m,0.5)},
  {id:'sandal',n:'Sandal',dyes:'leather',def:'tan',from:10,
    paint:p=>(x,y)=>y===10?((x%2===0)?p.m:null):shade(p.m,0.6),
    sole:p=>shade(p.m,0.6)},
  /* --- khusus perempuan --- */
  {id:'mary',n:'Mary Jane',g:'f',dyes:'leather',def:'black',from:9,
    paint:p=>(x,y,f)=>{if(y===9)return p.d;if(y===10)return(f==='pz'&&(x===1||x===2))?GOLD:p.m;return shade(p.m,0.45);},
    sole:p=>shade(p.m,0.45)},
  {id:'knee',n:'Bot Lutut',g:'f',dyes:'leather',def:'black',from:4,
    paint:p=>(x,y,f)=>{if(y===4)return p.l;if(y===5)return p.d;if(y===7&&f==='pz'&&(x===1||x===2))return GOLD;if(y<=10)return(f==='pz'&&y===10&&(x===1||x===2))?p.d:p.m;return shade(p.m,0.45);},
    sole:p=>shade(p.m,0.45)},
  {id:'flat',n:'Sepatu Flat',g:'f',dyes:'cloth',def:'pink',from:10,
    paint:p=>(x,y,f)=>y===11?shade(p.m,0.5):((f==='pz'&&x>=1&&x<=2)?p.l:p.m),
    sole:p=>shade(p.m,0.5)},
  {id:'none',n:'Telapak',dyes:null,from:12,paint:()=>()=>null,sole:()=>null}
];

/* ---- armor: helm ---- */
const HELMS=[
  {id:'none',n:'Tanpa',dyes:null},
  {id:'knight',n:'Helm Baja',dyes:'metal',def:'steel',hideHair:true,build:p=>{
    add('helm',head,box(8.9,3.6,8.9,phong(p.m),0,7.2,0));
    add('helm',head,box(9.1,0.7,9.1,phong(p.l),0,5.5,0));
    add('helm',head,box(8.9,4.4,0.9,phong(p.d),0,4.8,-4.2));
    add('helm',head,box(0.9,4.4,3,phong(p.d),4.2,5,-1.8));
    add('helm',head,box(0.9,4.4,3,phong(p.d),-4.2,5,-1.8));
    add('helm',head,box(1,3.6,0.8,phong(p.l),0,5.3,4.45));
    add('helm',head,box(1.4,2,6.4,solid(0xa83a34),0,9.4,-0.4));
  }},
  {id:'wizard',n:'Topi Sihir',dyes:'cloth',def:'purple',build:p=>{
    add('helm',head,box(11.5,0.9,11.5,solid(p.d),0,8.6,0));
    add('helm',head,box(7.6,0.8,7.6,solid(GOLD),0,9.2,0));
    add('helm',head,box(7.4,2,7.4,solid(p.m),0,9.9,0));
    add('helm',head,box(5.4,2,5.4,solid(p.m),0,11.8,-0.2));
    add('helm',head,box(3.4,2,3.4,solid(p.m),0,13.7,-0.6));
    add('helm',head,box(1.8,1.6,1.8,solid(p.m),0,15.4,-1.2));
  }},
  {id:'straw',n:'Topi Jerami',dyes:'straw',def:'straw',build:p=>{
    add('helm',head,box(11.5,0.8,11.5,solid(p.m),0,8.5,0));
    add('helm',head,box(7.4,0.8,7.4,solid(0xa23b32),0,9.0,0));
    add('helm',head,box(7.2,2.2,7.2,solid(p.m),0,9.8,0));
  }},
  {id:'crown',n:'Mahkota',dyes:'metal',def:'gold',build:p=>{
    add('helm',head,box(8.6,1.2,8.6,phong(p.m),0,8.75,0));
    [[-3.4,-3.4],[3.4,-3.4],[-3.4,3.4],[3.4,3.4],[0,-3.4],[0,3.4],[-3.4,0],[3.4,0]].forEach(q=>add('helm',head,box(1.4,2,1.4,phong(p.m),q[0],10.35,q[1])));
    add('helm',head,box(1.2,1.2,0.6,solid(0xb02a2a),0,8.75,4.35));
  }},
  /* --- khusus perempuan --- */
  {id:'ribbon',n:'Pita Besar',g:'f',dyes:'cloth',def:'red',build:p=>{
    add('helm',head,box(1.8,1.8,1.8,solid(p.d),0,9.2,-1.0));
    add('helm',head,box(3.6,2.6,1.2,solid(p.m),-2.9,9.5,-1.0));
    add('helm',head,box(3.6,2.6,1.2,solid(p.m),2.9,9.5,-1.0));
  }},
  {id:'tiara',n:'Tiara',g:'f',dyes:'metal',def:'gold',build:p=>{
    add('helm',head,box(6.4,0.9,1.2,phong(p.m),0,7.6,4.7));
    [-2,0,2].forEach(x=>add('helm',head,box(1,1.6,1,phong(p.m),x,8.7+(x===0?0.6:0),4.7)));
    add('helm',head,box(1,1,0.6,glow(0xd04a7a),0,7.6,5.4));
  }},
  {id:'flowers',n:'Mahkota Bunga',g:'f',dyes:'cloth',def:'pink',build:p=>{
    const P=[[-4.8,-4.8],[0,-4.8],[4.8,-4.8],[4.8,0],[4.8,4.8],[0,4.8],[-4.8,4.8],[-4.8,0],
      [-2.4,-4.8],[2.4,-4.8],[4.8,-2.4],[4.8,2.4],[2.4,4.8],[-2.4,4.8],[-4.8,2.4],[-4.8,-2.4]];
    P.forEach((q,i)=>{
      add('helm',head,box(1.6,1.6,1.6,solid(i%2?p.m:0xf2e9d0),q[0],7.9,q[1]));
      add('helm',head,box(1,1,1,solid(0x4a8a3a),q[0],7.0,q[1]));
    });
  }},
  {id:'beret',n:'Baret',g:'f',dyes:'cloth',def:'red',build:p=>{
    add('helm',head,box(9.6,1.4,9.6,solid(p.m),0,8.7,0));
    add('helm',head,box(8,1.2,8,solid(p.l),0,9.9,-0.3));
    add('helm',head,box(1.1,1,1.1,solid(p.d),0,10.8,-0.3));
  }}
];

/* ---- armor: dada ---- */
const plateP=p=>{
  const em=p.m===GOLD?0xa83a34:GOLD;
  return(x,y,f)=>{
    if(f==='py'||f==='ny')return p.d;
    if(y===0)return p.l;
    if(f==='pz'){
      if((x===3||x===4)&&(y===3||y===4))return em;
      if(x===0||x===7||y===7)return p.dd;
      if(x===1||x===6)return p.d;
      return p.m;
    }
    if(f==='nz'){if(x===0||x===7||y===7)return p.dd;return(x===3||x===4)?p.d:p.m;}
    return(x===0||x===3||y===7)?p.d:p.m;
  };
};
const fauldP=p=>(x,y,f)=>(f==='py'||f==='ny')?p.d:(y>=6?p.d:(y===3?p.dd:p.m));
const leatP=p=>(x,y,f)=>{
  if(f==='py'||f==='ny')return p.d;
  if(y===0)return p.l;
  if(x===0||x===7||y===7)return p.dd;
  if(f==='pz'&&(x===3||x===4))return p.d;
  return((x+y)%4===0)?p.l:p.m;
};
const CHESTS=[
  {id:'none',n:'Tanpa',dyes:null},
  {id:'plate',n:'Zirah Baja',dyes:'metal',def:'steel',build:p=>{
    add('chest',upper,box(8.6,7.5,4.4,faceMats(plateP(p),81),0,7.75,0));
    add('chest',upper,box(8.7,2,4.5,faceMats(fauldP(p),82),0,3.2,0));
    [legL,legR].forEach(R=>add('chest',R.g,box(4.6,2.2,1,phong(p.m),0,-5.2,2.3)));
  }},
  {id:'leather',n:'Zirah Kulit',dyes:'leather',def:'brown',build:p=>{
    add('chest',upper,box(8.5,7.2,4.3,faceMats(leatP(p),83),0,7.6,0));
  }},
  /* --- khusus perempuan --- */
  {id:'valk',n:'Zirah Valkyrie',g:'f',dyes:'metal',def:'gold',build:p=>{
    add('chest',upper,box(8.6,7.5,4.4,faceMats(plateP(p),84),0,7.75,0));
    add('chest',upper,box(9.6,1.8,5.4,phong(p.m),0,2.2,0));
    add('chest',upper,box(10.2,1.6,5.8,phong(p.d),0,0.5,0));
    add('chest',upper,box(10.6,1.2,6.2,phong(p.l),0,-1.0,0));
  }},
  {id:'bodice',n:'Korset Kulit',g:'f',dyes:'leather',def:'brown',build:p=>{
    const bp=(x,y,f)=>{
      if(f==='py'||f==='ny')return p.d;
      if(y===0)return p.l;
      if(x===0||x===7||y===7)return p.dd;
      if(f==='pz'&&(x===3||x===4))return(y%2===0)?GOLD:p.d;
      return p.m;
    };
    add('chest',upper,box(8.5,7.2,4.3,faceMats(bp,85),0,7.6,0));
    add('chest',upper,box(9.2,1.8,5,solid(p.m),0,2.2,0));
    add('chest',upper,box(9.4,0.5,5.2,solid(p.d),0,1.2,0));
  }}
];

/* ---- armor: bahu (menempel di lengan agar ikut berayun) ---- */
const SHOULDERS=[
  {id:'none',n:'Tanpa',dyes:null},
  {id:'pad',n:'Bahu Baja',dyes:'metal',def:'steel',build:(p,R)=>{
    add('shoulder',R.sh,box(5.6,1.6,5.6,phong(p.m),R.side*0.3,1.7,0));
    add('shoulder',R.sh,box(4.8,1,4.8,phong(p.l),R.side*0.3,2.8,0));
    add('shoulder',R.sh,box(1.1,1.1,1.1,phong(p.m===GOLD?0xa83a34:GOLD),R.side*0.3,3.6,0));
  }},
  {id:'spiked',n:'Bahu Duri',g:'m',dyes:'metal',def:'dark',build:(p,R)=>{
    add('shoulder',R.sh,box(5.6,1.6,5.6,phong(p.m),R.side*0.3,1.7,0));
    add('shoulder',R.sh,box(4.8,1,4.8,phong(p.d),R.side*0.3,2.8,0));
    [[-1.4,-1.4],[1.4,-1.4],[-1.4,1.4],[1.4,1.4]].forEach(q=>add('shoulder',R.sh,box(1,2.4,1,phong(p.l),R.side*0.3+q[0],4.2,q[1])));
  }},
  {id:'leather',n:'Bahu Kulit',dyes:'leather',def:'brown',build:(p,R)=>{
    add('shoulder',R.sh,box(5,1.4,5,solid(p.m),R.side*0.3,1.7,0));
    add('shoulder',R.sh,box(4.2,0.8,4.2,solid(p.l),R.side*0.3,2.6,0));
  }},
  /* --- khusus perempuan --- */
  {id:'ruffle',n:'Bahu Renda',g:'f',dyes:'cloth',def:'white',build:(p,R)=>{
    add('shoulder',R.sh,box(5.4,0.8,5.4,solid(p.m),R.side*0.3,2.2,0));
    add('shoulder',R.sh,box(4.6,0.8,4.6,solid(p.l),R.side*0.3,2.9,0));
    add('shoulder',R.sh,box(3.6,0.8,3.6,solid(p.m),R.side*0.3,3.5,0));
  }},
  {id:'gem',n:'Bahu Permata',g:'f',dyes:'metal',def:'gold',build:(p,R)=>{
    add('shoulder',R.sh,box(5.6,1.2,5.6,phong(p.m),R.side*0.3,1.9,0));
    add('shoulder',R.sh,box(4.4,0.8,4.4,phong(p.l),R.side*0.3,2.8,0));
    add('shoulder',R.sh,box(1.4,1.4,1.4,glow(0xd04a7a),R.side*0.3,3.7,0));
  }}
];

/* ---- jubah ---- */
const cp=c=>({m:c,d:shade(c,0.74),s:shade(c,0.9)});
function capeMats(yoff,q,total,emb){
  const hem=total-1;
  const outer=(x,y)=>{
    if(y===hem)return(x%2===1)?null:GOLD;
    if(y===hem-1)return GOLD;
    if(x===0||x===7)return q.d;
    if(emb&&((y===4&&(x===3||x===4))||(y===5&&x>=2&&x<=5)||(y===6&&(x===3||x===4))))return GOLD;
    return(x===2||x===5)?q.s:q.m;
  };
  const inner=(x,y)=>(y===hem&&x%2===1)?null:q.d;
  const edge=(x,y)=>y===hem?null:q.d;
  return[mat(mkTex(1,6,edge,yoff,71),true),mat(mkTex(1,6,edge,yoff,72),true),
    mat(mkTex(8,1,()=>q.d,0,73),true),mat(mkTex(8,1,()=>q.d,0,74),true),
    mat(mkTex(8,6,inner,yoff,75),true),mat(mkTex(8,6,outer,yoff,76),true)];
}
const CAPES=[
  {id:'none',n:'Tanpa',dyes:null},
  {id:'long',n:'Jubah Panjang',dyes:'cloth',def:'red',build:p=>{
    const q=cp(p.m);
    add('cape',cape1,box(8,6,1,capeMats(0,q,12,true),0,-3,-0.5));
    add('cape',cape2,box(8,6,1,capeMats(6,q,12,true),0,-3,-0.5));
  }},
  {id:'short',n:'Jubah Pendek',dyes:'cloth',def:'blue',build:p=>{
    add('cape',cape1,box(8,6,1,capeMats(0,cp(p.m),6,false),0,-3,-0.5));
  }},
  /* --- khusus perempuan --- */
  {id:'wings',n:'Sayap Peri',g:'f',dyes:'cloth',def:'pink',build:p=>{
    const wm=new THREE.MeshPhongMaterial({color:p.l,transparent:true,opacity:0.72,shininess:80,side:THREE.DoubleSide});
    const wd=new THREE.MeshPhongMaterial({color:p.m,transparent:true,opacity:0.72,shininess:80,side:THREE.DoubleSide});
    [1,-1].forEach(s=>{
      const a=box(6,8,0.4,wm,s*4.4,-1.5,-0.8);a.rotation.z=-s*0.45;a.castShadow=false;add('cape',cape1,a);
      const b=box(4,5,0.4,wd,s*3.7,-6.2,-0.8);b.rotation.z=s*0.4;b.castShadow=false;add('cape',cape1,b);
    });
  }}
];

/* ---- senjata (genggam di tangan kanan; base = sudut dasar terhadap lengan bawah) ---- */
const WEAPONS=[
  {id:'none',n:'Tanpa',dyes:null},
  {id:'sword',n:'Pedang',dyes:'metal',def:'steel',base:1.9,build:(p,g)=>{
    g.add(box(1.4,3.2,1.4,solid(LEA_D),0,0,0));
    g.add(box(1.9,1,1.9,phong(GOLD),0,-2,0));
    g.add(box(5,1,1.8,phong(GOLD),0,1.9,0));
    g.add(box(1.8,10,0.6,phong(p.m),0,7.4,0));
    g.add(box(0.6,10,0.75,phong(p.l),0,7.4,0));
    g.add(box(1.2,1.2,0.55,phong(p.m),0,13,0));
  }},
  {id:'staff',n:'Tongkat',dyes:'cloth',def:'blue',base:0.95,build:(p,g)=>{
    g.add(box(1.2,18,1.2,solid(LEA),0,5,0));
    [[-1.4,0],[1.4,0],[0,-1.4],[0,1.4]].forEach(q=>g.add(box(0.8,3,0.8,solid(LEA_D),q[0],14.5,q[1])));
    g.add(box(2.6,2.6,2.6,glow(p.l),0,15.4,0));
  }},
  {id:'wand',n:'Tongkat Peri',g:'f',dyes:'cloth',def:'pink',base:1.5,build:(p,g)=>{
    g.add(box(0.9,10,0.9,solid(0xe6d3a0),0,3.5,0));
    g.add(box(1.4,1,1.4,phong(GOLD),0,-1.2,0));
    g.add(box(3.4,0.8,0.8,glow(p.l),0,9.6,0));
    g.add(box(0.8,3.4,0.8,glow(p.l),0,9.6,0));
    g.add(box(1.8,1.8,0.9,glow(p.m),0,9.6,0));
  }},
  {id:'rapier',n:'Rapier',g:'f',dyes:'metal',def:'steel',base:1.9,build:(p,g)=>{
    g.add(box(1.2,3,1.2,solid(LEA_D),0,0,0));
    g.add(box(1.5,1,1.5,phong(GOLD),0,-1.8,0));
    g.add(box(3.4,0.9,3.4,phong(GOLD),0,1.9,0));
    g.add(box(0.9,13,0.45,phong(p.m),0,8.9,0));
    g.add(box(0.4,13,0.55,phong(p.l),0,8.9,0));
  }},
  {id:'parasol',n:'Payung',g:'f',dyes:'cloth',def:'pink',base:0.95,build:(p,g)=>{
    g.add(box(0.8,15,0.8,solid(LEA),0,5.5,0));
    g.add(box(10.6,0.5,10.6,solid(p.d),0,11.4,0));
    g.add(box(10,0.8,10,solid(p.m),0,12,0));
    g.add(box(7,0.8,7,solid(p.l),0,12.8,0));
    g.add(box(3.4,0.8,3.4,solid(p.m),0,13.6,0));
    g.add(box(1,1.6,1,phong(GOLD),0,14.6,0));
  }},
  {id:'axe',n:'Kapak',g:'m',dyes:'metal',def:'steel',base:1.6,build:(p,g)=>{
    g.add(box(1.3,14,1.3,solid(LEA),0,3.5,0));
    g.add(box(1.8,3.6,1.8,phong(p.d),0,9.4,0));
    g.add(box(0.6,5,3,phong(p.m),0,9.4,2.1));
    g.add(box(0.5,5.4,0.6,phong(p.l),0,9.4,3.7));
  }}
];

/* ---- aksesori (boleh lebih dari satu) ---- */
const ACCS=[
  {id:'belt',n:'Sabuk',dyes:'leather',def:'brown',build:p=>{
    add('acc',upper,box(8.8,2,4.7,solid(p.m),0,2,0));
    add('acc',upper,box(2.6,2.4,0.8,phong(GOLD),0,2,2.45));
    add('acc',upper,box(2.6,2.8,1.4,solid(p.d),3.3,1.2,2.9));
    add('acc',upper,box(2.8,0.8,1.6,solid(p.l),3.3,2.7,2.9));
  }},
  {id:'pack',n:'Ransel',dyes:'leather',def:'brown',build:p=>{
    add('acc',upper,box(6.5,7,3,solid(p.d),0,6,-3.3));
    add('acc',upper,box(6.5,2,3.2,solid(p.l),0,8.8,-3.3));
    add('acc',upper,box(0.9,5,0.5,solid(p.dd),2.4,7,2.4));
    add('acc',upper,box(0.9,5,0.5,solid(p.dd),-2.4,7,2.4));
  }},
  {id:'goggles',n:'Kacamata',dyes:'metal',def:'bronze',build:p=>{
    [-2,2].forEach(sx=>{
      add('acc',head,box(2.8,2,0.2,glass(0x88ccff),sx,4,4.3));
      add('acc',head,box(3.4,0.5,0.5,phong(p.m),sx,5.3,4.3));
      add('acc',head,box(3.4,0.5,0.5,phong(p.m),sx,2.7,4.3));
      add('acc',head,box(0.5,2.6,0.5,phong(p.m),sx-1.45,4,4.3));
      add('acc',head,box(0.5,2.6,0.5,phong(p.m),sx+1.45,4,4.3));
    });
    add('acc',head,box(1.4,0.5,0.5,phong(p.m),0,4.6,4.3));
    add('acc',head,box(0.5,0.5,4.4,phong(p.m),4.2,4.6,2.1));
    add('acc',head,box(0.5,0.5,4.4,phong(p.m),-4.2,4.6,2.1));
  }},
  {id:'scarf',n:'Syal',dyes:'cloth',def:'red',build:p=>{
    add('acc',upper,box(8.6,2,4.8,solid(p.m),0,11,0));
    add('acc',upper,box(2.2,5.5,0.6,solid(p.d),2.2,8.2,2.55));
  }},
  {id:'gloves',n:'Sarung Tangan',dyes:'cloth',def:'white',build:p=>{
    [armL,armR].forEach(R=>{
      add('acc',R.el,box(4.4,2.6,4.4,solid(p.m),0,-4.7,0));
      add('acc',R.el,box(4.6,0.8,4.6,solid(p.d),0,-3.6,0));
    });
  }},
  {id:'glasses',n:'Kacamata Bulat',dyes:'metal',def:'dark',build:p=>{
    [-2,2].forEach(sx=>{
      add('acc',head,box(2.4,1.8,0.2,glass(0xdff2ff),sx,4,4.25));
      add('acc',head,box(3,0.4,0.5,phong(p.m),sx,5.1,4.3));
      add('acc',head,box(3,0.4,0.5,phong(p.m),sx,2.9,4.3));
      add('acc',head,box(0.4,2.2,0.5,phong(p.m),sx-1.4,4,4.3));
      add('acc',head,box(0.4,2.2,0.5,phong(p.m),sx+1.4,4,4.3));
    });
    add('acc',head,box(1.2,0.4,0.5,phong(p.m),0,4.6,4.3));
    add('acc',head,box(0.4,0.4,4.4,phong(p.m),4.2,4.6,2.1));
    add('acc',head,box(0.4,0.4,4.4,phong(p.m),-4.2,4.6,2.1));
  }},
  /* --- khusus laki-laki --- */
  {id:'beard',n:'Jenggot',g:'m',dyes:'hair',def:'brown',build:p=>{
    add('acc',head,box(8.4,2.2,1,solid(p.m),0,1.1,4.2));
    add('acc',head,box(1,3.8,3.2,solid(p.m),4.2,2.0,2.4));
    add('acc',head,box(1,3.8,3.2,solid(p.m),-4.2,2.0,2.4));
  }},
  {id:'mustache',n:'Kumis',g:'m',dyes:'hair',def:'brown',build:p=>{
    add('acc',head,box(4.4,0.8,0.8,solid(p.m),0,2.1,4.3));
  }},
  /* --- khusus perempuan --- */
  {id:'bow',n:'Pita Rambut',g:'f',dyes:'cloth',def:'red',build:p=>{
    add('acc',head,box(1.4,1.4,1.4,solid(p.d),4.1,7.3,1.6));
    add('acc',head,box(1,2.4,2.4,solid(p.m),4.2,7.3,3.4));
    add('acc',head,box(1,2.4,2.4,solid(p.m),4.2,7.3,-0.2));
  }},
  {id:'earrings',n:'Anting',g:'f',dyes:'metal',def:'gold',build:p=>{
    [1,-1].forEach(s=>{
      add('acc',head,box(0.6,1.6,0.6,phong(p.m),s*4.2,2.4,0.6));
      add('acc',head,box(0.9,0.9,0.9,glow(0xd04a7a),s*4.25,1.1,0.6));
    });
  }},
  {id:'necklace',n:'Kalung',g:'f',dyes:'metal',def:'gold',build:p=>{
    add('acc',upper,box(5.2,0.5,0.5,phong(p.m),0,10.8,2.2));
    add('acc',upper,box(0.5,2.2,0.5,phong(p.m),1.9,9.8,2.2));
    add('acc',upper,box(0.5,2.2,0.5,phong(p.m),-1.9,9.8,2.2));
    add('acc',upper,box(3.3,0.5,0.5,phong(p.m),0,8.7,2.2));
    add('acc',upper,box(1.1,1.1,0.5,glow(0xd04a7a),0,8.0,2.2));
  }},
  {id:'purse',n:'Tas Selempang',g:'f',dyes:'leather',def:'brown',build:p=>{
    [2.15,-2.15].forEach(z=>{const s=box(0.9,10,0.5,solid(p.d),0,7,z);s.rotation.z=-0.6435;add('acc',upper,s);});
    add('acc',upper,box(4,3.4,1.8,solid(p.m),-3.3,3,2.9));
    add('acc',upper,box(4.2,1.2,2,solid(p.l),-3.3,4.6,2.9));
    add('acc',upper,box(0.9,0.9,0.4,phong(GOLD),-3.3,3.6,3.95));
  }}
];

const REG={eyes:EYES,hair:HAIRS,top:TOPS,legs:LEGS,boots:BOOTS,helm:HELMS,chest:CHESTS,shoulder:SHOULDERS,cape:CAPES,weapon:WEAPONS,acc:ACCS};
const find=(key,id)=>REG[key].find(i=>i.id===id)||REG[key][0];
/* Kepemilikan: item builder yang ada di katalog game ('gear.<bagian>.<id>') hanya boleh dipakai bila dimiliki (PlayerData).
   Item yang tidak ada di katalog (mata, rambut, 'none') adalah dasar penampilan: gratis. Harga/kepemilikan asli ada di server. */
const IC=window.ItemCatalog,PD=window.PlayerData;
const catItem=(key,it)=>IC.byId('gear.'+key+'.'+it.id);
let previewAll=false; /* true hanya saat membuat thumbnail: item terkunci tetap dirender */
const owned=(key,it)=>{if(previewAll)return true;const c=catItem(key,it);return !c||PD.owns(c.id);};



const NONE_GEAR={helm:{id:'none'},chest:{id:'none'},shoulder:{id:'none'},cape:{id:'none'},weapon:{id:'none'},accessories:[]};
const gear=o=>Object.assign(clone(NONE_GEAR),o);
const PRESETS=[
  {id:'citizen',n:'🙂 Warga',set:gear({top:{id:'tee',dye:'blue'},legs:{id:'pants',dye:'navy'},boots:{id:'shoes',dye:'brown'}})},
  {id:'knight',n:'🛡️ Ksatria',set:gear({top:{id:'tunic',dye:'red'},legs:{id:'pants',dye:'navy'},boots:{id:'tall',dye:'brown'},
    chest:{id:'plate',dye:'steel'},shoulder:{id:'pad',dye:'steel'},cape:{id:'long',dye:'red'},weapon:{id:'sword',dye:'steel'},accessories:[{id:'belt',dye:'brown'}]})},
  {id:'mage',n:'🧙 Penyihir',set:gear({top:{id:'robe',dye:'purple'},legs:{id:'pants',dye:'purple'},boots:{id:'cloth',dye:'black'},
    helm:{id:'wizard',dye:'purple'},weapon:{id:'staff',dye:'blue'}})},
  {id:'farmer',n:'🌾 Petani',set:gear({top:{id:'overall',dye:'blue'},legs:{id:'pants',dye:'blue'},boots:{id:'shoes',dye:'brown'},helm:{id:'straw',dye:'straw'}})},
  {id:'explorer',n:'🧭 Petualang',set:gear({top:{id:'vest',dye:'green'},legs:{id:'pants',dye:'brown'},boots:{id:'tall',dye:'brown'},
    accessories:[{id:'belt',dye:'brown'},{id:'pack',dye:'brown'},{id:'goggles',dye:'bronze'}]})},
  {id:'noble',n:'👑 Bangsawan',set:gear({top:{id:'coat',dye:'navy'},legs:{id:'formal',dye:'black'},boots:{id:'shoes',dye:'black'},
    helm:{id:'crown',dye:'gold'},cape:{id:'short',dye:'navy'},accessories:[{id:'belt',dye:'black'}]})}
];
PRESETS.forEach(p=>p.g='m');
const FP=(id,n,set)=>PRESETS.push({id:id,n:n,g:'f',set:gear(set)});
FP('citizen','🙂 Warga',{top:{id:'blouse',dye:'white'},legs:{id:'skirt',dye:'navy'},boots:{id:'mary',dye:'black'},accessories:[{id:'bow',dye:'red'}]});
FP('knight','🛡️ Ksatria',{top:{id:'tunic',dye:'purple'},legs:{id:'tights',dye:'black'},boots:{id:'knee',dye:'black'},
  chest:{id:'valk',dye:'steel'},shoulder:{id:'gem',dye:'steel'},cape:{id:'long',dye:'purple'},weapon:{id:'rapier',dye:'steel'},accessories:[{id:'belt',dye:'black'}]});
FP('mage','🧙 Penyihir',{top:{id:'robe',dye:'navy'},legs:{id:'tights',dye:'black'},boots:{id:'knee',dye:'black'},
  helm:{id:'wizard',dye:'navy'},weapon:{id:'wand',dye:'pink'},accessories:[{id:'earrings',dye:'gold'}]});
FP('farmer','🌾 Petani',{top:{id:'sundress',dye:'yellow'},legs:{id:'bare'},boots:{id:'sandal',dye:'tan'},helm:{id:'straw',dye:'straw'}});
FP('explorer','🧭 Petualang',{top:{id:'vest',dye:'green'},legs:{id:'shorts',dye:'brown'},boots:{id:'tall',dye:'brown'},
  accessories:[{id:'belt',dye:'brown'},{id:'goggles',dye:'bronze'},{id:'purse',dye:'brown'}]});
FP('princess','👑 Putri',{top:{id:'dress',dye:'pink'},legs:{id:'tights',dye:'white'},boots:{id:'mary',dye:'pink'},
  helm:{id:'tiara',dye:'gold'},cape:{id:'short',dye:'pink'},accessories:[{id:'necklace',dye:'gold'},{id:'earrings',dye:'gold'},{id:'gloves',dye:'white'}]});
FP('fairy','🧚 Peri',{top:{id:'sundress',dye:'mint'},legs:{id:'bare'},boots:{id:'flat',dye:'mint'},
  helm:{id:'flowers',dye:'pink'},cape:{id:'wings',dye:'lilac'},weapon:{id:'wand',dye:'mint'},accessories:[{id:'earrings',dye:'gold'}]});
const DEFAULT=Object.assign({
  version:1,
  gender:'m',
  body:{height:1,build:1},
  skin:'s2',
  eyes:{id:'round',dye:'blue'},
  hair:{id:'short',dye:'brown'}
},clone(PRESETS[0].set));

let cfg=clone(DEFAULT);
const okG=i=>!i.g||i.g===cfg.gender;
const START={
  m:Object.assign({gender:'m',eyes:{id:'round',dye:'blue'},hair:{id:'short',dye:'brown'}},clone(PRESETS[0].set)),
  f:Object.assign({gender:'f',eyes:{id:'lash',dye:'blue'},hair:{id:'bob',dye:'brown'}},clone(PRESETS.find(p=>p.g==='f'&&p.id==='citizen').set))
};
// ganti gender: pakai set dasar gender tsb, pertahankan kulit, badan, warna rambut & mata
function setGender(g){
  if(cfg.gender===g)return;
  const o=clone(START[g]);
  o.hair.dye=cfg.hair.dye;o.eyes.dye=cfg.eyes.dye;o.skin=cfg.skin;o.body=clone(cfg.body);
  apply(o);
}

function merge(d,s){
  for(const k in s){
    const v=s[k];
    if(Array.isArray(v))d[k]=clone(v);
    else if(v&&typeof v==='object'&&d[k]&&typeof d[k]==='object'&&!Array.isArray(d[k])){for(const kk in v)d[k][kk]=v[kk];}
    else d[k]=v;
  }
}
function fixDye(o,it){
  if(!it.dyes){delete o.dye;return;}
  if(!DYES[it.dyes].some(d=>d.id===o.dye))o.dye=it.def;
}
function normalize(){
  const b=cfg.body=(cfg.body&&typeof cfg.body==='object')?cfg.body:{};
  b.height=clamp(+b.height||1,0.9,1.1);b.build=clamp(+b.build||1,0.9,1.15);
  if(cfg.gender!=='m'&&cfg.gender!=='f')cfg.gender='m';
  if(!SKINS.some(s=>s.id===cfg.skin))cfg.skin='s2';
  ['eyes','hair','top','legs','boots','helm','chest','shoulder','cape','weapon'].forEach(k=>{
    const o=cfg[k]=(cfg[k]&&typeof cfg[k]==='object'&&!Array.isArray(cfg[k]))?cfg[k]:{};
    let it=find(k,o.id);if(!okG(it)||!owned(k,it))it=REG[k].find(i=>okG(i)&&owned(k,i))||REG[k][0];o.id=it.id;fixDye(o,it);
  });
  const seen={};
  cfg.accessories=(Array.isArray(cfg.accessories)?cfg.accessories:[]).map(a=>typeof a==='string'?{id:a}:a)
    .filter(a=>a&&ACCS.some(i=>i.id===a.id&&okG(i)&&owned('acc',i))&&!seen[a.id]&&(seen[a.id]=true))
    .map(a=>{const it=find('acc',a.id);const o={id:a.id,dye:a.dye};fixDye(o,it);return o;});
}
// kategori config -> slot mesh yang harus dibangun ulang
const KEYMAP={gender:['head'],skin:['head','body'],eyes:['head'],hair:['head','hair'],top:['body'],legs:['body'],boots:['body'],
  helm:['helm','hair'],chest:['chest'],shoulder:['shoulder'],cape:['cape'],weapon:['weapon'],accessories:['acc','cape']};
const ORDER=['head','hair','body','helm','chest','shoulder','weapon','acc','cape'];
const listeners=[];
function apply(part,all){
  const old=clone(cfg);
  if(part)merge(cfg,part);
  normalize();
  const need={};
  if(all)ORDER.forEach(s=>need[s]=1);
  else for(const k in KEYMAP){if(JSON.stringify(old[k])!==JSON.stringify(cfg[k]))KEYMAP[k].forEach(s=>need[s]=1);}
  ORDER.forEach(s=>{if(need[s])BUILD[s]();});
  const fm=cfg.gender==='f';
  root.scale.set(cfg.body.build*(fm?0.95:1),cfg.body.height*(fm?0.97:1),cfg.body.build*(fm?0.95:1));
  listeners.forEach(fn=>fn(cfg));
}



const skinC=()=>SKINS.find(s=>s.id===cfg.skin).c;
const hairC=()=>dyeC(cfg.hair,find('hair',cfg.hair.id));
const colorOf=(key,o)=>{const it=find(key,o.id);const c=dyeC(o,it);return c===null?null:pal(c);};

function buildHead(){
  clear('head');
  const sk=skinC(),skD=shade(sk,0.85),hD=shade(hairC(),0.55),fem=cfg.gender==='f';
  const eye=find('eyes',cfg.eyes.id),ic=dyeC(cfg.eyes,eye);
  const faceF=(x,y)=>{
    const m=x<4?x:7-x;
    if(m===1||m===2){const e=eye.px(m,y,ic);if(e!==undefined)return e;}
    if(eye.brow!==null&&y===eye.brow&&(m===1||m===2))return hD;
    if(y===5&&(x===3||x===4))return skD;
    if(y===6&&(x===3||x===4))return fem?0xc4565f:0x8c4a3c;
    if(fem&&y===5&&m===1)return mix(sk,0xf08080,0.4);
    return sk;
  };
  const lidC=shade(sk,0.5);
  const faceC=(x,y)=>{ /* wajah mata terpejam: baris iris/putih jadi garis kelopak, bulu mata (baris atas) tetap */
    const m=x<4?x:7-x;
    if((m===1||m===2)&&y===4&&eye.px(m,y,ic)!==undefined)return fem?0x2a1a12:lidC;
    if((m===1||m===2)&&y===3&&eye.px(m,y,ic)!==undefined&&eye.id!=='lash')return sk;
    return faceF(x,y);
  };
  const sideF=fz=>(x,y)=>{const f=fz?x:7-x;return((f===3||f===4)&&(y===4||y===5))?skD:sk;};
  const faceOpen=mat(mkTex(8,8,faceF,0,25)),faceShut=mat(mkTex(8,8,faceC,0,25));
  headMesh=add('head',head,box(8,8,8,[
    mat(mkTex(8,8,sideF(true),0,21)),mat(mkTex(8,8,sideF(false),0,22)),
    mat(mkTex(8,8,()=>hairC(),0,23)),mat(mkTex(8,8,()=>skD,0,24)),
    faceOpen,mat(mkTex(8,8,()=>sk,0,26))
  ],0,4,0));
  blinkMats={open:faceOpen,shut:faceShut};blinkClose=0;blinkT=1.5+Math.random()*3;
}
/* Kedip: dipanggil tiap frame. Mata terbuka 2–5,5 dtk, terpejam 0,11 dtk; sesekali kedip ganda. */
function blinkStep(dt){
  if(!headMesh||!blinkMats||eyeIsClosedStyle())return;
  if(blinkClose>0){
    blinkClose-=dt;
    if(blinkClose<=0){headMesh.material[4]=blinkMats.open;blinkT=Math.random()<0.2?0.18:2+Math.random()*3.5;}
    return;
  }
  blinkT-=dt;
  if(blinkT<=0){headMesh.material[4]=blinkMats.shut;blinkClose=0.11;}
}
function eyeIsClosedStyle(){return cfg&&cfg.eyes&&cfg.eyes.id==='closed';}

function buildHair(){
  clear('hair');
  if(find('helm',cfg.helm.id).hideHair)return;
  const hs=find('hair',cfg.hair.id),hc=hairC(),hL=shade(hc,1.35);
  const hm=mat(mkTex(8,8,(x,y)=>hash(x,y,31)>0.65?hL:hc,0,31));
  const H=(w,h,d,x,y,z)=>add('hair',head,box(w,h,d,hm,x,y,z));
  const T=(x,y,z,w,h,d)=>{
    const g=new THREE.Group();g.position.set(x*S,y*S,z*S);add('hair',head,g);
    g.add(box(w,h,d,hm,0,-h/2,0));tails.push(g);return g;
  };
  hs.f(H,hm,T);
}

function buildBody(){
  clear('body');
  const sk=skinC(),skD=shade(sk,0.85);
  const tI=find('top',cfg.top.id),tp=tI.paint(pal(dyeC(cfg.top,tI)));
  const lI=find('legs',cfg.legs.id),lc=dyeC(cfg.legs,lI),lp=pal(lc===null?sk:lc),lPaint=lI.paint(lp);
  const bI=find('boots',cfg.boots.id),bc=dyeC(cfg.boots,bI),bp=bc===null?null:pal(bc),bPaint=bI.paint(bp);
  const orSk=v=>v==null?sk:v;
  const capC=tp.arm(0,0);
  const tt=(w,f,seed)=>mat(mkTex(w,12,(x,y)=>orSk(tp.torso(x,y,f)),0,seed));
  torsoMesh=add('body',upper,box(8,12,4,[
    tt(4,'side',11),tt(4,'side',12),
    mat(mkTex(8,4,()=>orSk(tp.torso(0,1,'side')),0,13)),mat(mkTex(8,4,()=>lp.m,0,14)),
    tt(8,'pz',15),tt(8,'nz',16)
  ],0,6,0));
  const ap=(x,y)=>{const v=tp.arm(x,y);return v==null?(y===11?skD:sk):v;};
  [armL,armR].forEach(R=>{
    add('body',R.sh,box(4,6,4,limbMats(4,6,0,(x,y)=>ap(x,y),capC==null?sk:orSk(capC),sk,31+R.side),0,-2,0));
    add('body',R.el,box(4,6,4,limbMats(4,6,6,(x,y)=>ap(x,y),sk,skD,41+R.side),0,-3,0));
  });
  const lg=(x,y,f)=>{
    const v=y>=bI.from?bPaint(x,y,f):(y>7?null:lPaint(x,y,f));
    return orSk(v);
  };
  const soleC=bI.sole(bp);
  [legL,legR].forEach(R=>{
    add('body',R.g,box(4,6,4,limbMats(4,6,0,lg,lp.m,lp.m,51+R.side),0,-3,0));
    add('body',R.knee,box(4,6,4,limbMats(4,6,6,lg,lp.m,soleC==null?skD:soleC,61+R.side),0,-3,0));
  });
  if(tp.extra)tp.extra();
  if(lI.skirt)lI.skirt(lp);
}

function buildHelm(){clear('helm');const it=find('helm',cfg.helm.id);if(it.build)it.build(colorOf('helm',cfg.helm));}
function buildChest(){clear('chest');const it=find('chest',cfg.chest.id);if(it.build)it.build(colorOf('chest',cfg.chest));}
function buildShoulder(){
  clear('shoulder');const it=find('shoulder',cfg.shoulder.id);
  if(it.build){const p=colorOf('shoulder',cfg.shoulder);[armL,armR].forEach(R=>it.build(p,R));}
}
function buildCape(){
  clear('cape');
  // jubah menjauh dari punggung bila memakai ransel
  cape1.position.z=(cfg.accessories.some(a=>a.id==='pack')?-4.9:-2.3)*S;
  const it=find('cape',cfg.cape.id);if(it.build)it.build(colorOf('cape',cfg.cape));
}
function buildWeapon(){
  clear('weapon');
  const it=find('weapon',cfg.weapon.id);
  if(!it.build)return;
  wpg=new THREE.Group();wpBase=it.base||0;
  add('weapon',hand,wpg);
  it.build(colorOf('weapon',cfg.weapon),wpg);
}
/* Alat kerja di tangan kanan: 'pickaxe' (beliung) atau null. Ikut lengan & pergelangan (seperti senjata), tidak tersimpan di data pemain. */
function setTool(kind){
  clear('tool');
  if(kind!=='pickaxe')return;
  toolG=new THREE.Group();add('tool',hand,toolG);
  toolG.add(box(1.3,14,1.3,solid(LEA),0,3.5,0));              /* gagang kayu */
  toolG.add(box(2.0,2.4,2.4,phong(0x7d8696),0,10.8,0));        /* pangkal kepala */
  toolG.add(box(1.1,1.1,9.5,phong(0x959eae),0,11.1,0));        /* bilah memanjang depan-belakang */
  [1,-1].forEach(s=>{toolG.add(box(0.9,0.9,2.6,phong(0xb9c1cd),0,10.2,s*5.6));toolG.add(box(0.8,0.8,1.6,phong(0xd3d9e2),0,9.4,s*6.7));}); /* ujung melengkung turun */
}
function buildAcc(){
  clear('acc');
  cfg.accessories.forEach(a=>{const it=find('acc',a.id);it.build(colorOf('acc',a));});
}
const BUILD={head:buildHead,hair:buildHair,body:buildBody,helm:buildHelm,chest:buildChest,shoulder:buildShoulder,cape:buildCape,weapon:buildWeapon,acc:buildAcc};



const POSES={
  pose1:{rLegT:-0.55,rKnee:0.5,lLegT:0.45,lKnee:0.05,rLegZ:-0.12,lLegZ:0.15,rArmS:-0.95,rElbow:-0.75,rWrist:1.0,rArmZ:-0.12,lArmS:-0.7,lElbow:-1.1,lArmZ:0.35,lean:0.18,twist:0.25,headX:0.05,headY:-0.2,cape:0.2,tail:0.3},
  pose2:{rLegT:-0.15,rKnee:0.05,lLegT:0.1,lKnee:0.05,rLegZ:-0.25,lLegZ:0.25,rArmS:-3.05,rElbow:-0.15,rWrist:1.55,rArmZ:-0.25,lArmS:0.1,lElbow:-1.3,lArmZ:0.55,lean:-0.12,twist:-0.1,headX:-0.2,headY:0,cape:0.35,tail:0.5},
  pose3:{rLegT:-0.95,rKnee:0.95,lLegT:0.7,lKnee:0.05,rLegZ:-0.15,lLegZ:0.2,rArmS:-1.5,rElbow:-0.05,rWrist:1.5,rArmZ:-0.05,lArmS:0.5,lElbow:-0.4,lArmZ:0.9,lean:0.28,twist:0.5,headX:0.1,headY:-0.45,cape:0.5,tail:0.6}
};
const CROUCH={rLegT:-0.75,rKnee:1.35,lLegT:-0.55,lKnee:1.2,rArmS:-0.2,rArmZ:-0.35,lArmS:-0.3,lArmZ:0.4,lean:0.35,headX:-0.15,cape:0.1};
const AIR_UP={rLegT:-1.0,rKnee:1.2,lLegT:0.35,lKnee:0.9,rLegZ:-0.1,lLegZ:0.12,rArmS:-2.7,rElbow:-0.15,rWrist:1.3,rArmZ:-0.15,lArmS:-2.5,lElbow:-0.2,lArmZ:0.35,lean:0.05,twist:0,headX:-0.1,headY:0,cape:0.2,tail:1.0};
const AIR_DN={rLegT:-0.5,rKnee:0.4,lLegT:0.35,lKnee:0.3,rLegZ:-0.15,lLegZ:0.15,rArmS:-0.5,rElbow:-0.4,rWrist:0.4,rArmZ:-0.9,lArmS:-0.5,lElbow:-0.3,lArmZ:1.0,lean:0.08,twist:0,headX:0.05,headY:0,cape:0.7,tail:1.2};

let mode='idle',level=0,phase=0,time=0;
let jumpY=0,vy=0,airborne=false,landT=0;

function computeTarget(){
  const T={rLegT:0,rKnee:0,lLegT:0,lKnee:0,rLegZ:-0.05,lLegZ:0.05,rArmS:-0.35,rElbow:-0.6,rWrist:0,rArmZ:-0.1,
    lArmS:0.05,lElbow:-0.12,lArmZ:0.07,lean:0,twist:0,headX:0,headY:0,cape:0.1,tail:0.25};
  const w=clamp(level,0,1),ra=clamp(level-1,0,1),idleW=1-w;
  const b=Math.sin(time*2.2);
  T.rArmS+=b*0.025*idleW;T.lArmS+=-b*0.03*idleW;T.headX+=b*0.02*idleW;T.headY+=Math.sin(time*0.7)*0.3*idleW;
  if(w>0.01){
    const A=(0.62+0.45*ra)*w,Aa=(0.55+0.5*ra)*w,kb=0.55+0.95*ra;
    const s=Math.sin(phase),c=Math.cos(phase);
    T.rLegT=A*s;T.lLegT=-A*s;
    T.rKnee=kb*Math.max(0,-c)*w+0.05*w;T.lKnee=kb*Math.max(0,c)*w+0.05*w;
    T.lArmS=Aa*s;T.lElbow=-(0.15+0.95*ra)*w;
    T.rArmS=-0.4-0.25*ra*w-s*0.15*w*(1+ra);T.rElbow=-0.5-0.3*ra*w;T.rWrist=0.05;
    T.lean=0.04*w+0.28*ra;T.twist=0.18*s*w;
    T.headY=0;T.headX=-0.04*w-0.12*ra;
    T.cape=0.1+0.25*w+0.45*ra;T.tail=0.25+0.4*w+0.45*ra;
  }
  if(mode.indexOf('pose')===0&&level<0.3&&!airborne)Object.assign(T,POSES[mode]);
  if(airborne){
    const u=(clamp(vy/6,-1,1)+1)/2;
    for(const k in AIR_UP)T[k]=lerp(AIR_DN[k],AIR_UP[k],u);
  }
  if(landT>0){
    const lw=clamp(landT/0.25,0,1);
    for(const k in CROUCH)T[k]=lerp(T[k],CROUCH[k],lw);
  }
  return T;
}
const P=computeTarget();
function reach(t,k,z){return(0.375*Math.cos(t)+0.375*Math.cos(t+k))*Math.cos(z);}

function applyRig(){
  legR.g.rotation.set(P.rLegT,0,P.rLegZ);legR.knee.rotation.x=P.rKnee;
  legL.g.rotation.set(P.lLegT,0,P.lLegZ);legL.knee.rotation.x=P.lKnee;
  armR.sh.rotation.set(P.rArmS,0,P.rArmZ);armR.el.rotation.x=P.rElbow;
  armL.sh.rotation.set(P.lArmS,0,P.lArmZ);armL.el.rotation.x=P.lElbow;
  // pergelangan: senjata di tangan kanan berputar relatif terhadap lengan bawah
  if(wpg)wpg.rotation.x=wpBase+P.rWrist*1.35;
  if(toolG)toolG.rotation.x=1.6+P.rWrist*1.35;
  upper.rotation.set(P.lean,P.twist,0);
  head.rotation.set(P.headX-P.lean*0.6,P.headY-P.twist*0.7,0);
  const act=clamp(level,0,2)*0.5+(airborne?0.6:0)+0.1;
  cape1.rotation.x=P.cape+Math.sin(time*6)*0.03*act;
  cape2.rotation.x=P.cape*0.6+Math.sin(time*7+1.2)*0.08*act;
  tails.forEach((g,i)=>{g.rotation.x=0.2+P.tail*0.5+Math.sin(time*6+i)*0.08*act;g.rotation.z=Math.sin(time*3.1+i)*0.05*act;});
  if(torsoMesh)torsoMesh.scale.y=1+Math.sin(time*2.2)*0.012*(1-clamp(level,0,1));
  const hipY=Math.max(reach(P.rLegT,P.rKnee,P.rLegZ),reach(P.lLegT,P.lKnee,P.lLegZ));
  const af=clamp(jumpY/0.15,0,1);
  hips.position.y=lerp(hipY,0.75,af);
  root.position.y=jumpY;
}


/* ---- Aksi sekali pakai (tidak ada di karakter.html): attack = ayun senjata, block = pose bertahan + perisai ----
   Ditumpuk di atas pose normal (jalan/lari/idle) lewat applyAct di tick, lalu memudar kembali. */
const ACT_W={rArmS:-2.9,rElbow:-0.5,rWrist:1.2,rArmZ:-0.15,lArmS:-0.4,lElbow:-0.5,lArmZ:0.4,lean:-0.2,twist:-0.45,headX:-0.1,headY:-0.3,rLegT:0.3,rKnee:0.1,lLegT:-0.35,lKnee:0.25,cape:0.4,tail:0.5};
const ACT_S={rArmS:-0.9,rElbow:-0.15,rWrist:-0.6,rArmZ:-0.05,lArmS:0.4,lElbow:-0.3,lArmZ:0.5,lean:0.35,twist:0.4,headX:0.1,headY:0.28,rLegT:-0.5,rKnee:0.6,lLegT:0.5,lKnee:0.05,cape:0.7,tail:0.7};
const ACT_B={rArmS:-0.55,rElbow:-1.1,rWrist:0,rArmZ:0.3,lArmS:-0.55,lElbow:-1.1,lArmZ:-0.3,lean:-0.1,twist:0,headX:0.2,headY:0,rLegT:-0.45,rKnee:0.9,lLegT:-0.3,lKnee:0.8,cape:0.5,tail:0.6};
const ACT_SAD={rArmS:0.05,rElbow:-0.1,rWrist:0,rArmZ:-0.05,lArmS:0.05,lElbow:-0.1,lArmZ:0.05,lean:0.3,twist:0,headX:0.5,headY:0,rLegT:-0.1,rKnee:0.25,lLegT:-0.05,lKnee:0.2,cape:0.1,tail:0.05};
const ACT_CHEER={rArmS:-3.0,rElbow:-0.2,rWrist:0.5,rArmZ:-0.35,lArmS:-3.0,lElbow:-0.2,lArmZ:0.35,lean:-0.1,twist:0,headX:-0.25,headY:0,cape:0.5,tail:0.8};
const ACT_WAVE={rArmS:-2.85,rElbow:-0.4,rWrist:0.3,rArmZ:-0.55,lArmS:0.05,lElbow:-0.12,lArmZ:0.07,lean:0,twist:0.1,headX:-0.05,headY:0.25,cape:0.15,tail:0.3};
const ACT_TUCK={rArmS:-1.3,rElbow:-1.5,rWrist:0.3,rArmZ:-0.3,lArmS:-1.3,lElbow:-1.5,lArmZ:0.3,lean:0.5,twist:0,headX:0.45,headY:0,rLegT:-1.5,rKnee:1.9,lLegT:-1.5,lKnee:1.9,rLegZ:-0.1,lLegZ:0.1,cape:0.9,tail:1.0};
/* Menambang: angkat beliung dengan dua tangan (MU) -> hantam ke depan-bawah (MH) -> tarik kembali; berulang tanpa kembali ke pose netral */
const ACT_MU={rArmS:-2.6,rElbow:-0.9,rWrist:1.0,rArmZ:-0.1,lArmS:-2.3,lElbow:-0.9,lArmZ:0.25,lean:-0.28,twist:-0.2,headX:-0.15,headY:0,rLegT:0.25,rKnee:0.15,lLegT:-0.25,lKnee:0.2,cape:0.3,tail:0.4};
const ACT_MH={rArmS:-0.75,rElbow:-0.1,rWrist:-0.7,rArmZ:-0.05,lArmS:-0.95,lElbow:-0.25,lArmZ:0.2,lean:0.5,twist:0.15,headX:0.3,headY:0,rLegT:-0.45,rKnee:0.55,lLegT:0.4,lKnee:0.05,cape:0.7,tail:0.7};
/* Main dadu di lobby: lempar-tangkap (toss), pantul ke lantai (dribble), lempar ke depan lalu dipanggil kembali (throw). Gerak dadunya diatur halaman lewat bc.hand. */
const TS_LOW={rArmS:-0.9,rElbow:-0.5,rWrist:0.3,rArmZ:-0.12,lArmS:0.3,lElbow:-0.3,lArmZ:0.2,lean:0.05,twist:0.1,headX:-0.1,headY:0,rLegT:-0.1,rKnee:0.15,lLegT:0.1,lKnee:0.1};
const TS_UP={rArmS:-2.7,rElbow:-0.2,rWrist:0.5,rArmZ:-0.2,lArmS:0.2,lElbow:-0.3,lArmZ:0.25,lean:-0.18,twist:0,headX:-0.35,headY:0,rLegT:-0.2,rKnee:0.2,lLegT:0.15,lKnee:0.1};
const DR_LOW={rArmS:-0.35,rElbow:-0.3,rWrist:0.4,rArmZ:-0.1,lArmS:0.2,lElbow:-0.4,lArmZ:0.25,lean:0.3,twist:0.05,headX:0.35,headY:0,rLegT:-0.35,rKnee:0.55,lLegT:0.25,lKnee:0.35};
const DR_HI={rArmS:-0.8,rElbow:-0.45,rWrist:0.3,rArmZ:-0.1,lArmS:0.2,lElbow:-0.4,lArmZ:0.25,lean:0.22,twist:0.05,headX:0.3,headY:0,rLegT:-0.3,rKnee:0.45,lLegT:0.2,lKnee:0.3};
/* Memanah (aksi 'bow'): badan berputar menyamping (twist -90 derajat) sehingga kedua lengan sejajar garis bahu = arah panah = arah hadap pion; tangan kiri memegang busur, tangan kanan menarik tali ke dagu lalu melepas. BOW0 = siap bidik, BOW1 = tarik penuh. Bidik ke atas = badan condong ke belakang (lean). */
const BOW0={rArmS:-0.3,rElbow:-0.6,rWrist:0,rArmZ:-1.2,lArmS:0,lElbow:0,lArmZ:1.45,lean:0,twist:-1.5708,headX:0,headY:0.47,rLegT:-0.3,rKnee:0.15,lLegT:0.3,lKnee:0.1,cape:0.3,tail:0.4};
const BOW1={rArmS:-1.2,rElbow:-2.8,rWrist:0,rArmZ:-0.5,lArmS:0,lElbow:0,lArmZ:1.45,lean:0,twist:-1.5708,headX:0,headY:0.47,rLegT:-0.3,rKnee:0.15,lLegT:0.3,lKnee:0.1,cape:0.3,tail:0.4};
const BOW_REL=0.74; /* saat tali dilepas (bagian dari durasi aksi) */
const ACT_STATIC={block:ACT_B,sad:ACT_SAD,cheer:ACT_CHEER,wave:ACT_WAVE};
const ACT_DUR={spinball:3.0,toss:3.0,dribble:2.4,throw:2.6,mine:0.85,attack:0.75,bow:1.2,block:1.0,sad:1.6,cheer:2.4,wave:2.0,flip:0.7,backflip:0.7,spin:0.7,roll:0.75};
const ROLL_PY=0.8,ROLL_LIFT=0.3; /* guling di lantai: poros tubuh & angkatan kecil agar badan tidak menembus lantai */
let strikeN=0; /* jumlah hantaman beliung (aksi 'mine') — dibaca halaman untuk percikan batu */
const ACT_AIR={flip:1,backflip:1,spin:1}; /* aksi yang melompat dulu (salto/putar di udara) */
const fx={rx:0,ry:0,py:1,lift:0}; /* rotasi badan utuh dari aksi: rx = salto (+ ke depan), ry = putar; py = tinggi poros (satuan lokal) */
let act=null,bowAim=0; /* bowAim = sudut bidik ke atas (rad), diatur pemanggil sebelum act('bow') */
const shield=new THREE.Group();shield.visible=false;
(function(){ /* perisai kayu berbingkai besi di ujung lengan bawah kiri (normal = arah lengan bawah, yang menghadap depan saat siku ditekuk) */
  const L=(w,h,d,c,y)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w*S,h*S,d*S),new THREE.MeshLambertMaterial({color:c}));m.position.y=y*S;shield.add(m);};
  L(11,1.6,13,0x8a8f98,-7);L(9,1.9,11,0x8a5a2b,-7.2);L(3,2.4,3,0xc9ced6,-7.5);L(9,2.0,1.4,0x6a4220,-7.25);
  armL.el.add(shield);
})();
/* Busur kayu bergaya blok di tangan kiri: batang melintang di atas-bawah saat lengan lurus ke depan, perut busur ke depan, tali + anak panah ikut ditarik */
const bowG=new THREE.Group(),arrowG=new THREE.Group(),bowStr=[];
(function(){
  const WD=solid(0x7a4a22),WD2=solid(0x5a3516),ST=solid(0xece6d4);
  bowG.visible=false;arrowG.visible=false;bowG.position.y=-5.5*S;bowG.rotation.y=Math.PI/2; /* batang busur tegak saat lengan lurus ke samping */
  bowG.add(box(2.4,2.4,4,solid(0x3a2a1a),0,0,0));
  [1,-1].forEach(sd=>{
    bowG.add(box(1.6,1.6,4.6,WD,0,-1.0,sd*4.3));
    bowG.add(box(1.5,1.5,4,WD2,0,0.2,sd*8.2));
    bowG.add(box(1.4,1.4,2.6,WD,0,1.6,sd*11.3));
    const sg=box(0.5,0.5,1,ST,0,0,0);bowG.add(sg);bowStr.push(sg);
  });
  arrowG.add(box(0.6,24,0.6,solid(0xc9a56a),0,-12,0));
  arrowG.add(box(1.7,2.4,1.7,solid(0x8a8f98),0,-25.2,0));
  arrowG.add(box(0.3,3.2,2.4,solid(0xf1f1f1),0,-1.8,0));arrowG.add(box(2.4,3.2,0.3,solid(0xf1f1f1),0,-1.8,0)); /* bulu pengarah silang */
  bowG.add(arrowG);armL.el.add(bowG);
})();
const _bv=new THREE.Vector3();
function bowDraw(ny,nz){ /* tali dua segmen dari ujung busur ke titik pasang panah (ny,nz dalam px, koordinat busur); anak panah ikut di titik itu */
  const ty=1.6;
  bowStr.forEach((sg,i)=>{const sd=i?-1:1,dy=ny-ty,dz=nz-sd*11.3,len=Math.hypot(dy,dz);
    sg.scale.z=len;sg.position.set(0,((ty+ny)/2)*S,((sd*11.3+nz)/2)*S);sg.rotation.x=Math.atan2(-dy,dz);});
  arrowG.position.set(0,ny*S,nz*S);
}
function bowFollow(){ /* dipanggil setelah pose diterapkan: titik pasang panah mengikuti TANGAN KANAN (tali tertarik ke tangan); setelah lepas, tali bergetar lalu diam */
  const u=act.t/act.dur;let ny=1.6,nz=0;
  if(u<BOW_REL){root.updateMatrixWorld(true);hand.getWorldPosition(_bv);bowG.worldToLocal(_bv);ny=clamp(_bv.y/S,1.6,30);nz=clamp(_bv.z/S,-3,3);}
  else{const r=(u-BOW_REL)*act.dur;ny=1.6+Math.sin(r*60)*1.4*Math.exp(-r*14);}
  bowDraw(ny,nz);
}
bowDraw(1.6,0);
const ease3=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
function doAct(type,dur){
  if(!ACT_DUR[type])return;
  if(ACT_AIR[type]){if(airborne)return;airborne=true;vy=8.3;} /* salto/putar butuh lompatan sendiri; sedang di udara = diabaikan */
  act={type:type,t:0,dur:dur||ACT_DUR[type]};shield.visible=(type==='block');bowG.visible=(type==='bow');if(type!=='bow')arrowG.visible=false;if(wpg)wpg.visible=(type!=='bow'); /* memanah: senjata tangan kanan disembunyikan */
}
function applyAct(T,dt){
  if(!act)return;
  act.t+=dt;const u=act.t/act.dur;
  if(u>=1){act=null;shield.visible=false;bowG.visible=false;arrowG.visible=false;if(wpg)wpg.visible=true;return;}
  let w,pose={};
  if(act.type==='flip'||act.type==='backflip'||act.type==='spin'||act.type==='roll'){
    const e=ease3(u),turn=Math.PI*2*e;
    if(act.type==='spin')fx.ry=turn;
    else{fx.rx=act.type==='backflip'?-turn:turn;fx.py=act.type==='roll'?ROLL_PY:1;if(act.type==='roll')fx.lift=ROLL_LIFT*Math.sin(Math.PI*u);}
    if(act.type==='spin'){w=0;pose={};} /* putar: pose lompat bawaan, tanpa tuck */
    else{w=ease3(Math.min(1,u/0.25))*(1-ease3(clamp((u-0.75)/0.25,0,1)));pose=Object.assign({},ACT_TUCK);}
  }else if(act.type==='mine'){
    let m;
    if(u<0.3)m=0;else if(u<0.42)m=ease3((u-0.3)/0.12);else if(u<0.6)m=1;else m=1-ease3((u-0.6)/0.4);
    if(!act.hit&&u>=0.4){act.hit=true;strikeN++;}
    w=1;for(const k in ACT_MU)pose[k]=lerp(ACT_MU[k],ACT_MH[k],m);
  }else if(act.type==='attack'){
    let m;
    if(u<0.4){m=0;w=ease3(u/0.4);}else if(u<0.55){m=(u-0.4)/0.15;w=1;}else{m=1;w=1-ease3((u-0.55)/0.45);}
    for(const k in ACT_W)pose[k]=lerp(ACT_W[k],ACT_S[k],m);
  }else if(act.type==='bow'){
    const m=u<0.22?0:u<0.66?ease3((u-0.22)/0.44):u<BOW_REL?1:1-ease3((u-BOW_REL)/0.08); /* siap -> tarik -> tahan -> lepas (tali menjepret balik) */
    w=ease3(Math.min(1,u/0.2))*(1-ease3(clamp((u-0.88)/0.12,0,1)));
    for(const k in BOW0)pose[k]=lerp(BOW0[k],BOW1[k],m);
    pose.lean=-bowAim;pose.headX=-bowAim*0.6; /* bidik ke atas: badan condong ke belakang, kepala mengikuti arah panah */
    pose.lean+=(u>=BOW_REL&&u<BOW_REL+0.06)?0.1:0; /* sentak kecil saat melepas */
    arrowG.visible=(u<BOW_REL);
  }else if(act.type==='toss'){
    const c=act.t%1,a=c<0.22?ease3(c/0.22):1-0.75*ease3((c-0.22)/0.78);
    w=Math.min(1,act.t/0.15)*Math.min(1,(act.dur-act.t)/0.15);
    for(const k in TS_LOW)pose[k]=lerp(TS_LOW[k],TS_UP[k],a);
  }else if(act.type==='spinball'){
    w=Math.min(1,act.t/0.35)*Math.min(1,(act.dur-act.t)/0.3);
    for(const k in TS_UP)pose[k]=TS_UP[k];pose.rArmS=-2.45;pose.rWrist=0.9;pose.rArmZ=-0.3+Math.sin(act.t*2.2)*0.05; /* lengan terangkat, dadu berputar di atas telapak */
  }else if(act.type==='dribble'){
    const a=Math.abs(Math.cos(Math.PI*((act.t%0.6)/0.6)));
    w=Math.min(1,act.t/0.2)*Math.min(1,(act.dur-act.t)/0.2);
    for(const k in DR_LOW)pose[k]=lerp(DR_LOW[k],DR_HI[k],a);
  }else if(act.type==='throw'){
    const t=act.t,m=clamp((t-0.5)/0.15,0,1);
    w=Math.min(1,t/0.4)*(t<1.7?1:1-ease3((t-1.7)/0.8));
    for(const k in ACT_W)pose[k]=lerp(ACT_W[k],ACT_S[k],m);
  }else{
    w=Math.min(1,u/0.12)*Math.min(1,(1-u)/0.2);
    pose=Object.assign({},ACT_STATIC[act.type]);
    if(act.type==='block')pose.lean+=Math.sin(act.t*38)*0.05*Math.max(0,1-u*2); /* getar sesaat saat kena */
    else if(act.type==='sad')pose.headY=Math.sin(act.t*3)*0.25; /* menggeleng pelan */
    else if(act.type==='wave')pose.rElbow=-0.4+Math.sin(act.t*11)*0.55; /* lengan bawah melambai */
    else pose.rArmZ+=Math.sin(act.t*9)*0.12,pose.lArmZ-=Math.sin(act.t*9)*0.12; /* lengan melambai saat bersorak */
  }
  for(const k in pose)T[k]=lerp(T[k],pose[k],w);
}
/* ---- API (loop & loadCfg disalin dari bagian 12 karakter.html) ---- */
function tick(dt){
  dt=Math.min(Math.max(dt,0),0.05);time+=dt;
  const tl=mode==='walk'?1:(mode==='run'?2:0);
  level+=(tl-level)*(1-Math.exp(-dt*7));
  phase+=dt*(6.5+4.5*clamp(level-1,0,1));
  if(airborne){vy-=22*dt;jumpY+=vy*dt;if(jumpY<=0){jumpY=0;vy=0;airborne=false;landT=0.25;}}
  if(landT>0)landT-=dt;
  const k=1-Math.exp(-dt*(airborne?26:12));
  fx.rx=0;fx.ry=0;fx.py=1;fx.lift=0;
  const T=computeTarget();applyAct(T,dt);
  for(const key in T)P[key]+=(T[key]-P[key])*k;
  applyRig();
  applyFx();blinkStep(dt);
  if(act&&act.type==='bow')bowFollow();
}
/* Rotasi badan utuh (salto/guling/putar) mengelilingi titik tengah badan: posisi dikompensasi agar poros tetap di tempat. */
function applyFx(){
  root.rotation.set(fx.rx,fx.ry,0);
  if(fx.rx!==0){const p=fx.py*root.scale.y;root.position.y+=p*(1-Math.cos(fx.rx))+fx.lift*root.scale.y;root.position.z=-p*Math.sin(fx.rx);}
  else root.position.z=0;
}
function jump(){if(!airborne){airborne=true;vy=7.2;}}
function setMode(m){mode=m;}
/* Tampilan siap pakai (preset gear + gaya rambut/kulit bervariasi) untuk pemain lain/CPU: n bilangan bulat, deterministik. */
function loadPreset(n){
  n=Math.abs(n|0);const p=PRESETS[n%PRESETS.length],f=p.g==='f';
  const hairs=f?['bob','long','pony','twin','bun','braid','wavy']:['short','spiky','buzz'],dyes=['brown','black','blonde','red','brown'];
  const o={gender:p.g,skin:'s'+(1+(n*2)%5),eyes:{id:f?'lash':'round',dye:'blue'},hair:{id:hairs[n%hairs.length],dye:dyes[n%dyes.length]}};
  Object.assign(o,clone(p.set));
  cfg=clone(DEFAULT);apply(o,true);
}
function loadLook(L,G){
  if(!L){cfg=clone(DEFAULT);apply(null,true);return;}
  const o={gender:L.gender,skin:L.skin,eyes:L.eyes,hair:L.hair,body:L.body,accessories:[]};
  ['top','legs','boots','helm','chest','shoulder','cape','weapon'].forEach(k=>{
    const g=G['g.'+k],ci=g&&IC.byId(g.id);
    o[k]=ci?{id:ci.gameKey,dye:g.dye||undefined}:{id:'none'};
  });
  ACCS.forEach(a=>{const g=G['g.acc.'+a.id];if(g)o.accessories.push({id:a.id,dye:g.dye||undefined});});
  cfg=clone(DEFAULT);apply(o,true);
}
function loadFromPlayer(){loadLook(PD.look(),PD.gearLook());}
/* Tampilan pemain lain dari server (AppearanceService.roomAppearance): look + equipped {slot:itemId} + gearDye {itemId:warna}. */
function loadFromData(look,equipped,gearDye){
  const G={},eq=equipped||{},gd=gearDye||{};
  for(const k in eq){if(k.indexOf('g.')===0&&eq[k])G[k]={id:eq[k],dye:gd[eq[k]]||null};}
  try{loadLook(look||null,G);}catch(e){cfg=clone(DEFAULT);apply(null,true);}
}
apply(null,true);
return{root:root,hand:hand,tick:tick,jump:jump,setMode:setMode,act:doAct,setTool:setTool,bow:bowG,arrow:arrowG,bowReleaseAt:function(dur){return BOW_REL*(dur||ACT_DUR.bow);},setBowAim:function(v){bowAim=clamp(+v||0,0,1.1);},get strikes(){return strikeN;},loadFromPlayer:loadFromPlayer,loadFromData:loadFromData,loadPreset:loadPreset,presetCount:PRESETS.length,apply:apply,
  get acting(){return act?act.type:null;},
  get config(){return clone(cfg);},get airborne(){return airborne;},
  height:function(){return 2*root.scale.y;}};
}};
})();
