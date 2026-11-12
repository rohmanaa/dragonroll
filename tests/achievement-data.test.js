const assert = require('assert');
const A = require('../assets/js/achievement-data.js');
assert.strictEqual(A.ACH.length, 15);
A.ACH.forEach(a => { assert.strictEqual(a[4].length, 3); assert.ok(a[4][0] < a[4][1] && a[4][1] < a[4][2], a[0]); });
// tanpa data server: semua nol, tidak ada yang bisa diklaim
let I = A.info(null, {});
assert.ok(I.every(a => a.v === 0 && a.st === 0 && a.pend === 0 && a.cl === 0 && a.tg === a.tg));
// bintang, klaim, dan pending
const sp = { plays: 60, wins: 55, best_streak: 5, counters: { chests: 10, dice_rolls: 300, best_login_streak: 7 }, claims: { menang: 1, peti: 9, dadu: 2 } };
I = A.info(sp, { skins: 3, emerald: 120 });
const by = id => I.find(a => a.id === id);
assert.deepStrictEqual([by('menang').st, by('menang').cl, by('menang').pend, by('menang').tg], [2, 1, 1, 200]);
assert.deepStrictEqual([by('peti').st, by('peti').cl], [1, 1], 'klaim tidak melebihi bintang');
assert.deepStrictEqual([by('dadu').st, by('dadu').pend], [2, 0]);
assert.strictEqual(by('legenda').st, 0); assert.strictEqual(by('legenda').tg, 500);
assert.strictEqual(by('emerald').st, 2); assert.strictEqual(by('skin').st, 1);
assert.strictEqual(by('login').st, 2); assert.strictEqual(by('streak').st, 2);
// klaim di server tidak boleh membuat nilai negatif / lebih dari 3
assert.strictEqual(A.info({ claims: { menang: 99 }, wins: 999 }, {}).find(a => a.id === 'menang').cl, 3);
assert.strictEqual(A.info({ claims: { menang: -4 } }, {}).find(a => a.id === 'menang').cl, 0);
// hadiah kumulatif
assert.deepStrictEqual(A.reward(0, 3), [3000, 40]); assert.deepStrictEqual(A.reward(1, 2), [750, 10]); assert.deepStrictEqual(A.reward(2, 2), [0, 0]);
console.log('ok - achievement-data'); console.log('1 tes lulus');
