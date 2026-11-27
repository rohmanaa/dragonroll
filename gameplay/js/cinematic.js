/* Ular Tangga Blok — gameplay/js/cinematic.js
   Lapisan SINEMATIK untuk adegan three.js (r128, skrip klasik, tanpa addon/CDN: offline-ready).
   Dimuat SEBELUM gameplay/js/main.js. Semua efek murni visual: tidak menyentuh logika game, input, atau HUD HTML.

   Isi:
   1. Pipeline post-processing sendiri  : scene -> RT HDR (MSAA) -> bloom (mip chain) + tilt-shift DOF + aberasi kromatik
                                          + tone-mapping filmic (ACES) + color grading per suasana + vinyet + film grain + dither
   2. Kubah langit shader               : gradasi, awan fbm bergerak, matahari/bulan + halo, bintang berkelip, aurora, bintang jatuh,
                                          Nether = langit abu/bara
   3. Patch material voxel (MAT)        : bayangan awan yang bergerak, kabut tipis di dasar (height fog), kilau air, lava menyala (HDR)
   4. Partikel ambient (shader Points)  : serbuk sari/debu cahaya (siang), kunang-kunang (malam), bara api (Nether)
   5. Tata cahaya per suasana           : matahari hangat golden-hour, cahaya bulan biru, fill dingin dari belakang, transisi halus siang<->malam
   6. Governor kualitas adaptif         : turunkan efek otomatis bila FPS jatuh (HP lemah), hormati prefers-reduced-motion

   API (window.UT.Cinema):
     init({renderer,scene,camera,hemi,sun,skyDome,coarse,reduce})  -> true bila siap (false = pakai render bawaan)
     patchMaterial(mat)           pasang efek shader ke material voxel
     look({night,themeKey,top,bot})  panggil tiap applyLook(): suasana baru (transisi halus)
     resize(w,h,pixelRatio)       ukuran drawing buffer berubah
     update(dt,t,camera,center)   per frame (sebelum render)
     render()                     pengganti renderer.render(scene,camera)
     setReduced(bool)             prefers-reduced-motion
     setEnabled(bool) / setQuality('auto'|'high'|'medium'|'low')
   Matikan total lewat URL ?cine=0 atau UT.Prefs 'cinema'=false. */
(function (win) {
  'use strict';
  var UT = win.UT = win.UT || {};
  if (UT.Cinema) return;
  var T = win.THREE;
  if (!T) return;

  var NOISE_GLSL = [
    'float cHash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }',
    'float cNoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);',
    '  return mix(mix(cHash(i),cHash(i+vec2(1,0)),f.x),mix(cHash(i+vec2(0,1)),cHash(i+vec2(1,1)),f.x),f.y); }',
    'float cFbm(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ s+=a*cNoise(p); p=p*2.03+17.1; a*=0.5; } return s; }',
    'float cFbm3(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<3;i++){ s+=a*cNoise(p); p=p*2.03+17.1; a*=0.5; } return s*1.14; }'
  ].join('\n');

  /* ---------- state ---------- */
  var S = {
    ok: false, on: true, renderer: null, scene: null, camera: null, hemi: null, sun: null, skyDome: null,
    coarse: false, reduce: false, w: 2, h: 2, dpr: 1, time: 0,
    q: 'auto', level: 2, hdr: false,        /* level: 2 tinggi, 1 sedang, 0 rendah */
    fpsAcc: 0, fpsN: 0, slowT: 0, fastT: 0, lockQ: false
  };
  /* uniform bersama (dipakai material voxel, langit, partikel, composite) */
  var U = {
    uTime: { value: 0 }, uNight: { value: 0 }, uNether: { value: 0 },
    uMist: { value: new T.Color(0xB8D4E6) }, uMistAmt: { value: 0.6 }, uGMist: { value: 1 }, uGMistR: { value: new T.Vector2(10, 16) },
    uCloudSh: { value: 0.0 }, uDoom: { value: 0.0 }, uTileGlow: { value: 0.1 }, uPress: { value: [new T.Vector4(), new T.Vector4(), new T.Vector4(), new T.Vector4()] }, uSunDirW: { value: new T.Vector3(-0.32, 0.85, 0.5) }
  };
  /* "look" target & current (di-lerp tiap frame supaya siang<->malam tidak loncat) */
  function mkLook() {
    return { night: 0, nether: 0, exposure: 1, bloom: 0.3, bloomThr: 0.8, sat: 1.06, contrast: 1.05, vig: 0.3,
      grain: 0.02, dof: 0.55, shadow: new T.Color(1, 1, 1), high: new T.Color(1, 1, 1), lift: 0.0,
      sunCol: new T.Color(1, 1, 1), sunInt: 0.6, hemiSky: new T.Color(1, 1, 1), hemiInt: 0.8, hemiGnd: new T.Color(0.5, 0.6, 0.4),
      fillCol: new T.Color(0.6, 0.6, 1), fillInt: 0.0, top: new T.Color(0x5EC1FF), bot: new T.Color(0xDDF4FF),
      cloud: new T.Color(1, 1, 1), mist: new T.Color(0xB8D4E6), mistAmt: 0.5, cloudSh: 0.5, haze: new T.Color(1, 0.9, 0.7), hazeAmt: 0.0 };
  }
  var cur = mkLook(), tgt = mkLook(), E = mkLook(), hasLook = false; /* cur = hasil transisi, E = cur + efek doom (dipakai render) */
var DOOM = { v: 0, t: 0, dbg: null, g: null, sp: [], fogObj: null, fn: 0, ff: 0 };

  /* ---------- ShaderMaterial helper ---------- */
  var FS_VERT = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }';
  function fsMat(frag, uniforms, extra) {
    var m = new T.ShaderMaterial({ vertexShader: FS_VERT, fragmentShader: frag, uniforms: uniforms, depthTest: false, depthWrite: false });
    if (extra) for (var k in extra) m[k] = extra[k];
    return m;
  }

  /* ---------- Post pipeline ---------- */
  var P = { rtScene: null, h0: null, h1: null, b: [], u: [], quad: null, camQ: null, sceneQ: null, mats: {}, built: false };

  function mkRT(w, h, type, aa) {
    var o = { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, type: type, depthBuffer: !!aa, stencilBuffer: false };
    var rt = aa && T.WebGLMultisampleRenderTarget ? new T.WebGLMultisampleRenderTarget(w, h, o) : new T.WebGLRenderTarget(w, h, o);
    if (aa && rt.samples !== undefined) rt.samples = S.level >= 2 && !S.coarse ? 4 : 2;
    rt.texture.generateMipmaps = false;
    return rt;
  }

  var DOWN_FRAG = [
    'uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;',
    '/* tapis 13-tap (Jimenez) : stabil, tanpa kedip */',
    'void main(){',
    ' vec2 t=uTexel; vec3 a=texture2D(tSrc,vUv+t*vec2(-2,-2)).rgb,b=texture2D(tSrc,vUv+t*vec2(0,-2)).rgb,c=texture2D(tSrc,vUv+t*vec2(2,-2)).rgb;',
    ' vec3 d=texture2D(tSrc,vUv+t*vec2(-1,-1)).rgb,e=texture2D(tSrc,vUv+t*vec2(1,-1)).rgb;',
    ' vec3 f=texture2D(tSrc,vUv+t*vec2(-2,0)).rgb,g=texture2D(tSrc,vUv).rgb,h=texture2D(tSrc,vUv+t*vec2(2,0)).rgb;',
    ' vec3 i=texture2D(tSrc,vUv+t*vec2(-1,1)).rgb,j=texture2D(tSrc,vUv+t*vec2(1,1)).rgb;',
    ' vec3 k=texture2D(tSrc,vUv+t*vec2(-2,2)).rgb,l=texture2D(tSrc,vUv+t*vec2(0,2)).rgb,m=texture2D(tSrc,vUv+t*vec2(2,2)).rgb;',
    ' vec3 o=(d+e+i+j)*0.25*0.5 + (a+b+f+g)*0.25*0.125 + (b+c+g+h)*0.25*0.125 + (f+g+k+l)*0.25*0.125 + (g+h+l+m)*0.25*0.125;',
    ' gl_FragColor=vec4(o,1.0); }'
  ].join('\n');

  var PRE_FRAG = [
    'uniform sampler2D tSrc; uniform float uThr; uniform float uKnee; varying vec2 vUv;',
    'void main(){ vec3 c=texture2D(tSrc,vUv).rgb; float br=max(c.r,max(c.g,c.b));',
    ' float soft=clamp(br-uThr+uKnee,0.0,2.0*uKnee); soft=soft*soft/(4.0*uKnee+1e-4);',
    ' float w=max(soft,br-uThr)/max(br,1e-4); gl_FragColor=vec4(c*w,1.0); }'
  ].join('\n');

  var UP_FRAG = [
    'uniform sampler2D tSrc; uniform sampler2D tBase; uniform vec2 uTexel; uniform float uMix; varying vec2 vUv;',
    'void main(){ vec2 t=uTexel;',
    ' vec3 s=texture2D(tSrc,vUv+t*vec2(-1,-1)).rgb+texture2D(tSrc,vUv+t*vec2(1,-1)).rgb+texture2D(tSrc,vUv+t*vec2(-1,1)).rgb+texture2D(tSrc,vUv+t*vec2(1,1)).rgb;',
    ' s*=0.0625; s+=(texture2D(tSrc,vUv+t*vec2(0,-1)).rgb+texture2D(tSrc,vUv+t*vec2(-1,0)).rgb+texture2D(tSrc,vUv+t*vec2(1,0)).rgb+texture2D(tSrc,vUv+t*vec2(0,1)).rgb)*0.125;',
    ' s+=texture2D(tSrc,vUv).rgb*0.25; gl_FragColor=vec4(texture2D(tBase,vUv).rgb*uMix+s,1.0); }'
  ].join('\n');

  var COMP_FRAG = [
    'precision highp float;',
    'uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tBlur;',
    'uniform vec2 uRes; uniform float uTime;',
    'uniform float uExposure,uBloom,uSat,uContrast,uVig,uGrain,uDof,uCA,uLift,uHazeAmt,uStreak,uNight,uUseDof,uNether;',
    'uniform vec3 uShadow,uHigh,uHaze;',
    'uniform vec2 uFocus; /* x = pusat fokus (0..1 dari bawah), y = setengah lebar pita tajam */',
    'varying vec2 vUv;',
    'vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }',
    'float luma(vec3 c){ return dot(c,vec3(0.2126,0.7152,0.0722)); }',
    'float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }',
    'float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash12(i),hash12(i+vec2(1,0)),f.x),mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),f.x),f.y); }',
    'void main(){',
    ' vec2 uv=vUv; vec2 cc=uv-0.5; float r2=dot(cc,cc);',
    ' /* aberasi kromatik halus di tepi layar */',
    ' vec2 ca=cc*r2*uCA;',
    ' vec4 s0=texture2D(tScene,uv); vec3 col=vec3(texture2D(tScene,uv+ca).r,s0.g,texture2D(tScene,uv-ca).b); float alpha=s0.a;',
    ' /* tilt-shift: pita fokus tajam, atas/bawah mengabur (efek miniatur) */',
    ' if(uUseDof>0.5){',
    '  float dy=abs(uv.y-uFocus.x); float k=smoothstep(uFocus.y,uFocus.y+0.34,dy)*uDof;',
    '  if(k>0.002){ vec2 px=vec2(1.5)/uRes*4.0; vec3 bl=texture2D(tBlur,uv).rgb*0.28;',
    '   bl+=texture2D(tBlur,uv+px*vec2(0.7,0.2)).rgb*0.18+texture2D(tBlur,uv-px*vec2(0.7,0.2)).rgb*0.18+texture2D(tBlur,uv+px*vec2(-0.2,0.7)).rgb*0.18+texture2D(tBlur,uv-px*vec2(-0.2,0.7)).rgb*0.18;',
    '   col=mix(col,bl,k); } }',
    ' /* bloom + streak anamorfik horizontal (hanya sorotan terkuat) */',
    ' vec3 bloom=texture2D(tBloom,uv).rgb;',
    ' vec3 st=vec3(0.0); for(int i=1;i<=5;i++){ float o=float(i)*0.012; st+=(texture2D(tBloom,uv+vec2(o,0.0)).rgb+texture2D(tBloom,uv-vec2(o,0.0)).rgb)*(1.0-float(i)*0.17); }',
    ' col+=bloom*uBloom+st*uStreak*uBloom*0.18;',
    ' alpha=max(alpha,clamp(luma(bloom)*uBloom,0.0,1.0));',
    ' /* (kabut layar dihapus: kabut sekarang kabut DUNIA di shader material, ikut kamera & berada di sekitar board) */',
    ' col*=uExposure;',
    ' /* tone mapping: bahu lembut yang menjaga hue (sorotan HDR tidak memutih/menguning) + sedikit kurva filmic; warna dasar tetap (audit-warna) */',
    ' float mx=max(col.r,max(col.g,col.b)); if(mx>0.74){ float m2=0.74+0.26*(1.0-exp(-(mx-0.74)/0.26)); col*=m2/mx; }',
    ' col=mix(col,aces(col*0.95)*1.03,0.18);',
    ' /* color grading: tint bayangan/sorotan + kontras + saturasi */',
    ' float l=luma(col); col=mix(col,col*uShadow,(1.0-smoothstep(0.0,0.5,l))*0.85); col=mix(col,col*uHigh,smoothstep(0.35,1.0,l)*0.8);',
    ' col=(col-0.5)*uContrast+0.5+uLift; l=luma(col); col=mix(vec3(l),col,uSat);',
    ' /* vinyet lembut */',
    ' float vg=smoothstep(0.16,0.92,r2*2.15); col*=1.0-vg*uVig; col=mix(col,col*vec3(0.92,0.96,1.05),vg*0.5*uNight);',
    ' /* film grain animasi + dither (anti banding gradasi langit) */',
    ' float g=hash12(gl_FragCoord.xy+fract(uTime*7.31)*vec2(311.0,173.0))-0.5; col+=g*uGrain*(1.0-0.5*l);',
    ' col+=(hash12(gl_FragCoord.xy*1.37+3.7)-0.5)/255.0;',
    ' col=clamp(col,0.0,1.0);',
    ' gl_FragColor=vec4(col*alpha,alpha); }'
  ].join('\n');

  function buildPipeline() {
    if (P.built) return;
    P.built = true;
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    g.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    P.quad = new T.Mesh(g, new T.MeshBasicMaterial());
    P.quad.frustumCulled = false;
    P.sceneQ = new T.Scene(); P.sceneQ.add(P.quad);
    P.camQ = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    P.mats.down = fsMat(DOWN_FRAG, { tSrc: { value: null }, uTexel: { value: new T.Vector2() } });
    P.mats.pre = fsMat(PRE_FRAG, { tSrc: { value: null }, uThr: { value: 0.8 }, uKnee: { value: 0.35 } });
    P.mats.up = fsMat(UP_FRAG, { tSrc: { value: null }, tBase: { value: null }, uTexel: { value: new T.Vector2() }, uMix: { value: 1 } });
    P.mats.comp = fsMat(COMP_FRAG, {
      tScene: { value: null }, tBloom: { value: null }, tBlur: { value: null }, uRes: { value: new T.Vector2(2, 2) }, uTime: U.uTime,
      uExposure: { value: 1 }, uBloom: { value: 0.3 }, uSat: { value: 1 }, uContrast: { value: 1 }, uVig: { value: 0.3 }, uGrain: { value: 0.02 },
      uDof: { value: 0.5 }, uCA: { value: 0.012 }, uLift: { value: 0 }, uHazeAmt: { value: 0 }, uStreak: { value: 0.5 }, uNight: U.uNight, uUseDof: { value: 1 }, uNether: U.uNether,
      uShadow: { value: new T.Color(1, 1, 1) }, uHigh: { value: new T.Color(1, 1, 1) }, uHaze: { value: new T.Color(1, 0.9, 0.7) }, uFocus: { value: new T.Vector2(0.48, 0.2) }
    });
    P.mats.comp.transparent = false;
  }

  function disposeTargets() {
    [P.rtScene, P.h0, P.h1].concat(P.b, P.u).forEach(function (r) { if (r) r.dispose(); });
    P.rtScene = P.h0 = P.h1 = null; P.b = []; P.u = [];
  }

  function allocTargets() {
    disposeTargets();
    var pw = Math.max(2, Math.floor(S.w * S.dpr)), ph = Math.max(2, Math.floor(S.h * S.dpr));
    var type = S.hdr ? T.HalfFloatType : T.UnsignedByteType;
    P.rtScene = mkRT(pw, ph, type, true);
    var f = S.level >= 2 ? 2 : 4; /* level rendah: rantai efek di resolusi lebih kecil */
    var w0 = Math.max(2, Math.floor(pw / f)), h0 = Math.max(2, Math.floor(ph / f));
    P.h0 = mkRT(w0, h0, type, false);
    P.h1 = mkRT(Math.max(2, w0 >> 1), Math.max(2, h0 >> 1), type, false);
    var n = S.level >= 1 ? 4 : 3, bw = Math.max(2, w0 >> 1), bh = Math.max(2, h0 >> 1);
    for (var i = 0; i < n; i++) {
      P.b.push(mkRT(bw, bh, type, false));
      if (i < n - 1) P.u.push(mkRT(bw, bh, type, false));
      bw = Math.max(2, bw >> 1); bh = Math.max(2, bh >> 1);
    }
  }

  function pass(mat, target, src) {
    P.quad.material = mat;
    S.renderer.setRenderTarget(target);
    S.renderer.render(P.sceneQ, P.camQ);
  }
  function setTex(mat, name, tex) { mat.uniforms[name].value = tex; }

  function renderPost() {
    var r = S.renderer, i, m;
    var prevAuto = r.autoClear;
    /* 1) adegan -> RT HDR */
    r.setRenderTarget(P.rtScene); r.setClearColor(0x000000, 0); r.clear(true, true, true);
    r.render(S.scene, S.camera);
    r.autoClear = false;
    /* 2) rantai blur (full-color) untuk DOF */
    m = P.mats.down; setTex(m, 'tSrc', P.rtScene.texture); m.uniforms.uTexel.value.set(1 / P.rtScene.width, 1 / P.rtScene.height); pass(m, P.h0);
    setTex(m, 'tSrc', P.h0.texture); m.uniforms.uTexel.value.set(1 / P.h0.width, 1 / P.h0.height); pass(m, P.h1);
    /* 3) bloom: bright-pass -> turun -> naik */
    var n = P.b.length;
    m = P.mats.pre; setTex(m, 'tSrc', P.h1.texture); m.uniforms.uThr.value = E.bloomThr; pass(m, P.b[0]);
    m = P.mats.down;
    for (i = 1; i < n; i++) { setTex(m, 'tSrc', P.b[i - 1].texture); m.uniforms.uTexel.value.set(1 / P.b[i - 1].width, 1 / P.b[i - 1].height); pass(m, P.b[i]); }
    m = P.mats.up; var accum = P.b[n - 1];
    for (i = n - 2; i >= 0; i--) {
      setTex(m, 'tSrc', accum.texture); setTex(m, 'tBase', P.b[i].texture); m.uniforms.uTexel.value.set(1 / accum.width, 1 / accum.height); m.uniforms.uMix.value = 1.0;
      pass(m, P.u[i]); accum = P.u[i];
    }
    /* 4) composite ke layar */
    m = P.mats.comp; var cu = m.uniforms;
    cu.tScene.value = P.rtScene.texture; cu.tBloom.value = accum.texture; cu.tBlur.value = P.h1.texture;
    cu.uRes.value.set(P.rtScene.width, P.rtScene.height);
    var rd = S.reduce ? 0.0 : 1.0;
    cu.uExposure.value = E.exposure; cu.uBloom.value = E.bloom * (S.level >= 1 ? 1 : 0.8); cu.uSat.value = E.sat; cu.uContrast.value = E.contrast;
    cu.uVig.value = E.vig; cu.uGrain.value = E.grain * rd; cu.uDof.value = E.dof; cu.uLift.value = E.lift;
    cu.uHazeAmt.value = E.hazeAmt; cu.uStreak.value = (S.level >= 1 ? 1 : 0) * (0.35 + 0.65 * E.night + 0.3 * E.nether);
    cu.uCA.value = S.level >= 1 ? 0.010 : 0.0; cu.uUseDof.value = S.level >= 1 && E.dof > 0.01 ? 1 : 0;
    cu.uShadow.value.copy(E.shadow); cu.uHigh.value.copy(E.high); cu.uHaze.value.copy(E.haze);
    r.setRenderTarget(null); r.setClearColor(0x000000, 0); r.clear(true, true, true);
    pass(m, null);
    r.autoClear = prevAuto;
  }

  /* ---------- Kubah langit ---------- */
  var SKY_VERT = 'varying vec3 vDir; void main(){ vDir=normalize(position); vec4 p=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*p; gl_Position.z=gl_Position.w*0.99999; }';
  var SKY_FRAG = [
    'precision highp float;',
    'varying vec3 vDir; uniform float uTime,uNight,uNether; uniform vec3 uTop,uBot,uCloud,uSunDir,uMoonDir;',
    NOISE_GLSL,
    'float hash21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }',
    'void main(){',
    ' vec3 d=normalize(vDir); float h=d.y; float hp=clamp(h,0.0,1.0);',
    ' float day=1.0-uNight;',
    ' /* gradasi: horizon = warna kabut (sama dgn fog) -> tidak ada sambungan */',
    ' vec3 col=mix(uBot,uTop,pow(hp,0.55)); ',
    ' float sd=max(dot(d,uSunDir),0.0);',
    ' /* matahari + halo hangat + cahaya horizon senja */',
    ' vec3 warm=mix(vec3(1.0,0.86,0.62),vec3(1.0,0.55,0.28),uNether);',
    ' col+=warm*(pow(sd,6.0)*0.22+pow(sd,48.0)*0.55+smoothstep(0.9992,0.9998,sd)*2.2)*day*(1.0-0.6*uNether);',
    ' col+=vec3(1.0,0.72,0.45)*exp(-hp*9.0)*0.10*day*smoothstep(-0.2,0.5,dot(normalize(vec2(d.x,d.z)),normalize(vec2(uSunDir.x,uSunDir.z))));',
    ' /* awan fbm (bidang proyeksi, bergerak) */',
    ' float cy=max(h+0.12,0.001); vec2 cp=d.xz/cy*0.55+vec2(uTime*0.012,uTime*0.004);',
    ' float cn=cFbm(cp*1.4); float cov=smoothstep(0.50,0.80,cn)*smoothstep(0.0,0.28,h+0.02);',
    ' float rim=smoothstep(0.50,0.80,cFbm(cp*1.4+uSunDir.xz*0.06));',
    ' vec3 cc=mix(uCloud*mix(0.82,1.0,cn),uCloud*vec3(1.06,1.02,0.94),clamp((rim-cov)*3.0+0.4,0.0,1.0));',
    ' cc=mix(cc,vec3(0.10,0.07,0.07)+warm*0.10*pow(1.0-hp,3.0),uNether);',
    ' cc=mix(cc,uCloud*vec3(0.26,0.32,0.52),uNight*(1.0-uNether));',
    ' col=mix(col,cc,cov*mix(0.9,0.55,uNight)*mix(1.0,0.9,uNether));',
    ' /* BINTANG berkelip + bintang jatuh + AURORA (malam, bukan Nether) */',
    ' float nt=uNight*(1.0-uNether);',
    ' if(nt>0.01){',
    '  vec2 sp=vec2(atan(d.z,d.x)*1.0,asin(clamp(h,-1.0,1.0)))*vec2(110.0,110.0)/6.2831*6.2831*0.55; vec2 gi=floor(sp),gf=fract(sp)-0.5;',
    '  float hs=hash21(gi); float st=step(0.985,hs)*smoothstep(0.32,0.0,length(gf-(vec2(hash21(gi+7.0),hash21(gi+13.0))-0.5)*0.5));',
    '  float tw=0.55+0.45*sin(uTime*(1.5+hs*4.0)+hs*40.0); col+=vec3(0.85,0.92,1.0)*st*tw*smoothstep(0.02,0.25,h)*nt*1.4;',
    '  float md=max(dot(d,uMoonDir),0.0); col+=vec3(0.55,0.62,0.9)*(pow(md,10.0)*0.18+pow(md,120.0)*0.5)*nt;',
    '  float au=smoothstep(0.10,0.55,h)*smoothstep(0.95,0.5,h); vec2 ap=vec2(atan(d.z,d.x)*2.2+uTime*0.05,h*3.0);',
    '  float ribbon=cNoise(vec2(ap.x*1.2+sin(ap.y*2.0+uTime*0.15)*1.2,uTime*0.06)); float band=smoothstep(0.35,0.75,ribbon)*cNoise(ap*vec2(3.0,6.0)+uTime*0.1);',
    '  vec3 ac=mix(vec3(0.12,1.0,0.62),vec3(0.55,0.3,1.0),smoothstep(0.2,0.7,h)); col+=ac*band*au*0.20*nt;',
    '  float ph=floor(uTime/11.0); float sdn=hash21(vec2(ph,3.1)); if(sdn>0.35){ float ft=fract(uTime/11.0)*1.0; vec2 a0=vec2(hash21(vec2(ph,1.0)),hash21(vec2(ph,2.0))); ',
    '   vec2 sc=vec2(atan(d.z,d.x)/6.2831+0.5,h); vec2 p0=vec2(a0.x,0.35+a0.y*0.45); vec2 dir=normalize(vec2(0.8,-0.5)); vec2 q=sc-(p0+dir*ft*0.35); float al=dot(q,dir); float pd=abs(dot(q,vec2(-dir.y,dir.x)));',
    '   float trail=smoothstep(0.0,-0.09,al)*smoothstep(-0.0,0.002,al+0.09)*smoothstep(0.0035,0.0,pd); col+=vec3(1.0)*trail*smoothstep(0.0,0.1,ft)*smoothstep(0.35,0.1,ft)*nt; }',
    ' }',
    ' /* Nether: pendar bara di horizon, berdenyut */',
    ' col+=vec3(1.0,0.35,0.08)*uNether*exp(-hp*7.0)*(0.30+0.08*sin(uTime*0.8+d.x*4.0))*(0.6+0.4*cNoise(d.xz*6.0+uTime*0.1));',
    ' gl_FragColor=vec4(col,1.0); }'
  ].join('\n');

  var skyMesh = null, skyMat = null;
  function buildSky() {
    if (skyMesh) return;
    skyMat = new T.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: T.BackSide, depthWrite: false, depthTest: false, fog: false,
      uniforms: {
        uTime: U.uTime, uNight: U.uNight, uNether: U.uNether, uTop: { value: new T.Color() }, uBot: { value: new T.Color() }, uCloud: { value: new T.Color(1, 1, 1) },
        uSunDir: { value: new T.Vector3(-0.32, 0.85, 0.5).normalize() }, uMoonDir: { value: new T.Vector3(38, 17, -98).normalize() }
      }
    });
    skyMesh = new T.Mesh(new T.SphereGeometry(100, 40, 20), skyMat);
    skyMesh.frustumCulled = false; skyMesh.renderOrder = -1000; skyMesh.name = 'cine-sky';
    (S.skyDome || S.scene).add(skyMesh);
  }

  /* ---------- Patch material voxel ---------- */
  var MAT_FRAG_HEAD = [
    'uniform float uTime,uNight,uNether,uMistAmt,uCloudSh,uDoom,uTileGlow,uGMist; uniform vec2 uGMistR; uniform vec3 uMist; uniform vec4 uPress[4]; varying vec3 vCW;',
    NOISE_GLSL
  ].join('\n');
  var MAT_FRAG_BODY = [
    '{ vec3 cw=vCW; vec3 base=gl_FragColor.rgb; float day=1.0-uNight;',
    '  /* bayangan awan yang melintas di papan (siang) */',
    '  vec2 cuv=cw.xz*0.05+vec2(uTime*0.018,uTime*0.007); float cn=cFbm3(cuv);',
    '  float cs=smoothstep(0.50,0.74,cn); gl_FragColor.rgb*=1.0-cs*uCloudSh*0.30;',
    '/* DOOM: rumput & daun di luar papan layu -> pucat, lebih gelap, kering */',
    'if(uDoom>0.001){ float outB=smoothstep(5.4,7.4,max(abs(cw.x),abs(cw.z))); float gm=smoothstep(0.004,0.045,base.g-max(base.r,base.b*0.9));',
    'float wd=uDoom*outB*gm; if(wd>0.001){ float l=dot(gl_FragColor.rgb,vec3(0.299,0.587,0.114)); float v=0.88+0.24*cNoise(cw.xz*2.6);',
    'vec3 dead=vec3(l*1.18)*vec3(0.92,0.82,0.62)*0.80*v+vec3(0.035,0.028,0.018); gl_FragColor.rgb=mix(gl_FragColor.rgb,dead,min(1.0,wd*1.25)); } }',
    '/* TILE: menyala tipis (napas pelan) di dalam papan + kilau saat diinjak (hanya saat baru mendarat) */',
    '{ float onB=step(max(abs(cw.x),abs(cw.z)),5.004)*step(0.25,cw.y)*step(cw.y,1.3);',
    'float pul=0.5+0.5*sin(uTime*0.8+(cw.x*0.6+cw.z*0.45));',
    'gl_FragColor.rgb+=base*onB*uTileGlow*(0.55+0.45*pul);',
    'float gl=0.0; for(int i=0;i<4;i++){ vec4 pr=uPress[i]; if(pr.w>0.001){ vec2 dd=abs(cw.xz-pr.xy); float mxd=max(dd.x,dd.y); gl+=pr.w*step(mxd,0.503)*step(0.25,cw.y)*(0.6+0.4*(1.0-smoothstep(0.15,0.55,mxd))); } }',
    'gl_FragColor.rgb+=(base*1.0+vec3(0.10,0.09,0.06))*gl*0.85; }',
    '/* air (y rendah, biru): kilau matahari berkelip + riak */',
    '  bool lowY=cw.y<-0.10&&cw.y>-0.42; float bl=base.b-base.r; /* biru ATAU tosca (sungai World R=0x35B9DC: b-max(r,g) cuma 0.14 -> dulu tak terdeteksi, kilau siang hilang) */',
    '  if(lowY&&bl>0.30&&base.b>base.g-0.06&&uNether<0.5){ float rp=cNoise(cw.xz*vec2(2.2,2.2)+vec2(uTime*0.55,-uTime*0.35)); float rp2=cNoise(cw.xz*5.3+vec2(-uTime*0.8,uTime*0.4));',
    '   float sp=smoothstep(0.84,0.97,rp*0.6+rp2*0.5); gl_FragColor.rgb+=vec3(1.0,0.97,0.88)*sp*(0.40*day+0.12*uNight); gl_FragColor.rgb*=0.96+0.08*rp; }',
    '  /* lava (oranye jenuh): menyala HDR, mengalir pelan -> memicu bloom */',
    '  float lv=smoothstep(0.62,0.9,base.r)*smoothstep(0.22,0.38,base.g)*(1.0-smoothstep(0.62,0.84,base.g))*(1.0-smoothstep(0.12,0.30,base.b));',
    '  if(lv>0.01){ float f1=cNoise(cw.xz*1.9+vec2(uTime*0.10,uTime*0.06)); float f2=cNoise(cw.xz*4.6-vec2(uTime*0.18,0.0)); float fl=0.80+0.55*f1+0.35*f2*f2; gl_FragColor.rgb=mix(gl_FragColor.rgb,base*fl*1.22+vec3(0.05,0.008,0.0),lv); }',
    '  /* kabut dasar: makin tebal di bawah & jauh dari kamera (aerial perspective) */',
    '  float dist=length(cw-cameraPosition); float hf=exp(-max(cw.y+0.4,0.0)*0.55)*smoothstep(7.0,46.0,dist);',
    '  /* kabut tanah di DUNIA: bergumpal & melayang pelan, rendah, BARU mulai agak jauh dari papan (uGMistR); kekuatan ikut Pengaturan > Grafis (uGMist) */',
    '  float mn=cNoise(cw.xz*0.28+vec2(uTime*0.035,-uTime*0.022))*0.65+cNoise(cw.xz*0.7-vec2(uTime*0.02,uTime*0.03))*0.35;',
    '  float gm=exp(-max(cw.y+0.1,0.0)*2.2)*smoothstep(uGMistR.x,uGMistR.y,max(abs(cw.x),abs(cw.z)))*smoothstep(2.5,7.0,dist)*(0.15+0.85*mn)*uGMist;',
    '  hf=max(hf*(0.75+0.5*mn),gm*0.55);',
    '  gl_FragColor.rgb=mix(gl_FragColor.rgb,uMist,clamp(hf*uMistAmt,0.0,0.85)); }'
  ].join('\n');

  function patchMaterial(mat) {
    if (!mat || mat.__cine) return mat;
    mat.__cine = true;
    var prev = mat.onBeforeCompile;
    mat.onBeforeCompile = function (sh, rend) {
      if (prev) prev.call(mat, sh, rend);
      sh.uniforms.uTime = U.uTime; sh.uniforms.uNight = U.uNight; sh.uniforms.uNether = U.uNether;
      sh.uniforms.uDoom = U.uDoom; sh.uniforms.uTileGlow = U.uTileGlow; sh.uniforms.uPress = U.uPress; sh.uniforms.uMist = U.uMist; sh.uniforms.uMistAmt = U.uMistAmt; sh.uniforms.uGMist = U.uGMist; sh.uniforms.uGMistR = U.uGMistR; sh.uniforms.uCloudSh = U.uCloudSh;
      sh.vertexShader = 'varying vec3 vCW; uniform vec4 uPress[4];\n' + sh.vertexShader
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n { vec3 wpP=(modelMatrix*vec4(transformed,1.0)).xyz; for(int i=0;i<4;i++){ vec4 pr=uPress[i]; if(pr.z>0.0){ vec2 dd=abs(wpP.xz-pr.xy); if(max(dd.x,dd.y)<0.502&&wpP.y>0.25) transformed.y-=pr.z; /* y>0.25: hanya petak & benda di atasnya; tanah tepi papan (y<=0.03, pojok di |x|/|z|=5.0) dan bingkai tidak ikut turun */ } } }')
        .replace('#include <project_vertex>', '#include <project_vertex>\n vCW=(modelMatrix*vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = MAT_FRAG_HEAD + '\n' + sh.fragmentShader.replace('#include <fog_fragment>', MAT_FRAG_BODY + '\n#include <fog_fragment>');
    };
    var pk = mat.customProgramCacheKey;
    mat.customProgramCacheKey = function () { return 'ut-cine-voxel' + (pk ? pk.call(mat) : ''); };
    mat.needsUpdate = true;
    return mat;
  }

  /* ---------- Profil per Pengaturan > Grafis (low|normal|high|ultra) ----------
     mist = kekuatan kabut tanah dunia; r0/r1 = jarak (dari tengah papan) mulai-penuh kabut; ff = proporsi kunang-kunang/bara yang digambar. Ubah angka di sini untuk menyetel. */
  var GFX_FX = { low: { mist: 0, r0: 10, r1: 16, ff: 0 }, normal: { mist: 0.6, r0: 11, r1: 17, ff: 0.5 }, high: { mist: 1, r0: 10, r1: 16, ff: 0.8 }, ultra: { mist: 1.3, r0: 9, r1: 15, ff: 1 } };
  function applyGfxFx() {
    var P2 = GFX_FX[S.gfx] || GFX_FX.high;
    U.uGMist.value = P2.mist * (S.reduce ? 0.6 : 1); U.uGMistR.value.set(P2.r0, P2.r1);
    if (AMB.pts) AMB.pts.geometry.setDrawRange(0, Math.max(0, Math.round(AMB.n * P2.ff)));
  }

  /* ---------- Partikel ambient ---------- */
  var AMB = { pts: null, mat: null, n: 0 };
  var AMB_VERT = [
    'attribute vec4 aSeed; uniform float uTime,uSize,uPR,uNight,uNether; uniform vec3 uCenter; uniform vec3 uBox; varying float vA; varying vec3 vC;',
    'uniform vec3 uColDay,uColNight,uColNether;',
    'void main(){',
    ' float mode=mix(mix(0.0,1.0,uNight),2.0,uNether);',
    ' /* gerak: siang melayang pelan, malam berputar (kunang-kunang), Nether naik cepat (bara) */',
    ' vec3 v=vec3(0.07,0.05,0.03)*(1.0-uNether)+vec3(0.18,0.55+aSeed.w*0.6,0.10)*uNether;',
    ' vec3 p=aSeed.xyz*uBox+v*uTime*(0.6+aSeed.w);',
    ' p.x+=sin(uTime*(0.3+aSeed.w)+aSeed.z*20.0)*0.5*(1.0+uNight); p.z+=cos(uTime*(0.27+aSeed.x)+aSeed.y*17.0)*0.5*(1.0+uNight); p.y+=sin(uTime*0.5+aSeed.x*30.0)*0.25*(1.0-uNether);',
    ' p=mod(p+uBox*0.5,uBox)-uBox*0.5; vec3 wp=vec3(p.x+uCenter.x,p.y+uBox.y*0.5+0.12,p.z+uCenter.z);',
    ' float fade=1.0-pow(length(p/uBox*2.0),4.0); fade=clamp(fade,0.0,1.0);',
    ' float tw=mix(0.45+0.55*sin(uTime*(1.2+aSeed.w*2.5)+aSeed.x*40.0),0.35+0.65*pow(0.5+0.5*sin(uTime*(0.9+aSeed.w*1.6)+aSeed.y*30.0),3.0),step(0.5,mode)*(1.0-uNether));',
    ' tw=mix(tw,0.55+0.45*sin(uTime*(7.0+aSeed.w*9.0)+aSeed.z*50.0),uNether);',
    ' vA=fade*tw*clamp(uNight*2.0+uNether,0.0,1.0); /* siang = tanpa partikel; malam = kunang-kunang; Nether = bara */ vC=mix(mix(uColDay,uColNight,uNight),uColNether,uNether);',
    ' vec4 mv=viewMatrix*vec4(wp,1.0); gl_Position=projectionMatrix*mv; vA*=smoothstep(4.0,9.0,-mv.z); /* dekat kamera = hilang (tidak jadi blob besar yang menempel di layar) */',
    ' float sz=uSize*(0.55+aSeed.w*0.9)*mix(1.0,1.55,uNight)*mix(1.0,0.7,uNether);',
    ' gl_PointSize=clamp(sz*uPR*(26.0/max(-mv.z,1.0)),1.0,22.0*uPR); }'
  ].join('\n');
  var AMB_FRAG = [
    'precision mediump float; varying float vA; varying vec3 vC;',
    'void main(){ vec2 q=gl_PointCoord-0.5; float r=length(q)*2.0; float a=smoothstep(1.0,0.0,r); a=a*a; float core=smoothstep(0.35,0.0,r);',
    ' gl_FragColor=vec4(vC*(0.6+core*1.1),a*vA); }'
  ].join('\n');

  function buildAmbient() {
    if (AMB.pts) return;
    var n = S.coarse ? 70 : 150; AMB.n = n; /* dikurangi (sebelumnya 260/520) */
    var g = new T.BufferGeometry(), pos = new Float32Array(n * 3), seed = new Float32Array(n * 4);
    var s = 1337; function rr() { s = (s * 16807) % 2147483647; return s / 2147483647; }
    for (var i = 0; i < n; i++) { seed[i * 4] = rr() - 0.5; seed[i * 4 + 1] = rr(); seed[i * 4 + 2] = rr() - 0.5; seed[i * 4 + 3] = rr(); }
    g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new T.BufferAttribute(seed, 4));
    AMB.mat = new T.ShaderMaterial({
      vertexShader: AMB_VERT, fragmentShader: AMB_FRAG, transparent: true, depthWrite: false, depthTest: true, blending: T.AdditiveBlending, fog: false,
      uniforms: {
        uTime: U.uTime, uNight: U.uNight, uNether: U.uNether, uSize: { value: 4.0 }, uPR: { value: 1 }, uCenter: { value: new T.Vector3() }, uBox: { value: new T.Vector3(15, 4.2, 15) }, /* kotak kecil: hanya di sekitar board */
        uColDay: { value: new T.Color(1.0, 0.93, 0.72) }, uColNight: { value: new T.Color(0.75, 1.0, 0.45) }, uColNether: { value: new T.Color(1.0, 0.42, 0.10) }
      }
    });
    AMB.pts = new T.Points(g, AMB.mat); AMB.pts.frustumCulled = false; AMB.pts.renderOrder = 50; AMB.pts.name = 'cine-ambient';
    S.scene.add(AMB.pts);
  }

  /* ---------- Suasana (look) ---------- */
  function setLookTargets(o) {
    var night = !!o.night, nether = o.themeKey === 'nether';
    var L = tgt;
    L.night = night ? 1 : 0; L.nether = nether ? 1 : 0;
    L.top.set(o.top || '#5EC1FF'); L.bot.set(o.bot || '#DDF4FF');
    if (nether) {
      L.exposure = 1.0; L.bloom = 0.34; L.bloomThr = 1.0; L.sat = 1.08; L.contrast = 1.10; L.vig = 0.42; L.grain = 0.026; L.dof = 0.5; L.lift = -0.004;
      L.shadow.setRGB(0.80, 0.86, 1.10); L.high.setRGB(1.10, 0.94, 0.80);
      L.sunCol.setHex(0xFFC794); L.sunInt = 0.62; L.hemiSky.setHex(0xFFC8A0); L.hemiInt = 0.66; L.hemiGnd.setHex(0x4A1E14);
      L.fillCol.setHex(0x6A5BFF); L.fillInt = 0.12; L.cloud.setHex(0x2A1A1A); L.mistAmt = 0.55; L.cloudSh = 0.0; L.haze.setHex(0xFF7A2A); L.hazeAmt = 0.10;
    } else if (night) {
      L.exposure = 1.04; L.bloom = 0.40; L.bloomThr = 0.86; L.sat = 1.02; L.contrast = 1.10; L.vig = 0.48; L.grain = 0.030; L.dof = 0.6; L.lift = 0.004;
      L.shadow.setRGB(0.80, 0.92, 1.18); L.high.setRGB(1.06, 1.02, 0.94);
      L.sunCol.setHex(0x9DB6FF); L.sunInt = 0.42; L.hemiSky.setHex(0x8FA6FF); L.hemiInt = 0.5; L.hemiGnd.setHex(0x1A2340);
      L.fillCol.setHex(0xFFB27A); L.fillInt = 0.10; L.cloud.setHex(0x8FA6D8); L.mistAmt = 0.65; L.cloudSh = 0.0; L.haze.setHex(0x6E86FF); L.hazeAmt = 0.05;
    } else {
      L.exposure = 1.0; L.bloom = 0.26; L.bloomThr = 1.0; L.sat = 1.07; L.contrast = 1.08; L.vig = 0.30; L.grain = 0.018; L.dof = 0.62; L.lift = 0.0;
      L.shadow.setRGB(0.90, 0.96, 1.08); L.high.setRGB(1.08, 1.0, 0.90);
      L.sunCol.setHex(0xFFEBC8); L.sunInt = 0.66; L.hemiSky.setHex(0xEAF4FF); L.hemiInt = 0.66; L.hemiGnd.copy(new T.Color(o.hemiGnd != null ? o.hemiGnd : 0xB9D7A0));
      L.fillCol.setHex(0x9DB8FF); L.fillInt = 0.10; L.cloud.setHex(0xFFFFFF); L.mistAmt = 0.50; L.cloudSh = 1.0; L.haze.setHex(0xFFD9A0); L.hazeAmt = 0.12;
    }
    L.mist.set(o.bot || '#DDF4FF');
    if (night) L.mist.lerp(new T.Color(0x2A3C80), 0.1);
    if (!hasLook) { copyLook(cur, tgt); hasLook = true; applyLights(true); }
  }
  function copyLook(a, b) {
    for (var k in b) { var v = b[k]; if (v && v.isColor) a[k].copy(v); else if (typeof v === 'number') a[k] = v; }
  }
  function lerpLook(a, b, k) {
    for (var key in b) { var v = b[key]; if (v && v.isColor) a[key].lerp(v, k); else if (typeof v === 'number') a[key] += (v - a[key]) * k; }
  }

  var fill = null;
  function applyLights(force) {
    if (!S.sun || !S.hemi) return;
    if (!fill) {
      fill = new T.DirectionalLight(0x9DB8FF, 0.1); fill.position.set(13, 9, -12); fill.castShadow = false; S.scene.add(fill);
    }
    S.hemi.color.copy(E.hemiSky); S.hemi.intensity = E.hemiInt; S.hemi.groundColor.copy(E.hemiGnd);
    S.sun.color.copy(E.sunCol); S.sun.intensity = E.sunInt;
    fill.color.copy(E.fillCol); fill.intensity = E.fillInt;
  }

  function uniformsFromLook() {
    U.uNight.value = E.night; U.uNether.value = E.nether;
    U.uMist.value.copy(E.mist); U.uMistAmt.value = E.mistAmt; applyGfxFx(); U.uCloudSh.value = E.cloudSh * (S.reduce ? 0.6 : 1);
    if (skyMat) { skyMat.uniforms.uTop.value.copy(E.top); skyMat.uniforms.uBot.value.copy(E.bot); skyMat.uniforms.uCloud.value.copy(E.cloud); }
  }


  /* ---------- DOOM: suasana berubah saat Dragon Awakening (kayu papan -> bedrock) ---------- */
  /* Asap hitam: awan 3D (sprite) yang MENGELILINGI papan di dunia, ikut berputar/paralaks bersama kamera. */
  function smokeCanvas(seed, size) {
    var c = document.createElement('canvas'); c.width = c.height = size;
    var x = c.getContext('2d'), im = x.createImageData(size, size), d = im.data;
    function h(a, b) { var n = Math.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453; return n - Math.floor(n); }
    function vn(px, py) { var ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
      return (h(ix, iy) * (1 - fx) + h(ix + 1, iy) * fx) * (1 - fy) + (h(ix, iy + 1) * (1 - fx) + h(ix + 1, iy + 1) * fx) * fy; }
    for (var j = 0; j < size; j++) for (var i = 0; i < size; i++) {
      var u = i / size, v = j / size, a = 0.5, n = 0, px = u * 6.5, py = v * 6.5;
      for (var o = 0; o < 5; o++) { n += a * vn(px, py); px = px * 2.02 + 5.3; py = py * 2.02 + 1.7; a *= 0.5; }
      var dx = u - 0.5, dy = v - 0.5, r = Math.sqrt(dx * dx + dy * dy) * 2, fall = Math.max(0, Math.min(1, (1 - r) / 0.7)); fall = fall * fall * (3 - 2 * fall);
      var al = Math.max(0, Math.min(1, (n - 0.40) * 7.0)) * fall;
      var k = (j * size + i) * 4; d[k] = 255; d[k + 1] = 255; d[k + 2] = 255; d[k + 3] = Math.round(Math.min(1, al * 1.25) * 255);
    }
    x.putImageData(im, 0, 0); return c;
  }

  function buildDoomSmoke() {
    if (DOOM.g) return;
    try {
      var g = new T.Group(); g.name = 'cine-doom-smoke'; g.visible = false;
      var texs = [new T.CanvasTexture(smokeCanvas(1.0, 160)), new T.CanvasTexture(smokeCanvas(7.0, 160)), new T.CanvasTexture(smokeCanvas(13.0, 160))];
      var N = S.coarse ? 28 : 44, s = 4242;
      function rr() { s = (s * 16807) % 2147483647; return s / 2147483647; }
      DOOM.sp = [];
      for (var i = 0; i < N; i++) {
        var size = 7 + rr() * 6;
        var m = new T.SpriteMaterial({ map: texs[i % 3], color: 0x07060b, transparent: true, depthWrite: false, fog: false, opacity: 0 });
        m.rotation = rr() * 6.283;
        var sp = new T.Sprite(m); sp.scale.set(size, size * (0.75 + rr() * 0.35), 1); sp.renderOrder = 6;
        var o = { s: sp, a: (i / N) * 6.283 + (rr() - 0.5) * 0.35, r: 8.2 + rr() * 8, v: (rr() - 0.5) * 0.05, y: size * 0.46 + 0.35 + rr() * 1.6, ph: rr() * 6.283, spin: (rr() - 0.5) * 0.04 };
        DOOM.sp.push(o); g.add(sp);
      }
      g.position.set(0, 0, 0); S.scene.add(g); DOOM.g = g;
    } catch (e) { DOOM.g = null; try { console.warn('[Cinema] asap doom gagal', e); } catch (_) {} }
  }
  function updateDoomSmoke(dt, D) {
    var g = DOOM.g; if (!g) return;
    g.visible = D > 0.01; if (!g.visible) return;
    var cam = S.camera, cx = cam ? cam.position.x : 0, cz = cam ? cam.position.z : 1, cl = Math.sqrt(cx * cx + cz * cz) || 1; cx /= cl; cz /= cl;
    var mv = S.reduce ? 0 : 1;
    for (var i = 0; i < DOOM.sp.length; i++) {
      var o = DOOM.sp[i]; o.a += o.v * dt * mv; o.ph += dt * 0.25 * mv;
      var x = Math.sin(o.a) * o.r, z = Math.cos(o.a) * o.r, dn = Math.sin(o.a) * cx + Math.cos(o.a) * cz; /* >0 = sisi yang menghadap kamera */
      o.s.position.set(x, o.y + Math.sin(o.ph) * 0.35 * mv, z);
      o.s.material.rotation += o.spin * dt * mv;
      var near = Math.max(0, Math.min(1, (dn - 0.15) / 0.7)); /* asap di depan papan menipis agar papan tetap terbaca */
      var cd = cam ? Math.sqrt(Math.pow(cam.position.x - x, 2) + Math.pow(cam.position.y - o.y, 2) + Math.pow(cam.position.z - z, 2)) : 99; /* dekat kamera = menipis, tidak menutupi layar */
      o.s.material.opacity = Math.min(1, D * 1.1) * (1.0 - 0.85 * near) * Math.max(0, Math.min(1, (cd - 6) / 7));
    }
  }

  function doomMod(L, D) {
    if (D < 0.002) return;
    L.exposure *= 1 - 0.10 * D; L.sat *= 1 - 0.24 * D; L.contrast += 0.06 * D; L.vig += 0.24 * D; L.grain += 0.01 * D; L.hazeAmt *= 1 - D; L.bloom *= 1 - 0.2 * D;
    L.sunInt *= 1 - 0.26 * D; L.hemiInt *= 1 - 0.22 * D; L.sunCol.lerp(TMP.set(0xFF9A6A), 0.5 * D); L.hemiSky.lerp(TMP.set(0xB6A8AE), 0.5 * D);
    L.shadow.lerp(TMP.set(0.82, 0.86, 1.0), 0.5 * D);
    L.top.lerp(TMP.set(0x241f2a), 0.72 * D); L.bot.lerp(TMP.set(0x4b454f), 0.72 * D); L.mist.lerp(TMP.set(0x2e2b33), 0.72 * D); L.cloud.lerp(TMP.set(0x3a3238), 0.8 * D);
    L.mistAmt += 0.28 * D; L.cloudSh *= 1 + 0.4 * D;
  }
  var TMP = new T.Color();

  function applyDoomEffects(dt) {
    var tgtD = DOOM.dbg != null ? DOOM.dbg : DOOM.t;
    DOOM.v += (tgtD - DOOM.v) * (1 - Math.exp(-dt * 2.6)); if (Math.abs(tgtD - DOOM.v) < 0.002) DOOM.v = tgtD;
    var D = DOOM.v; U.uDoom.value = D;
    if (D > 0.01 && !DOOM.g) buildDoomSmoke();
    updateDoomSmoke(dt, D);
    return D;
  }


  /* ---------- Tile: tertekan + menyala saat bidak mendarat; nomor menyala tipis ---------- */
  var TL = { tiles: null, labs: [], map: {}, press: [], pw: [], baseY: [] };
  function setTiles(TILES, labs) {
    TL.tiles = TILES; TL.labs = labs || []; TL.map = {}; TL.baseY = [];
    for (var n = 1; n < TILES.length; n++) { var t = TILES[n]; if (!t) continue; TL.map[Math.round(t.x + 4.5) + ',' + Math.round(4.5 - t.z)] = n; }
    for (var k = 0; k < TL.labs.length; k++) if (TL.labs[k]) TL.baseY[k] = TL.labs[k].position.y;
    TL.press.length = 0; TL.pw.length = 0;
  }
  function tileAt(x, z) { var c = Math.floor(x + 5), r = Math.round(4.5 - z); if (c < 0 || c > 9 || r < 0 || r > 9) return 0; return TL.map[c + ',' + r] || 0; }
  function strike(n, amp) {
    var t = TL.tiles[n]; if (!t) return;
    for (var i = 0; i < TL.press.length; i++) if (TL.press[i].n === n && TL.press[i].age < 0.2) return; /* debounce */
    if (TL.press.length >= 4) TL.press.shift();
    TL.press.push({ n: n, x: t.x, z: t.z, age: 0, amp: amp });
  }
  function trackPawns(list) {
    if (!S.ok || !TL.tiles) return;
    for (var i = 0; i < list.length; i++) {
      var pos = list[i]; if (!pos) continue;
      var st = TL.pw[i] || (TL.pw[i] = { n: 0, air: false });
      var n = tileAt(pos.x, pos.z);
      if (!n) { st.n = 0; st.air = pos.y > 0.15; continue; }
      var gy = pos.y - TL.tiles[n].h;
      if (gy < 0.09 && (st.air || st.n !== n)) strike(n, 0.065);
      if (gy > 0.12) st.air = true; else if (gy < 0.09) st.air = false;
      st.n = n;
    }
  }
  /* kurva: turun cepat (seperti tombol keyboard) lalu kembali dengan pegas kecil */
  function pressCurve(t) { var dn = 0.055; if (t < dn) { var k = t / dn; return Math.sin(k * Math.PI * 0.5); } var u = t - dn; return Math.exp(-u * 11.0) * (1.0 - 0.10 * Math.sin(u * 22.0)); }
  function updateTiles(dt) {
    var P = U.uPress.value, i;
    for (i = 0; i < 4; i++) P[i].set(0, 0, 0, 0);
    for (i = TL.press.length - 1; i >= 0; i--) {
      var q = TL.press[i]; q.age += dt;
      if (q.age > 1.4) { TL.press.splice(i, 1); continue; }
    }
    var night = E.night, nether = E.nether;
    U.uTileGlow.value = 0.085 + 0.09 * night + 0.05 * nether;
    var pulse = {}, ci;
    for (i = 0; i < TL.press.length; i++) {
      var p = TL.press[i];
      var depth = S.reduce ? 0 : p.amp * pressCurve(p.age);
      var glow = (1 - Math.exp(-p.age * 38)) * Math.exp(-p.age * 3.4) * (0.75 + 0.25 * night + 0.2 * nether);
      P[i].set(p.x, p.z, depth, glow); pulse[p.n] = { d: depth, g: glow };
    }
    /* nomor petak: menyala tipis (HDR > 1 -> ikut bloom), ikut turun & menyala lebih saat diinjak */
    var base = 1.16 + 0.26 * night + 0.14 * nether;
    for (ci = 1; ci < TL.labs.length; ci++) {
      var lab = TL.labs[ci]; if (!lab) continue;
      var pr = pulse[ci], by = TL.baseY[ci] !== undefined ? TL.baseY[ci] : lab.position.y;
      var m = base + 0.12 * Math.sin(S.time * 0.8 + ci * 0.55) * (S.reduce ? 0 : 1) + (pr ? pr.g * 1.1 : 0);
      lab.material.color.setScalar(m); lab.position.y = by - (pr ? pr.d : 0);
    }
  }

  /* ---------- Aurora di LANGIT (3D, tertambat ke dunia: bergeser/paralaks saat kamera berputar) ---------- */
  var AUR = { g: null, mats: [] };
  var AUR_FRAG = [
    'precision highp float; varying vec2 vUv; uniform float uTime,uStr,uSeed;',
    'float h12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }',
    'float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h12(i),h12(i+vec2(1,0)),f.x),mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),f.x),f.y); }',
    'void main(){ float t=uTime; float x=vUv.x*7.0+uSeed*9.0; float y=vUv.y;',
    ' float w=sin(x*1.7+t*0.16+sin(x*3.1-t*0.21)*1.3);',
    ' float lower=0.10+0.10*w; float fall=smoothstep(lower,lower+0.10,y)*exp(-(y-lower)*2.6); /* tepi bawah tegas, memudar ke atas */',
    ' float rays=0.30+0.70*vn(vec2(x*11.0+w*3.5,t*0.17+uSeed)); float body=0.55+0.45*vn(vec2(x*1.4+t*0.05,y*3.0));',
    ' float hf=smoothstep(0.0,0.18,vUv.x)*smoothstep(1.0,0.82,vUv.x);',
    ' vec3 c=mix(vec3(0.08,1.0,0.55),vec3(0.55,0.28,1.0),smoothstep(0.18,0.85,y)); c=mix(c,vec3(0.12,0.95,0.95),0.22*(0.5+0.5*w));',
    ' float a=fall*rays*body*hf*uStr; gl_FragColor=vec4(c*1.7,a); }'
  ].join('\n');
  function buildAurora() {
    if (AUR.g) return;
    var g = new T.Group(); g.name = 'cine-aurora'; g.position.set(0, 0, 1); g.visible = false;
    var R = 54, H = 40, segs = 7, span = 1.25;
    for (var i = 0; i < segs; i++) {
      var geo = new T.CylinderGeometry(R, R, H, 40, 1, true, (i / segs) * Math.PI * 2, span); geo.translate(0, 3 + H / 2, 0);
      var m = new T.ShaderMaterial({
        vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }', fragmentShader: AUR_FRAG,
        uniforms: { uTime: U.uTime, uStr: { value: 0 }, uSeed: { value: i * 1.37 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false
      });
      var mesh = new T.Mesh(geo, m); mesh.frustumCulled = false; mesh.renderOrder = 8; g.add(mesh); AUR.mats.push(m);
    }
    S.scene.add(g); AUR.g = g;
  }
  function updateAurora() {
    if (!AUR.g) return;
    var str = E.night * (1 - E.nether) * (0.34 + 0.34 * DOOM.v) * (S.reduce ? 0.6 : 1);
    AUR.g.visible = str > 0.01;
    for (var i = 0; i < AUR.mats.length; i++) AUR.mats[i].uniforms.uStr.value = str;
  }

  /* ---------- Governor kualitas ---------- */
  function governor(dt) {
    if (S.q !== 'auto' || S.lockQ || dt <= 0) return;
    S.fpsAcc += dt; S.fpsN++;
    if (S.fpsAcc < 1.5) return;
    var avg = S.fpsAcc / S.fpsN; S.fpsAcc = 0; S.fpsN = 0;
    if (avg > 0.034) { S.slowT++; S.fastT = 0; } else if (avg < 0.021) { S.fastT++; S.slowT = 0; } else { S.slowT = 0; S.fastT = 0; }
    if (S.slowT >= 2 && S.level > 0) { setLevel(S.level - 1); S.slowT = 0; }
    else if (S.fastT >= 8 && S.level < (S.coarse ? 1 : 2) && !S.demoted) { setLevel(S.level + 1); S.fastT = 0; }
    if (S.slowT >= 3 && S.level === 0 && S.on) { S.on = false; } /* paling parah: kembali ke render bawaan */
  }
  function setLevel(l) {
    if (l === S.level) return;
    if (l < S.level) S.demoted = true; /* sekali turun, jangan naik-turun terus */
    S.level = l; if (S.built) { allocTargets(); } uniformsApplyLevel();
  }
  function uniformsApplyLevel() {
    /* visibilitas partikel diatur tiap frame di update() (malam/Nether + level + setting grafis) */
    if (S.sun) { var big = S.level >= 2 && !S.coarse ? 2048 : 1024; if (S.sun.shadow.mapSize.x !== big && S.level < 2) { /* biarkan ukuran shadow bawaan */ } }
  }

  /* ---------- API ---------- */
  var API = {
    get ready() { return S.ok; },
    get enabled() { return S.ok && S.on; },
    init: function (o) {
      try {
        var q = /[?&]cine=0\b/.test(win.location.search);
        try { if (UT.Prefs && UT.Prefs.get('cinema', true) === false) q = true; } catch (e) {}
        if (q) return false;
        S.renderer = o.renderer; S.scene = o.scene; S.camera = o.camera; S.hemi = o.hemi; S.sun = o.sun; S.skyDome = o.skyDome;
        S.coarse = !!o.coarse; S.reduce = !!o.reduce;
        var gl = S.renderer.getContext(), isGL2 = (typeof WebGL2RenderingContext !== 'undefined') && gl instanceof WebGL2RenderingContext;
        if (!isGL2) return false; /* MSAA RT + half-float butuh WebGL2; selain itu: render bawaan */
        var ex = S.renderer.extensions;
        S.hdr = !!ex.has('EXT_color_buffer_float'); /* MSAA half-float butuh ekstensi ini; tanpa itu RT 8-bit */
        S.level = S.coarse ? 1 : 2;
        buildPipeline(); buildSky(); buildAmbient(); buildAurora();
        var sz = S.renderer.getSize(new T.Vector2()); S.w = sz.x || win.innerWidth; S.h = sz.y || win.innerHeight; S.dpr = S.renderer.getPixelRatio();
        allocTargets();
        S.ok = true; S.on = true;
        return true;
      } catch (e) { try { console.warn('[Cinema] gagal init, pakai render bawaan:', e); } catch (_) {} S.ok = false; S.on = false; return false; }
    },
    patchMaterial: patchMaterial,
    look: function (o) { try { setLookTargets(o || {}); } catch (e) { console.warn('[Cinema] look', e); } },
    resize: function (w, h, dpr) {
      S.w = w; S.h = h; S.dpr = dpr || S.dpr;
      if (S.ok && P.built) { try { allocTargets(); } catch (e) { S.on = false; } }
    },
    update: function (dt, t, camera, center) {
      if (!S.ok) return;
      S.time += S.reduce ? dt * 0.25 : dt; U.uTime.value = S.time;
      var k = 1 - Math.exp(-dt * 2.2); lerpLook(cur, tgt, k);
      copyLook(E, cur); var D = applyDoomEffects(dt); doomMod(E, D);
      uniformsFromLook(); applyLights(); updateTiles(dt); updateAurora();
      var fg = S.scene.fog; /* kabut scene ikut warna/jarak suasana (doom = lebih pekat & gelap) */
      if (fg) { if (DOOM.fogObj !== fg) { DOOM.fogObj = fg; DOOM.fn = fg.near; DOOM.ff = fg.far; } fg.color.copy(E.bot); fg.near = DOOM.fn * (1 - 0.30 * D); fg.far = DOOM.ff * (1 - 0.22 * D); }
      if (AMB.pts) {
        AMB.mat.uniforms.uPR.value = S.dpr; if (center) AMB.mat.uniforms.uCenter.value.set(center.x, 0.0, center.z);
        AMB.pts.visible = S.on && !S.reduce && S.level >= 1 && (U.uNight.value > 0.02 || U.uNether.value > 0.02); /* siang: tak digambar sama sekali */
        AMB.mat.uniforms.uSize.value = 4.0;
        applyGfxFx();
      }
      if (S.sun) { U.uSunDirW.value.copy(S.sun.position).normalize(); if (skyMat) skyMat.uniforms.uSunDir.value.copy(U.uSunDirW.value); }
      /* fokus tilt-shift: pita tajam di sekitar pusat papan (sedikit di bawah tengah layar) */
      if (P.built) { var f = P.mats.comp.uniforms.uFocus.value; f.set(0.46, S.camera && S.camera.aspect < 1 ? 0.30 : 0.22); }
      governor(dt);
    },
    render: function () {
      if (!S.ok || !S.on) { S.renderer.setRenderTarget(null); S.renderer.render(S.scene, S.camera); return; }
      try { renderPost(); }
      catch (e) { console.warn('[Cinema] render gagal, kembali ke render bawaan:', e); S.on = false; try { S.renderer.setRenderTarget(null); } catch (_) {} S.renderer.render(S.scene, S.camera); }
    },
    setReduced: function (v) { S.reduce = !!v; },
    /* Pengaturan > Grafis (PlayerData.settings().graphics): low | normal | high | ultra. Kualitas DIKUNCI mengikuti pengaturan (governor FPS otomatis tidak dipakai lagi,
       sebelumnya ia menurunkan level sendiri saat FPS tersendat sehingga kunang-kunang & post-processing hilang di tengah main).
       low = sinematik mati (render bawaan, tanpa partikel) | normal = level 1 | high = level 2 (perangkat sentuh: 1) | ultra = level 2 di semua perangkat */
    applyGraphics: function (g) {
      if (!S.ok) return;
      g = (g === 'low' || g === 'normal' || g === 'ultra') ? g : 'high';
      S.gfx = g; applyGfxFx(); S.lockQ = true; S.demoted = false; S.on = g !== 'low';
      setLevel(g === 'normal' ? 1 : (g === 'ultra' ? 2 : (S.coarse ? 1 : 2)));
      uniformsApplyLevel();
    },
    setTiles: setTiles, trackPawns: trackPawns, strike: strike,
    setDoom: function (v) { DOOM.t = Math.max(0, Math.min(1, +v || 0)); },
    debugDoom: function (v) { DOOM.dbg = (v == null) ? null : Math.max(0, Math.min(1, +v)); },
    setEnabled: function (v) { S.on = !!v && S.ok; },
    setQuality: function (q) {
      S.q = q;
      if (q === 'high') { S.lockQ = true; setLevel(S.coarse ? 1 : 2); } else if (q === 'medium') { S.lockQ = true; setLevel(1); }
      else if (q === 'low') { S.lockQ = true; setLevel(0); } else { S.lockQ = false; S.demoted = false; }
    },
    state: S, look_: E, tl_: TL, doom_: DOOM
  };
  UT.Cinema = API;
})(window);
