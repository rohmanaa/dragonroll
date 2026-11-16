(function(global){
"use strict";
const registry=global.UT&&global.UT.PetModelRegistry;
if(!registry)throw new Error('PetModelRegistry must load before the Storm Wolf model');

function buildStormWolf(context){
  if(!context||!context.THREE||!context.helpers||typeof context.emit!=='function'){
    throw new TypeError('Storm Wolf requires the shared PetViewer context');
  }
  const T=context.THREE,helpers=context.helpers,emit=context.emit;
  const {bx,cone,oct,gp,makeBolt,zig,glow,rate,rr,pick}=helpers;
  if([bx,cone,oct,gp,makeBolt,zig,glow,rate,rr,pick].some(fn=>typeof fn!=='function')){
    throw new TypeError('Storm Wolf is missing a shared PetViewer helper');
  }
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

registry.register('storm_wolf',buildStormWolf);
})(window);
