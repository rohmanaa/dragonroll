/* Gameplay Feedback — presentasi visual (Stage 4.1.14): indikator pemain aktif (marker di atas pawn) dan kartu hadiah Chest / kartu serangan.
   Dipindahkan APA ADANYA dari gameplay.html (DOM id #puCard/#pcWho/#pcName/#pcDesc/#pcEmoji, kelas 'pop', jeda 75ms/900ms/1500ms/1600ms, suara, urutan).
   BERBEDA dari UT.Gameplay.Feedback (module-bridge.js = adapter routing HUD: short/event/reward). Modul ini tidak memanggil HUD/Feedback dan tidak mengubah state gameplay;
   showPUCard tetap didaftarkan gameplay sebagai presenter Feedback.reward. Kapan feedback ditampilkan (urutan aksi) tetap ditentukan gameplay.html.
   Dependensi diberikan lewat init({sfx, sleep, reduce}); data Power dibaca dari UT.Gameplay.Config.PUN (sumber yang sama dengan gameplay).
   Classic script. Namespace: UT.GameplayFeedback.
   API: init(deps) · setCurrentMarker(players, cur) · hideMarker(player) · updateTurnMarkers(players, now, dt) · showPUCard(p, k) · showAttackCard(attacker, defender, weapon, desc, {silent}) — silent:true = tanpa sfx.pop (pemanggil memutar suara sendiri) · showChestRewardCard(who, text) / hideChestRewardCard() — card reward Chest compact (tanpa sfx) */
(function (win, doc) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.GameplayFeedback) return;

  var SILENT = (typeof Proxy === 'function') ? new Proxy({}, { get: function () { return function () {}; } }) : { rewardpower: function () {}, pop: function () {} };
  var sfx = SILENT, sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); }, reduce = false;
  function $(id) { return doc.getElementById(id); }
  function setIco(el, k, fb) { var C = UT.Gameplay && UT.Gameplay.Config, P = getPUN(); if (C && C.setPuIcon) return C.setPuIcon(el, k, fb); el.textContent = P[k] ? P[k][0] : (fb || ''); return el; }
  function getPUN() { var G = UT.Gameplay; return (G && G.Config && G.Config.PUN) || {}; }

  function init(o) {
    o = o || {};
    if (o.sfx) sfx = o.sfx;
    if (typeof o.sleep === 'function') sleep = o.sleep;
    reduce = !!o.reduce;
    return true;
  }

  /* ---- Indikator pemain aktif (marker oktahedron di atas pawn) ---- */
  function setCurrentMarker(players, cur) { players.forEach(function (q, i) { q.pawn.userData.marker.visible = (i === cur); }); }
  function hideMarker(p) { p.pawn.userData.marker.visible = false; }
  function updateTurnMarkers(players, now, dt) {
    players.forEach(p=>{
      const mk=p.pawn.userData.marker;
      if(mk.visible){ mk.position.y=1.22+Math.sin(now*0.004)*0.08; mk.rotation.y+=dt*2; }
    });
  }

  /* ---- Kartu hadiah Chest & kartu serangan (salinan persis) ---- */
  async function showPUCard(p,k){
     const PUN=getPUN();
     const c=$('puCard'),em=$('pcEmoji'),keys=Object.keys(PUN);
     $('pcWho').textContent=p.name+' membuka peti'; $('pcName').textContent='...'; $('pcDesc').textContent='';
     c.classList.remove('pop','chest','power-hit','mob-hit'); c.hidden=false;
     if(!reduce) for(let i=0;i<9;i++){ setIco(em,keys[i%keys.length]); await sleep(75); }
     sfx.rewardpower();
     setIco(em,k); $('pcName').textContent=PUN[k][1]; $('pcDesc').textContent=PUN[k][2]; c.classList.add('pop'); sfx.pop();
     await sleep(reduce?900:1500); c.hidden=true;
  }
  var atkTimer = 0;
  function showAttackCard(attacker,defender,weapon,desc,o){
     const PUN=getPUN();
     const c=$('puCard'),em=$('pcEmoji');
     $('pcWho').textContent=attacker+' → '+defender;
     $('pcName').textContent=PUN[weapon]?PUN[weapon][1]:weapon;
     $('pcDesc').textContent=desc;
     setIco(em,weapon,'⚔️');
     c.classList.remove('pop','chest'); c.classList.toggle('power-hit',!!(o&&o.powerHit)); c.classList.toggle('mob-hit',weapon==='hit'); c.hidden=false; c.classList.add('pop'); if(!(o&&o.silent)) sfx.pop();
     clearTimeout(atkTimer); atkTimer=setTimeout(()=>c.hidden=true,1600); /* timer lama dibatalkan: card baru tidak ikut tertutup timer card sebelumnya */
  }
  /* Kartu reward Chest (compact, tengah layar): reuse #puCard + kelas 'chest'. Tidak ada SFX di sini: pemanggil (giveChest) memutar SFX Chest/Reward 1x. Ditutup lewat hideChestRewardCard. */
  function showChestRewardCard(who,text){
     const c=$('puCard'),em=$('pcEmoji');
     clearTimeout(atkTimer);
     $('pcWho').textContent=who+' membuka peti'; $('pcName').textContent=text; $('pcDesc').textContent='';
     em.textContent='🎁';
     c.classList.remove('pop','power-hit','mob-hit'); c.classList.add('chest'); c.hidden=false; c.classList.add('pop');
  }
  function hideChestRewardCard(){ const c=$('puCard'); if(!c||!c.classList.contains('chest')) return; c.hidden=true; c.classList.remove('chest','pop','power-hit','mob-hit'); }

  UT.GameplayFeedback = { init: init, setCurrentMarker: setCurrentMarker, hideMarker: hideMarker, updateTurnMarkers: updateTurnMarkers, showPUCard: showPUCard, showAttackCard: showAttackCard, showChestRewardCard: showChestRewardCard, hideChestRewardCard: hideChestRewardCard };
})(window, document);
