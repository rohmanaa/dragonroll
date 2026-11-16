(function(global){
"use strict";
const registry=global.UT&&global.UT.PetModelRegistry;
if(!registry)throw new Error('PetModelRegistry must load before the Celestial Kitsune model');

function buildCelestialKitsune(context){
  if(!context||!context.THREE||!context.helpers||typeof context.emit!=='function'){
    throw new TypeError('Celestial Kitsune requires the shared PetViewer context');
  }
  const T=context.THREE,helpers=context.helpers,emit=context.emit;
  const {bx,cone,oct,torus,glow,gp,sph,rate,rr,pick}=helpers;
  if([bx,cone,oct,torus,glow,gp,sph,rate,rr,pick].some(fn=>typeof fn!=='function')){
    throw new TypeError('Celestial Kitsune is missing a shared PetViewer helper');
  }
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

registry.register('celestial_kitsune',buildCelestialKitsune);
})(window);
