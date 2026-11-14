const assert = require('assert');
const fs = require('fs');
const path = require('path');

/* Bug: pion yang dipindah Power (Trident, Sword/TNT/jebakan, Swap) diam di kepala ular / dasar tangga.
   Semua gerakan Power harus memanggil resolveTileAt (satu jalur dengan dadu). */
const main = fs.readFileSync(path.join(__dirname, '..', 'gameplay/js/main.js'), 'utf8');
const slice = (a, b) => { const s = main.indexOf(a), e = main.indexOf(b, s); assert.ok(s >= 0 && e > s, 'anchor missing: ' + a); return main.slice(s, e); };

const strike = slice("if(R.kind==='strike'||R.kind==='area'){", "if(R.kind==='swap'){");
assert.ok(/for\(const q of hits\)\{[^}]*resolveTileAt\(q,gid\)/.test(strike), 'korban Sword/TNT yang terdorong harus memproses petak pendaratan');
assert.ok(/R\.self&&hits\.length&&p\.pos!==oldP[^]*resolveTileAt\(p,gid\)/.test(strike), 'pemakai Trident harus memproses petak pendaratan');
assert.ok(strike.indexOf('Trident: kamu maju') < strike.indexOf('resolveTileAt(p,gid)'), 'Trident: maju dulu, baru petak diproses');

const swap = slice("if(R.kind==='swap'){ const L=T[0]", "if(R.kind==='freeze'){");
assert.ok(/for\(const q of \[p,L\]\)[^]*resolveTileAt\(q,gid\)/.test(swap), 'Swap harus memproses petak tujuan kedua pion (jebakan+ular+tangga+mob)');
assert.ok(!/await trapCheck\(/.test(swap), 'Swap tidak boleh lagi hanya memeriksa jebakan');

const trap = slice('async function trapCheck(p,gid){', 'const PU_PFX=');
assert.ok(/pushedOthers\.push\(q\)/.test(trap) && /for\(const q of pushedOthers\)[^]*resolveTileAt\(q,gid\)/.test(trap), 'korban lain jebakan harus memproses petak pendaratan');

assert.ok(/const mv=q=>\{ const d=old\[q\.idx\]-\(pushed\[q\.idx\]!=null\?pushed\[q\.idx\]:q\.pos\)/.test(main), 'teks "mundur N petak" memakai jarak dorongan, bukan posisi setelah ular/tangga');

console.log('ok - Power (Trident, Sword/TNT, jebakan, Swap) memproses petak pendaratan via resolveTileAt');
