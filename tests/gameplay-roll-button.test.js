const assert = require('assert');
const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '../gameplay/hud-mockup.css'), 'utf8');
const rollRule = css.match(/^#side \.rcol \.pnl\.tn #btnRoll\s*\{\s*grid-area:\s*roll([^}]*)\}/m);

assert.ok(rollRule, 'expected a gameplay Roll button layout rule');
assert.match(rollRule[1], /width:\s*200px\s*!important/);
assert.match(rollRule[1], /height:\s*76px\s*!important/);
assert.match(rollRule[1], /justify-self:\s*center\s*!important/);
console.log('ok - gameplay Roll button is compact and centered');
