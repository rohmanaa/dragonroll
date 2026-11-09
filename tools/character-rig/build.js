#!/usr/bin/env node
/* Bangun assets/js/character-rig.js dari rig 3D di karakter.html (satu sumber kebenaran).
   Pakai:  node tools/character-rig/build.js          -> tulis assets/js/character-rig.js
           node tools/character-rig/build.js --check   -> gagal (exit 1) bila file hasil belum mutakhir
   Yang diambil apa adanya dari karakter.html: util (S, mkTex, box, ...), data warna/kulit, rig, katalog item, config,
   builder per slot, pose & animasi. Yang TIDAK diambil: scene/kamera/renderer, UI, thumbnail, kamera, loop.
   Perubahan yang dibuat saat ekstraksi (dicek satu per satu; build gagal bila teks sumber berubah):
     1. scene.add(root)         -> dihapus (grup root dikembalikan ke pemanggil)
     2. window.ItemCatalog/...  -> win.ItemCatalog/...
     3. previewAll=false        -> previewAll=!opts.enforceOwnership (halaman lain menampilkan apa adanya, tanpa cek kepemilikan) */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'karakter.html');
const OUT = path.join(ROOT, 'assets', 'js', 'character-rig.js');

const lines = fs.readFileSync(SRC, 'utf8').split('\n');
const idx = (re, from) => { for (let i = from || 0; i < lines.length; i++) if (re.test(lines[i])) return i; throw new Error('penanda tidak ketemu: ' + re); };
const bar = i => { while (!/^\/\* =====/.test(lines[i])) i--; return i; };   /* baris pembuka blok judul */

const iUtil = idx(/^const S=1\/16;/);
const iScene = bar(idx(/^\s+2\. SCENE/));
const iData = bar(idx(/^\s+3\. DATA/));
const iUi = bar(idx(/^\s+10\. UI/));
if (!(iUtil < iScene && iScene < iData && iData < iUi)) throw new Error('urutan bagian karakter.html berubah');

let body = lines.slice(iUtil, iScene).concat(lines.slice(iData, iUi)).join('\n');
function swap(from, to) {
  const n = body.split(from).length - 1;
  if (n !== 1) throw new Error('teks sumber berubah (' + n + 'x): ' + from);
  body = body.replace(from, () => to);
}
swap('const root=new THREE.Group();scene.add(root);', 'const root=new THREE.Group();');
swap('const IC=window.ItemCatalog,PD=window.PlayerData;', 'const IC=win.ItemCatalog,PD=win.PlayerData;');
swap('let previewAll=false;', 'let previewAll=!opts.enforceOwnership;');

const out = `/* GENERATED oleh tools/character-rig/build.js dari karakter.html — JANGAN diedit manual (jalankan ulang build bila rig berubah).
   Rig karakter 3D yang SAMA dengan halaman Karakter, dipakai semua halaman supaya tampilan karakter selalu mengikuti
   data pemain (PlayerData.appearance() / baris server: {look, equipped, gearDye}) — bukan Steve/Alex bawaan.

   UT.CharacterRig.create(THREE, {enforceOwnership?}) -> {
     root            THREE.Group (kaki di y=0, tinggi ~2 satuan, menghadap +z)
     setAppearance(a)  a = {look, equipped, gearDye|gear_dye} -> bangun ulang karakter (null/tanpa look = tampilan awal)
     setMode(m)        'idle' | 'walk' | 'run' | 'pose1' | 'pose2' | 'pose3'
     setEmote(n)       'idle' | 'wave' | 'dance' | 'victory' | 'cheer' | 'laugh' | 'celebrate'
     update(dt)        majukan animasi (detik)
     config()          salinan config karakter saat ini
     dispose()
   }
   UT.CharacterRig.toConfig(a) tersedia setelah create() pertama (butuh katalog builder). */
(function (win) {
  var UT = win.UT = win.UT || {};
  if (UT.CharacterRig) return;

  function create(THREE, opts) {
    opts = opts || {};
${body.split('\n').map(l => '    ' + l).join('\n')}

    /* ===== API bersama (ditulis tangan di template build.js) ===== */
    const A_SLOTS=['top','legs','boots','helm','chest','shoulder','cape','weapon'];
    // {look, equipped, gearDye} -> config builder (sama dengan loadCfg() di karakter.html)
    function toConfig(a){
      const L=a&&a.look;
      if(!L)return null;
      const eq=a.equipped||{},dye=a.gearDye||a.gear_dye||{};
      const o={gender:L.gender,skin:L.skin,eyes:L.eyes,hair:L.hair,body:L.body,accessories:[]};
      A_SLOTS.forEach(k=>{
        const id=eq['g.'+k],ci=id&&IC&&IC.byId(id);
        o[k]=ci?{id:ci.gameKey,dye:dye[id]||undefined}:{id:'none'};
      });
      ACCS.forEach(x=>{
        const id=eq['g.acc.'+x.id];
        if(id)o.accessories.push({id:x.id,dye:dye[id]||undefined});
      });
      return o;
    }
    let emote='idle';
    function setAppearance(a){
      cfg=clone(DEFAULT);
      apply(toConfig(a),true);
    }
    // sasaran pose tambahan per emote (di atas computeTarget), dalam parameter rig yang sama dengan POSES
    function emoteTarget(T,t){
      const s=Math.sin;
      if(emote==='wave'){T.rArmS=-2.9;T.rElbow=-0.25+s(t*9)*0.35;T.rArmZ=-0.3;T.rWrist=0;}
      else if(emote==='cheer'||emote==='victory'||emote==='celebrate'){
        T.rArmS=-3.0;T.lArmS=-3.0;T.rArmZ=-0.3;T.lArmZ=0.3;T.rElbow=-0.15;T.lElbow=-0.15;
        const sp=emote==='celebrate'?5:(emote==='cheer'?6:4);
        jumpY=Math.abs(s(t*sp))*(emote==='celebrate'?0.14:0.09);
      }else if(emote==='dance'){
        const w=s(t*5);
        T.twist=s(t*2.5)*0.4;T.lean=0.08;T.rArmS=-2.2+w*0.5;T.lArmS=-2.2-w*0.5;T.rArmZ=-0.4;T.lArmZ=0.4;
        T.rLegT=Math.max(0,w)*0.7;T.lLegT=Math.max(0,-w)*0.7;jumpY=Math.abs(w)*0.05;
      }else if(emote==='laugh'){
        T.headX=-0.3+s(t*16)*0.06;T.rArmS=-0.8;T.lArmS=-0.8;T.rElbow=-1.2;T.lElbow=-1.2;T.lean=-0.05;
      }
    }
    function update(dt){
      dt=Math.min(dt,0.05);time+=dt;
      const tl=mode==='walk'?1:(mode==='run'?2:0);
      level+=(tl-level)*(1-Math.exp(-dt*7));
      phase+=dt*(6.5+4.5*clamp(level-1,0,1));
      if(airborne){vy-=22*dt;jumpY+=vy*dt;if(jumpY<=0){jumpY=0;vy=0;airborne=false;landT=0.25;}}
      else if(emote==='idle'||emote==='wave'||emote==='laugh')jumpY=0;
      if(landT>0)landT-=dt;
      const k=1-Math.exp(-dt*(airborne?26:12));
      const T=computeTarget();
      if(emote!=='idle'&&!airborne)emoteTarget(T,time);
      for(const key in T)P[key]+=(T[key]-P[key])*k;
      applyRig();
    }
    function dispose(){ORDER.forEach(s=>clear(s));}
    setAppearance(null);
    Object.assign(P,computeTarget());applyRig();
    return {
      root:root,
      setAppearance:setAppearance,
      setMode:m=>{mode=m;},
      setEmote:n=>{emote=n||'idle';},
      update:update,
      config:()=>clone(cfg),
      toConfig:toConfig,
      dispose:dispose
    };
  }

  /* Potret 2D (dataURL PNG) dari rig yang sama — untuk avatar/kartu di halaman yang tidak punya kanvas 3D.
     Satu renderer & satu rig bersama untuk seluruh halaman; hasil di-cache per (tampilan, bingkai, ukuran).
     Bingkai kamera sama dengan thumbnail di halaman Karakter. Mengembalikan '' bila WebGL tidak tersedia. */
  var PT = null, PT_FAIL = false, PCACHE = new Map();
  var FR = { full: { y: 1.0, d: 4.7, yaw: .5, pit: .12 }, bust: { y: 1.3, d: 3.0, yaw: .45, pit: .1 }, head: { y: 1.75, d: 2.1, yaw: .5, pit: .1 } };
  function sigOf(a) { return JSON.stringify(a ? { l: a.look || null, e: a.equipped || null, d: a.gearDye || a.gear_dye || null } : null); }
  function portrait(THREE, a, o) {
    o = o || {};
    var frame = FR[o.frame] ? o.frame : 'head', size = Math.max(32, Math.min(512, o.size | 0 || 128));
    var key = frame + '|' + size + '|' + sigOf(a);
    if (PCACHE.has(key)) return PCACHE.get(key);
    if (PT_FAIL) return '';
    var url = '';
    try {
      if (!PT) {
        var r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        r.setPixelRatio(1); r.setClearColor(0x000000, 0);
        var sc = new THREE.Scene();
        sc.add(new THREE.HemisphereLight(0xffffff, 0xcfcfcf, 0.85));
        var sun = new THREE.DirectionalLight(0xfff0d0, 0.55); sun.position.set(0, 14, 0.01); sc.add(sun);
        var rig = create(THREE, {}); sc.add(rig.root);
        PT = { r: r, sc: sc, rig: rig, cam: new THREE.PerspectiveCamera(30, 1, 0.1, 60) };
      }
      PT.rig.setAppearance(a); PT.rig.setMode('idle'); PT.rig.setEmote('idle'); PT.rig.update(0.0001);
      var f = FR[frame], t = f.y * PT.rig.config().body.height, c = PT.cam;
      PT.r.setSize(size, size);
      c.position.set(Math.sin(f.yaw) * Math.cos(f.pit) * f.d, t + Math.sin(f.pit) * f.d, Math.cos(f.yaw) * Math.cos(f.pit) * f.d);
      c.lookAt(0, t, 0);
      PT.r.render(PT.sc, c);
      url = PT.r.domElement.toDataURL('image/png');
      if (typeof url !== 'string' || url.length < 30) url = '';
    } catch (e) { url = ''; PT_FAIL = !PT; }
    if (url) { if (PCACHE.size > 300) PCACHE.delete(PCACHE.keys().next().value); PCACHE.set(key, url); }
    return url;
  }

  UT.CharacterRig = { create: create, portrait: portrait, signature: sigOf };
})(window);
`;

if (process.argv.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (cur !== out) { console.error('character-rig.js tidak mutakhir terhadap karakter.html — jalankan: node tools/character-rig/build.js'); process.exit(1); }
  console.log('character-rig.js mutakhir'); process.exit(0);
}
fs.writeFileSync(OUT, out);
console.log('ditulis', path.relative(ROOT, OUT), out.length + ' byte');
