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
// Detail = tab di dalam modal pratinjau (bukan dialog / tombol terpisah)
assert.ok(!html.includes('<dialog') && !/id="petInfo(Close|Title)?"/.test(html), 'dialog detail terpisah dihapus');
assert.ok(/id="pvTabs" class="ut-tabs" role="tablist"/.test(html) && /data-v="preview" aria-selected="true"/.test(html) && /data-v="detail" aria-selected="false"/.test(html));
assert.ok(/id="pvBox"[\s\S]*id="pvPreview"[\s\S]*id="fpv"[\s\S]*id="pvDetail"[\s\S]*id="petInfoBody"[\s\S]*id="md"/.test(html));
assert.ok(!page.includes('pc-det') && !page.includes('data-act="detail"') && page.includes('function setView('), 'tombol detail di kartu dipindah ke tab modal');
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
assert.ok(html.includes('src/components/button/button.css') && html.includes('src/components/tabs/tabs.css'));
assert.ok(html.indexOf('src/components/button/button.css') < html.indexOf('data/inventory/pet/_shared/css/pet-page.css'), 'button.css dimuat sebelum CSS Pet');
assert.ok(/id="back" class="ut-gl ut-c-r"/.test(html) && /id="pvClose" class="ut-mk-x ut-gl ut-c-r"/.test(html));
// modal kit (modal-kit.css): detail, pratinjau & konfirmasi memakai .ut-mk (judul .ut-mk-t, tutup .ut-mk-x dengan X dari CSS, tanpa gambar bingkai/ikon)
assert.ok(html.includes('src/components/modal/modal-kit.css') && html.includes('id="pvBox" class="pet-info-panel ut-mk"') && html.includes('class="panel ut-mk" id="box"') && html.includes('id="mt" class="ut-mk-t"'));
assert.ok(!/id="pvClose"[^>]*>[^<]/.test(html), 'tombol tutup modal tanpa teks/gambar (X digambar CSS)');
assert.ok(/class="btn ut-gl ut-c-r" id="m-no"/.test(html) && /class="btn ut-gl ut-c-g" id="m-ok"/.test(html) && !/tombol-(merah|hijau)-polos/.test(html));
['pc-pr used ut-hc-btn red', 'pc-pr own ut-hc-btn', 'pc-pr no ut-hc-btn gray', 'pc-pr ut-hc-btn', 'pc-ic pc-eye ut-hc-ic', 'pet-info-retry ut-gl ut-c-b'].forEach((c) => assert.ok(page.includes(c), c));
assert.ok(!/tombol-(kuning|hijau|merah|gelap)-polos/.test(pcss), 'gambar bingkai tombol kartu dihapus dari CSS Pet');
assert.ok(css.includes('.pet-info-panel{'));
assert.ok(!css.includes('bingkai-dialog') && !/#petInfoClose\{|#pvClose\{/.test(css + pcss), 'bingkai gambar & gaya tombol tutup lama dihapus (kini .ut-mk di modal-kit.css)');
assert.ok(/#petInfoBody\{[^}]*overflow-y:auto/.test(css));
assert.ok(css.includes('.pv-pane:not(.on){visibility:hidden}'), 'ganti tab tidak mengubah ukuran kanvas 3D');
assert.ok(page.includes("$('#petInfoBody').scrollTop = 0"));
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
console.log('ok - Pet shows Preview and Detail tabs in one modal, removes the duplicate home icon, and keeps skills at the bottom');

