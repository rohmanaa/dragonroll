const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'profile.html'), 'utf8');
const baseCss = 'src/styles/pages/profile-legacy.css';
const pageCss = 'src/styles/pages/profile.css';

/* CSS panel Profil kini dimuat hub per-panel: daftar ada di atribut data-css pada <template id="tpl-profil"> (urutan = urutan muat) */
const m = /<template id="tpl-profil" data-css="([^"]+)"/.exec(html);
assert.ok(m, 'template Profil dengan data-css tidak ditemukan');
const list = m[1].split(/\s+/).filter(Boolean);
assert.ok(list.includes(baseCss));
assert.ok(list.indexOf(baseCss) < list.indexOf(pageCss));
assert.strictEqual(list.filter(x => x === pageCss).length, 1);
/* dan tidak boleh dipasang statis di <head> (akan bocor ke panel Teman/Pesan/Pengaturan) */
assert.ok(!html.includes(`<link rel="stylesheet" href="${baseCss}">`));
assert.ok(!html.includes(`<link rel="stylesheet" href="${pageCss}">`));

console.log('ok - profile loads its base layout before page-specific overrides');
