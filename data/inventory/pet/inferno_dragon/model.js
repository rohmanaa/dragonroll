(function(global){
"use strict";
const registry=global.UT&&global.UT.PetModelRegistry;
if(!registry)throw new Error('PetModelRegistry must load before the Inferno Dragon model');

function buildInfernoDragon(context){
  if(!context||!context.THREE||!context.helpers||typeof context.emit!=='function'){
    throw new TypeError('Inferno Dragon requires the shared PetViewer context');
  }
  const T=context.THREE,helpers=context.helpers,emit=context.emit;
  const {bx,cone,fan,mk,glow,gp,rate,rr,pick}=helpers;
  if([bx,cone,fan,mk,glow,gp,rate,rr,pick].some(fn=>typeof fn!=='function')){
    throw new TypeError('Inferno Dragon is missing a shared PetViewer helper');
  }
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

registry.register('inferno_dragon',buildInfernoDragon);
})(window);
