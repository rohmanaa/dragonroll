const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'inventory.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'src/views/inventory.js'), 'utf8');
const tabsJs = fs.readFileSync(path.join(root, 'src/core/inv-tabs.js'), 'utf8');
const scripts = Array.from(html.matchAll(/<script[^>]+src="([^"]+)"/g), match => match[1]);

assert.ok(!scripts.includes('src/core/item-registry.js'));
assert.ok(!scripts.some(src => /^data\/inventory\/(?:aura|frame|power)\//.test(src)));
assert.ok(scripts.includes('src/stores/item-catalog.js'));
assert.ok(scripts.includes('src/stores/player-data.js'));
assert.match(html, /id="view-loading" role="status" aria-live="polite"/);

for (const [key, page] of Object.entries({
  frame: 'frame.html',
  dadu: 'dadu.html',
  efek: 'efek.html',
  power: 'powerup.html',
  pet: 'pet.html'
})) {
  assert.ok(new RegExp("k: '" + key + "', page: '" + page + "'").test(tabsJs), key);
}
assert.ok(js.includes("if (!frames[t.k]) frames[t.k] = mk(t)"));
assert.ok(js.includes("if (f.classList.contains('on')) loading.hidden = true"));
assert.ok(js.includes("loading.hidden = frames[t.k].classList.contains('ready')"));

assert.ok(js.includes("function warm()") && js.includes("classList.add('warm')"), 'pemanasan tab di latar belakang');
assert.ok(js.includes("c.saveData") && js.includes("deviceMemory"), 'pemanasan dilewati di perangkat hemat');
assert.match(fs.readFileSync(path.join(root, 'src/styles/pages/inventory.css'), 'utf8'), /\.view\.warm\{display:block;pointer-events:none\}/);

console.log('ok - inventory shell memuat tab sekali tanpa menduplikasi Registry kategori');

