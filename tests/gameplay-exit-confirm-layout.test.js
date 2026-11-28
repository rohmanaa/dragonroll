const assert = require('assert');
const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '../src/gameplay/css/pause.css'), 'utf8');
const gridRule = css.match(/html body #exitConfirm \.lm-grid\.lm-two\s*\{([^}]*)\}/);
const buttonRule = css.match(/html body #exitConfirm \.lm-grid\.lm-two \.lm-mode\s*\{([^}]*)\}/);
const html = fs.readFileSync(path.join(__dirname, '../gameplay.html'), 'utf8');

assert.ok(gridRule, 'expected a two-column exit confirmation layout rule');
assert.match(gridRule[1], /repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
assert.ok(buttonRule, 'expected a contained exit confirmation button rule');
assert.match(buttonRule[1], /box-sizing:\s*border-box/);
assert.match(buttonRule[1], /min-width:\s*0/);
assert.match(buttonRule[1], /aspect-ratio:\s*3\s*\/\s*1/);
assert.match(html, /class="lm-mode lm-blue ut-gl ut-c-d"[^>]*id="ecNo"/, 'Batal memakai komponen HUD (ut-gl gelap)');
assert.match(html, /class="lm-mode lm-red ut-gl ut-c-r"[^>]*id="ecYes"/, 'Ya, keluar memakai komponen HUD (ut-gl merah)');
console.log('ok - gameplay exit confirmation uses equal, proportional HUD buttons');

