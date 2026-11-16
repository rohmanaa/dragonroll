(function(global){
"use strict";
const registry=global.UT&&global.UT.PetModelRegistry;
if(!registry)throw new Error('PetModelRegistry must load before the Copper Golem model');

function buildCopperGolem(context){
  if(!context||!context.THREE||!context.helpers||typeof context.emit!=='function'){
    throw new TypeError('Copper Golem requires the shared PetViewer context');
  }
  const T=context.THREE,{bx,cyl,gp,glow,sph,rate,rr,pick}=context.helpers,emit=context.emit;
  if([bx,cyl,gp,glow,sph,rate,rr,pick].some(fn=>typeof fn!=='function')){
    throw new TypeError('Copper Golem is missing a shared PetViewer helper');
  }
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

registry.register('copper_golem',buildCopperGolem);
})(window);
