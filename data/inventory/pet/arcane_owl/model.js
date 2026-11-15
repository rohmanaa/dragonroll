(function(global){
"use strict";
const registry=global.UT&&global.UT.PetModelRegistry;
if(!registry)throw new Error('PetModelRegistry must load before the Arcane Owl model');

function buildArcaneOwl(context){
  if(!context||!context.THREE||!context.helpers||typeof context.emit!=='function'){
    throw new TypeError('Arcane Owl requires the shared PetViewer context');
  }
  const T=context.THREE,helpers=context.helpers,emit=context.emit;
  const {bx,cone,cyl,oct,torus,gp,eye,glow,rate,pick,rr}=helpers;
  if([bx,cone,cyl,oct,torus,gp,eye,glow,rate,pick,rr].some(fn=>typeof fn!=='function')){
    throw new TypeError('Arcane Owl is missing a shared PetViewer helper');
  }
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

registry.register('arcane_owl',buildArcaneOwl);
})(window);
