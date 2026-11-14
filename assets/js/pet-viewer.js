/* Viewer 3D pet (dipindah dari 'data pet.html'; data pet sudah ada di supabase/pet_catalog.sql).
   Latar transparan, tanpa pad, tanpa zoom. API: PetViewer.select(id). */
(function(){
"use strict";
const T=THREE;
let _s=11;
const rnd=()=>((_s=(Math.imul(_s,1664525)+1013904223)>>>0)/4294967296);
const rr=(a,b)=>a+(b-a)*Math.random();
const pick=a=>a[(Math.random()*a.length)|0];
const rgb=h=>{const c=new T.Color(h);return[c.r,c.g,c.b]};
const jc=(hex,a)=>{const c=new T.Color(hex);if(a)c.offsetHSL(0,0,(rnd()-.5)*a);return c};

// ---------- mesh helpers (pets face +z, floor is y=0)
function mk(parent,geo,col,x,y,z,o){
  o=o||{};
  const mat=new T.MeshStandardMaterial({color:jc(col,o.j===undefined?.06:o.j),roughness:o.r===undefined?.8:o.r,metalness:o.m||0,flatShading:o.flat!==false});
  if(o.e!==undefined){mat.emissive=new T.Color(o.e);mat.emissiveIntensity=o.ei===undefined?1:o.ei}
  if(o.op!==undefined){mat.transparent=true;mat.opacity=o.op}
  if(o.side)mat.side=T.DoubleSide;
  const m=new T.Mesh(geo,mat);m.position.set(x||0,y||0,z||0);
  if(o.rx)m.rotation.x=o.rx;if(o.ry)m.rotation.y=o.ry;if(o.rz)m.rotation.z=o.rz;
  parent.add(m);return m;
}
const bx=(p,w,h,d,c,x,y,z,o)=>mk(p,new T.BoxGeometry(w,h,d),c,x,y,z,o);
const cone=(p,r,h,c,x,y,z,o,seg)=>mk(p,new T.ConeGeometry(r,h,seg||4),c,x,y,z,o);
const cyl=(p,r,h,c,x,y,z,o,seg)=>mk(p,new T.CylinderGeometry(r,r,h,seg||10),c,x,y,z,o);
const oct=(p,r,c,x,y,z,o)=>mk(p,new T.OctahedronGeometry(r,0),c,x,y,z,o);
const torus=(p,r,t,c,x,y,z,o)=>mk(p,new T.TorusGeometry(r,t,6,36),c,x,y,z,o);
const sph=(p,r,c,x,y,z,o)=>mk(p,new T.SphereGeometry(r,10,8),c,x,y,z,o);
function gp(parent,x,y,z){const g=new T.Group();g.position.set(x||0,y||0,z||0);parent.add(g);return g}

// eye with sclera, pupil, and a highlight. o.sc = sclera color, o.glow = emissive pupil
function eye(p,x,y,z,s,iris,o){
  o=o||{};const g=gp(p,x,y,z);
  bx(g,s,s*1.1,.05,o.sc||'#ffffff',0,0,0,{j:0,e:o.scGlow});
  bx(g,s*.62,s*.82,.06,iris||'#1a1020',0,-.01*s,.02,{j:0,e:o.glow,ei:o.ei||1});
  bx(g,s*.22,s*.22,.07,'#ffffff',s*.14,s*.2,.04,{j:0,e:'#ffffff'});
  return g;
}

// soft additive glow billboard
const glowTex=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
  const g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.35,'rgba(255,255,255,.35)');g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g;x.fillRect(0,0,128,128);return new T.CanvasTexture(c)})();
function glow(p,col,size,x,y,z,op){
  const s=new T.Sprite(new T.SpriteMaterial({map:glowTex,color:col,blending:T.AdditiveBlending,transparent:true,depthWrite:false,opacity:op===undefined?.8:op}));
  s.scale.set(size,size,1);s.position.set(x||0,y||0,z||0);p.add(s);return s;
}

// triangle fan from [x,y,z] points, first point is the hub (wing membranes)
function fan(pts){
  const v=[];for(let i=1;i<pts.length-1;i++){v.push(pts[0][0],pts[0][1],pts[0][2],pts[i][0],pts[i][1],pts[i][2],pts[i+1][0],pts[i+1][1],pts[i+1][2])}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();return g;
}

// bolt made of thin additive boxes between points
function makeBolt(parent,n,col){
  const g=gp(parent,0,0,0),segs=[];
  const mat=new T.MeshBasicMaterial({color:col,blending:T.AdditiveBlending,transparent:true,depthWrite:false});
  for(let i=0;i<n;i++){const m=new T.Mesh(new T.BoxGeometry(.07,.07,1),mat);m.visible=false;g.add(m);segs.push(m)}
  return{g,mat,set(pts){
    for(let i=0;i<segs.length;i++){
      const m=segs[i];
      if(i>=pts.length-1){m.visible=false;continue}
      const a=new T.Vector3(...pts[i]),b=new T.Vector3(...pts[i+1]);
      m.visible=true;m.position.copy(a).add(b).multiplyScalar(.5);m.scale.set(1,1,a.distanceTo(b));m.lookAt(b);
    }},hide(){segs.forEach(m=>m.visible=false)}};
}
function zig(a,b,n,amp){
  const pts=[];for(let i=0;i<=n;i++){const u=i/n,j=(i===0||i===n)?0:1;pts.push([a[0]+(b[0]-a[0])*u+(Math.random()-.5)*amp*j,a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u+(Math.random()-.5)*amp*j])}
  return pts;
}
const rate=r=>{let a=0;return(dt,fn)=>{a+=r*dt;let n=0;while(a>=1&&n++<10){a--;fn()}}};

// ---------- particle system (one Points object, additive)
class Particles{
  constructor(scene,N){
    this.N=N;this.i=0;
    this.pos=new Float32Array(N*3);this.col=new Float32Array(N*3);this.size=new Float32Array(N);
    this.vel=new Float32Array(N*3);this.cs=new Float32Array(N*3);this.life=new Float32Array(N);this.max=new Float32Array(N).fill(1);this.g=new Float32Array(N);this.base=new Float32Array(N);
    const geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.BufferAttribute(this.pos,3));
    geo.setAttribute('aCol',new T.BufferAttribute(this.col,3));
    geo.setAttribute('aSize',new T.BufferAttribute(this.size,1));
    this.u={uScale:{value:500}};
    const mat=new T.ShaderMaterial({uniforms:this.u,transparent:true,depthWrite:false,blending:T.AdditiveBlending,
      vertexShader:'attribute vec3 aCol;attribute float aSize;varying vec3 vC;uniform float uScale;void main(){vC=aCol;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=aSize*uScale/max(0.1,-mv.z);gl_Position=projectionMatrix*mv;}',
      fragmentShader:'varying vec3 vC;void main(){float d=length(gl_PointCoord-0.5);if(d>0.5)discard;float a=smoothstep(0.5,0.0,d);gl_FragColor=vec4(vC*a*1.2,1.0);}'});
    this.pts=new T.Points(geo,mat);this.pts.frustumCulled=false;scene.add(this.pts);this.geo=geo;
  }
  emit(p,v,life,size,c,g){
    const i=this.i;this.i=(i+1)%this.N;const k=i*3;
    this.pos[k]=p[0];this.pos[k+1]=p[1];this.pos[k+2]=p[2];
    this.vel[k]=v[0];this.vel[k+1]=v[1];this.vel[k+2]=v[2];
    this.cs[k]=c[0];this.cs[k+1]=c[1];this.cs[k+2]=c[2];
    this.life[i]=life;this.max[i]=life;this.base[i]=size;this.size[i]=size;this.g[i]=g||0;
  }
  clear(){this.life.fill(0);this.size.fill(0);this.geo.attributes.aSize.needsUpdate=true}
  update(dt){
    for(let i=0;i<this.N;i++){
      if(this.life[i]<=0)continue;
      this.life[i]-=dt;
      if(this.life[i]<=0){this.size[i]=0;continue}
      const k=i*3;this.vel[k+1]+=this.g[i]*dt;
      this.pos[k]+=this.vel[k]*dt;this.pos[k+1]+=this.vel[k+1]*dt;this.pos[k+2]+=this.vel[k+2]*dt;
      const u=this.life[i]/this.max[i],f=Math.min(1,u*3)*Math.min(1,(1-u)*10);
      this.col[k]=this.cs[k]*f;this.col[k+1]=this.cs[k+1]*f;this.col[k+2]=this.cs[k+2]*f;
      this.size[i]=this.base[i]*(.55+.45*u);
    }
    this.geo.attributes.position.needsUpdate=true;this.geo.attributes.aCol.needsUpdate=true;this.geo.attributes.aSize.needsUpdate=true;
  }
}
let P=null;
const emit=(p,v,l,s,c,g)=>{if(P)P.emit(p,v,l,s,c,g)};
// ================= T1 Forest Pup (Common)
function petPup(){
  const R=new T.Group();
  const fur='#b8803f',dark='#8a5a2a',cream='#f0dcb0',leaf=['#3fa04a','#2c7a35','#6fd05a'];
  for(const[sx,sz]of[[-1,1],[1,1],[-1,-1],[1,-1]]){
    const l=gp(R,sx*.3,.55,sz*.45);
    bx(l,.3,.5,.3,fur,0,-.27,0);
    bx(l,.34,.12,.4,cream,0,-.5,.05);
    bx(l,.06,.05,.06,'#4a2c12',-.08,-.52,.26,{j:0});bx(l,.06,.05,.06,'#4a2c12',.08,-.52,.26,{j:0});
  }
  const body=gp(R,0,0,0);
  bx(body,.92,.72,1.4,fur,0,.91,0);
  bx(body,.94,.1,.8,dark,0,1.28,-.1);
  bx(body,.5,.1,.5,dark,.2,1.24,.4);
  bx(body,.64,.5,.12,cream,0,.85,.7);
  bx(body,.7,.14,1.0,cream,0,.57,.05);
  bx(body,.2,.2,.2,dark,-.5,.9,-.3);bx(body,.2,.2,.2,dark,.5,1.05,.1);
  // collar and wooden tag
  bx(R,.98,.12,.5,'#6a3a1a',0,1.12,.62);
  bx(R,.22,.22,.05,'#b07a40',0,.98,.9,{j:.1});
  bx(R,.08,.08,.06,'#2a1608',0,.99,.93,{j:0});
  // head
  const head=gp(R,0,1.5,.8);
  bx(head,.86,.76,.8,fur,0,0,0);
  bx(head,.48,.32,.44,cream,0,-.14,.5);
  bx(head,.16,.12,.1,'#1a1020',0,0,.74,{j:0,r:.3});
  bx(head,.3,.06,.06,'#4a2c12',0,-.3,.72,{j:0});
  const tongue=bx(head,.12,.05,.2,'#e8607a',0,-.31,.62,{j:0});
  bx(head,.5,.14,.1,dark,0,.38,.3);
  bx(head,.1,.28,.1,dark,0,.52,.3);
  const eL=eye(head,-.22,.1,.41,.2,'#2a1608'),eR=eye(head,.22,.1,.41,.2,'#2a1608');
  bx(head,.22,.05,.05,'#4a2c12',-.22,.27,.41,{j:0,rz:.15});bx(head,.22,.05,.05,'#4a2c12',.22,.27,.41,{j:0,rz:-.15});
  bx(head,.12,.12,.1,'#a07040',-.46,-.16,.2);bx(head,.12,.12,.1,'#a07040',.46,-.16,.2);
  const earL=gp(head,-.4,.34,0),earR=gp(head,.4,.34,0);
  bx(earL,.22,.5,.3,dark,-.04,-.2,0);bx(earL,.1,.34,.18,'#d49a70',.02,-.2,.08,{j:.02});
  bx(earR,.22,.5,.3,dark,.04,-.2,0);bx(earR,.1,.34,.18,'#d49a70',-.02,-.2,.08,{j:.02});
  // leaf sprig on head
  const sp=gp(head,.18,.4,-.05);
  bx(sp,.05,.28,.05,'#4a8a3a',0,.14,0,{j:0});
  bx(sp,.22,.1,.14,leaf[0],.12,.3,0,{rz:.4});bx(sp,.2,.1,.14,leaf[1],-.12,.22,0,{rz:-.4});bx(sp,.16,.1,.12,leaf[2],.02,.4,0);
  // tail
  const tail=gp(R,0,1.1,-.7);
  bx(tail,.2,.2,.6,fur,0,.2,-.2,{rx:.5});
  bx(tail,.22,.22,.22,cream,0,.46,-.46);
  const rate1=rate(1.6);
  return{root:R,cam:{y:1.3,d:6.4},
    tick(t,dt){
      body.scale.y=1+Math.sin(t*2)*.015;head.position.y=1.5+Math.sin(t*2)*.012;
      head.rotation.z=Math.sin(t*.8)*.07;head.rotation.y=Math.sin(t*.6)*.2;
      tail.rotation.y=Math.sin(t*7)*.5;
      earL.rotation.z=.12+Math.sin(t*3)*.05;earR.rotation.z=-.12-Math.sin(t*3+1)*.05;
      tongue.scale.y=1+Math.max(0,Math.sin(t*5))*.8;tongue.position.y=-.31-Math.max(0,Math.sin(t*5))*.03;
      const b=(t%4)<.12?.1:1;eL.scale.y=eR.scale.y=b;
      rate1(dt,()=>{const c=pick([[.25,.65,.3],[.4,.8,.3],[.2,.5,.25]]);emit([rr(-1.3,1.3),rr(2.4,3.2),rr(-1.3,1.3)],[rr(-.1,.1),-.1,rr(-.1,.1)],rr(3,4),.12,c,-.05)});
    },
    burst(){for(let i=0;i<50;i++){const a=rr(0,6.28);emit([Math.cos(a)*.9,rr(.4,2),Math.sin(a)*.9],[Math.cos(a)*rr(.5,1.6),rr(.5,1.8),Math.sin(a)*rr(.5,1.6)],rr(1.2,2),.14,pick([[.25,.65,.3],[.5,.85,.35],[.9,.7,.3]]),-.5)}}
  };
}

// ================= T2 Copper Golem (Uncommon)
function petGolem(){
  const R=new T.Group();
  const cu='#c8703a',cu2='#8a4422',cu3='#f2a460',ver='#3fbf9f',M={m:.55,r:.45};
  for(const sx of[-1,1]){
    bx(R,.42,.6,.46,cu,sx*.36,.38,0,M);
    bx(R,.5,.16,.66,cu2,sx*.36,.08,.08,M);
    bx(R,.46,.06,.5,cu3,sx*.36,.62,0,M);
    bx(R,.1,.1,.1,ver,sx*.36,.3,.24,{j:0});
  }
  bx(R,1.1,.3,.75,cu2,0,.78,0,M);
  const torso=gp(R,0,0,0);
  bx(torso,1.3,1.0,.95,cu,0,1.43,0,M);
  bx(torso,1.34,.1,.99,cu3,0,1.98,0,M);bx(torso,1.34,.1,.99,cu2,0,.92,0,M);
  for(const[x,y,z,w,h]of[[-.5,1.7,.49,.3,.2],[.55,1.15,.49,.2,.3],[-.62,1.2,0,.08,.4],[.66,1.75,-.2,.08,.3],[.2,1.95,.3,.4,.06]])bx(torso,w,h,.06,ver,x,y,z,{j:.1});
  // chest plate + gauge
  bx(torso,.8,.56,.08,cu2,0,1.45,.5,M);
  for(const[x,y]of[[-.34,1.67],[.34,1.67],[-.34,1.23],[.34,1.23]])bx(torso,.07,.07,.06,cu3,x,y,.55,{m:.8,r:.3,j:0});
  const dial=cyl(torso,.2,.05,'#0e5a64',0,1.45,.56,{e:'#40e0f0',ei:.7,m:.2,r:.3,j:0},16);dial.rotation.x=Math.PI/2;
  const needle=gp(torso,0,1.45,.6);bx(needle,.04,.16,.02,'#fff0c0',0,.07,0,{j:0,e:'#fff0c0'});
  // neck + head
  bx(R,.36,.22,.36,cu2,0,2.1,0,M);
  const head=gp(R,0,2.5,0);
  bx(head,.9,.72,.76,cu,0,0,0,M);
  bx(head,.94,.1,.8,cu3,0,.39,0,M);
  bx(head,.7,.08,.06,cu2,0,.18,.39,M);
  const e1=bx(head,.18,.18,.06,'#ffb040',-.22,.04,.39,{e:'#ff9a20',ei:1.4,j:0});
  const e2=bx(head,.18,.18,.06,'#ffb040',.22,.04,.39,{e:'#ff9a20',ei:1.4,j:0});
  for(let i=0;i<3;i++)bx(head,.3,.04,.04,'#3a1a0a',0,-.18-i*.09,.39,{j:0});
  for(const sx of[-1,1]){const b=cyl(head,.14,.1,cu3,sx*.5,0,0,{m:.7,r:.35},8);b.rotation.z=Math.PI/2;bx(head,.06,.06,.06,ver,sx*.57,.08,0,{j:0})}
  bx(head,.06,.5,.06,cu2,.22,.62,0,M);
  const bulb=sph(head,.12,'#ffb040',.22,.92,0,{e:'#ff9a20',ei:1.5,j:0});
  const bg=glow(head,0xff9a30,.9,.22,.92,0,.7);
  // arms
  const armL=gp(R,-.82,1.85,0),armR=gp(R,.82,1.85,0);
  for(const[a,s]of[[armL,-1],[armR,1]]){
    bx(a,.34,.3,.4,cu3,0,.02,0,M);bx(a,.3,.8,.3,cu,0,-.45,0,M);
    bx(a,.4,.3,.4,cu2,0,-1.0,.04,M);bx(a,.08,.08,.08,ver,s*.1,-.5,.16,{j:0});
    for(let i=-1;i<=1;i++)bx(a,.08,.14,.1,cu3,i*.12,-1.18,.14,M);
  }
  // back gear + steam pipe
  const gear=gp(R,0,1.5,-.58);
  const gb=cyl(gear,.42,.14,cu3,0,0,0,{m:.7,r:.4},12);gb.rotation.x=Math.PI/2;
  for(let i=0;i<8;i++){const a=i/8*6.283;bx(gear,.16,.2,.14,cu2,Math.cos(a)*.5,Math.sin(a)*.5,0,{m:.6,rz:a})}
  const gc=cyl(gear,.14,.2,cu2,0,0,0,{m:.8,r:.3},8);gc.rotation.x=Math.PI/2;
  bx(R,.2,.5,.2,cu2,-.48,2.25,-.3,M);bx(R,.28,.1,.28,cu3,-.48,2.52,-.3,M);
  const gl=glow(R,0xff9a30,1.6,0,1.45,.2,.0);
  const r1=rate(5),r2=rate(2.2);
  return{root:R,cam:{y:1.5,d:7.2},
    tick(t,dt){
      torso.scale.y=1+Math.sin(t*2)*.01;
      head.rotation.y=Math.sin(t*.7)*.35;head.rotation.z=Math.sin(t*1.1)*.04;
      armL.rotation.x=Math.sin(t*1.3)*.25;armR.rotation.x=-Math.sin(t*1.3)*.25;armL.rotation.z=-.05;armR.rotation.z=.05;
      gear.rotation.z=t*.8;needle.rotation.z=Math.sin(t*1.5)*1.0;
      const p=.6+.4*Math.sin(t*3);bulb.material.emissiveIntensity=1+p;bg.material.opacity=.4+.5*p;
      e1.material.emissiveIntensity=e2.material.emissiveIntensity=1.1+.5*Math.sin(t*2.4);
      r1(dt,()=>emit([-.48+rr(-.05,.05),2.6,-.3+rr(-.05,.05)],[rr(-.15,.15),rr(.5,.9),rr(-.15,.15)],rr(1.2,1.8),.34,[.28,.26,.24],.05));
      r2(dt,()=>{const a=rr(0,6.28);emit([Math.cos(a)*.9,rr(.6,2.8),Math.sin(a)*.6],[0,rr(.2,.6),0],rr(.8,1.3),.1,[1,.7,.4],0)});
    },
    burst(){for(let i=0;i<60;i++){const a=rr(0,6.28);emit([Math.cos(a)*.6,rr(.8,2.8),Math.sin(a)*.6],[Math.cos(a)*rr(1,2.6),rr(.5,2),Math.sin(a)*rr(1,2.6)],rr(.6,1.2),.12,pick([[1,.7,.4],[1,.9,.7],[.4,.9,.8]]),-1.6)}}
  };
}
// ================= T3 Crystal Axolotl (Rare)
function petAxolotl(){
  const R=new T.Group();
  const skin='#8fe8f2',belly='#d8fbff',back='#3ab8d8',pink='#ff9ad8',crys='#40e8f4';
  const G={e:crys,ei:.45,op:.88,r:.25,m:.1};
  const body=gp(R,0,0,0);
  bx(body,.95,.62,1.5,skin,0,.6,-.1);
  bx(body,.8,.14,1.3,belly,0,.3,-.1);
  bx(body,.9,.1,1.2,back,0,.94,-.1);
  const head=gp(R,0,.64,.95);
  bx(head,1.15,.56,.9,skin,0,0,0);
  bx(head,.9,.12,.7,belly,0,-.3,.05);
  bx(head,1.0,.08,.7,back,0,.3,-.04);
  const eL=eye(head,-.4,.28,.3,.26,'#12101e',{sc:'#12101e'}),eR=eye(head,.4,.28,.3,.26,'#12101e',{sc:'#12101e'});
  bx(head,.5,.05,.05,'#2a6a8a',0,-.06,.46,{j:0});
  bx(head,.08,.08,.05,'#2a6a8a',-.27,-.02,.46,{j:0});bx(head,.08,.08,.05,'#2a6a8a',.27,-.02,.46,{j:0});
  bx(head,.12,.08,.05,pink,-.5,-.04,.46,{j:0,e:pink,ei:.3});bx(head,.12,.08,.05,pink,.5,-.04,.46,{j:0,e:pink,ei:.3});
  const fg=oct(head,.16,'#e8ffff',0,.46,.28,Object.assign({},G,{op:.95,ei:1.1,e:'#aaf8ff'}));
  // gills
  const gills=[];
  for(const s of[-1,1])for(let i=0;i<3;i++){
    const g=gp(head,s*.56,.14-i*.02,-.18);g.rotation.z=-s*(.7+i*.32);g.rotation.y=s*(.25-i*.18);
    bx(g,.08,.56,.08,'#ff8ad0',0,.28,0,{e:pink,ei:.25,j:.04});
    bx(g,.2,.1,.06,'#ffc0ea',s*.08,.18,0,{j:.04});bx(g,.2,.1,.06,'#ffc0ea',s*.08,.36,0,{j:.04});
    oct(g,.1,crys,0,.58,0,Object.assign({},G,{ei:.9}));gills.push({g,s,i});
  }
  // legs
  const legs=[];
  for(const[sx,sz]of[[-1,.5],[1,.5],[-1,-.55],[1,-.55]]){
    const l=gp(R,sx*.52,.3,sz);l.rotation.z=-sx*.15;
    bx(l,.26,.34,.3,skin,sx*.06,-.08,0);bx(l,.34,.1,.36,belly,sx*.1,-.26,.05);
    for(let k=-1;k<=1;k++)bx(l,.07,.08,.1,pink,sx*.1+k*.1,-.3,.26,{j:0});legs.push(l);
  }
  // tail chain
  const segs=[];let par=gp(R,0,.58,-.78);const widths=[.8,.72,.62,.52,.42,.32];
  for(let i=0;i<6;i++){
    const w=widths[i];bx(par,w,.5-i*.05,.42,i%2?skin:'#9aeef6',0,0,-.2);
    bx(par,.06,.18+(5-i)*.05,.38,crys,0,.3-i*.025,-.2,Object.assign({},G,{ei:.3}));
    segs.push(par);const n=gp(par,0,0,-.4);par=n;
  }
  oct(par,.2,'#e8ffff',0,0,-.1,Object.assign({},G,{op:.95,ei:1}));
  // dorsal crystals
  const cr=[];
  for(let i=0;i<6;i++){const h=.5+((i*37)%5)*.1;const c=cone(R,.15,h,crys,(i%2?.18:-.18),1.0+h/2-.04,.6-i*.34,Object.assign({},G,{rz:(i%2?-.18:.18)}));cr.push(c)}
  for(let i=0;i<2;i++)cone(R,.2,.9-i*.2,'#a0f8ff',0,1.05+.45-i*.1,.15-i*.45,Object.assign({},G,{ei:.7}));
  const gl=glow(R,0x40e8f4,3.2,0,.9,0,.28);
  const r1=rate(5);
  return{root:R,cam:{y:.95,d:6.6},
    tick(t,dt){
      R.position.y=Math.sin(t*1.4)*.05;body.scale.y=1+Math.sin(t*2)*.02;
      head.rotation.y=Math.sin(t*.7)*.18;head.rotation.z=Math.sin(t*1.1)*.05;
      segs.forEach((s,i)=>{s.rotation.y=Math.sin(t*2.2-i*.7)*.2});
      gills.forEach(({g,s,i})=>{g.rotation.x=Math.sin(t*5+i*1.1+(s>0?1:0))*.14});
      cr.forEach((c,i)=>{c.material.emissiveIntensity=.35+.35*(.5+.5*Math.sin(t*2+i))});
      fg.rotation.y=t*1.2;fg.material.emissiveIntensity=.8+.4*Math.sin(t*3);
      legs.forEach((l,i)=>{l.rotation.x=Math.sin(t*1.4+i*1.5)*.08});
      const b=(t%3.6)<.12?.1:1;eL.scale.y=eR.scale.y=b;
      r1(dt,()=>{const a=rr(0,6.28),r=rr(.4,1.4);emit([Math.cos(a)*r,rr(.4,1.2),Math.sin(a)*r],[rr(-.1,.1),rr(.4,.8),rr(-.1,.1)],rr(1.6,2.6),pick([.1,.14,.2]),pick([[.4,.95,1],[1,1,1],[.6,.9,1]]),0)});
    },
    burst(){for(let i=0;i<70;i++){const a=rr(0,6.28);emit([Math.cos(a)*.6,rr(.5,1.4),Math.sin(a)*.6],[Math.cos(a)*rr(.8,2.2),rr(.4,2),Math.sin(a)*rr(.8,2.2)],rr(1,1.8),.12,pick([[.4,.95,1],[1,1,1]]),-.3)}}
  };
}

// ================= T4 Arcane Owl (Epic)
function petOwl(){
  const R=new T.Group();
  const pur='#b46af0',purD='#5a22a0',brown='#6a4a7a',feather='#8a6aa0',light='#e6d4f2',gold='#ffd24a';
  const A={e:pur,ei:.6,op:.92,r:.3};
  // amethyst perch
  bx(R,1.5,.16,1.1,'#2a1a3a',0,.7,0,{j:.04});
  const spikes=[[-.6,.45,.2,.9],[.55,.4,-.2,.75],[0,.5,.45,.6],[-.2,.35,-.4,.95],[.7,.3,.4,.5],[-.7,.3,-.3,.55]];
  const pcr=spikes.map(([x,r,z,h],i)=>cone(R,.2+r*.3,h,pur,x,h/2,z,Object.assign({},A,{rz:(x>0?-.12:.12)})));
  const body=gp(R,0,0,0);
  bx(body,1.2,1.3,1.0,brown,0,1.5,0);
  bx(body,.9,.95,.1,light,0,1.4,.52);
  for(let r=0;r<4;r++)for(let c=-1;c<=1;c++)bx(body,.26,.18,.06,feather,c*.28+(r%2?.14:0)*(c>=1?0:1),1.78-r*.24,.58,{j:.12});
  bx(body,1.0,.1,.9,purD,0,2.18,0);
  bx(body,1.04,.5,.1,purD,0,1.1,-.5);
  // feet
  for(const sx of[-1,1]){bx(R,.2,.2,.2,gold,sx*.32,.9,.3,{j:.03});for(let k=-1;k<=1;k++)bx(R,.1,.1,.3,gold,sx*.32+k*.1,.82,.44,{j:.03})}
  // wings
  const wL=gp(R,-.66,2.0,-.05),wR=gp(R,.66,2.0,-.05);
  for(const[w,s]of[[wL,-1],[wR,1]]){
    bx(w,.18,1.1,.74,brown,s*.04,-.55,0);
    for(let i=0;i<3;i++)bx(w,.16,.3,.7-i*.12,feather,s*.04,-1.12-i*.18,-.02-i*.04,{j:.1});
    bx(w,.1,.7,.5,purD,s*.1,-.45,.02);
    for(let i=0;i<3;i++)bx(w,.12,.1,.1,pur,s*.1,-.2-i*.2,.34,{e:pur,ei:.9,j:0});
  }
  // head
  const head=gp(R,0,2.78,.02);
  bx(head,1.3,.9,1.0,brown,0,0,0);
  bx(head,1.1,.1,.9,purD,0,.5,0);
  bx(head,1.0,.7,.1,light,0,-.02,.52);
  for(const s of[-1,1]){
    const t1=bx(head,.22,.55,.3,purD,s*.52,.62,-.05,{rz:-s*.25});
    cone(head,.12,.3,pur,s*.6,.98,-.05,Object.assign({},A,{rz:-s*.25}));
  }
  const eyes=[];
  for(const s of[-1,1]){
    bx(head,.58,.58,.08,'#d8bcec',s*.3,.02,.54,{j:.03});
    const e=cyl(head,.24,.1,gold,s*.3,.02,.6,{e:'#ffc830',ei:1.2,j:0},14);e.rotation.x=Math.PI/2;
    bx(head,.14,.3,.06,'#1a0c28',s*.3,.02,.68,{j:0});bx(head,.07,.07,.06,'#fff',s*.3+.06,.12,.7,{j:0,e:'#fff'});
    eyes.push(e);
  }
  const bk=cone(head,.16,.34,'#ffc830',0,-.2,.62,{e:'#ff9a10',ei:.25,j:0});bk.rotation.x=Math.PI/2+.25;
  const hg=oct(head,.14,pur,0,.36,.55,Object.assign({},A,{ei:1.2,op:.95}));
  const lids=bx(head,1.2,.58,.07,brown,0,.02,.76,{j:0});lids.scale.y=.01;
  // rune rings behind
  const ring=gp(R,0,2.9,-.7);
  const r1=torus(ring,1.0,.05,pur,0,0,0,{e:pur,ei:1.1,r:.3,j:0});
  const r2=gp(ring,0,0,0);torus(r2,.72,.04,'#e0b0ff',0,0,0,{e:'#e0b0ff',ei:1,r:.3,j:0});
  for(let i=0;i<8;i++){const a=i/8*6.283;bx(r2,.12,.2,.05,'#f4d8ff',Math.cos(a)*.72,Math.sin(a)*.72,0,{e:'#f4d8ff',ei:1,j:0,rz:a})}
  for(let i=0;i<12;i++){const a=i/12*6.283;bx(ring,.08,.14,.05,pur,Math.cos(a)*1.0,Math.sin(a)*1.0,0,{e:pur,ei:1,j:0,rz:a})}
  const orbs=[];
  for(let i=0;i<4;i++){const o=gp(R,0,0,0);oct(o,.16+.03*(i%2),i%2?'#e0b0ff':pur,0,0,0,Object.assign({},A,{ei:1}));orbs.push(o)}
  glow(R,0xb46af0,3.8,0,2.4,-.3,.35);
  const rt=rate(7);
  return{root:R,cam:{y:2.0,d:8.0},
    tick(t,dt){
      R.position.y=Math.sin(t*1.2)*.03;
      body.scale.y=1+Math.sin(t*2)*.012;
      head.rotation.y=Math.sin(t*.7)*.55;head.rotation.z=Math.sin(t*.45)*.1;
      const fl=Math.max(0,Math.sin(t*.9));wL.rotation.z=-.04-fl*fl*.18*Math.sin(t*14);wR.rotation.z=.04+fl*fl*.18*Math.sin(t*14);
      ring.rotation.z=t*.3;r2.rotation.z=-t*.7;
      pcr.forEach((c,i)=>{c.material.emissiveIntensity=.45+.35*Math.sin(t*2+i)});
      eyes.forEach(e=>{e.material.emissiveIntensity=1.1+.4*Math.sin(t*2)});
      const b=(t%5)<.14?1:.01;lids.scale.y=b<.5?.01:1;lids.visible=b>.5;
      orbs.forEach((o,i)=>{const a=t*.9+i*1.57,r=1.5+.1*Math.sin(t+i);o.position.set(Math.cos(a)*r,1.7+Math.sin(t*1.3+i)*.5+i*.18,Math.sin(a)*r);o.rotation.y=t*2;o.rotation.x=t});
      rt(dt,()=>{const a=rr(0,6.28),r=rr(.6,1.6);emit([Math.cos(a)*r,rr(.8,3.4),Math.sin(a)*r],[rr(-.1,.1),rr(.3,.8),rr(-.1,.1)],rr(1.4,2.4),pick([.08,.12,.16]),pick([[.9,.6,1],[.8,.5,1],[1,.85,1]]),0)});
    },
    burst(){for(let i=0;i<80;i++){const a=rr(0,6.28);emit([Math.cos(a)*.5,rr(1,3.2),Math.sin(a)*.5],[Math.cos(a)*rr(.8,2.4),rr(.4,2),Math.sin(a)*rr(.8,2.4)],rr(1,1.8),.13,pick([[.9,.6,1],[.7,.4,1],[1,.85,1]]),-.2)}}
  };
}
// ================= T5 Storm Wolf (Legendary)
function petWolf(){
  const R=new T.Group();
  const steel='#5a6a8a',steelD='#2e3850',steelL='#a8b8d8',white='#e8f4ff',cyan='#7fd0ff',yel='#fff2a0';
  const E={e:cyan,ei:1.2,j:0};
  const legs=[];
  for(const[sx,sz,h]of[[-1,.62,1],[1,.62,1],[-1,-.7,.9],[1,-.7,.9]]){
    const l=gp(R,sx*.38,.92,sz);
    bx(l,.34,.5,.34,steel,0,-.25,0);bx(l,.28,.46,.3,steelD,0,-.68,.02);
    bx(l,.36,.12,.46,steelL,0,-.9,.07);
    bx(l,.05,.4,.05,cyan,sx*.18,-.3,0,E);legs.push(l);
  }
  const body=gp(R,0,0,0);
  bx(body,1.0,.95,1.9,steel,0,1.4,0);
  bx(body,.84,.5,1.5,steelL,0,1.04,.1,{j:.04});
  bx(body,1.04,.14,1.4,steelD,0,1.88,-.2);
  bx(body,1.04,.9,.6,steel,0,1.5,.8);
  bx(body,.7,.6,.1,white,0,1.35,1.12,{j:.03});
  for(const[a,b,w]of[[-.52,1.5,.9],[.52,1.55,.8]]){bx(body,.05,.07,w,cyan,a,b,-.2,E);bx(body,.05,.3,.07,cyan,a,b-.1,.3,E);bx(body,.05,.07,.4,cyan,a,b-.25,.5,E)}
  // head
  const head=gp(R,0,2.0,1.2);
  bx(head,.8,.7,.8,steel,0,0,0);
  bx(head,.44,.34,.62,steelL,0,-.14,.66);
  bx(head,.16,.12,.1,'#10141c',0,-.0,.98,{j:0,r:.3});
  const jaw=gp(head,0,-.2,.3);
  bx(jaw,.42,.12,.6,steelD,0,-.02,.4);
  for(const s of[-1,1]){bx(jaw,.05,.1,.05,'#fff',s*.16,.07,.62,{j:0});bx(head,.05,.1,.05,'#fff',s*.16,-.3,.9,{j:0})}
  const eyes=[];
  for(const s of[-1,1]){eyes.push(bx(head,.22,.08,.06,'#e8fbff',s*.24,.1,.42,{e:cyan,ei:1.8,j:0,rz:s*-.25}))}
  bx(head,.5,.08,.06,steelD,0,.22,.4,{j:0});
  const ears=[];
  for(const s of[-1,1]){const e=gp(head,s*.28,.36,-.1);cone(e,.2,.6,steelD,0,.3,0,{j:.04});cone(e,.12,.4,steelL,0,.26,.06,{j:.04});ears.push(e)}
  for(const s of[-1,1])bx(head,.14,.2,.4,white,s*.44,-.12,.1,{j:.03});
  // mane of storm spikes
  const mane=[];
  for(let i=0;i<8;i++){
    const z=1.3-i*.32,y=2.0+(i<3?.18-i*.02:-i*.015)+.16,h=.55+(i<4?i*.08:(7-i)*.1);
    const c=cone(R,.15,h,yel,0,y+h/2*.8,z-.1,{e:yel,ei:.8,j:0,rx:-.55});mane.push(c);
  }
  for(let i=0;i<3;i++)for(const s of[-1,1])bx(R,.28,.22,.3,white,s*.34,1.95-i*.12,.95-i*.28,{j:.05});
  // tail
  const tail=[];let tp=gp(R,0,1.5,-.95);
  for(let i=0;i<4;i++){bx(tp,.34+i*.1,.34+i*.1,.5,i===3?white:steel,0,0,-.22,{j:.05});tail.push(tp);tp=gp(tp,0,.02,-.45)}
  bx(tp,.1,.1,.4,cyan,0,.08,-.2,E);const tipG=oct(tp,.18,'#e8fbff',0,.12,-.5,E);
  // storm cloud above
  const cloud=gp(R,0,4.6,.2);
  const cc=[[0,0,0,1.5,.5,1.1],[-.8,.1,.1,1,.5,.9],[.85,.05,-.1,1.1,.55,.9],[.2,.35,0,1,.4,.8],[-.4,.3,-.3,.8,.4,.7]];
  const clMats=cc.map(([x,y,z,w,h,d])=>bx(cloud,w,h,d,'#4a5470',x,y,z,{j:.08}));
  bx(cloud,1.6,.14,1.0,cyan,0,-.28,0,{e:cyan,ei:.7,op:.7,j:0});
  const cl=new T.PointLight(0x9fd8ff,0,12);cl.position.set(0,-.6,0);cloud.add(cl);
  const bolt=makeBolt(R,18,0xcfeeff),bolt2=makeBolt(R,10,0x7fd0ff);
  glow(R,0x7fd0ff,4,0,2,0,.22);
  let next=1.5,fl=0,tgt=[0,0,0],acc=0;
  const r1=rate(9);
  return{root:R,cam:{y:2.3,d:10},
    tick(t,dt){
      body.scale.y=1+Math.sin(t*2)*.012;head.position.y=2.0+Math.sin(t*2)*.015;
      head.rotation.y=Math.sin(t*.5)*.25;head.rotation.z=Math.sin(t*.7)*.04;
      jaw.rotation.x=.05+Math.max(0,Math.sin(t*.8))*.1;
      tail.forEach((s,i)=>{s.rotation.y=Math.sin(t*1.6-i*.6)*.25});
      ears.forEach((e,i)=>{e.rotation.z=(i?-1:1)*(.15+Math.sin(t*3+i*2)*.04)});
      mane.forEach((m,i)=>{m.material.emissiveIntensity=.6+.5*(.5+.5*Math.sin(t*5-i*.8))});
      eyes.forEach(e=>{e.material.emissiveIntensity=1.5+.5*Math.sin(t*3)});
      tipG.rotation.y=t*3;
      cloud.position.y=4.6+Math.sin(t*.8)*.08;clMats.forEach((m,i)=>{m.position.y+=Math.sin(t*1.5+i)*.0008});
      next-=dt;
      if(next<=0){next=rr(1.8,3.6);fl=.28;const g=Math.random()<.5;tgt=g?[rr(-1.8,1.8),0,rr(-1.8,1.8)]:[0,2.45,.3]}
      if(fl>0){
        fl-=dt;acc+=dt;
        if(acc>.04){acc=0;const o=[cloud.position.x+rr(-.4,.4),cloud.position.y-.3,cloud.position.z+rr(-.3,.3)];bolt.set(zig(o,tgt,16,.9));bolt2.set(zig([tgt[0],tgt[1]+.2,tgt[2]],[tgt[0]+rr(-1,1),tgt[1]+rr(.3,.9),tgt[2]+rr(-1,1)],5,.5))}
        cl.intensity=3+Math.random()*3;
        for(let i=0;i<3;i++)emit([tgt[0],tgt[1]+.1,tgt[2]],[rr(-3,3),rr(.5,3),rr(-3,3)],rr(.25,.5),.1,[.7,.9,1],-4);
        if(fl<=0){bolt.hide();bolt2.hide();cl.intensity=0}
      }
      r1(dt,()=>{const m=pick(mane).position;emit([m.x+rr(-.15,.15),m.y+rr(.1,.4),m.z+rr(-.15,.15)],[rr(-1,1),rr(.2,1.2),rr(-1,1)],rr(.3,.7),.08,pick([[1,.95,.6],[.7,.9,1]]),-1)});
    },
    burst(){next=0;for(let i=0;i<70;i++){const a=rr(0,6.28);emit([Math.cos(a)*.5,rr(.8,2.6),Math.sin(a)*.5],[Math.cos(a)*rr(1.5,4),rr(.5,3),Math.sin(a)*rr(1.5,4)],rr(.4,.9),.1,pick([[.7,.9,1],[1,1,.7],[1,1,1]]),-3)}}
  };
}

// ================= T6 Inferno Dragon (Mythic)
function petDragon(){
  const R=new T.Group();
  const sc='#1b0a10',sc2='#2a1018',red='#a0182c',redD='#6a0f1e',belly='#b86a38',gold='#ffd24a',lava='#ff7a18';
  const L={e:lava,ei:1.4,j:0};
  // legs
  const toes=(p,y,z)=>{for(let k=-1;k<=1;k++)cone(p,.06,.22,'#e8dcc0',k*.12,y,z,{j:0,rx:Math.PI/2})};
  for(const s of[-1,1]){
    const h=gp(R,s*.8,1.35,-.7);
    bx(h,.52,.9,.8,sc,0,-.1,0);bx(h,.54,.16,.84,red,0,.3,0);
    bx(h,.4,.8,.44,sc2,0,-.78,.2,{rx:-.3});bx(h,.5,.14,.7,sc,0,-1.22,.38);toes(h,-1.22,.78);
    const f=gp(R,s*.62,1.0,.95);
    bx(f,.38,.9,.4,sc,0,-.3,0);bx(f,.46,.14,.6,sc,0,-.78,.12);toes(f,-.78,.46);
  }
  const body=gp(R,0,0,0);
  bx(body,1.25,1.1,2.1,sc,0,1.7,0);
  bx(body,1.0,.5,1.8,belly,0,1.3,.05,{j:.05});
  for(let i=0;i<6;i++)bx(body,1.04,.06,.2,'#d08848',0,1.06+i*.0,.8-i*.3,{j:.05});
  bx(body,1.0,.1,1.2,redD,0,2.26,0);
  bx(body,.9,.7,.12,sc2,0,1.9,1.08);
  for(const[x,y,w,h]of[[-.2,1.75,.06,.4],[.1,1.9,.06,.3],[.0,1.55,.4,.05],[.25,1.6,.05,.25],[-.3,1.95,.3,.05]])bx(body,w,h,.05,lava,x,y,1.15,L);
  for(let i=0;i<26;i++){const a=Math.random(),top=a<.55;
    if(top)bx(body,.2,.07,.2,red,rr(-.5,.5),2.27,rr(-.9,.9),{j:.15});else{const s=Math.random()<.5?-1:1;bx(body,.07,.18,.2,red,s*.63,rr(1.5,2.1),rr(-.9,.9),{j:.15})}}
  const bsp=[];
  for(let i=0;i<8;i++){const h=.4+((i*3)%4)*.1;bsp.push(cone(R,.14,h,red,0,2.35+h/2-.05,.9-i*.28,{j:.1,m:.2,rx:-.15}))}
  // neck
  let np=gp(R,0,2.0,.95);const nk=[];
  for(let i=0;i<4;i++){np.rotation.x=-.34;bx(np,.62-i*.04,.6-i*.03,.64,i%2?sc:sc2,0,0,.3);bx(np,.4,.08,.5,belly,0,-.28,.3,{j:.05});cone(np,.1,.28,red,0,.4,.3,{j:.1});nk.push(np);np=gp(np,0,0,.6)}
  const head=gp(np,0,.12,.05);head.rotation.x=1.3;
  bx(head,.86,.62,.86,sc,0,0,.12);bx(head,.84,.1,.7,redD,0,.34,.1);
  bx(head,.56,.4,.66,sc2,0,-.06,.7);bx(head,.1,.08,.1,lava,-.16,.06,1.04,L);bx(head,.1,.08,.1,lava,.16,.06,1.04,L);
  const jaw=gp(head,0,-.24,.2);
  bx(jaw,.5,.14,.8,sc,0,-.02,.5);
  for(let i=0;i<4;i++){bx(jaw,.05,.12,.05,'#fff',-.2,.07,.35+i*.16,{j:0});bx(jaw,.05,.12,.05,'#fff',.2,.07,.35+i*.16,{j:0})}
  bx(jaw,.3,.04,.5,'#c01830',0,.02,.5,{j:0,e:'#ff3040',ei:.5});
  for(let i=0;i<4;i++){bx(head,.05,.12,.05,'#fff',-.22,-.3,.62+i*.1,{j:0});bx(head,.05,.12,.05,'#fff',.22,-.3,.62+i*.1,{j:0})}
  const eyes=[];
  for(const s of[-1,1]){
    eyes.push(bx(head,.2,.1,.08,'#ffe060',s*.28,.14,.5,{e:gold,ei:2,j:0,rz:s*-.3}));bx(head,.05,.1,.09,'#1a0408',s*.28,.14,.51,{j:0,rz:s*-.3});
    const h1=gp(head,s*.3,.34,-.2);h1.rotation.z=-s*.35;h1.rotation.x=-.4;
    bx(h1,.18,.5,.18,'#e8dcc0',0,.25,0,{j:.05});const h2=gp(h1,0,.5,0);h2.rotation.x=-.55;bx(h2,.14,.5,.14,'#cdbfa0',0,.25,0,{j:.05});cone(h2,.07,.3,'#e8dcc0',0,.6,0,{j:0});
    for(let k=0;k<2;k++)cone(head,.07,.28,red,s*(.5),.0-k*.14,-.1-k*.05,{j:.08,rz:-s*1.2});
  }
  const mouth=gp(head,0,-.15,.95);
  // wings
  const wings=[];
  for(const s of[-1,1]){
    const a=gp(R,s*.6,2.2,.2);a.scale.x=s;const w=gp(a,0,0,0);w.rotation.y=.25;
    const wi=gp(w,0,0,0);wi.rotation.x=1.35;
    const P=[[0,0],[.5,-1.4],[1.6,-2.2],[2.7,-1.8],[3.3,-.7],[3.1,.6],[1.2,.5]];
    const bone=(p,q,th,col)=>{const dx=q[0]-p[0],dy=q[1]-p[1],len=Math.hypot(dx,dy);bx(wi,len,th,th,col,(p[0]+q[0])/2,(p[1]+q[1])/2,0,{rz:Math.atan2(dy,dx),j:.05})};
    bone(P[0],P[6],.2,sc);for(let i=2;i<=5;i++)bone(P[6],P[i],.1,sc);bone(P[0],P[1],.1,sc);
    mk(wi,fan(P.map(p=>[p[0],p[1],0])),red,0,0,0,{side:true,op:.94,e:'#5a0614',ei:.8,j:0,flat:false});
    cone(wi,.08,.3,'#e8dcc0',3.2,.7,0,{j:0,rz:-1.2});
    wings.push(w);
  }
  // tail
  const tail=[];let tp=gp(R,0,1.7,-1.0);
  for(let i=0;i<9;i++){const k=1-i*.09;tp.rotation.x=.04;bx(tp,.8*k,.64*k,.62,i%2?sc:sc2,0,0,-.28);cone(tp,.12*k+.04,.34*k+.1,red,0,.4*k,-.28,{j:.1});bx(tp,.5*k,.1,.5,belly,0,-.3*k,-.28,{j:.05});tail.push(tp);tp=gp(tp,0,0,-.56)}
  const flame=cone(tp,.28,.9,lava,0,0,-.5,{e:lava,ei:1.6,j:0,rx:-Math.PI/2});
  cone(tp,.16,.6,'#ffe060',0,0,-.45,{e:'#ffe060',ei:1.8,j:0,rx:-Math.PI/2});
  const tipGl=glow(tp,0xff6a20,1.8,0,0,-.5,.7);
  glow(R,0xff2a3a,4.5,0,1.8,.4,.3);
  const rE=rate(14),rF=rate(95),v1=new T.Vector3(),v2=new T.Vector3(),q=new T.Quaternion();
  return{root:R,cam:{y:2.2,d:11.5},
    tick(t,dt){
      body.scale.y=1+Math.sin(t*1.8)*.015;
      nk.forEach((n,i)=>{n.rotation.y=Math.sin(t*.8-i*.5)*.1});
      head.rotation.y=Math.sin(t*.6)*.25;
      const ph=t%6,open=ph>3.2&&ph<4.7?Math.min(1,(ph-3.2)*4,(4.7-ph)*4):Math.max(0,Math.sin(t*1.2))*.08;
      jaw.rotation.x=open*.7;
      const flap=Math.sin(t*2.2);wings.forEach(w=>{w.rotation.z=.2+flap*.45});
      tail.forEach((s,i)=>{s.rotation.y=Math.sin(t*1.5-i*.55)*.16});
      bsp.forEach((c,i)=>{c.material.emissiveIntensity=.2*(.5+.5*Math.sin(t*3-i))});
      eyes.forEach(e=>{e.material.emissiveIntensity=1.8+.6*Math.sin(t*3)});
      flame.scale.y=1+.25*Math.sin(t*12);tipGl.material.opacity=.55+.25*Math.sin(t*8);
      R.updateMatrixWorld(true);
      if(open>.5){mouth.getWorldPosition(v1);head.getWorldQuaternion(q);v2.set(0,-.22,1).applyQuaternion(q);
        rF(dt,()=>{const sp=rr(2.5,4);emit([v1.x+rr(-.06,.06),v1.y+rr(-.06,.06),v1.z+rr(-.06,.06)],[v2.x*sp+rr(-.4,.4),v2.y*sp+rr(-.2,.6),v2.z*sp+rr(-.4,.4)],rr(.5,.9),rr(.16,.3),pick([[1,.85,.3],[1,.5,.1],[1,.25,.1]]),.8)})}
      rE(dt,()=>{const s=Math.random()<.5?-1:1;emit([s*rr(.3,1.2),rr(1.2,2.8),rr(-1.5,1.4)],[rr(-.3,.3),rr(.8,1.8),rr(-.3,.3)],rr(1.2,2),.1,pick([[1,.3,.2],[1,.6,.2],[1,.85,.4]]),.2)});
    },
    burst(){for(let i=0;i<90;i++){const a=rr(0,6.28);emit([Math.cos(a)*.7,rr(.8,3),Math.sin(a)*.7],[Math.cos(a)*rr(1,3.4),rr(.8,3),Math.sin(a)*rr(1,3.4)],rr(.9,1.6),rr(.12,.24),pick([[1,.85,.3],[1,.5,.1],[1,.25,.1]]),-.6)}}
  };
}
// ================= T7 Celestial Kitsune (Divine)
function petKitsune(){
  const R=new T.Group();
  const H=gp(R,0,.45,0);
  const wh='#fdfbf4',cr='#efe6d2',go='#ffcf4a',goD='#c8921a',cy='#6ae8ff';
  const GL={e:go,ei:.8,j:0},CY={e:cy,ei:1.5,j:0};
  for(const[sx,sz]of[[-1,.55],[1,.55],[-1,-.5],[1,-.5]]){
    const l=gp(H,sx*.26,.95,sz);
    bx(l,.22,.7,.24,wh,0,-.35,0);bx(l,.25,.26,.27,go,0,-.82,.01,{e:go,ei:.35,j:.03});bx(l,.26,.08,.36,goD,0,-.96,.05,{j:.03});
  }
  const body=gp(H,0,0,0);
  bx(body,.8,.8,1.6,wh,0,1.35,0);
  bx(body,.66,.4,1.3,cr,0,1.05,.05,{j:.03});
  for(let i=0;i<4;i++)bx(body,.84,.06,.12,go,0,1.4,.5-i*.32,Object.assign({},GL,{rx:0}));
  bx(body,.6,.5,.1,go,0,1.35,.84,{e:go,ei:.4,j:.02,m:.4,r:.4});
  const chestGem=oct(body,.13,cy,0,1.38,.93,CY);
  for(const s of[-1,1]){bx(body,.3,.3,.3,wh,s*.42,1.72,.62);bx(body,.26,.26,.26,wh,s*.44,1.5,.7)}
  // head
  const head=gp(H,0,1.98,.92);
  bx(head,.8,.66,.7,wh,0,0,0);
  bx(head,.36,.3,.56,wh,0,-.12,.56);
  bx(head,.14,.1,.1,'#14101c',0,-.02,.86,{j:0,r:.3});
  bx(head,.5,.18,.1,wh,0,-.24,.2);
  for(const s of[-1,1]){
    bx(head,.22,.28,.4,wh,s*.46,-.12,.08);bx(head,.12,.2,.3,wh,s*.56,-.2,0);
    bx(head,.2,.1,.06,'#e8ffff',s*.22,.1,.36,Object.assign({},CY,{rz:-s*.28,ei:1.9}));
    bx(head,.26,.05,.06,go,s*.22,.2,.37,Object.assign({},GL,{rz:-s*.28}));
    bx(head,.2,.04,.05,go,s*.34,-.04,.36,GL);bx(head,.14,.04,.05,go,s*.36,-.12,.36,GL);
  }
  bx(head,.06,.2,.05,go,0,.22,.36,GL);
  const fg=oct(head,.12,go,0,.34,.36,{e:go,ei:1.4,j:0});
  const ears=[];
  for(const s of[-1,1]){
    const e=gp(head,s*.28,.33,-.04);e.rotation.z=-s*.12;
    cone(e,.22,.8,wh,0,.4,0,{j:.02});cone(e,.13,.55,go,0,.34,.1,{j:.02,e:go,ei:.3});
    cone(e,.08,.2,cy,0,.82,0,CY);ears.push(e);
  }
  // nine tails
  const tails=[];
  const cols=['#fdfbf4','#fff4d0','#ffe89a','#ffd24a','#b8f0ff','#6ae8ff'];
  const tw=[.55,.82,.95,.82,.58,.3];
  for(let i=0;i<9;i++){
    const d=Math.abs(i-4);
    const outer=gp(H,0,1.45,-.75);outer.rotation.y=Math.PI+(i-4)*.27;
    const base=gp(outer,0,0,0);base.rotation.x=.32+(4-d)*.09;
    let p=base;const segs=[];
    for(let j=0;j<6;j++){
      const w=tw[j];
      bx(p,w,w,.62,cols[j],0,0,.3,{e:j>3?cy:go,ei:j>3?.5:.12,j:.02});
      if(j<5){for(const s of[-1,1]){bx(p,w*.5,w*.7,.5,cols[j],s*w*.4,(j%2?.06:-.06),.3,{j:.03,ry:s*.25,e:j>3?cy:go,ei:j>3?.4:.08});bx(p,w*.5,w*.5,.4,cols[j],s*w*.2,w*.4,.34,{j:.03,e:j>3?cy:go,ei:j>3?.4:.08})}}
      segs.push(p);const n=gp(p,0,0,.56);p=n;
    }
    cone(p,.16,.5,'#ffffff',0,0,.2,{e:i%2?cy:go,ei:1.5,j:0,rx:Math.PI/2});
    const g=glow(p,i%2?0x6ae8ff:0xffd24a,1.1,0,0,.2,.7);
    tails.push({segs,i,g});
  }
  // magic circle on floor
  const circ=gp(R,0,.03,0);
  const c1=torus(circ,1.95,.03,go,0,0,0,{e:go,ei:1.3,j:0});c1.rotation.x=Math.PI/2;
  const c2=torus(circ,1.45,.025,'#ffffff',0,0,0,{e:'#ffffff',ei:1.2,j:0});c2.rotation.x=Math.PI/2;
  for(let i=0;i<14;i++){const a=i/14*6.283;bx(circ,.16,.02,.2,go,Math.cos(a)*1.7,0,Math.sin(a)*1.7,{e:go,ei:1.2,j:0,ry:-a})}
  glow(R,0xffe08a,5,0,.4,0,.35);
  // orbiting stars and spirit flames
  const stars=[];
  for(let i=0;i<6;i++){const o=gp(R,0,0,0);const c=[go,'#ffffff',cy][i%3];oct(o,.14+.04*(i%2),c,0,0,0,{e:c,ei:1.6,j:0});glow(o,new T.Color(c),.7,0,0,0,.7);stars.push(o)}
  const flames=[];
  for(const s of[-1,1]){const f=gp(R,s*1.05,2.2,.4);sph(f,.12,cy,0,0,0,CY);cone(f,.1,.4,cy,0,.25,0,Object.assign({},CY,{ei:1}));glow(f,0x6ae8ff,1,0,.1,0,.8);flames.push(f)}
  const pl=new T.PointLight(0xffe6a0,1.0,10);pl.position.set(0,3,2);R.add(pl);
  const r1=rate(18),r2=rate(6);
  return{root:R,cam:{y:2.1,d:12.5},
    tick(t,dt){
      H.position.y=.45+Math.sin(t*1.3)*.1;
      body.scale.y=1+Math.sin(t*2)*.012;
      head.rotation.y=Math.sin(t*.6)*.25;head.rotation.z=Math.sin(t*.9)*.05;
      ears.forEach((e,i)=>{e.rotation.x=Math.max(0,Math.sin(t*1.4+i*1.2))*.18});
      tails.forEach(({segs,i,g})=>{segs.forEach((s,j)=>{s.rotation.y=Math.sin(t*1.5+i*.7-j*.55)*.14;s.rotation.x=-(.1+Math.sin(t*1.2+i*.5-j*.4)*.07)});g.material.opacity=.5+.3*Math.sin(t*3+i)});
      circ.rotation.y=-t*.25;
      chestGem.rotation.y=t*2;
      stars.forEach((o,i)=>{const a=t*.7+i*1.047,r=2.0+.15*Math.sin(t+i);o.position.set(Math.cos(a)*r,1.0+i*.38+Math.sin(t*1.2+i)*.2,Math.sin(a)*r);o.rotation.y=t*2;o.rotation.z=t*1.3});
      flames.forEach((f,i)=>{f.position.y=2.2+Math.sin(t*1.8+i*2)*.15;f.rotation.y=t*2;f.children[1].scale.y=1+.3*Math.sin(t*9+i)});
      r1(dt,()=>{const a=rr(0,6.28),r=rr(.3,2.2);emit([Math.cos(a)*r,rr(.2,3.4),Math.sin(a)*r],[rr(-.15,.15),rr(.5,1.1),rr(-.15,.15)],rr(1.6,2.8),pick([.08,.12,.16,.22]),pick([[1,1,1],[1,.88,.5],[.5,.95,1]]),0)});
      r2(dt,()=>{const a=rr(0,6.28);emit([Math.cos(a)*1.9,.1,Math.sin(a)*1.9],[0,rr(.8,1.6),0],rr(1.4,2.2),.14,[1,.85,.4],0)});
    },
    burst(){for(let i=0;i<110;i++){const a=rr(0,6.28);emit([Math.cos(a)*.6,rr(.4,3.2),Math.sin(a)*.6],[Math.cos(a)*rr(1,3.2),rr(.5,2.6),Math.sin(a)*rr(1,3.2)],rr(1.2,2.2),rr(.1,.2),pick([[1,1,1],[1,.88,.5],[.5,.95,1]]),-.3)}}
  };
}
// ================= audio (synthesized, no files)
let AC=null,MASTER=null,noiseBuf=null;
/* Suara pet ikut pengaturan: tombol Suara (PlayerData.settings().sound) + slider Efek suara (Prefs sfxVol), sama seperti UT.Audio. */
function sfxVolume(){let v=1;try{const p=parseInt(UT.Prefs.get('sfxVol',100),10);if(!isNaN(p))v=Math.max(0,Math.min(100,p))/100}catch(e){}return v}
function sfxEnabled(){try{return !!window.PlayerData.settings().sound&&sfxVolume()>0&&!(UT.Audio&&UT.Audio.isMuted&&UT.Audio.isMuted())}catch(e){return true}}
function applyMaster(){if(MASTER)MASTER.gain.value=.55*sfxVolume()}
function audioInit(){
  if(AC){if(AC.state==='suspended')AC.resume();applyMaster();return true}
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return false;
  try{
    AC=new C();const comp=AC.createDynamicsCompressor();
    MASTER=AC.createGain();MASTER.gain.value=.55*sfxVolume();MASTER.connect(comp);comp.connect(AC.destination);
    if(AC.state==='suspended')AC.resume();
  }catch(e){AC=null;return false}
  try{petPreloadFiles()}catch(e){}
  return true;
}
// f0 -> f1 over dur. o: attack, lp (lowpass hz), vib (hz), vibd (depth hz), then (extra target hz at the end)
function tone(f0,f1,dur,type,vol,delay,o){
  o=o||{};const t0=AC.currentTime+(delay||0);
  const os=AC.createOscillator(),g=AC.createGain();os.type=type||'sine';
  os.frequency.setValueAtTime(f0,t0);
  if(o.then){os.frequency.exponentialRampToValueAtTime(f1,t0+dur*.45);os.frequency.exponentialRampToValueAtTime(o.then,t0+dur)}
  else if(f1&&f1!==f0)os.frequency.exponentialRampToValueAtTime(f1,t0+dur);
  g.gain.setValueAtTime(.0001,t0);g.gain.linearRampToValueAtTime(vol,t0+(o.attack||.01));g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
  let n=os;
  if(o.lp){const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=o.lp;os.connect(f);n=f}
  if(o.vib){const l=AC.createOscillator(),lg=AC.createGain();l.frequency.value=o.vib;lg.gain.value=o.vibd||f0*.03;l.connect(lg);lg.connect(os.frequency);l.start(t0);l.stop(t0+dur+.05)}
  n.connect(g);g.connect(MASTER);os.start(t0);os.stop(t0+dur+.05);
}
function noise(dur,vol,type,f0,f1,delay,q){
  if(!noiseBuf){noiseBuf=AC.createBuffer(1,AC.sampleRate*1.6,AC.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}
  const t0=AC.currentTime+(delay||0);
  const s=AC.createBufferSource();s.buffer=noiseBuf;
  const f=AC.createBiquadFilter();f.type=type||'bandpass';f.frequency.setValueAtTime(f0,t0);if(f1)f.frequency.exponentialRampToValueAtTime(f1,t0+dur);f.Q.value=q||1;
  const g=AC.createGain();g.gain.setValueAtTime(.0001,t0);g.gain.linearRampToValueAtTime(vol,t0+Math.min(.03,dur/3));g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
  s.connect(f);f.connect(g);g.connect(MASTER);s.start(t0,Math.random()*.3);s.stop(t0+dur+.05);
}

// 3 sounds per pet, same order as PETS
const SND=[
 [ // Forest Pup: guk guk, yip, rengekan
  ()=>{tone(420,220,.16,'sawtooth',.32,0,{lp:1800});noise(.1,.16,'bandpass',900,500,0);tone(460,240,.15,'sawtooth',.3,.22,{lp:1800});noise(.09,.14,'bandpass',900,500,.22)},
  ()=>{tone(700,950,.09,'square',.1,0,{lp:2500});tone(760,1000,.09,'square',.1,.13,{lp:2500});tone(820,1060,.1,'square',.09,.26,{lp:2500})},
  ()=>{tone(620,380,.75,'sine',.22,0,{vib:7,vibd:14,attack:.05})}
 ],
 [ // Copper Golem: denting logam, uap, servo
  ()=>{tone(880,880,.4,'triangle',.22,0);tone(1320,1320,.32,'triangle',.14,0);tone(1990,1990,.22,'triangle',.08,0);noise(.05,.18,'highpass',3000,0,0)},
  ()=>{noise(.9,.26,'highpass',2500,4500,0)},
  ()=>{tone(140,320,.5,'sawtooth',.16,0,{lp:900});tone(320,160,.45,'sawtooth',.13,.5,{lp:900})}
 ],
 [ // Crystal Axolotl: gelembung, lonceng air, cicit
  ()=>{for(let i=0;i<4;i++)tone(300+i*120,900+i*200,.08,'sine',.22,i*.1)},
  ()=>{tone(1318,1318,.7,'sine',.16,0);tone(1760,1760,.8,'sine',.12,.13)},
  ()=>{tone(900,1500,.13,'triangle',.18,0);tone(1100,1700,.13,'triangle',.16,.17)}
 ],
 [ // Arcane Owl: hu-hu, denting arcane, kepakan
  ()=>{tone(340,300,.45,'sine',.3,0,{lp:700,attack:.08});tone(340,290,.55,'sine',.3,.62,{lp:700,attack:.08})},
  ()=>{[660,990,1320,1980].forEach((f,i)=>tone(f,f,1.2,'sine',.1,i*.1,{vib:5,vibd:3}))},
  ()=>{for(let i=0;i<6;i++)noise(.09,.16,'bandpass',900,600,i*.1,1.5)}
 ],
 [ // Storm Wolf: lolongan, guntur, setrum
  ()=>{tone(330,700,1.8,'sine',.24,0,{vib:5,vibd:8,then:520,attack:.3});tone(660,1400,1.8,'triangle',.07,0,{vib:5,vibd:16,then:1040,attack:.35});noise(1.6,.05,'bandpass',1200,1600,.1,2)},
  ()=>{noise(.12,.5,'highpass',1500,800,0);noise(.35,.4,'bandpass',500,200,.05,.6);noise(.7,.35,'bandpass',300,120,.3,.5);noise(1.0,.25,'bandpass',200,90,.7,.5)},
  ()=>{for(let i=0;i<7;i++)noise(.03,.3,'highpass',4000,0,i*.035+Math.random()*.02);tone(3200,700,.18,'sine',.1,0)}
 ],
 [ // Inferno Dragon: raungan, semburan api, kepakan sayap
  ()=>{tone(110,55,1.1,'sawtooth',.28,0,{lp:700,vib:18,vibd:8,attack:.1});noise(1.1,.28,'lowpass',500,200,0)},
  ()=>{noise(1.0,.4,'bandpass',500,1800,0,.8);noise(1.0,.2,'lowpass',300,150,0)},
  ()=>{for(let i=0;i<2;i++){tone(90,45,.28,'sine',.5,i*.45);noise(.3,.28,'lowpass',500,150,i*.45)}}
 ],
 [ // Celestial Kitsune: lonceng arpeggio, lengkingan rubah, kilau
  ()=>{[880,1175,1319,1760].forEach((f,i)=>tone(f,f,.9,'sine',.15,i*.11))},
  ()=>{tone(800,1500,.5,'sine',.2,0,{vib:8,vibd:20,then:900,attack:.05})},
  ()=>{[2093,2637,3136].forEach((f,i)=>tone(f,f,1.0,'sine',.06,i*.05,{vib:9,vibd:f*.01}));noise(.9,.05,'highpass',6000,9000,0)}
 ]
];
/* Suara Forest Pup (anjing), Copper Golem (logam/uap/servo), dan Crystal Axolotl (gelembung/lonceng air/cicit), Arcane Owl (hu-hu/denting arcane/kepakan), Storm Wolf (lolongan/guntur/setrum), Inferno Dragon (raungan/semburan api/kepakan sayap), dan Celestial Kitsune (lonceng/lengkingan rubah/kilau) = rekaman asli (assets/sfx/pet/, kekerasan diseragamkan oleh tools/normalize-sfx.py).
   Urutan sama dengan SND[indeks pet]. Forest Pup: gonggongan beruntun, satu gonggongan, rengekan. Sintesis lama jadi cadangan bila file belum dimuat/gagal. */
const PET_FILES={
 0:['assets/sfx/pet/forest-pup-bark-burst.mp3','assets/sfx/pet/forest-pup-bark.mp3','assets/sfx/pet/forest-pup-whimper.mp3'],
 1:['assets/sfx/pet/copper-golem-clang.mp3','assets/sfx/pet/copper-golem-steam.mp3','assets/sfx/pet/copper-golem-servo.mp3'], /* denting logam, uap, servo */
 2:['assets/sfx/pet/crystal-axolotl-bubble.mp3','assets/sfx/pet/crystal-axolotl-chime.mp3','assets/sfx/pet/crystal-axolotl-squeak.mp3'], /* gelembung, lonceng air, cicit */
 3:['assets/sfx/pet/arcane-owl-hoot.mp3','assets/sfx/pet/arcane-owl-sparkle.mp3','assets/sfx/pet/arcane-owl-flap.mp3'], /* hu-hu, denting arcane, kepakan */
 4:['assets/sfx/pet/storm-wolf-howl.mp3','assets/sfx/pet/storm-wolf-thunder.mp3','assets/sfx/pet/storm-wolf-zap.mp3'], /* lolongan, guntur, setrum */
 5:['assets/sfx/pet/inferno-dragon-roar.mp3','assets/sfx/pet/inferno-dragon-fire.mp3','assets/sfx/pet/inferno-dragon-wings.mp3'], /* raungan, semburan api, kepakan sayap */
 6:['assets/sfx/pet/celestial-kitsune-bell.mp3','assets/sfx/pet/celestial-kitsune-cry.mp3','assets/sfx/pet/celestial-kitsune-shine.mp3'] /* lonceng, lengkingan rubah, kilau */
};
const petBuf={},petLoading={};
function petLoad(url){
  if(petBuf[url]||petLoading[url]||!AC)return;
  petLoading[url]=1;
  fetch(url).then(r=>{if(!r.ok)throw 0;return r.arrayBuffer()}).then(b=>new Promise((ok,no)=>AC.decodeAudioData(b,ok,no))).then(buf=>{petBuf[url]=buf}).catch(()=>{}).then(()=>{delete petLoading[url]});
}
function petPlayFile(url,fallback){
  const b=petBuf[url];
  if(!b||!AC){petLoad(url);try{fallback&&fallback()}catch(e){}return}
  const s=AC.createBufferSource();s.buffer=b;s.connect(MASTER);s.start();
}
function petPreloadFiles(){Object.keys(PET_FILES).forEach(k=>PET_FILES[k].forEach(petLoad))}
Object.keys(PET_FILES).forEach(k=>PET_FILES[k].forEach((url,i)=>{const synth=SND[k][i];SND[k][i]=()=>petPlayFile(url,synth)}));
const PETS=[
 {id:'forest_pup',tier:1,name:'Forest Pup',mat:'Oak Wood dan Daun',ident:'Ramah dan setia',efek:'Ekor bergoyang, daun jatuh pelan',lore:'Anak anjing hutan dengan kalung papan kayu. Gerakannya sederhana: bernapas, mengibas ekor, berkedip.',color:'#6fd05a',build:petPup},
 {id:'copper_golem',tier:2,name:'Copper Golem',mat:'Copper Block dan Verdigris',ident:'Industrial dan rajin',efek:'Roda gigi berputar, uap, lampu antena berdenyut',lore:'Golem tembaga dengan bercak karat hijau, panel pengukur di dada, dan roda gigi di punggung.',color:'#ff9a30',build:petGolem},
 {id:'crystal_axolotl',tier:3,name:'Crystal Axolotl',mat:'Diamond Crystal',ident:'Tenang dan berkilau',efek:'Insang bergetar, ekor berombak, gelembung kristal',lore:'Axolotl berwarna es dengan kristal tumbuh di punggung dan permata di dahi. Mengambang pelan di atas panggung.',color:'#40e8f4',build:petAxolotl},
 {id:'arcane_owl',tier:4,name:'Arcane Owl',mat:'Amethyst dan Rune',ident:'Bijak dan arcane',efek:'Cincin rune berputar, kristal mengorbit, kilau ungu',lore:'Burung hantu bertengger di gugus amethyst. Dua cincin rune berputar berlawanan di belakang kepalanya.',color:'#b46af0',build:petOwl},
 {id:'storm_wolf',tier:5,name:'Storm Wolf',mat:'Storm Steel dan Lightning Crystal',ident:'Thunder Lord',efek:'Petir menyambar dari awan, surai listrik',lore:'Serigala baja dengan surai duri petir. Awan badai di atasnya menyambar tanah dan surainya secara acak.',color:'#7fd0ff',build:petWolf},
 {id:'inferno_dragon',tier:6,name:'Inferno Dragon',mat:'Dragon Scale dan Obsidian',ident:'Dragon Lord',efek:'Kepakan sayap, napas api, bara menyala',lore:'Naga obsidian dengan retakan lava di dada. Setiap beberapa detik rahangnya terbuka dan menyemburkan api.',color:'#ff4a3a',build:petDragon},
 {id:'celestial_kitsune',tier:7,name:'Celestial Kitsune',mat:'Divine Crystal dan Gold',ident:'Celestial Guardian',efek:'Sembilan ekor tebal bergelombang, bintang mengorbit',lore:'Rubah sembilan ekor melayang di atas lingkaran sihir. Ekornya besar, berbulu tebal, mengembang seperti kipas dan berujung bintang.',color:'#ffe08a',build:petKitsune}
];

/* ================= scene: latar transparan, tanpa pad, kanvas besar, tanpa zoom ================= */
const view=document.getElementById('fpv'),canvas=document.getElementById('petGl');
let renderer=null;
try{renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,premultipliedAlpha:true})}catch(err){
  view.insertAdjacentHTML('beforeend','<div class="gl-fail">WebGL tidak tersedia, pratinjau 3D tidak bisa ditampilkan.</div>');
}
const RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
let pendingId=null,selectFn=null;
if(renderer){
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.setClearColor(0x000000,0);
const scene=new T.Scene();
const camera=new T.PerspectiveCamera(40,1,.1,100);
scene.add(new T.HemisphereLight(0xcfe0ff,0x201838,.8));
const key=new T.DirectionalLight(0xffffff,.85);key.position.set(4,7,5);scene.add(key);
const rim=new T.DirectionalLight(0xffffff,.8);rim.position.set(-5,3,-5);scene.add(rim);
const fill=new T.PointLight(0xffffff,.5,12);fill.position.set(0,.6,3.5);scene.add(fill);
P=new Particles(scene,900);

/* kamera: hanya putar (seret). Tanpa zoom: roda mouse dan cubit tidak mengubah jarak. */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let az=.6,azT=.6,pol=1.3,polT=1.3,dist=9,distT=9,ty=1.5,tyT=1.5,camD=9,idle=0,autoRot=!RM,pop=0,drag=null;
function resetCam(){azT=.6;polT=1.3;distT=camD}
canvas.addEventListener('pointerdown',e=>{try{canvas.setPointerCapture(e.pointerId)}catch(_){}if(drag===null)drag={id:e.pointerId,x:e.clientX,y:e.clientY};idle=2.5});
canvas.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id)return;
  azT-=(e.clientX-drag.x)*.009;polT=clamp(polT-(e.clientY-drag.y)*.006,.4,1.65);
  drag.x=e.clientX;drag.y=e.clientY;
});
const up=e=>{if(drag&&e.pointerId===drag.id)drag=null;idle=2.5};
canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
canvas.addEventListener('wheel',e=>e.preventDefault(),{passive:false});
canvas.addEventListener('dblclick',resetCam);

function resize(){
  const w=Math.max(1,view.clientWidth),h=Math.max(1,view.clientHeight);
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  P.u.uScale.value=renderer.domElement.height/(2*Math.tan(camera.fov*Math.PI/360));
}
new ResizeObserver(resize).observe(view);resize();

let pet=null,cur=-1;
function disposeObj(o){o.traverse(m=>{if(m.geometry)m.geometry.dispose();if(m.material)(Array.isArray(m.material)?m.material:[m.material]).forEach(x=>x.dispose())})}
let soundOn=false,sndT=1,sndBag=[],bagLast=-1;
function playPetSound(){
  applyMaster();if(!soundOn||!sfxEnabled()||!AC||AC.state!=='running'||cur<0)return;
  if(!sndBag.length){sndBag=[0,1,2].sort(()=>Math.random()-.5);if(sndBag[sndBag.length-1]===bagLast)sndBag.reverse()}
  const k=sndBag.pop();bagLast=k;
  try{SND[cur][k]()}catch(e){}
}
function unlockAudio(){if(audioInit())soundOn=true}
['pointerdown','keydown','touchstart'].forEach(ev=>window.addEventListener(ev,unlockAudio,{passive:true}));
selectFn=function(i){
  const d=PETS[i];const changed=cur!==i;cur=i;
  if(pet){scene.remove(pet.root);disposeObj(pet.root)}
  P.clear();
  pet=d.build();scene.add(pet.root);
  rim.color.set(d.color);fill.color.set(d.color);
  camD=pet.cam.d;tyT=pet.cam.y;resetCam();pop=.1;sndT=.9;sndBag=[];
  if(changed&&soundOn)setTimeout(playPetSound,120);
  canvas.setAttribute('aria-label','Pratinjau 3D '+d.name);
};

let last=performance.now(),t=0;
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(.05,(now-last)/1000);last=now;t+=dt;
  if(idle>0)idle-=dt;
  sndT-=dt;if(sndT<=0){sndT=rr(3,5.5);playPetSound()}
  if(autoRot&&!drag&&idle<=0)azT+=dt*.4;
  const k=1-Math.exp(-dt*9);
  az+=(azT-az)*k;pol+=(polT-pol)*k;dist+=(distT-dist)*k;ty+=(tyT-ty)*k;
  const asp=camera.aspect,dd=dist*(asp<1?1+(1-asp)*.8:1);
  camera.position.set(Math.sin(pol)*Math.sin(az)*dd,ty+Math.cos(pol)*dd*.9-dd*.18,Math.sin(pol)*Math.cos(az)*dd);
  camera.lookAt(0,ty,0);
  if(pet){pet.tick(t,dt);pop*=Math.exp(-dt*5);pet.root.scale.setScalar(1+pop)}
  P.update(dt);
  renderer.render(scene,camera);
}
requestAnimationFrame(frame);
}

window.PetViewer={
  select(id){
    const i=PETS.findIndex(d=>d.id===id);if(i<0)return;
    if(selectFn){selectFn(i);}
  }
};
})();
