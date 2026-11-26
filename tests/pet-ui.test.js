const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('pet.html');
const css = read('data/inventory/pet/_shared/css/pet.css');
const pcss = read('data/inventory/pet/_shared/css/pet-page.css');
const page = read('data/inventory/pet/_shared/js/pet-page.js');

assert.ok(html.includes('<div id="petTitle">'));
assert.ok(!html.includes('petInfoOpen'), 'tanda seru di modal preview dihapus');
assert.ok(html.includes('<dialog id="petInfo" aria-labelledby="petInfoTitle">'));
assert.ok(html.includes('<div class="pet-info-panel">'));
assert.ok(!html.includes('glyph-putih/info-bulat.webp'));
assert.ok(!html.includes('id="home"'));
assert.deepStrictEqual(
  fs.readFileSync(path.join(root, 'assets/images/ui/white-glyphs/seru-bulat.webp')),
  fs.readFileSync(path.join(root, 'referensi/newgui/game/assets/komponen/glyph-putih/seru-bulat.webp'))
);
assert.ok(css.includes('.cur{z-index:6}'));
assert.ok(pcss.includes('#pv #petTitle{position:static;'));
assert.ok(pcss.includes('#pv #rar{position:static;'));
// redesain: tanpa tab, preview = modal #pv, kartu gaya skin, tombol beli di kartu, saldo kiri bawah
assert.ok(!html.includes('id="left"'), 'panel kiri lama dihapus');
assert.ok(html.includes('id="pv"') && html.includes('id="pvClose"') && /id="pv"[\s\S]*id="fpv"/.test(html) && !html.includes('id="use"'));
assert.ok(!page.includes('invtabs') && !page.includes('InvTabs'), 'bar tab dihapus');
assert.ok(page.includes('class="pc-pr') && page.includes('data-act="use"') && page.includes('function openPreview') && page.includes('function closePreview'));
assert.ok(pcss.includes('#stage #cur-em{left:60px!important}') && pcss.includes('bottom:28px'));
assert.ok(pcss.includes('.pc-ic{width:64px;height:64px}') && !pcss.includes('.pc-ic{width:64px;height:64px;border:0;border-radius:0;background:none;box-shadow:none}'), 'ikon mata/info = tombol HUD (.ut-gl), bukan ikon tanpa kotak');
// komponen HUD (button.css): tombol Pet memakai ut-gl ut-c-<warna>, tanpa gambar bingkai tombol lama
assert.ok(html.includes('assets/components/button/button.css') && html.includes('assets/components/tabs/tabs.css'));
assert.ok(html.indexOf('assets/components/button/button.css') < html.indexOf('data/inventory/pet/_shared/css/pet-page.css'), 'button.css dimuat sebelum CSS Pet');
assert.ok(/id="back" class="ut-gl ut-c-r"/.test(html) && /id="pvClose" class="ut-gl ut-c-r"/.test(html) && /id="petInfoClose" class="ut-gl ut-c-r"/.test(html));
assert.ok(/class="btn ut-gl ut-c-r" id="m-no"/.test(html) && /class="btn ut-gl ut-c-g" id="m-ok"/.test(html) && !/tombol-(merah|hijau)-polos/.test(html));
['pc-pr used ut-gl ut-c-r', 'pc-pr own ut-gl ut-c-g', 'pc-pr no ut-gl ut-c-d', 'pc-pr ut-gl ut-c-y', 'pc-ic pc-eye ut-gl ut-c-b', 'pc-ic pc-det ut-gl ut-c-b', 'pet-info-retry ut-gl ut-c-b'].forEach((c) => assert.ok(page.includes(c), c));
assert.ok(!/tombol-(kuning|hijau|merah|gelap)-polos/.test(pcss), 'gambar bingkai tombol kartu dihapus dari CSS Pet');
assert.ok(css.includes('#petInfo::backdrop{'));
assert.ok(css.includes('.pet-info-panel{'));
assert.ok(css.includes('border-image:url(../../../../../assets/images/ui/panel-dialog/bingkai-dialog.webp) 44 fill / 22px stretch'));
assert.ok(css.includes('#petInfoBody{min-height:0;max-height:calc(82vh - 120px);overflow-y:auto;'));
assert.ok(page.includes("$('#petInfo').showModal()"));
assert.ok(page.includes("requestAnimationFrame(() => { $('#petInfoBody').scrollTop = 0; })"));
assert.ok(page.includes("$('#petInfoClose').addEventListener('click', () => $('#petInfo').close())"));
assert.ok(!page.includes("$('#home').addEventListener"));
for (const label of ['Kelangkaan', 'Tier', 'Bahan', 'Animasi', 'Efek visual', 'Suara', 'Identitas', 'Keunggulan', 'Cerita']) {
  assert.ok(!page.includes(`addInfoRow(body, '${label}'`), `${label} tidak ditampilkan dalam panel`);
}
for (const label of ['Peran', 'Skill', 'Efek skill', 'Batas']) {
  assert.ok(page.includes(`addInfoRow(body, '${label}'`), `${label} tetap ditampilkan dalam panel`);
}
assert.ok(page.includes(".select('id,identity,role,skill,advantage,lore')"));
assert.deepStrictEqual(
  fs.readFileSync(path.join(root, 'assets/images/ui/panel-dialog/bingkai-dialog.webp')),
  fs.readFileSync(path.join(root, 'referensi/newgui/assets/komponen/panel-dialog/bingkai-dialog.webp'))
);
console.log('ok - Pet uses an accessible tier modal, removes the duplicate home icon, and keeps skills at the bottom');
