const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('pet.html');
const css = read('assets/ng/css/pet.css');
const page = read('assets/js/pet-page.js');

assert.ok(html.includes('<div id="petTitle">'));
assert.ok(html.includes('id="petInfoOpen" type="button" aria-label="Informasi tier" aria-haspopup="dialog"'));
assert.ok(html.includes('<dialog id="petInfo" aria-labelledby="petInfoTitle">'));
assert.ok(html.includes('<div class="pet-info-panel">'));
assert.ok(!html.includes('glyph-putih/info-bulat.webp'));
assert.ok(!html.includes('id="home"'));
assert.deepStrictEqual(
  fs.readFileSync(path.join(root, 'assets/ng/komponen/glyph-putih/seru-bulat.webp')),
  fs.readFileSync(path.join(root, 'referensi/newgui/game/assets/komponen/glyph-putih/seru-bulat.webp'))
);
assert.ok(css.includes('.cur{z-index:6}'));
assert.ok(css.includes('#petTitle{position:absolute;left:190px;top:660px;width:600px;display:flex;align-items:center;justify-content:center;gap:12px}'));
assert.ok(css.includes('#rar{position:absolute;left:190px;top:744px;width:600px;text-align:center;font-size:26px}'));
assert.ok(css.includes('#petInfo::backdrop{'));
assert.ok(css.includes('.pet-info-panel{'));
assert.ok(css.includes('border-image:url(../komponen/panel-dialog/bingkai-dialog.webp) 44 fill / 22px stretch'));
assert.ok(css.includes('#petInfoBody{min-height:0;max-height:calc(82vh - 120px);overflow-y:auto;'));
assert.ok(page.includes("$('#petInfo').showModal()"));
assert.ok(page.includes("requestAnimationFrame(() => { $('#petInfoBody').scrollTop = 0; })"));
assert.ok(page.includes("$('#petInfoClose').addEventListener('click', () => $('#petInfo').close())"));
assert.ok(!page.includes("$('#home').addEventListener"));
for (const label of ['Kelangkaan', 'Tier', 'Bahan', 'Animasi', 'Efek visual', 'Suara']) {
  assert.ok(!page.includes(`addInfoRow(body, '${label}'`), `${label} tidak ditampilkan dalam panel`);
}
for (const label of ['Identitas', 'Peran', 'Keunggulan', 'Cerita', 'Skill', 'Efek skill', 'Batas']) {
  assert.ok(page.includes(`addInfoRow(body, '${label}'`), `${label} tetap ditampilkan dalam panel`);
}
assert.ok(page.includes(".select('id,identity,role,skill,advantage,lore')"));
assert.deepStrictEqual(
  fs.readFileSync(path.join(root, 'assets/ng/komponen/panel-dialog/bingkai-dialog.webp')),
  fs.readFileSync(path.join(root, 'referensi/newgui/assets/komponen/panel-dialog/bingkai-dialog.webp'))
);
console.log('ok - Pet uses an accessible tier modal, removes the duplicate home icon, and keeps skills at the bottom');
