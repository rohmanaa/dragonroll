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
assert.ok(css.includes('#petInfoBody{min-height:0;max-height:calc(82vh - 120px);overflow-y:auto;'));
assert.ok(page.includes("$('#petInfo').showModal()"));
assert.ok(page.includes("$('#petInfoClose').addEventListener('click', () => $('#petInfo').close())"));
assert.ok(!page.includes("$('#home').addEventListener"));
assert.ok(page.includes("addInfoRow(body, 'Kelangkaan', rarity[0])"));
assert.ok(page.includes("addInfoRow(body, 'Tier', `Tier ${item.tier}`)"));
assert.ok(page.indexOf("addInfoRow(body, 'Skill'") > page.indexOf("addInfoRow(body, 'Cerita'"));
console.log('ok - Pet uses an accessible tier modal, removes the duplicate home icon, and keeps skills at the bottom');
