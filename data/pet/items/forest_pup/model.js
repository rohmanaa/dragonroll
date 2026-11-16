(function(global){
"use strict";
const registry=global.UT&&global.UT.PetModelRegistry;
if(!registry)throw new Error('PetModelRegistry must load before the Forest Pup model');

function buildForestPup(context){
  if(!context||!context.THREE||!context.helpers||typeof context.emit!=='function'){
    throw new TypeError('Forest Pup requires the shared PetViewer context');
  }
  const T=context.THREE,{bx,gp,eye,rate,pick,rr}=context.helpers,emit=context.emit;
  if([bx,gp,eye,rate,pick,rr].some(fn=>typeof fn!=='function')){
    throw new TypeError('Forest Pup is missing a shared PetViewer helper');
  }
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
  bx(R,.98,.12,.5,'#6a3a1a',0,1.12,.62);
  bx(R,.22,.22,.05,'#b07a40',0,.98,.9,{j:.1});
  bx(R,.08,.08,.06,'#2a1608',0,.99,.93,{j:0});
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
  const sp=gp(head,.18,.4,-.05);
  bx(sp,.05,.28,.05,'#4a8a3a',0,.14,0,{j:0});
  bx(sp,.22,.1,.14,leaf[0],.12,.3,0,{rz:.4});bx(sp,.2,.1,.14,leaf[1],-.12,.22,0,{rz:-.4});bx(sp,.16,.1,.12,leaf[2],.02,.4,0);
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

registry.register('forest_pup',buildForestPup);
})(window);
