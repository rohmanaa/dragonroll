/* Gameplay Audio (Stage 4.1.11) — HANYA presentation suara: AudioContext lazy, beep/noise sintetis, dan objek SFX (file di assets/audio/sfx/<kategori>/ + fallback beep).
   Isi blok di bawah dipindahkan APA ADANYA dari gameplay.html (frekuensi, gain, durasi, path file, urutan fallback tidak diubah).
   Gameplay tetap yang menentukan KAPAN suara dimainkan; state mute/musik/persistence tetap di gameplay.html (modul hanya diberi setMuted).
   Tanpa timer gameplay; semua kegagalan audio ditelan di dalam helper (try/catch) sehingga game tidak berhenti.
   Classic script. Namespace: UT.GameplayAudio.
   API:  ensure()        — buat/resume AudioContext (dipanggil setelah interaksi user, seperti sebelumnya)
         play(name)      — mainkan SFX bernama (mis. 'pop','roll','chest'); nama tak dikenal diabaikan
         setMuted(bool)  — samakan status mute (dari tombol suara di gameplay)
         sfx             — objek SFX yang sama (sfx.pop() dst) untuk call site existing */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.GameplayAudio) return;

  let actx=null,muted=false,sfxV=1; /* sfxV: volume SFX 0..1 dari slider Suara di menu jeda */
  function ensureAudio(){
    try{
      if(!actx) actx=new (window.AudioContext||window.webkitAudioContext)();
      if(actx&&actx.state==='suspended') actx.resume();
    }catch(e){}
  }
  function beep(f,d,type,vol,when,to){
    if(muted||sfxV<=0||!actx) return;
    try{
      const t=actx.currentTime+(when||0),o=actx.createOscillator(),g=actx.createGain();
      o.type=type||'square'; o.frequency.setValueAtTime(f,t);
      if(to) o.frequency.exponentialRampToValueAtTime(to,t+d);
      g.gain.setValueAtTime((vol||0.05)*sfxV,t); g.gain.exponentialRampToValueAtTime(0.0001,t+d);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t+d+0.03);
    }catch(e){}
  }
  function noise(d,vol,when,freq){
    if(muted||sfxV<=0||!actx) return;
    try{
      const n=Math.floor(actx.sampleRate*d),buf=actx.createBuffer(1,n,actx.sampleRate),ch=buf.getChannelData(0);
      for(let i=0;i<n;i++) ch[i]=(Math.random()*2-1)*(1-i/n);
      const src=actx.createBufferSource(),f=actx.createBiquadFilter(),g=actx.createGain();
      src.buffer=buf; f.type='highpass'; f.frequency.value=freq||3000; g.gain.value=(vol||0.08)*sfxV;
      src.connect(f); f.connect(g); g.connect(actx.destination); src.start(actx.currentTime+(when||0));
    }catch(e){}
  }
  /* ============================ LOKASI FILE SFX ============================
     Satu tabel path. Struktur folder: assets/audio/sfx/<kategori>/<nama>.<ext>
       ui/ dice/ board/ reward/ powerup/ mob/ dragon/   (daftar lengkap: assets/audio/sfx/readme.md)
     Mengganti/menambah file cukup ubah baris di sini; fungsi sfx di bawah hanya memakai kuncinya. */
  const SFX_DIR='assets/audio/sfx/', NS='';
  const FILE={
    /* dice */   roll:'dice/dice-roll.mp3',
    /* board */  hop:'board/pawn-hop.mp3', ladder:'board/ladder-up.mp3', snakeBite:'board/snake-bite.mp3', block100:'board/block-100.mp3',
    /* win */    firework:'win/firework-launch.ogg',
    /* result */ defeat:'ui/game-lose.mp3',
    /* power */  swordUnsheathing:'powerup/sword-unsheathing.mp3', swordSlice:'powerup/sword-slice.mp3', metalWhooshHit:'powerup/metal-whoosh-hit.mp3',
                 diamondSwordUnsheath:'powerup/diamond-sword-crystal-unsheathe.mp3', diamondSwordWhoosh:'powerup/diamond-sword-slash-whoosh.mp3', diamondSwordImpact:'powerup/diamond-sword-metal-impact.mp3', diamondSwordResonance:'powerup/diamond-sword-crystal-resonance.mp3',
                 woodenShieldEquip:'powerup/wooden-shield-equip.mp3', woodenShieldImpact:'powerup/wooden-shield-impact.mp3', woodenShieldResonance:'powerup/wooden-shield-resonance.mp3',
                 featherWindMagic:'powerup/wind-magic.mp3', featherLongWhoosh:'powerup/long-whoosh.mp3', featherFinishWhoosh:'powerup/epic-whoosh.mp3',
                 tntExplosionFx:'powerup/explosion-fx.mp3', tntDeepExplosion:'powerup/deep-explosion.mp3', tntDebrisBreak:'powerup/debris-break.mp3',
                 totemChime:'powerup/totem-mystical-chime.mp3', totemSpell:'powerup/totem-magic-spell.mp3', totemShield:'powerup/totem-shield-activation.mp3',
                 goldenAppleActivation:'powerup/golden-apple-activation.mp3', goldenAppleBite:'powerup/golden-apple-bite.mp3', goldenAppleHealing:'powerup/golden-apple-healing.mp3', goldenAppleFinish:'powerup/golden-apple-finish.mp3',
                 fireChargeIgnition:'powerup/fire-charge-ignition.mp3', fireChargeMagic:'powerup/fire-charge-magic.mp3', fireChargeWhoosh:'powerup/fire-charge-whoosh.mp3', fireChargeImpact:'powerup/fire-charge-impact.mp3',
                 iceCrystalChime:'powerup/ice-crystal-chime.mp3', iceCrystalCharge:'powerup/ice-crystal-charge.mp3', iceCrystalRelease:'powerup/ice-crystal-release.mp3', iceCrystalShatter:'powerup/ice-crystal-shatter.mp3',
                 potionDrink:'powerup/potion-drink.mp3', potionBubbling:'powerup/potion-bubbling.mp3', potionDarkMagic:'powerup/potion-dark-magic.mp3',
                 potionEvenDrink:'powerup/potion-even-drink.mp3', potionEvenHealing:'powerup/potion-even-healing-magic.mp3', potionEvenChime:'powerup/potion-even-magic-chime.mp3',
    /* reward */ chestOpen:'reward/chest-open.mp3', chestClose:'reward/chest-close.mp3', powerReward:'reward/power-reward.mp3',
    /* power (memakai ulang file pet/dragon yang sudah ada) */ stormZap:'pet/storm-wolf-zap.mp3', infernoFire:'pet/inferno-dragon-fire.mp3', kitsuneBell:'pet/celestial-kitsune-bell.mp3', kitsuneShine:'pet/celestial-kitsune-shine.mp3',
    /* mob */    punch:'mob/mob-punch.mp3', playerHurt:'mob/player-hurt.mp3', creeperFuse:'mob/creeper-fuse.mp3', skeletonShoot:'mob/skeleton-shoot.mp3', endermanTp:'mob/enderman-teleport.mp3',
    /* dragon */ dragonIdle:'dragon/dragon-idle.mp3', dragonSpawn:'dragon/dragon-spawn.mp3', dragonHurt:'dragon/dragon-hurt.mp3', dragonDeath:'dragon/dragon-death.mp3',
               earthquake:'dragon/earthquake.mp3', tower:'dragon/tower-rise.mp3', crystalAppear:'dragon/crystal-appear.mp3', crystalBreak:'dragon/crystal-break.mp3',
               /* file ada di root sfx/ (nama apa adanya, termasuk ejaan 'areana'/'crsytal'): arena naik setelah gempa; semua Crystal hancur */
               arenaUp:'dragon-arena-up-before-crystal.mp3', crystalsDone:'setalah-hancurkan-crystal.mp3',
    /* new sound/ (folder assets/audio/sfx/, dirujuk relatif dari SFX_DIR) — pengganti SFX yang dulu sintetis; fungsi sintetis lama tetap jadi fallback */
    hiss:NS+'hiss.mp3', chomp:NS+'chomp.mp3', gulp:NS+'gulp.mp3', ladderClimb:NS+'ladder.mp3', pop:NS+'pop.mp3', bounce:NS+'bounce.mp3', crystalDestroyed:NS+'crystal-destroyed.mp3',
    win:NS+'win.mp3', victory:NS+'win2.mp3', shuffle:NS+'shuffle.mp3', villager:NS+'villager.mp3'
  };
  const FILE_AWAKENING=NS+'dragon-awakening.mp3'; /* file ada di assets/audio/sfx/; bila gagal -> fallback sintetis (retak + gema) */
  /* Warm-up: file SFX dimuat lebih awal (tanpa diputar, tanpa butuh gesture) agar pemutaran pertama tidak menunggu fetch/decode. */
  var warm=[];
  function preload(){ if(warm.length) return; Object.keys(FILE).forEach(function(k){ try{ var a=new Audio(); a.preload='auto'; a.src=SFX_DIR+FILE[k]; warm.push(a); }catch(e){} }); }
  /* Putar file SFX. fb = fallback sintetis bila file gagal/diblok. Mengembalikan elemen Audio (bisa di-fade/stop) atau null. Hormati tombol mute. */
  /* Penguat: elemen Audio maksimal volume 1, jadi untuk SFX yang harus lebih keras disalurkan lewat GainNode (>1) + kompresor agar tidak pecah. Gagal -> tetap volume biasa. */
  var boostBus=null;
  function amplify(a,gain){
    try{
      if(!actx) return;
      if(!boostBus){ const comp=actx.createDynamicsCompressor(); comp.threshold.value=-18; comp.knee.value=10; comp.ratio.value=10; comp.attack.value=0.003; comp.release.value=0.2; comp.connect(actx.destination); boostBus=comp; }
      const src=actx.createMediaElementSource(a),g=actx.createGain(); g.gain.value=gain; src.connect(g); g.connect(boostBus);
    }catch(e){}
  }
  /* Kekerasan SEMUA file SFX sudah diseragamkan (tools/normalize-sfx.py, sumber asli di referensi/sfx-asli): vol di bawah = 1 untuk semua.
     Jangan menambal suara keras/pelan lewat angka vol/boost di sini; koreksi lewat OFFSETS di skrip lalu jalankan ulang, supaya slider Efek suara adil untuk semua suara. */
  function fileSfx(key,vol,fb,boost,rate){ if(muted||sfxV<=0) return null; try{ const a=new Audio(SFX_DIR+(FILE[key]||key)); a.volume=Math.min(1,vol*sfxV); a.playbackRate=rate||1; if(boost>1) amplify(a,boost); a.play().catch(fb||function(){}); return a; }catch(e){ if(fb) fb(); return null; } }
  function fadeOut(a,ms){ if(!a) return; try{ const v0=a.volume,t0=Date.now(),id=setInterval(function(){ const k=Math.min(1,(Date.now()-t0)/ms); a.volume=v0*(1-k); if(k>=1){ clearInterval(id); a.pause(); } },50); }catch(e){} }
  /* ---------- Suara Power ----------
     Tiap Power memakai resep PowerSound khusus; fase trigger memainkan hit khas Power itu sendiri.
     Audio pedang berbasis file punya fallback sintesis, bukan file musik atau ledakan bersama. */
  const POWER_FILES={ sword:{activate:'swordUnsheathing',impact:'swordSlice',delay:400}, diamond_sword:{activate:'diamondSwordUnsheath',attack:'diamondSwordWhoosh',impact:'diamondSwordImpact',finish:'diamondSwordResonance',pitch:1.05,volume:0.85}, wooden_shield:{activate:'woodenShieldEquip',defense:'woodenShieldImpact',finish:'woodenShieldResonance',pitch:0.95,volume:0.8}, golden_apple:{activate:'goldenAppleActivation',consume:'goldenAppleBite',healing:'goldenAppleHealing',finish:'goldenAppleFinish',pitch:1.05,volume:0.75}, fire_charge:{activate:'fireChargeIgnition',charge:'fireChargeMagic',launch:'fireChargeWhoosh',impact:'fireChargeImpact',pitch:1,volume:0.85}, ice_crystal:{activate:'iceCrystalChime',charge:'iceCrystalCharge',release:'iceCrystalRelease',impact:'iceCrystalShatter',pitch:1.1,volume:0.78}, feather:{activate:'featherWindMagic',action:'featherLongWhoosh',finish:'featherFinishWhoosh',pitch:1.1,volume:0.68}, tnt:{boom:'tntExplosionFx',deepBoom:'tntDeepExplosion',debris:'tntDebrisBreak',pitch:0.9,volume:0.85}, totem:{activate:'totemChime',protection:'totemShield',finish:'totemSpell',pitch:0.95,volume:0.75}, potion_odd:{drink:'potionDrink',bubbling:'potionBubbling',effect:'potionDarkMagic',pitch:1,volume:0.7}, potion_even:{drink:'potionEvenDrink',effect:'potionEvenHealing',chime:'potionEvenChime',pitch:1.1,volume:0.7} };
  function powerSynth(k,phase,level){
    try{ const PS=win.UT&&win.UT.PowerSound; if(PS&&PS.has(k)&&!muted&&sfxV>0&&PS.play(k,{phase:phase||'use',ctx:actx,volume:sfxV*(level==null?1:level)})) return true; }catch(e){}
    return false;
  }
  function powerFileFX(a,fx){
    if(!actx) ensureAudio();
    if(!actx) return;
    try{
      const source=actx.createMediaElementSource(a), shelf=actx.createBiquadFilter(), comp=actx.createDynamicsCompressor();
      shelf.type='lowshelf'; shelf.frequency.value=120; shelf.gain.value=fx.bassDb||0;
      comp.threshold.value=-10; comp.knee.value=8; comp.ratio.value=4; comp.attack.value=0.005; comp.release.value=0.2;
      let output=shelf;
      if(fx.resonanceDb){
        const resonance=actx.createBiquadFilter();
        resonance.type='peaking'; resonance.frequency.value=fx.resonanceHz||1250; resonance.Q.value=fx.resonanceQ||0.8; resonance.gain.value=fx.resonanceDb;
        shelf.connect(resonance); output=resonance;
      }
      source.connect(shelf); output.connect(comp); comp.connect(actx.destination);
      if(fx.reverb){
        const length=Math.max(1,Math.floor(actx.sampleRate*fx.reverb)), impulse=actx.createBuffer(2,length,actx.sampleRate);
        for(let channel=0;channel<2;channel++){
          const data=impulse.getChannelData(channel);
          for(let i=0;i<length;i++) data[i]=(Math.random()*2-1)*0.02*Math.pow(1-i/length,3);
        }
        const convolver=actx.createConvolver(), wet=actx.createGain();
        convolver.buffer=impulse; wet.gain.value=fx.reverbWet==null?0.2:fx.reverbWet; output.connect(convolver); convolver.connect(wet); wet.connect(comp);
      }
    }catch(e){ console.warn('[audio] efek SFX tambahan tidak tersedia',e); }
  }
  function powerFile(key,rate,duration,fb,level,fx){
    const a=fileSfx(key,level==null?1:level,fb,0,rate);
    if(a&&fx) powerFileFX(a,fx);
    if(a) setTimeout(function(){ fadeOut(a,80); },duration);
    return a;
  }
  function powerFiles(k,phase){
    const layers=POWER_FILES[k]; if(!layers) return false;
    if(k==='totem'){
      const rate=layers.pitch*(0.98+Math.random()*0.04), level=layers.volume;
      const fx={bassDb:0,reverb:0.28,reverbWet:0.2,resonanceDb:1.5,resonanceHz:1250,resonanceQ:0.8};
      if(phase==='protection'){
        powerFile(layers.protection,rate,500,function(){ powerSynth(k,'hit',level); },level,fx);
        return true;
      }
      powerFile(layers.activate,rate,300,function(){ powerSynth(k,'activate',level); },level,fx);
      setTimeout(function(){ powerFile(layers.protection,rate,500,function(){ powerSynth(k,'hit',level); },level,fx); },300);
      setTimeout(function(){ powerFile(layers.finish,rate,500,function(){ powerSynth(k,'finish',level); },level,fx); },800);
      return true;
    }
    if(k==='diamond_sword'){
      const rate=layers.pitch*(0.98+Math.random()*0.04), level=layers.volume;
      const fx={bassDb:1,reverb:0.16,reverbWet:0.18,resonanceDb:1.5,resonanceHz:2500,resonanceQ:1.1};
      powerFile(layers.activate,rate,300,function(){ powerSynth(k,'activate',level); },level,fx);
      setTimeout(function(){ powerFile(layers.attack,rate,400,function(){ powerSynth(k,'swing',level); },level,fx); },300);
      setTimeout(function(){ powerFile(layers.impact,rate,500,function(){ powerSynth(k,'hit',level); },level,fx); },700);
      setTimeout(function(){ powerFile(layers.finish,rate,300,function(){ powerSynth(k,'finish',level); },level,fx); },1200);
      return true;
    }
    if(k==='wooden_shield'){
      const rate=layers.pitch*(0.98+Math.random()*0.04), level=layers.volume;
      const fx={bassDb:1.5,reverb:0.06,reverbWet:0.08,resonanceDb:2,resonanceHz:250,resonanceQ:1.1};
      if(phase==='block'){
        powerFile(layers.defense,rate,400,function(){ powerSynth(k,'hit',level); },level,fx);
        setTimeout(function(){ powerFile(layers.finish,rate,300,function(){ powerSynth(k,'finish',level); },level,fx); },400);
      }else powerFile(layers.activate,rate,300,function(){ powerSynth(k,'activate',level); },level,fx);
      return true;
    }
    if(k==='golden_apple'){
      const rate=layers.pitch*(0.98+Math.random()*0.04), level=layers.volume;
      const fx={bassDb:0,reverb:0.14,reverbWet:0.16,resonanceDb:1.2,resonanceHz:1800,resonanceQ:0.9};
      powerFile(layers.activate,rate,300,function(){ powerSynth(k,'activate',level); },level,fx);
      setTimeout(function(){ powerFile(layers.consume,rate,300,function(){ powerSynth(k,'consume',level); },level); },300);
      setTimeout(function(){ powerFile(layers.healing,rate,700,function(){ powerSynth(k,'healing',level); },level,fx); },600);
      setTimeout(function(){ powerFile(layers.finish,rate,300,function(){ powerSynth(k,'finish',level); },level,fx); },1300);
      return true;
    }
    if(k==='fire_charge'){
      const rate=layers.pitch*(0.98+Math.random()*0.04), level=layers.volume;
      const fx={bassDb:-1,reverb:0.22,reverbWet:0.18,resonanceDb:1,resonanceHz:1600,resonanceQ:0.8};
      if(phase==='trigger'){
        powerFile(layers.charge,rate,400,function(){ powerSynth(k,'charge',level); },level,fx);
        powerSynth(k,'embers',level*0.25);
        setTimeout(function(){ powerFile(layers.launch,rate,400,function(){ powerSynth(k,'launch',level); },level,fx); },400);
        setTimeout(function(){ powerFile(layers.impact,rate,500,function(){ powerSynth(k,'hit',level); },level,fx); },800);
      }else powerFile(layers.activate,rate,200,function(){ powerSynth(k,'activate',level); },level,fx);
      return true;
    }
    if(k==='ice_crystal'){
      const rate=layers.pitch*(0.98+Math.random()*0.04), level=layers.volume;
      const fx={bassDb:-1,reverb:0.22,reverbWet:0.2,resonanceDb:1.5,resonanceHz:4000,resonanceQ:1};
      powerFile(layers.activate,rate,300,function(){ powerSynth(k,'activate',level); },level,fx);
      setTimeout(function(){ powerFile(layers.charge,rate,400,function(){ powerSynth(k,'charge',level); },level,fx); },300);
      setTimeout(function(){ powerFile(layers.release,rate,400,function(){ powerSynth(k,'release',level); },level,fx); },700);
      setTimeout(function(){
        let fallbackPlayed=false;
        const fallback=function(){ if(!fallbackPlayed){ fallbackPlayed=true; powerSynth(k,'hit',level); } };
        powerFile(layers.impact,rate,600,fallback,level,fx);
        powerSynth(k,'crack',level*0.25);
      },1100);
      return true;
    }
    if(k==='potion_odd'||k==='potion_even'){
      const rate=layers.pitch*(0.99+Math.random()*0.02), level=layers.volume;
      powerSynth(k,'activate',level);
      setTimeout(function(){
        const fallback=function(){ powerSynth(k,'drink',level); };
        powerFile(layers.drink,rate,400,fallback,level);
        if(layers.bubbling) powerFile(layers.bubbling,rate,280,fallback,0.3);
      },200);
      setTimeout(function(){
        if(k==='potion_even'){
          let fallbackPlayed=false;
          const fallback=function(){ if(!fallbackPlayed){ fallbackPlayed=true; powerSynth(k,'finish',level); } };
          const fx={bassDb:0,reverb:0.12,reverbWet:0.14};
          powerFile(layers.effect,rate,600,fallback,level,fx);
          powerFile(layers.chime,rate,600,fallback,0.4,fx);
        }else powerFile(layers.effect,rate,600,function(){ powerSynth(k,'finish',level); },level,{bassDb:0,reverb:0.12,reverbWet:0.14});
      },600);
      return true;
    }
    if(k==='tnt'&&phase==='trigger'){
      const rate=layers.pitch*(0.98+Math.random()*0.04), level=layers.volume;
      let fallbackPlayed=false;
      const fallback=function(){ if(!fallbackPlayed){ fallbackPlayed=true; powerSynth(k,'hit'); } };
      powerFile(layers.boom,rate,800,fallback,level,{bassDb:2,reverb:0.18});
      powerFile(layers.deepBoom,rate,1300,fallback,level,{bassDb:6,reverb:0.35});
      setTimeout(function(){ powerFile(layers.debris,rate,600,null,0.72,{bassDb:1,reverb:0.2}); },1000);
      return true;
    }
    if(k==='feather'){
      const rate=layers.pitch*(0.98+Math.random()*0.04), level=layers.volume;
      powerFile(layers.activate,rate,200,function(){ powerSynth(k,'activate',level); },level);
      setTimeout(function(){ powerFile(layers.action,rate,500,function(){ powerSynth(k,'hit',level); },level); },200);
      setTimeout(function(){
        powerFile(layers.finish,rate,300,null,0.28);
        powerSynth(k,'finish',level);
      },700);
      return true;
    }
    const rate=0.98+Math.random()*0.04;
    if(layers.activate) powerFile(layers.activate,rate,360,function(){ powerSynth(k,'activate'); });
    else powerSynth(k,'activate');
    setTimeout(function(){ if(layers.impact) powerFile(layers.impact,rate,600,function(){ powerSynth(k,'hit'); }); },layers.delay||260);
    return true;
  }
  function powerBase(k){ if(powerSynth(k)) return null; sfx.pop(); return null; }
  const ladderBeeps=()=>[392,494,587,784].forEach((f,i)=>beep(f,0.14,'square',0.05,i*0.11));

  const sfx={
    /* ---------- DADU ---------- */
    roll(){ return fileSfx('roll',1,function(){ for(let i=0;i<7;i++) beep(180+Math.random()*320,0.05,'square',0.07,i*0.13); }); }, /* dadu: kekerasan file sudah diseragamkan (tools/normalize-sfx.py); tanpa penguat 3.2x lagi */
    rollStop(a){ fadeOut(a,250); },

    /* ---------- PAPAN: gerak & kejadian di tile ---------- */
    hop(){ fileSfx('hop',1,function(){ beep(480+Math.random()*120,0.08,'square',0.04); }); },
    naiktangga(){ fileSfx('ladder',1,ladderBeeps); },
    ladder(){ return fileSfx('ladderClimb',1,ladderBeeps); }, /* mengembalikan elemen Audio agar bisa dihentikan tepat saat pion sampai (ladder.mp3 ~9,5 dtk, lebih lama dari animasi naik) */
    ladderStop(a){ fadeOut(a,220); },
    caplokular(){ fileSfx('snakeBite',1,function(){ beep(200,0.12,'square',0.09,0,60); }); },
    hundred(){ fileSfx('block100',1,function(){ beep(523,0.2,'square',0.05); }); },
    hiss(){ fileSfx('hiss',1,function(){ noise(0.55,0.09,0,4500); }); },
    chomp(){ fileSfx('chomp',1,function(){ beep(200,0.12,'square',0.09,0,60); beep(90,0.25,'sawtooth',0.08,0.02); noise(0.12,0.07,0,1500); }); },
    gulp(){ fileSfx('gulp',1,function(){ beep(220,0.18,'sine',0.1,0,90); beep(200,0.18,'sine',0.1,0.24,80); }); },
    pop(){ fileSfx('pop',1,function(){ beep(300,0.12,'triangle',0.08,0,900); }); },
    bounce(){ fileSfx('bounce',1,function(){ beep(330,0.2,'triangle',0.07,0,140); }); },

    /* ---------- HADIAH & PETI ---------- */
    chest(){ fileSfx('chestOpen',1,function(){ beep(300,0.12,'triangle',0.08,0,900); }); },
    chestClose(){ fileSfx('chestClose',1,function(){ beep(200,0.1,'square',0.05); }); },
    rewardpower(){ fileSfx('powerReward',1,function(){ beep(523,0.12,'square',0.05,0,784); }); },
    firework(){ fileSfx('firework',1); }, /* Stage 4.1.23.3: 1x per event Firework (dipanggil UT.FireworkFX); tanpa fallback sintetis: bila file gagal, hanya senyap */
    defeat(){ return fileSfx('defeat',1); }, /* Stage 4.1.24.D.1: 1x saat hasil KALAH (CPU menang, finishGame). Tanpa fallback sintetis: bila file gagal, hanya senyap. Victory asset (result/victory.mp3) belum ada -> BLOCKED, tidak dipasang */
    /* Satu titik aktivasi Power untuk Player dan Computer; resep tiap Power tersedia di PowerSound. */
    power(k,phase){
      if(phase==='trigger'){
        if(powerFiles(k,'trigger')) return null;
        return powerSynth(k,'hit')||powerBase(k);
      }
      if(k==='tnt'||k==='fire_charge'||k==='blaze_core'){
        if(k==='fire_charge'&&powerFiles(k,'activate')) return null;
        return powerSynth(k,'activate')||powerBase(k);
      }
      if(powerFiles(k,'use')) return null;
      return powerSynth(k,'use')||powerBase(k);
    },
    /* Shield/Totem menahan serangan (dipanggil powerFxPawn: 'shield_block' | 'totem_block') */
    powerBlock(key){
      const power=key==='shield_block'?'wooden_shield':'totem';
      if(power==='totem'&&powerFiles(power,'protection')) return null;
      if(power==='wooden_shield'&&powerFiles(power,'block')) return null;
      if(!powerSynth(power,'hit')) beep(key==='shield_block'?160:1568,0.4,'sine',0.06,0,key==='shield_block'?70:0);
    },
    win(){ fileSfx('win',1,function(){ [523,659,784,1047,784,1047].forEach((f,i)=>beep(f,0.2,'square',0.05,i*0.14)); }); }, /* tiba di Block 100 (win.mp3, ~4 dtk) */
    victory(){ return fileSfx('victory',1,function(){ [523,659,784,1047,784,1047].forEach((f,i)=>beep(f,0.2,'square',0.05,i*0.14)); }); }, /* layar menang / celebrate (win2.mp3, ~16 dtk) */
    villager(){ fileSfx('villager',1,function(){ beep(300,0.12,'triangle',0.08,0,900); }); }, /* Villager membantu (maju 5 blok) */

    /* ---------- MOB DI BOARD ---------- */
    hit(){ fileSfx('punch',1,function(){ beep(330,0.2,'triangle',0.07,0,140); }); },
    playerHurt(){ return fileSfx('playerHurt',1,function(){ beep(330,0.2,'triangle',0.07,0,140); }); },
    creeper(){ fileSfx('creeperFuse',1,function(){ beep(200,0.12,'square',0.09,0,60); }); },
    skeltonSh(){ fileSfx('skeletonShoot',1,function(){ beep(400,0.1,'square',0.05); }); },
    enderman(){ fileSfx('endermanTp',1,function(){ beep(700,0.2,'square',0.05,0,1000); }); },

    /* ---------- DRAGON ---------- */
    dragonIdle(){ fileSfx('dragonIdle',1); },
    dragonHurt(){ fileSfx('dragonHurt',1,function(){ beep(523,0.2,'square',0.05); }); },
    dragonDeath(){ fileSfx('dragonDeath',1,function(){ beep(1047,0.4,'square',0.08); }); },
    dragonSpawn(){ return fileSfx('dragonSpawn',1,function(){ fileSfx('dragonIdle',1); }); }, /* growl + roar (dragon-spawn.mp3); gagal -> dragon-idle lama */
    /* Dragon Awakening: file placeholder (lihat FILE_AWAKENING); fallback sintetis = retak + gema. Tidak dipakai lagi oleh gameplay (diganti quakeStart). */
    dragonAwakening(){ let done=false;const fb=()=>{ if(done) return; done=true; noise(0.18,0.1,0,900); noise(0.14,0.08,0.22,1400); beep(70,0.9,'sawtooth',0.06,0.05,38); [0.35,0.75,1.2].forEach((w,i)=>{ noise(0.1,0.05/(i+1),w,1100); beep(110-i*20,0.5,'sine',0.05/(i+1),w,50); }); }; if(muted) return; try{ const a=new Audio(SFX_DIR+FILE_AWAKENING); a.volume=Math.min(1,sfxV); a.addEventListener('error',fb); a.play().catch(fb); }catch(e){ fb(); } },
    quakeStart(){ return fileSfx('earthquake',1,function(){ noise(0.6,0.1,0,900); }); },
    quakeStop(a){ fadeOut(a,700); },
    towerRise(){ return fileSfx('tower',1); },
    towerStop(a){ fadeOut(a,600); },
    crystalAppear(){ return fileSfx('crystalAppear',1,function(){ beep(900,0.4,'sine',0.05,0,1400); }); },
    crystalDestroyed(){ fileSfx('crystalDestroyed',1,function(){ beep(330,0.2,'triangle',0.07,0,140); }); }, /* angka dadu = Crystal yang SUDAH hancur (bukan bounce); fallback = beep bounce lama */
    crystalBreak(){ fileSfx('crystalBreak',1,function(){ noise(0.25,0.1,0,2500); beep(900,0.22,'triangle',0.06,0,200); beep(1400,0.12,'square',0.03,0.04,500); }); },
    arenaUp(){ return fileSfx('arenaUp',1); }, /* Awakening: Dragon Arena naik setelah gempa, sebelum tower/crystal. Tanpa fallback sintetis (senyap bila file gagal) */
    arenaStop(a){ fadeOut(a,600); },
    crystalsCleared(){ fileSfx('crystalsDone',1,function(){ [523,659,784,1047,784,1047].forEach((f,i)=>beep(f,0.2,'square',0.05,i*0.14)); }); }, /* semua Crystal hancur (READY). Fallback = fanfare sintetis lama (sama dengan sfx.win) bila file gagal */

    /* ---------- READY SCREEN (acak urutan giliran) — sintetis ---------- */
    shuffleTick(){ fileSfx('shuffle',1,function(){ beep(700+Math.random()*700,0.03,'square',0.03); }); },
    revealTick(){ beep(660,0.07,'square',0.05); },
    revealFirst(){ beep(660,0.07,'square',0.05); beep(990,0.14,'square',0.05,0.08); }
  };

  /* Gerbang urutan: SFX baru boleh bunyi setelah gameplay menandai audio siap (setelah percobaan BGM pada gesture pertama). */
  var ready=false;
  Object.keys(sfx).forEach(function(k){ var f=sfx[k]; sfx[k]=function(){ if(!ready) return; return f.apply(this,arguments); }; });
  try{ preload(); }catch(e){}
  UT.GameplayAudio = {
    ensure: ensureAudio,
    preload: preload,
    play: function (name) { try { if (typeof sfx[name] === 'function') sfx[name](); } catch (e) {} },
    setMuted: function (v) { muted = !!v; },
    setSfxVolume: function (v) { v = +v; sfxV = isNaN(v) ? 1 : Math.max(0, Math.min(1, v)); },
    setReady: function (v) { ready = !!v; },
    sfx: sfx
  };
})(window);
