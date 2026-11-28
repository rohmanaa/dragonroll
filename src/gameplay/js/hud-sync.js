
/* HUD saja (tanpa logika game): sinkron avatar/tab giliran, animasi transisi, panah power-up */
(function(){try{
 var tn=document.querySelector('.tn'),n=document.getElementById('turnName');if(!tn||!n)return;
 var tab=tn.querySelector('h3'),av=document.getElementById('tnAv'),img=document.getElementById('tnAvImg'),st=document.getElementById('tnSt'),lv=document.getElementById('tnLv');
 function sync(){try{var on=document.querySelector('#players .pr.on img');if(on&&on.src)img.src=on.src;img.style.visibility=img.getAttribute('src')?'visible':'hidden';var p=null;try{p=(typeof players!=='undefined'&&players[cur])||null}catch(e){}if(!p)return;var cpu=!!p.cpu,solo=(typeof mode!=='undefined'&&mode==='cpu');
  tn.classList.toggle('is-cpu',cpu);tn.classList.toggle('is-wait',cpu);
  tab.textContent=(typeof turnTag==='function')?turnTag():p.name;
  if(p.css){av.style.setProperty('--pc',p.css);tn.style.setProperty('--tnc',p.css)}
  if(!img.getAttribute('src')&&typeof framedFace==='function')img.src=framedFace(p);
  lv.style.display=cpu?'none':'';st.textContent=cpu?'Berpikir...':'Online'}catch(e){}}
 new MutationObserver(function(){sync();tn.classList.remove('swap');void tn.offsetWidth;tn.classList.add('swap')}).observe(n,{childList:true,characterData:true,subtree:true});
 sync();
 setTimeout(function(){var own='H3,.TROW,.MSG,BUTTON,.TN-AV,.TN-META';if([].some.call(tn.children,function(c){return !(c.tagName==='H3'||c.classList.contains('trow')||c.classList.contains('msg')||c.id==='btnRoll'||c.id==='btnAuto'||c.id==='tnAv'||c.id==='tnMeta')}))tn.classList.add('ext')},900);
 var pus=document.getElementById('pus');
 if(pus){pus.addEventListener('wheel',function(e){if(Math.abs(e.deltaY)>Math.abs(e.deltaX)&&pus.scrollWidth>pus.clientWidth){pus.scrollLeft+=e.deltaY;e.preventDefault()}},{passive:false})} /* panah dihapus: geser dengan swipe / roda mouse */
}catch(e){}})();
