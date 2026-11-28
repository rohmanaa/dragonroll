/* Komponen collapse-button & tile-button (assets/components) dan pemakaiannya di Lobby. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const html = rd('lobby.html'), css = rd('src/styles/pages/lobby.css');
const col = rd('src/components/collapse-button/collapse-button.css'), tile = rd('src/components/tile-button/tile-button.css');
assert(html.includes('src/components/tile-button/tile-button.css') && html.includes('src/components/collapse-button/collapse-button.css'));
assert(html.indexOf('collapse-button.css') < html.indexOf('src/styles/pages/lobby.css'), 'komponen dimuat sebelum CSS halaman');
assert(/id="grp" class="ut-collapse ut-collapse-k flip"/.test(html) && /id="grpt" class="ut-collapse-toggle"[^>]*aria-expanded="true"/.test(html));
assert.strictEqual((html.match(/class="gbtn ut-collapse-item/g) || []).length, 3);
for (const id of ['b-char', 'b-shop']) assert(new RegExp('ut-tile ut-tile-y" id="' + id + '"').test(html), id);
for (const id of ['b-pet', 'b-dice', 'b-aura', 'b-guild', 'b-misi', 'b-chest', 'b-inv']) assert(new RegExp('ut-tile ut-tile-k" id="' + id + '"').test(html), id);
assert(!/tile-stage-(aktif|terkunci)/.test(css), 'gambar tile lama tidak dipakai Lobby');
assert(col.includes(':is(.collapsed, .shut)') && tile.includes('.ut-tile-y') && tile.includes('.ut-tile-k') && tile.includes('.ut-tile-d'));
console.log('ok - Lobby memakai komponen collapse-button dan tile-button');

