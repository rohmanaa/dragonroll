(function(global){
"use strict";
const registry=global.UT&&global.UT.PetModelRegistry;
if(!registry)throw new Error('PetModelRegistry must load before the Crystal Axolotl model');

function buildCrystalAxolotl(context){
  if(!context||!context.THREE||!context.helpers||typeof context.emit!=='function'){
    throw new TypeError('Crystal Axolotl requires the shared PetViewer context');
  }
  const T=context.THREE,{bx,cone,gp,eye,oct,glow,rate,pick,rr}=context.helpers,emit=context.emit;
  if([bx,cone,gp,eye,oct,glow,rate,pick,rr].some(fn=>typeof fn!=='function')){
    throw new TypeError('Crystal Axolotl is missing a shared PetViewer helper');
  }
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

registry.register('crystal_axolotl',buildCrystalAxolotl);
})(window);
