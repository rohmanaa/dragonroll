const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'gameplay/js/main.js'), 'utf8');
const hud = fs.readFileSync(path.join(root, 'gameplay/css/hud-mockup.css'), 'utf8');

assert.match(main, /if\(slot===1\|\|slot===2\)\{\s*group\.appendChild\(card\);\s*group\.appendChild\(extra\);\s*\}\s*else\s*\{\s*group\.appendChild\(extra\);\s*group\.appendChild\(card\);\s*\}/);
assert.match(main, /extra\.appendChild\(crystals\)/, 'crystal progress belongs to the player extra panel');
assert.match(main, /extra\.appendChild\(hp\)/, 'dragon attack progress belongs to the same player extra panel');
assert.match(hud, /#players \.pg\.p0 \{[^}]*bottom:/);
assert.match(hud, /#players \.pg\.p3 \{[^}]*bottom:/);
assert.match(hud, /#players \.pg\.p1 \{[^}]*top:/);
assert.match(hud, /#players \.pg\.p2 \{[^}]*top:/);

console.log('ok - crystal and dragon progress follows the player panel edge');
