/* Jalankan dari akar repo:  node tools/blocky-character/build.js
   Membaca karakter.html (bagian 1 UTIL, 3–9: data, rig, slot, katalog, config, builder, pose) lalu menulis assets/js/blocky-character.js.
   karakter.html TIDAK diubah. Bagian 2 (scene), 10+ (UI, kamera, loop) sengaja tidak ikut. */
const fs=require('fs'),path=require('path'),ROOT=path.join(__dirname,'..','..');
const src=fs.readFileSync(path.join(ROOT,'karakter.html'),'utf8');
const re=/\/\* =+\n\s+(\d+)\. [^\n]*\n\s+=+ \*\//g,marks=[];let m;
while((m=re.exec(src)))marks.push({n:+m[1],start:m.index,end:m.index+m[0].length});
const sec=n=>{const i=marks.findIndex(x=>x.n===n);if(i<0)throw new Error('bagian '+n+' tidak ditemukan');const e=marks[i+1];
  if(!e&&n!==marks[marks.length-1].n)throw new Error('bagian '+n+' tanpa penutup');return src.slice(marks[i].end,e?e.start:src.length);};
const util=sec(1);
let body=[3,4,5,6,7,8,9].map(sec).join('\n');
if(!/scene\.add\(root\)/.test(body))throw new Error('scene.add(root) tidak ditemukan — struktur karakter.html berubah');
body=body.replace('scene.add(root)','/* root tidak ditambahkan ke scene: pemakai yang menempatkan */');
for(const bad of ['renderer','camera','showEl','getElementById'])
  if(new RegExp('\\b'+bad+'\\b').test(body))throw new Error('referensi "'+bad+'" bocor ke builder — perbarui build.js');
const out=fs.readFileSync(path.join(__dirname,'template.js'),'utf8').replace('/*UTIL*/',()=>util).replace('/*BODY*/',()=>body);
fs.writeFileSync(path.join(ROOT,'assets/js/blocky-character.js'),out);
console.log('assets/js/blocky-character.js',out.length,'bytes');
