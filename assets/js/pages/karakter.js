/* karakter.js — dipindah dari <script> inline (karakter.html). */
(function(){
if(typeof THREE==='undefined'||!window.ItemCatalog||!window.PlayerData){document.body.insertAdjacentHTML('beforeend','<p style="padding:20px;font:16px sans-serif">Halaman karakter gagal dimuat. Muat ulang halaman.</p>');return;}

/* ================================================================
   1. UTIL
   ================================================================ */
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

/* ================================================================
   2. SCENE
   ================================================================ */
const scene=new THREE.Scene();
const cv=document.getElementById('gl'),showEl=document.getElementById('show');
const camera=new THREE.PerspectiveCamera(40,1,0.1,200);
const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true});
renderer.setClearColor(0x000000,0);
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
scene.add(new THREE.HemisphereLight(0xffffff,0xcfcfcf,0.85));
const sun=new THREE.DirectionalLight(0xfff0d0,0.55);
sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-9;sun.shadow.camera.right=9;sun.shadow.camera.top=9;sun.shadow.camera.bottom=-9;
sun.shadow.camera.near=1;sun.shadow.camera.far=40;
sun.shadow.bias=-0.0006;
sun.position.set(0,14,0.01);
scene.add(sun);scene.add(sun.target);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.ShadowMaterial({opacity:0.3}));
ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);

/* ================================================================
   3. DATA: warna (dye) & opsi dasar
   ================================================================ */
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

/* ================================================================
   4. RIG (dibuat sekali, tidak pernah dibangun ulang)
   ================================================================ */
const root=new THREE.Group();scene.add(root);
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

/* ================================================================
   5. SLOT: setiap kategori punya daftar mesh sendiri -> bisa dibangun ulang sendiri
   ================================================================ */
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

/* ================================================================
   6. KATALOG ITEM (semua data, tanpa warna/tekstur di logika build)
   ================================================================ */
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

/* ================================================================
   7. CONFIG (satu-satunya sumber kebenaran; bisa disimpan sebagai JSON)
   ================================================================ */
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

/* ================================================================
   8. BUILDER per slot
   ================================================================ */
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

/* ================================================================
   9. POSE & ANIMASI (rig yang sama untuk semua kombinasi item)
   ================================================================ */
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
  const w=clamp(level,0,1),ra=clamp(level-1,0,1);
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
  cape1.rotation.x=P.cape;
  cape2.rotation.x=P.cape*0.6;
  tails.forEach(g=>{g.rotation.x=0.2+P.tail*0.5;g.rotation.z=0;});
  if(torsoMesh)torsoMesh.scale.y=1;
  hips.position.y=1.5;
  root.position.y=0;
}

/* ================================================================
   10. UI
   ================================================================ */

/* ================================================================
   10a. THUMBNAIL ASLI: setiap kartu menampilkan render 3D sebenarnya dari item tsb
   (rig yang sama, pose netral, kamera dekat). Dibuat bertahap per frame & di-cache.
   ================================================================ */
const THUMB={
  ready:false,cache:new Map(),queue:[],epoch:0,busy:false,
  FR:{full:{y:1.0,d:4.7,yaw:.5,pit:.12},bust:{y:1.3,d:3.0,yaw:.45,pit:.1},head:{y:1.75,d:2.1,yaw:.5,pit:.1},eyes:{y:1.75,d:1.35,yaw:.3,pit:.05},
      legs:{y:.4,d:1.95,yaw:.5,pit:.1},boots:{y:.2,d:1.35,yaw:.55,pit:.15},back:{y:1.0,d:4.7,yaw:Math.PI+.5,pit:.12}},
  init(){
    if(this.ready)return true;
    try{
      const r=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
      r.setSize(160,160);r.setPixelRatio(1);r.setClearColor(0x000000,0);
      this.r=r;this.cam=new THREE.PerspectiveCamera(30,1,0.1,60);this.ready=true;
    }catch(e){this.ready=false;}
    return this.ready;
  },
  sig(omit){const o=clone(cfg);omit.forEach(k=>delete o[k]);return JSON.stringify(o);},
  setCfg(n){ /* ganti cfg tanpa listeners (tidak menyentuh PlayerData / UI), bangun ulang hanya slot yang berbeda */
    const old=cfg;cfg=n;
    const need={};
    for(const k in KEYMAP){if(JSON.stringify(old[k])!==JSON.stringify(cfg[k]))KEYMAP[k].forEach(s=>need[s]=1);}
    ORDER.forEach(s=>{if(need[s])BUILD[s]();});
    const fm=cfg.gender==='f';
    root.scale.set(cfg.body.build*(fm?0.95:1),cfg.body.height*(fm?0.97:1),cfg.body.build*(fm?0.95:1));
  },
  shoot(job){
    const saved=clone(cfg),keep={P:Object.assign({},P),mode,level,phase,time,airborne,jumpY,vy,landT};
    let url='';
    const pa=previewAll;previewAll=true;
    try{
      const keepCfg=cfg;cfg=clone(saved);
      merge(cfg,job.part(saved));normalize();
      const m=cfg;cfg=keepCfg;
      this.setCfg(m);
      mode='idle';level=0;airborne=false;jumpY=0;landT=0;time=0;Object.assign(P,computeTarget());applyRig();
      const f=this.FR[job.fr]||this.FR.full,c=this.cam,t=f.y*cfg.body.height;
      c.position.set(Math.sin(f.yaw)*Math.cos(f.pit)*f.d,t+Math.sin(f.pit)*f.d,Math.cos(f.yaw)*Math.cos(f.pit)*f.d);
      c.lookAt(0,t,0);
      const gv=ground.visible;ground.visible=false;
      this.r.render(scene,c);
      ground.visible=gv;
      url=this.r.domElement.toDataURL('image/png');
    }catch(e){url='';}
    previewAll=pa;
    try{this.setCfg(saved);}catch(e){cfg=saved;}
    Object.assign(P,keep.P);mode=keep.mode;level=keep.level;phase=keep.phase;time=keep.time;airborne=keep.airborne;jumpY=keep.jumpY;vy=keep.vy;landT=keep.landT;
    applyRig();
    return typeof url==='string'&&url.length>30?url:'';
  },
  put(el,url){
    if(!el||!el.isConnected||!url)return;
    const old=el.querySelector('img');if(old)old.remove();
    const im=new Image();im.className='thimg';im.alt='';im.draggable=false;im.src=url;
    im.addEventListener('load',()=>el.classList.add('ph'));
    el.appendChild(im);
  },
  add(el,key,part,fr){
    if(this.cache.has(key)){const u=this.cache.get(key);Promise.resolve().then(()=>this.put(el,u));return;} /* ditunda: kartu baru ditempel ke DOM setelah card() selesai */
    if(!this.init())return;
    this.queue.push({el,key,part,fr,epoch:this.epoch});
    this.pump();
  },
  reset(){this.epoch++;this.queue=this.queue.filter(j=>j.epoch===this.epoch);},
  pump(){
    if(this.busy||!this.queue.length)return;
    this.busy=true;
    requestAnimationFrame(()=>{
      this.busy=false;
      const t0=performance.now();let n=0;
      while(this.queue.length&&n<3&&performance.now()-t0<12){
        const j=this.queue.shift();
        if(j.epoch!==this.epoch||!j.el.isConnected)continue;
        const url=this.shoot(j);n++;
        if(url){
          if(this.cache.size>400)this.cache.delete(this.cache.keys().next().value);
          this.cache.set(j.key,url);this.put(j.el,url);
        }
      }
      this.pump();
    });
  }
};
function jump(){if(!airborne){airborne=true;vy=7.2;}}
const $=s=>document.querySelector(s);
const fmt=n=>(n||0).toLocaleString('id-ID');
const fmtPrice=n=>n>=100000?Math.round(n/1000)+'k':n>=1000?(n/1000).toLocaleString('id-ID',{maximumFractionDigits:1})+'k':fmt(n);
$('#back').addEventListener('click',()=>{location.href='lobby.html';});
$('#rnd').addEventListener('click',()=>{endPreview();randomize();});
$('#shp').addEventListener('click',()=>{location.href='shop.html';});
$('#cur-em').addEventListener('click',()=>{location.href='tambang.html?from=karakter.html'});$('#cur-co').addEventListener('click',()=>{location.href='shop.html?coin=1'});
function setMode(m){mode=m;}
function renderCurrency(){try{$('#v-em').textContent=(PD.walletReady()?fmt(PD.gems()):'—');$('#v-co').textContent=(PD.walletReady()?fmt(PD.coins()):'—');}catch(e){}}
try{if(!window.__curSub){window.__curSub=1;PD.subscribe(r=>{if(r==='server-wallet'||r==='storage'||r==='pageshow')try{renderCurrency()}catch(e){}})}}catch(e){} /* Tahap 6d: saldo tampil '—' sampai server membalas, lalu otomatis diperbarui */
renderCurrency();
try{UT.Events.on('currencyChanged',renderCurrency);}catch(e){}

const CATS=[
  {key:'gender',label:'⚧ Gender',type:'gender'},
  {key:'skin',label:'🎨 Kulit',type:'skin'},
  {key:'eyes',label:'👁️ Mata',reg:'eyes',keepDye:true},
  {key:'hair',label:'💇 Rambut',reg:'hair',keepDye:true},
  {key:'top',label:'👕 Baju',reg:'top'},
  {key:'legs',label:'👖 Celana',reg:'legs'},
  {key:'boots',label:'👢 Sepatu',reg:'boots'},
  {key:'helm',label:'⛑️ Kepala',reg:'helm'},
  {key:'chest',label:'🛡️ Zirah',reg:'chest'},
  {key:'shoulder',label:'🦾 Bahu',reg:'shoulder'},
  {key:'cape',label:'🧣 Jubah',reg:'cape'},
  {key:'weapon',label:'⚔️ Senjata',reg:'weapon'},
  {key:'accessories',label:'🎒 Aksesori',type:'multi'},
  {key:'body',label:'📏 Tubuh',type:'body'},
  {key:'preset',label:'🎭 Set',type:'preset'}
];
CATS.forEach(c=>{const i=c.label.indexOf(' ');c.ico=c.label.slice(0,i);c.name=c.label.slice(i+1);});
let cat=0,accSel=null,eqSel=null; /* eqSel: slot "sedang dipakai" yang dipilih (kolom kiri) */
const FRAME={eyes:'eyes',hair:'head',top:'bust',legs:'legs',boots:'boots',helm:'head',chest:'bust',shoulder:'bust',cape:'back',weapon:'full'};
const tabsEl=$('#tabs'),optsEl=$('#grid'),dyesEl=$('#dyes'),toastEl=$('#toast');
let toastT=0;
function toast(t){toastEl.textContent=t;toastEl.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>toastEl.classList.remove('on'),1800);}
const hex=c=>'#'+('000000'+c.toString(16)).slice(-6);
const KOIN='assets/ng/komponen/hud/ikon-koin-emas.webp';
const BG={own:'own',owned:'owned',def:'',lock:'no'};
const CKSVG='<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const emo=e=>'<span class="em">'+e+'</span>';
const sq=c=>'<i class="sq" style="background:'+hex(c)+'"></i>';
/* kartu opsi gaya Inventory: {th, nm, on, lock, badge, bg, fn, i} */
function card(o){
  const d=document.createElement('div');
  d.className='card'+(o.on||o.sel?' sel':'')+(o.lock?' lk':'');
  d.tabIndex=0;d.setAttribute('role','button');d.setAttribute('aria-label',o.nm);
  d.style.animationDelay=Math.min(o.i||0,14)*22+'ms';
  d.innerHTML=(o.on?'<span class="ck">'+CKSVG+'</span>':'')+'<div class="th">'+o.th+'</div><span class="nm"></span>'+(o.badge?'<button class="bt"></button>':'');
  d.querySelector('.nm').textContent=o.nm;
  if(o.badge){
    const b=d.querySelector('.bt');b.textContent=o.badge;
    if(o.badgeHtml)b.innerHTML=o.badgeHtml;
    if(o.buttonLabel)b.setAttribute('aria-label',o.buttonLabel);
    if(o.bg)b.classList.add(o.bg);
    if(o.buttonDisabled)b.disabled=true;
    else if(o.buttonFn)b.addEventListener('click',e=>{e.stopPropagation();o.buttonFn();});
  }
  d.addEventListener('click',()=>{endPreview();o.fn();});
  d.addEventListener('keydown',e=>{if(e.key==='Enter'){endPreview();o.fn();}});
  if(o.tq)THUMB.add(d.querySelector('.th'),o.tq.key,o.tq.part,o.tq.fr);
  return d;
}
function dyeRow(it,cur,pick){
  if(!it||!it.dyes)return;
  const l=document.createElement('span');l.className='lbl';l.textContent='Warna';dyesEl.appendChild(l);
  DYES[it.dyes].forEach(d=>{
    const b=document.createElement('button');b.className='sw'+(d.id===cur?' on':'');
    b.style.background=hex(d.c);b.title=d.n;b.setAttribute('aria-label',d.n);
    b.addEventListener('click',()=>pick(d.id));dyesEl.appendChild(b);
  });
}
function needBuy(ci){toast(ci.name+' belum dimiliki - beli di Toko'+(ci.price>0?' ('+ci.price+' koin)':''));}
function randomize(){
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  const g=Math.random()<0.5?'m':'f',ok=i=>!i.g||i.g===g;
  const slot=(key,pNone)=>{
    const L=REG[key].filter(i=>ok(i)&&owned(key,i)),P=L.filter(i=>i.id!=='none'),it=(L[0].id==='none'&&(Math.random()<pNone||!P.length))?L[0]:pick(P);
    const o={id:it.id};if(it.dyes)o.dye=pick(DYES[it.dyes]).id;return o;
  };
  const accs=[];ACCS.filter(i=>ok(i)&&owned('acc',i)).forEach(a=>{if(Math.random()<0.3)accs.push({id:a.id,dye:pick(DYES[a.dyes]).id});});
  apply({gender:g,skin:pick(SKINS).id,eyes:slot('eyes'),hair:slot('hair'),top:slot('top'),legs:slot('legs'),boots:slot('boots'),
    helm:slot('helm',0.5),chest:slot('chest',0.6),shoulder:slot('shoulder',0.6),cape:slot('cape',0.5),weapon:slot('weapon',0.4),
    accessories:accs,body:{height:0.9+Math.random()*0.2,build:0.9+Math.random()*0.25}});
}
function exportCfg(){
  const s=JSON.stringify(cfg);
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(s).then(()=>toast('Config disalin'),()=>window.prompt('Salin config:',s));}
  else window.prompt('Salin config:',s);
}
function importCfg(){
  const s=window.prompt('Tempel config JSON:');
  if(!s)return;
  try{const o=JSON.parse(s);cfg=clone(DEFAULT);apply(o,true);toast('Config dimuat');}catch(e){toast('JSON tidak valid');}
}

function setInfo(name,desc){$('#irar').textContent=CATS[cat].name;$('#iname').textContent=name||'';$('#idesc').textContent=desc||'';}
function updateInfo(){
  const c=CATS[cat];
  if(eqSel&&!pv){setInfo(eqSel.name,'Sedang dipakai. Tekan Dipakai pada kartunya untuk melepas.');$('#irar').textContent=eqSel.cat;return;}
  if(pv&&pv.draft){setInfo(pv.name,'Pratinjau. Tekan tombol pada kartu untuk menerapkan pilihan; tanda centang menunjukkan yang sedang dipakai.');return;}
  if(pv&&pv.set){const ss=pv.set,sok=ss.cis.every(canSell),nm=ss.cis.map(x=>x.name).join(', ');
    setInfo(ss.n.replace(/^\S+\s/,'')+' (Set)',sok?ss.cis.length+' item belum dimiliki: '+nm+'. Beli semua untuk memakai set ini.':'Set ini berisi item yang tidak dijual ('+nm+'). Hanya preview.');return;}
  if(pv){setInfo(pv.ci.name,canSell(pv.ci)?'Belum dimiliki. Ini hanya preview, beli untuk memakainya.':'Belum dimiliki dan tidak dijual (hadiah/event). Hanya preview.');return;}
  if(c.type==='gender')setInfo(cfg.gender==='m'?'Laki-laki':'Perempuan','Pilih gender karakter. Pakaian menyesuaikan gender.');
  else if(c.type==='skin'){const s=SKINS.find(x=>x.id===cfg.skin);setInfo(s?s.n:'Warna kulit','Pilih warna kulit karakter.');}
  else if(c.type==='body')setInfo('Ukuran tubuh','Atur tinggi dan besar badan karakter.');
  else if(c.type==='preset')setInfo('Set siap pakai','Ketuk set untuk pratinjau. Tombol Beli menampilkan harga; Dimiliki untuk memakai.');
  else if(c.type==='multi')setInfo('Aksesori ('+cfg.accessories.length+' dipakai)','Beberapa aksesori boleh dipakai bersamaan. Tombol Beli menampilkan harga.');
  else{const it=find(c.reg,cfg[c.key].id);setInfo(it&&it.id!=='none'?it.n:'Tidak dipakai','Ketuk kartu untuk pratinjau. Tombol Dimiliki untuk memakai, Beli menampilkan harga.');}
}
/* ===== Preview item terkunci + beli dengan coin (menggantikan Toko untuk item karakter) ===== */
let pv=null; /* {saved, ci}: item belum dimiliki yang sedang dicoba; TIDAK disimpan ke PlayerData */
const SV=()=>{try{return PD.serverMode();}catch(e){return false;}},WS=()=>window.UT&&UT.WalletService&&UT.WalletService.get(),AS=()=>window.UT&&UT.AppearanceService&&UT.AppearanceService.get();
const WMSG={'saldo-kurang':'Coin tidak cukup.','sudah-dimiliki':'Item sudah dimiliki.','tidak-tersedia':'Item tidak tersedia.','jaringan':'Tidak dapat terhubung ke server.','belum-login':'Silakan login ulang.','sedang-diproses':'Sedang diproses...','terlalu-banyak':'Set terlalu besar.'};
const canSell=ci=>!!ci&&ci.price>0&&ci.source==='shop';
function startPreview(ci,part,set){
  endPreview();
  pv={saved:clone(cfg),ci:ci,set:set||null};previewAll=true;
  apply(part);
}
/* ===== Set: beli per set = total harga item yang belum dimiliki ===== */
const SLOTK=['top','legs','boots','helm','chest','shoulder','cape','weapon'];
function setParts(p){ /* item katalog tiap bagian set (selain 'none') */
  const out=[];
  SLOTK.forEach(k=>{const o=p.set[k];if(!o||o.id==='none')return;const ci=catItem(k,find(k,o.id));if(ci)out.push(ci);});
  (p.set.accessories||[]).forEach(a=>{const ci=catItem('acc',find('acc',a.id));if(ci)out.push(ci);});
  return out;
}
function setStatus(p){
  const miss=setParts(p).filter(ci=>!PD.owns(ci.id));
  return {miss:miss,total:miss.reduce((a,ci)=>a+(ci.price>0?ci.price:0),0),sellable:miss.every(canSell)};
}
const setOn=p=>{const c=pv?pv.saved:cfg;return SLOTK.every(k=>c[k].id===((p.set[k]||{id:'none'}).id))&&c.accessories.length===p.set.accessories.length&&p.set.accessories.every(a=>c.accessories.some(x=>x.id===a.id));};
function endPreview(){
  if(!pv)return;
  const s=pv.saved;pv=null;previewAll=false;
  cfg=clone(s);apply(null,true);
}
/* ===== Pratinjau pilihan (draft): diterapkan dari tombol status di kartu ===== */
const B=()=>pv?pv.saved:cfg; /* tampilan yang SEDANG DIPAKAI (tersimpan); tanda centang/"Dipakai" selalu dibaca dari sini */
function stage(key,name,part){
  if(!pv||!pv.draft){endPreview();pv={saved:clone(cfg),ci:null,set:null,draft:true};}
  pv.key=key;pv.name=name;previewAll=true;apply(part);
  if(pv&&pv.draft&&JSON.stringify(cfg)===JSON.stringify(pv.saved))endPreview(); /* kembali sama dengan yang dipakai = tidak ada pratinjau */
}
function stageGender(g){
  if(g===B().gender){if(pv&&pv.draft)endPreview();return;}
  if(cfg.gender===g)return;
  const o=clone(START[g]);o.hair.dye=cfg.hair.dye;o.eyes.dye=cfg.eyes.dye;o.skin=cfg.skin;o.body=clone(cfg.body);
  stage('g'+g,g==='m'?'Laki-laki':'Perempuan',o);
}
function commitDraft(){
  if(!(pv&&pv.draft))return;
  const keep=clone(cfg);pv=null;previewAll=false;cfg=keep;apply(null,true); /* apply -> syncToPD: baru sekarang disimpan */
  toast('Tampilan dipakai!');
}
const modal=$('#modal');let mOpen=false;
function openModal(html,init){$('#mb').innerHTML=html;modal.style.display='grid';requestAnimationFrame(()=>modal.classList.add('show'));mOpen=true;init&&init();}
function closeModal(){if(!mOpen)return;mOpen=false;modal.classList.add('closing');modal.classList.remove('show');setTimeout(()=>{modal.style.display='none';modal.classList.remove('closing');},250);}
$('#mx').addEventListener('click',closeModal);
modal.addEventListener('click',e=>{if(e.target===modal)closeModal();});
addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
function confirmBuy(ci){
  const coins=PD.coins(),ok=coins>=ci.price;
  openModal(ok
    ?'<h2>Konfirmasi</h2><p>Beli '+ci.name+'?</p><div class="row" style="justify-content:center;gap:.8rem;color:#ffe36a;font-size:2.8rem"><img src="assets/Images/icon/currency/coin.webp" alt="" style="width:3rem;height:3rem">'+fmt(ci.price)+'</div><button class="mb no" id="no">Batal</button><button class="mb" id="yes">Beli</button>'
    :'<h2>Coin tidak cukup</h2><p>Kamu butuh '+fmt(ci.price-coins)+' coin lagi.</p><button class="mb no" id="no">Batal</button><button class="mb" id="more">Dapatkan Coin</button>',
  ()=>{
    $('#no').addEventListener('click',closeModal);
    if(!ok){$('#more').addEventListener('click',()=>{location.href='shop.html';});return;}
    $('#yes').addEventListener('click',async()=>{
      const r=SV()?await WS().buy(ci.id):PD.purchase(ci.id);
      closeModal();
      if(!r||!r.ok){toast(WMSG[r&&r.reason]||'Pembelian gagal.');return;}
      /* sekarang dimiliki: pertahankan tampilan yang dicoba, lalu simpan & pakai lewat jalur normal */
      const keep=clone(cfg);pv=null;previewAll=false;cfg=keep;apply(null,true);
      renderCurrency();toast('Pembelian berhasil!');
    });
  });
}
function confirmBuySet(set){
  const coins=PD.coins(),ok=coins>=set.total,nm=set.n.replace(/^\S+\s/,'');
  const list=set.cis.map(c=>'<div class="row" style="justify-content:space-between;gap:.8rem;font-size:2rem;margin:.4rem 0"><span>'+c.name+'</span><span style="color:#ffe36a">'+fmt(c.price)+'</span></div>').join('');
  openModal(ok
    ?'<h2>Beli Set '+nm+'?</h2>'+list+'<div class="row" style="justify-content:center;gap:.8rem;color:#ffe36a;font-size:2.8rem"><span style="color:#fff">Total</span><img src="assets/Images/icon/currency/coin.webp" alt="" style="width:3rem;height:3rem">'+fmt(set.total)+'</div><button class="mb no" id="no">Batal</button><button class="mb" id="yes">Beli</button>'
    :'<h2>Coin tidak cukup</h2><p>Kamu butuh '+fmt(set.total-coins)+' coin lagi untuk set ini.</p><button class="mb no" id="no">Batal</button><button class="mb" id="more">Dapatkan Coin</button>',
  ()=>{
    $('#no').addEventListener('click',closeModal);
    if(!ok){$('#more').addEventListener('click',()=>{location.href='shop.html';});return;}
    $('#yes').addEventListener('click',async()=>{
      /* atomik: server (buy_set) / PlayerData.purchaseSet memotong koin sekali dan memberi SEMUA item, atau tidak sama sekali */
      const ids=set.cis.map(c=>c.id);
      const r=SV()?await WS().buySet(ids):PD.purchaseSet(ids);
      if(!r||!r.ok){
        closeModal();
        toast(WMSG[r&&r.reason]||'Pembelian gagal.');
        renderCurrency();endPreview();renderOpts();return;
      }
      closeModal();
      /* semua item sudah dimiliki: pertahankan tampilan set, lalu simpan & pakai lewat jalur normal */
      const keep=clone(cfg);pv=null;previewAll=false;cfg=keep;apply(null,true);
      renderCurrency();toast('Set berhasil dibeli dan dipakai!');
    });
  });
}
function slider(label,key,min,max){
  const w=document.createElement('div');w.className='slrow';
  const t=document.createElement('span');
  const r=document.createElement('input');r.type='range';r.min=min;r.max=max;r.step=0.01;r.value=cfg.body[key];
  const upd=()=>{t.textContent=label+' '+Math.round(cfg.body[key]*100)+'%';};
  r.addEventListener('input',()=>{apply({body:{[key]:+r.value}});upd();});
  upd();w.appendChild(t);w.appendChild(r);optsEl.appendChild(w);
}
/* Tab bergaya NewGUI; subkategori tetap tersedia untuk editor yang punya banyak bagian. */
const GROUPS=[
  {name:'Gender',ico:'⚧',keys:['gender']},
  {name:'Penampilan',ico:'🎨',keys:['skin','eyes','hair','body']},
  {name:'Outfit',ico:'👕',keys:['top','legs','helm','boots']},
  {name:'Aksesori',ico:'🎒',keys:['accessories']},
  {name:'Set',ico:'🎭',keys:['preset']}
];
const subsEl=$('#subs');
const slotTabs={chest:'Outfit',shoulder:'Outfit',cape:'Outfit',weapon:'Outfit'};
const grpOf=k=>GROUPS.findIndex(g=>g.keys.includes(k)||slotTabs[k]===g.name);
function goCat(k,keepSel){const i=CATS.findIndex(x=>x.key===k);if(i<0)return;endPreview();if(!keepSel)eqSel=null;cat=i;renderTabs();renderOpts();}
function renderTabs(){
  const gi=grpOf(CATS[cat].key),G=GROUPS[gi];
  tabsEl.innerHTML='';subsEl.innerHTML='';
  GROUPS.forEach((g,i)=>{
    const b=document.createElement('button');b.className='cat tab'+(i===gi?' on':'');
    b.innerHTML='<span class="ce"></span><span class="cl"></span><img class="ul" src="assets/ng/komponen/ikon-navigasi/garis-bawah-tab-emas.webp" alt="">';
    b.querySelector('.ce').textContent=g.ico;b.querySelector('.cl').textContent=g.name;
    b.setAttribute('aria-label',g.name);
    b.addEventListener('click',()=>{if(i!==gi||!g.keys.includes(CATS[cat].key))goCat(g.keys[0]);});
    tabsEl.appendChild(b);
  });
  subsEl.style.display=G.keys.length>1?'':'none';
  if(G.keys.length>1)G.keys.forEach(k=>{
    const c=CATS.find(x=>x.key===k),b=document.createElement('button');b.className='cat sub'+(c===CATS[cat]?' on':'');
    b.innerHTML='<span class="ce"></span><span class="cl"></span>';
    b.querySelector('.ce').textContent=c.ico;b.querySelector('.cl').textContent=c.name;
    b.setAttribute('aria-label',c.name);
    b.addEventListener('click',()=>{if(c!==CATS[cat])goCat(k);});
    subsEl.appendChild(b);
  });
}
function renderOpts(){
  optsEl.innerHTML='';dyesEl.innerHTML='';optsEl.classList.remove('flat');
  THUMB.reset();
  const c=CATS[cat];let n=0;
  if(c.type==='gender'){
    [['m','👨','Laki-laki'],['f','👩','Perempuan']].forEach(a=>{const on=B().gender===a[0];
      optsEl.appendChild(card({i:n++,th:emo(a[1]),nm:a[2],on:on,badge:on?'Dipakai':'Pilih',bg:on?BG.own:BG.def,buttonDisabled:on,buttonFn:()=>{stageGender(a[0]);commitDraft();},sel:!!(pv&&pv.draft&&pv.key==='g'+a[0]),fn:()=>stageGender(a[0]),
        tq:{key:'g|'+a[0]+JSON.stringify([cfg.skin,cfg.hair.dye,cfg.eyes.dye,cfg.body]),fr:'full',
          part:cur=>{if(cur.gender===a[0])return {};const o=clone(START[a[0]]);o.hair.dye=cur.hair.dye;o.eyes.dye=cur.eyes.dye;o.skin=cur.skin;o.body=clone(cur.body);return o;}}}));});
  }else if(c.type==='skin'){
    SKINS.forEach(s=>optsEl.appendChild(card({i:n++,th:sq(s.c),nm:s.n,on:s.id===cfg.skin,fn:()=>apply({skin:s.id}),
      tq:{key:'s|'+s.id+THUMB.sig(['skin']),fr:'bust',part:()=>({skin:s.id})}})));
  }else if(c.type==='body'){
    optsEl.classList.add('flat');
    slider('Tinggi','height',0.9,1.1);slider('Besar badan','build',0.9,1.15);
    const r=document.createElement('button');r.className='bt gd';r.textContent='Atur ulang';
    r.addEventListener('click',()=>{apply({body:{height:1,build:1}});renderOpts();});
    optsEl.appendChild(r);
  }else if(c.type==='preset'){
    const presetCard=p=>{
      const st=setStatus(p),lock=st.miss.length>0,on=!lock&&setOn(p);
      const part=clone(p.set),name=p.n.replace(/^\S+\s/,'');
      optsEl.appendChild(card({i:n++,th:emo(c.ico),nm:p.n,on:on,lock:lock,sel:!!(pv&&((pv.set&&pv.set.id===p.id)||(pv.draft&&pv.key==='p'+p.id))),
        badge:lock?(st.sellable?'Beli '+fmtPrice(st.total):'Tidak dijual'):on?'Dipakai':'Dimiliki',badgeHtml:lock&&st.sellable?'<img class="coin" src="'+KOIN+'" alt=""><span>'+fmtPrice(st.total)+'</span>':null,buttonLabel:lock&&st.sellable?'Beli '+fmtPrice(st.total)+' koin':null,bg:lock?(st.sellable?BG.def:BG.lock):(on?BG.own:BG.owned),
        buttonDisabled:(lock&&!st.sellable)||on,
        buttonFn:()=>{
          if(lock){if(!st.sellable)return;startPreview(st.miss[0],part,{id:p.id,n:p.n,cis:st.miss,total:st.total});confirmBuySet(pv.set);return;}
          stage('p'+p.id,name,part);commitDraft();
        },
        fn:()=>lock?startPreview(st.miss[0],clone(p.set),{id:p.id,n:p.n,cis:st.miss,total:st.total}):stage('p'+p.id,p.n.replace(/^\S+\s/,''),clone(p.set)),
        tq:{key:'p|'+p.g+p.id+JSON.stringify([cfg.skin,cfg.eyes,cfg.hair,cfg.body])+(p.outfit!=null?JSON.stringify(p.set):''),fr:'full',part:()=>clone(p.set)}}));
    };
    PRESETS.filter(p=>p.g===cfg.gender).forEach(presetCard);
    /* outfit pribadi: tampil di samping set bawaan (hanya yang sesuai gender), lalu kartu "Simpan tampilan" bila slot masih ada */
    const outs=PD.outfits();
    outs.filter(o=>o.data.gender===cfg.gender).forEach(o=>presetCard(outfitPreset(o)));
    if(outs.length<PD.outfitLimit)optsEl.appendChild(card({i:n++,th:emo('➕'),nm:'Simpan tampilan',badge:outs.length+'/'+PD.outfitLimit,bg:BG.def,fn:openSaveOutfit}));
  }else if(c.type==='multi'){
    ACCS.filter(okG).forEach(it=>{
      const on=B().accessories.some(a=>a.id===it.id),onD=cfg.accessories.some(a=>a.id===it.id),ci=catItem('acc',it),lock=!!ci&&!PD.owns(ci.id);
      optsEl.appendChild(card({i:n++,th:emo(c.ico),nm:it.n,on:on,lock:lock,sel:!!(pv&&((ci&&pv.ci===ci)||(pv.draft&&pv.key==='a'+it.id))),
        badge:lock?(canSell(ci)?'Beli '+fmtPrice(ci.price):'Tidak dijual'):on?'Dipakai':'Dimiliki',badgeHtml:lock&&canSell(ci)?'<img class="coin" src="'+KOIN+'" alt=""><span>'+fmtPrice(ci.price)+'</span>':null,buttonLabel:lock&&canSell(ci)?'Beli '+fmtPrice(ci.price)+' koin':null,bg:lock?(canSell(ci)?BG.def:BG.lock):(on?BG.own:BG.owned),
        buttonDisabled:lock&&!canSell(ci),
        buttonFn:()=>{
          if(lock){if(!canSell(ci))return;const part={accessories:cfg.accessories.concat([{id:it.id,dye:it.def}])};startPreview(ci,part);confirmBuy(ci);return;}
          if(on){const equipped=eqItems().acc.find(a=>a.id===it.id);if(equipped)unequip(equipped);return;}
          stage('a'+it.id,it.n,{accessories:onD?cfg.accessories.filter(a=>a.id!==it.id):cfg.accessories.concat([{id:it.id,dye:it.def}])});commitDraft();
        },
        fn:()=>{
          if(lock){startPreview(ci,{accessories:cfg.accessories.concat([{id:it.id,dye:it.def}])});return;}
          accSel=it.id;
          stage('a'+it.id,it.n,{accessories:onD?cfg.accessories.filter(a=>a.id!==it.id):cfg.accessories.concat([{id:it.id,dye:it.def}])});
        },
        tq:{key:'a|'+it.id+THUMB.sig([]),fr:'full',part:cur=>cur.accessories.some(a=>a.id===it.id)?{}:{accessories:cur.accessories.concat([{id:it.id,dye:it.def}])}}}));
    });
    const cur=cfg.accessories.find(a=>a.id===accSel);
    if(cur)dyeRow(find('acc',cur.id),cur.dye,id=>apply({accessories:cfg.accessories.map(a=>a.id===cur.id?{id:a.id,dye:id}:a)}));
  }else{
    const cur=cfg[c.key];
    REG[c.reg].filter(okG).forEach(it=>{
      const ci=catItem(c.reg,it),lock=!!ci&&!PD.owns(ci.id),on=it.id===B()[c.key].id;
      optsEl.appendChild(card({i:n++,th:emo(it.id==='none'?'🚫':c.ico),nm:it.n,on:on,lock:lock,sel:!!(pv&&((ci&&pv.ci===ci)||(pv.draft&&pv.key==='i'+c.key+it.id))),
        badge:lock?(canSell(ci)?'Beli '+fmtPrice(ci.price):'Tidak dijual'):on?'Dipakai':'Dimiliki',badgeHtml:lock&&canSell(ci)?'<img class="coin" src="'+KOIN+'" alt=""><span>'+fmtPrice(ci.price)+'</span>':null,buttonLabel:lock&&canSell(ci)?'Beli '+fmtPrice(ci.price)+' koin':null,bg:lock?(canSell(ci)?BG.def:BG.lock):(on?BG.own:BG.owned),
        buttonDisabled:(lock&&!canSell(ci))||(on&&(it.id==='none'||!['helm','chest','shoulder','cape','weapon','boots'].includes(c.key))),
        buttonFn:()=>{
          if(lock){if(!canSell(ci))return;const part={[c.key]:{id:it.id}};startPreview(ci,part);confirmBuy(ci);return;}
          if(on){const equipped=eqItems().main.find(a=>a.k===c.key&&a.id===it.id);if(equipped)unequip(equipped);return;}
          stage('i'+c.key+it.id,it.n,{[c.key]:{id:it.id}});commitDraft();
        },
        fn:()=>lock?startPreview(ci,{[c.key]:{id:it.id}}):stage('i'+c.key+it.id,it.n,{[c.key]:{id:it.id}}),
        tq:it.id==='none'?null:{key:c.key+'|'+it.id+'|'+(cur.dye||'')+THUMB.sig([c.key]),fr:FRAME[c.key]||'full',part:()=>({[c.key]:{id:it.id}})}}));
    });
    dyeRow(find(c.reg,cur.id),cur.dye,id=>apply({[c.key]:{dye:id}}));
  }
  $('#ofm').style.display=(c.type==='preset'&&PD.outfits().length)?'':'none';
  renderEq();
  updateInfo();
}
/* ===== Outfit pribadi (tersimpan di PlayerData; maks PD.outfitLimit slot) ===== */
const esc=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const OMSG={'slot-penuh':'Slot outfit penuh.','nama-kosong':'Nama tidak boleh kosong.','belum-dimiliki':'Ada item yang belum dimiliki.','gender-tidak-cocok':'Ada item yang tidak cocok untuk gender ini.','item-tidak-dikenal':'Ada item yang tidak dikenal.','data-tidak-valid':'Tampilan tidak valid.','tidak-ada':'Outfit tidak ditemukan.','gagal-simpan':'Gagal menyimpan.','jaringan':'Tidak dapat terhubung ke server.','belum-login':'Silakan login ulang.','sedang-diproses':'Sedang diproses...','server-mode':'Tidak dapat menyimpan.','slot-tidak-cocok':'Tampilan tidak valid.'};
/* akun server: lewat AppearanceService (server memvalidasi & menghitung); tamu/lokal: langsung PlayerData */
const outCall=(m,...a)=>{if(SV()){const s=AS();return s?s[m](...a):Promise.resolve({ok:false,reason:'jaringan'});}return Promise.resolve(PD[m](...a));};
/* outfit tersimpan -> bentuk set bawaan (id 'o<slot>'), supaya preview, harga, dan tombol beli memakai jalur set yang sama */
function outfitPreset(o){
  const set={accessories:clone(o.data.accessories)};
  SLOTK.forEach(k=>{set[k]=clone(o.data[k]);});
  return {id:'o'+o.slot,n:'💾 '+o.name,g:o.data.gender,set:gear(set),outfit:o.slot};
}
function curOutfitData(){
  const d={gender:cfg.gender,accessories:cfg.accessories.map(a=>({id:a.id,dye:a.dye}))};
  SLOTK.forEach(k=>{d[k]={id:cfg[k].id,dye:cfg[k].dye};});
  return d;
}
function nameBox(title,val,okLabel,onOk,onCancel){
  openModal('<h2>'+title+'</h2><input id="onm" type="text" maxlength="'+PD.outfitNameMax+'" autocomplete="off" value="'+esc(val)+'" style="width:100%;box-sizing:border-box;font:inherit;font-size:2.6rem;padding:.8rem 1.2rem;border-radius:1rem;border:.3rem solid #172033;margin:.8rem 0"><button class="mb no" id="no">Batal</button><button class="mb" id="yes">'+okLabel+'</button>',
  ()=>{
    const inp=$('#onm'),go=()=>onOk(inp.value);
    $('#no').addEventListener('click',onCancel||closeModal);
    $('#yes').addEventListener('click',go);
    inp.addEventListener('keydown',e=>{if(e.key==='Enter')go();});
    inp.focus();inp.select();
  });
}
function openSaveOutfit(){
  const used={};PD.outfits().forEach(o=>{used[o.slot]=1;});
  let s=0;while(used[s])s++;
  nameBox('Simpan Tampilan','Outfit '+(s+1),'Simpan',async nm=>{
    const r=await outCall('saveOutfit',nm,curOutfitData());
    if(!r.ok){toast(OMSG[r.reason]||'Gagal menyimpan.');return;}
    closeModal();renderOpts();toast('Tampilan disimpan.');
  });
}
function openManageOutfits(){
  const outs=PD.outfits();
  if(!outs.length){closeModal();renderOpts();return;}
  openModal('<h2>Kelola Outfit</h2>'+outs.map(o=>'<div class="row" style="justify-content:space-between;gap:.8rem;font-size:2.4rem;margin:.6rem 0"><span>'+esc(o.name)+'</span><span><button class="bt" data-ren="'+o.slot+'" style="width:auto;display:inline-flex;padding:0 1.2rem">✏️</button> <button class="bt no" data-del="'+o.slot+'" style="width:auto;display:inline-flex;padding:0 1.2rem">🗑️</button></span></div>').join('')+'<button class="mb" id="ok" style="width:98%">Selesai</button>',
  ()=>{
    $('#ok').addEventListener('click',()=>{closeModal();renderOpts();});
    $('#mb').querySelectorAll('[data-ren]').forEach(b=>b.addEventListener('click',()=>{
      const slot=+b.dataset.ren,o=PD.outfits().find(x=>x.slot===slot);if(!o)return;
      nameBox('Ganti Nama',o.name,'Simpan',async nm=>{
        const r=await outCall('renameOutfit',slot,nm);
        if(!r.ok){toast(OMSG[r.reason]||'Gagal menyimpan.');return;}
        openManageOutfits();
      },openManageOutfits);
    }));
    $('#mb').querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>{
      const slot=+b.dataset.del,o=PD.outfits().find(x=>x.slot===slot);if(!o)return;
      openModal('<h2>Hapus Outfit?</h2><p>'+esc(o.name)+' akan dihapus.</p><button class="mb no" id="no">Batal</button><button class="mb" id="yes">Hapus</button>',()=>{
        $('#no').addEventListener('click',openManageOutfits);
        $('#yes').addEventListener('click',async()=>{
          const r=await outCall('deleteOutfit',slot);
          if(!r.ok)toast(OMSG[r.reason]||'Gagal menghapus.');
          openManageOutfits();
        });
      });
    }));
  });
}
$('#ofm').addEventListener('click',()=>{endPreview();openManageOutfits();});
/* cfg -> PlayerData: hanya menulis yang berubah. Equip ditolak PlayerData bila item belum dimiliki. */
function syncToPD(){
  if(previewAll)return;
  try{
    PD.setLook({gender:cfg.gender,skin:cfg.skin,eyes:cfg.eyes,hair:cfg.hair,body:cfg.body});
    const G=PD.gearLook();
    const put=(slot,ci,dye)=>{
      if(!ci){if(G[slot])PD.unequip(slot);return;}
      if(!G[slot]||G[slot].id!==ci.id)PD.equip(ci.id);
      if(((G[slot]&&G[slot].id===ci.id&&G[slot].dye)||null)!==(dye||null))PD.setGearDye(ci.id,dye||null);
    };
    ['top','legs','boots','helm','chest','shoulder','cape','weapon'].forEach(k=>put('g.'+k,catItem(k,cfg[k]),cfg[k].dye));
    ACCS.forEach(a=>{const ci=catItem('acc',a);if(!ci)return;const on=cfg.accessories.find(x=>x.id===a.id);put('g.acc.'+a.id,on?ci:null,on&&on.dye);});
  }catch(e){}
}
listeners.push(()=>{
  if(CATS[cat].type!=='body')renderOpts();
  syncToPD();
});

/* ================================================================
   SLOT EQUIPMENT DI KIRI DAN AKSESORI DI KANAN KARAKTER
   Enam slot equipment tetap; kolom aksesori menampilkan enam slot dan
   mengarahkan ke tab aksesori bila item yang dipakai melebihi kapasitas.
   ================================================================ */
const EQK=['helm','chest','shoulder','cape','weapon','boots'];
function eqItems(){
  const c=B(),main=[],acc=[];
  EQK.forEach(k=>{const cc=CATS.find(x=>x.key===k),o=c[k],it=(o&&o.id!=='none')?find(k,o.id):null;
    main.push(it&&it.id!=='none'?{k:k,id:it.id,name:it.n,cat:cc.name,ico:cc.ico,dye:o.dye||'',acc:false,empty:false}:{k:k,cat:cc.name,ico:cc.ico,empty:true});});
  (c.accessories||[]).forEach(a=>{const it=find('acc',a.id);if(!it)return;acc.push({k:'acc',id:it.id,name:it.n,cat:'Aksesori',ico:'🎒',dye:a.dye||'',acc:true,empty:false});});
  return {main:main,acc:acc};
}
const sameEq=(a,b)=>!!a&&!!b&&!a.empty&&!b.empty&&a.k===b.k&&a.id===b.id;
function eqSlot(it,compact){
  const d=document.createElement('button');
  d.className='eq'+(compact?' compact':'')+(it.empty?' empty':'')+(sameEq(it,eqSel)?' sel':'');
  d.setAttribute('aria-label',it.empty?(it.acc?'Aksesori kosong':it.cat+' kosong'):it.cat+': '+it.name+'. Klik untuk memilih, lalu tekan Dipakai pada kartu untuk melepas.');
  d.title=it.empty?(it.acc?'Aksesori kosong':it.cat+' kosong'):it.name+' — klik untuk memilih, lalu tekan Dipakai pada kartu untuk melepas';
  d.innerHTML='<div class="th"><span class="em">'+it.ico+'</span></div><span class="en"></span>';
  d.querySelector('.en').textContent=it.empty?(it.acc?'Aksesori':it.cat):it.name;
  d.addEventListener('click',()=>{
    endPreview();
    if(it.empty){goCat(it.acc?'accessories':it.k);return;}   /* slot kosong -> buka tab kategorinya */
    if(sameEq(it,eqSel)){eqSel=null;renderEq();updateInfo();return;}
    eqSel=it;goCat(it.acc?'accessories':it.k,true);          /* slot terisi -> buka kategorinya untuk melepas dari kartu */
  });
  if(!it.empty){
    const th=d.querySelector('.th');
    if(it.acc)THUMB.add(th,'a|'+it.id+THUMB.sig([]),cur=>cur.accessories.some(a=>a.id===it.id)?{}:{accessories:cur.accessories.concat([{id:it.id,dye:it.dye}])},'full');
    else THUMB.add(th,it.k+'|'+it.id+'|'+it.dye+THUMB.sig([it.k]),()=>({[it.k]:{id:it.id}}),FRAME[it.k]||'full');
  }
  return d;
}
function renderEq(){
  const el=$('#eqL'),ea=$('#eqR'),extra=$('#extraAcc'),info=$('#info');if(!el||!ea||!extra||!info)return;
  const E=eqItems(),all=E.main.filter(x=>!x.empty).concat(E.acc);
  if(eqSel){eqSel=all.find(x=>sameEq(x,eqSel))||null;} /* item sudah tidak dipakai (diganti/dilepas) -> pilihan dibatalkan */
  el.innerHTML='';ea.innerHTML='';extra.innerHTML='';
  E.main.slice(0,4).forEach(it=>el.appendChild(eqSlot(it)));
  const right=E.main.slice(4).concat(E.acc.slice(0,2));
  while(right.length<4)right.push({empty:true,k:'acc',cat:'Aksesori',ico:'🎒',acc:true});
  right.forEach(it=>ea.appendChild(eqSlot(it)));
  E.acc.slice(2).forEach(it=>extra.appendChild(eqSlot(it,true)));
  info.classList.toggle('hasextras',E.acc.length>2);
}
function unequip(it){
  endPreview();
  if(it.acc)apply({accessories:cfg.accessories.filter(a=>a.id!==it.id)});
  else apply({[it.k]:{id:'none'}});   /* apply -> listeners -> syncToPD: tersimpan seperti ganti item biasa */
  eqSel=null;renderEq();updateInfo();
  toast(it.name+' dilepas');
}
renderTabs();

/* ================================================================
   11. KAMERA
   ================================================================ */
/* camDist dikunci 3.6 (= 5.4/1.5 -> karakter 1.5x lebih besar dari sebelumnya); zoom scroll/pinch dimatikan, hanya putar (drag) */
let camYaw=0.4,camPitch=0.18;const camDist=4.1;
const ptrs=new Map();
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});});
cv.addEventListener('pointermove',e=>{
  const p=ptrs.get(e.pointerId);if(!p)return;
  const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
  if(ptrs.size===1){camYaw-=dx*0.007;camPitch=clamp(camPitch+dy*0.005,-0.05,1.3);}
});
const ptrEnd=e=>{ptrs.delete(e.pointerId);};
cv.addEventListener('pointerup',ptrEnd);cv.addEventListener('pointercancel',ptrEnd);
cv.addEventListener('wheel',e=>{e.preventDefault();},{passive:false}); /* scroll tidak lagi zoom */
let viewDirty=true;
const FEET_Y=594; /* sejajarkan kaki dengan batas bawah slot baris keempat */
function fit(){
  const w=showEl.clientWidth,h=showEl.clientHeight;if(!w||!h)return;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  renderer.setSize(w,h,false);
  camera.aspect=w/h;camera.fov=(w/h<0.8)?48:40;camera.clearViewOffset();camera.updateProjectionMatrix();
  /* Selaraskan titik dasar karakter dengan batas bawah slot equipment. */
  try{
    {
      const ty=0.85;
      camera.position.set(Math.sin(camYaw)*Math.cos(camPitch)*camDist,ty+Math.sin(camPitch)*camDist,Math.cos(camYaw)*Math.cos(camPitch)*camDist);
      camera.lookAt(0,ty,0);camera.updateMatrixWorld(true);
      const v=new THREE.Vector3(0,0,0).project(camera),feet=(1-v.y)/2*h,dy=FEET_Y-feet;
      if(isFinite(dy)&&Math.abs(dy)<h*0.45)camera.setViewOffset(w,h,0,-dy,w,h);
    }
  }catch(e){}
}
try{new ResizeObserver(fit).observe(showEl);}catch(e){addEventListener('resize',fit);}
function fitStage(){const s=Math.min(innerWidth/1920,innerHeight/1080);document.getElementById('stage').style.transform='scale('+s+')'}
addEventListener('resize',fitStage);fitStage();
fit();

/* ================================================================
   12. START & LOOP
   ================================================================ */
function loadCfg(){
  const L=PD.look(),G=PD.gearLook();
  if(!L){cfg=clone(DEFAULT);apply(null,true);return;}
  const o={gender:L.gender,skin:L.skin,eyes:L.eyes,hair:L.hair,body:L.body,accessories:[]};
  ['top','legs','boots','helm','chest','shoulder','cape','weapon'].forEach(k=>{
    const g=G['g.'+k],ci=g&&IC.byId(g.id);
    o[k]=ci?{id:ci.gameKey,dye:g.dye||undefined}:{id:'none'};
  });
  ACCS.forEach(a=>{const g=G['g.acc.'+a.id];if(g)o.accessories.push({id:a.id,dye:g.dye||undefined});});
  cfg=clone(DEFAULT);apply(o,true);
}
loadCfg();
try{const WS=window.UT&&UT.WalletService&&UT.WalletService.get();
  if(PD.serverMode()&&WS)WS.refresh().then(async r=>{
    if(!(r&&r.ok))return;
    const A=AS();if(A)await A.refresh();   /* tampilan aktif + outfit dari server (server menang) */
    loadCfg();
  });}catch(e){}

const camTarget=new THREE.Vector3(0,0.85,0);
let last=performance.now(),lastPh=-1;
/* Aura yang sedang dipakai (dipilih di halaman Efek) tampil di pratinjau karakter; dicek ~tiap 20 frame (ganti aura / tinggi badan) */
let AUR=null,auraKey,auraH=-1,auraTick=0;
function auraSync(){try{
  if(!(window.UT&&UT.AuraView&&UT.AuraFX))return;
  const k=UT.AuraView.equippedKey()||null,h=cfg.body.height;
  if(k===auraKey&&h===auraH)return;
  auraKey=k;auraH=h;if(!AUR)AUR=UT.AuraView.create(scene,camera);
  AUR.clear(root);scene.updateMatrixWorld(true);AUR.set(root,k);
}catch(e){}}
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min((now-last)/1000,0.05);last=now;time+=dt;

  const tl=mode==='walk'?1:(mode==='run'?2:0);
  level+=(tl-level)*(1-Math.exp(-dt*7));
  phase+=dt*(6.5+4.5*clamp(level-1,0,1));

  if(airborne){
    vy-=22*dt;jumpY+=vy*dt;
    if(jumpY<=0){jumpY=0;vy=0;airborne=false;landT=0.25;}
  }
  if(landT>0)landT-=dt;

  const k=1-Math.exp(-dt*(airborne?26:12));
  const T=computeTarget();
  for(const key in T)P[key]+=(T[key]-P[key])*k;
  applyRig();
  root.position.y=-0.75*cfg.body.height*(cfg.gender==='f'?0.97:1);
  camTarget.set(0,0.85,0);
  camera.position.set(
    camTarget.x+Math.sin(camYaw)*Math.cos(camPitch)*camDist,
    camTarget.y+Math.sin(camPitch)*camDist,
    camTarget.z+Math.cos(camYaw)*Math.cos(camPitch)*camDist);
  camera.lookAt(camTarget);
  if((auraTick++%20)===0)auraSync();if(AUR)AUR.update(dt);
  if(cv.width>1)renderer.render(scene,camera);
}
requestAnimationFrame(frame);

// API untuk game / editor luar
window.BlockyCharacter={
  get config(){return clone(cfg);},
  apply:o=>apply(o),
  load:o=>{cfg=clone(DEFAULT);apply(o,true);},
  export:()=>JSON.stringify(cfg),
  catalog:{REG,DYES,SKINS,PRESETS},
  setMode,jump
};
})();
