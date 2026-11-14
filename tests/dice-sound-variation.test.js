const assert = require('assert');
const fs = require('fs');
const path = require('path');

/* Keluhan: suara pantulan dadu ke papan terdengar berpola sama untuk semua dadu.
   Penyebab: buffer noise di-cache dan selalu diputar dari sampel 0, nada tetap, bunyi pantulan = bunyi material yang sama. */
const src = fs.readFileSync(path.join(__dirname, '..', 'assets/js/dice-kit/DiceEffectsCore.js'), 'utf8');
assert.ok(/s\.start\(t, Math\.random\(\)/.test(src), 'noise dimulai dari offset acak');
assert.ok(!/s\.start\(t\);/.test(src), 'tidak ada lagi start(t) tanpa offset');
assert.ok(/this\._pj = 1 \+ \(Math\.random\(\) - 0\.5\) \* 0\.14/.test(src) && /f0 \*= pj/.test(src), 'nada divariasikan per pemutaran');
assert.ok(/thud\(index = 0, intensity = 1, gain = 1\)/.test(src) && /whoosh\(gain = 1\)/.test(src), 'ada lapisan benturan papan dan desis lepas tangan');
const impact = src.slice(src.indexOf('onImpact(point, speed, index)'), src.indexOf('onLand(pos)'));
assert.ok(impact.includes('this.sound.thud(index, k, e.soundGain)'), 'tiap pantulan memanggil thud(index)');
const start = src.slice(src.indexOf('onRollStart(pos)'), src.indexOf('onRollFrame'));
assert.ok(start.includes('this.sound.whoosh(') && !start.includes('this.sound.play('), 'lepas tangan = desis, bukan bunyi material');
console.log('ok - suara dadu: noise acak, nada bervariasi, benturan papan + desis lepas tangan terpisah');
