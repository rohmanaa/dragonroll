/* Jalankan dari akar repo:  node tools/aura-fx/build.js
   Sumber: tools/aura-fx/src/*.js (ES module, ditulis untuk three r169 — paket "aura-3d").
   Hasil : assets/js/aura-fx.js — satu skrip klasik (global UT.AuraFX) untuk three.js r128 global (assets/js/vendor/three.min.js).
   Penyesuaian r128: tanpa import/export; shader pakai <encodings_fragment> (bukan <colorspace_fragment>); colorSpace tekstur di-guard. */
const fs = require('fs'), path = require('path'), ROOT = path.join(__dirname, '..', '..'), SRC = path.join(__dirname, 'src');
const MODS = [ // urutan = dependensi
  ['Config', 'AuraConfig', ['TAU', 'clamp', 'lerp', 'rnd', 'pick', 'smooth', 'RARITY', 'TIER', 'QUALITY', 'detectQuality']],
  ['Particles', 'AuraParticles', ['VoxelParticles']],
  ['Catalog', 'AuraCatalog', ['AURAS', 'getAura']],
  ['Decor', 'AuraDecor', ['DECOR']],
  ['System', 'AuraSystem', ['AuraSystem']],
];
const VAR = { AuraConfig: 'Config', AuraParticles: 'Particles', AuraCatalog: 'Catalog', AuraDecor: 'Decor' };
let out = `/* assets/js/aura-fx.js — GENERATED oleh tools/aura-fx/build.js dari tools/aura-fx/src (paket aura-3d). JANGAN edit manual.
   Aura karakter voxel 3D (15 aura, Common..Divine). Skrip klasik, global UT.AuraFX; perlu global THREE (r128).
     const sys = new UT.AuraFX.AuraSystem(scene, camera, {quality:'medium'});
     const aura = sys.attach(object3D, 'dragon', {intensity:1,size:1,speed:1,tint:null}, {height:2});
     aura.setAura('solar'); aura.jump(); aura.despawn(); // tiap frame: sys.update(dt)
*/
(function(){
window.UT=window.UT||{};
`;
for (const [name, file, exps] of MODS) {
  let s = fs.readFileSync(path.join(SRC, file + '.js'), 'utf8');
  s = s.replace(/^import \* as THREE from 'three';\n/m, '');
  s = s.replace(/^import \{([^}]*)\} from '\.\/(\w+)\.js';\n/gm, (_, names, f) => {
    if (!VAR[f]) throw new Error('import tak dikenal: ' + f);
    return 'const {' + names.trim() + '} = ' + VAR[f] + ';\n';
  });
  s = s.replace(/^export (const|class|function) /gm, '$1 ');
  if (/^\s*(import|export)\s/m.test(s)) throw new Error('import/export tersisa di ' + file);
  if (file === 'AuraDecor') {
    const n1 = (s.match(/#include <colorspace_fragment>/g) || []).length;
    s = s.replace(/#include <colorspace_fragment>/g, '#include <encodings_fragment>');
    const a = '_radial.colorSpace = THREE.SRGBColorSpace;';
    if (!s.includes(a)) throw new Error('baris colorSpace tidak ditemukan');
    s = s.replace(a, 'if (THREE.SRGBColorSpace) _radial.colorSpace = THREE.SRGBColorSpace; /* r152+; r128 tidak punya */');
    console.log('shader include diganti:', n1);
  }
  out += `const ${name} = (function(){\n${s}\nreturn { ${exps.join(', ')} };\n})();\n`;
}
out += `UT.AuraFX = { AuraSystem: System.AuraSystem, AURAS: Catalog.AURAS, getAura: Catalog.getAura, RARITY: Config.RARITY, TIER: Config.TIER, QUALITY: Config.QUALITY, detectQuality: Config.detectQuality };\n})();\n`;
fs.writeFileSync(path.join(ROOT, 'assets/js/aura-fx.js'), out);
console.log('assets/js/aura-fx.js', out.length, 'bytes');
