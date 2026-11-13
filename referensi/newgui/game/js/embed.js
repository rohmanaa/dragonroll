/* Mode embed: halaman dibuka di dalam modal layar penuh Game Room (iframe, ?embed=1).
   Tombol kembali/home menutup modal (postMessage ke room.html) dan tidak berpindah halaman. */
(function(){
  if(new URLSearchParams(location.search).get('embed')!=='1')return;
  document.documentElement.classList.add('embed');
  const st=document.createElement('style');
  st.textContent='html.embed #home{display:none!important}';
  document.head.appendChild(st);
  const close=()=>{try{parent.postMessage({type:'room-close'},'*')}catch(e){}};
  document.addEventListener('click',e=>{
    if(e.target.closest('#back,#home')){e.stopImmediatePropagation();e.preventDefault();close()}
    else if(e.target.closest('.cur')){e.stopImmediatePropagation();e.preventDefault()}
  },true);
  addEventListener('keydown',e=>{if(e.key==='Escape')close()});
})();
