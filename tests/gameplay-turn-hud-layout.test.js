const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'gameplay/js/main.js'), 'utf8');
const hud = fs.readFileSync(path.join(root, 'gameplay/css/hud-mockup.css'), 'utf8');

assert.match(main, /const appendCard=\(\)=>\{\s*group\.appendChild\(card\);\s*if\(turnChip\) group\.appendChild\(turnChip\);\s*\}/);
assert.match(hud, /#players \.pg \.turn-chip\s*\{[^}]*position:\s*relative;[^}]*align-self:\s*center;/);
assert.match(main, /dragonAttack\?'Serang':\(sp\?'Hancurkan':'Roll'\)/);

assert.match(hud, /grid-template-areas:\s*"\. die"\s*"meter meter"\s*"auto roll"/);
assert.match(hud, /grid-template-areas:\s*"die"\s*"meter"\s*"roll"/);
assert.match(hud, /#side \.rcol \.pnl\.tn #diceMeter \.dm-bar\s*\{[^}]*height:\s*12px !important/);
assert.match(hud, /#side \.rcol \.pnl\.tn #diceMeter \.dm-bar i\s*\{[^}]*font-size:\s*0 !important;[^}]*border:\s*0 !important/);

console.log('ok - turn chip and special-dice meter stay clear of the player HUD');
