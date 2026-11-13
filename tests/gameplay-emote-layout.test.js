const assert = require('assert');
const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '../gameplay/hud-mockup.css'), 'utf8');
const docks = [...css.matchAll(/#side \.emote-dock\s*\{([^}]*)\}/g)];

assert.ok(docks.length >= 2, 'expected both emote dock layout rules');
for (const [, declarations] of docks) {
  assert.ok(/bottom:\s*280px\s*!important/.test(declarations), 'emote dock should be raised above YOUR TURN');
}
console.log('ok - gameplay emote dock is raised above the turn chip');
