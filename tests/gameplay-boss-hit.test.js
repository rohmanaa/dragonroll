const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'gameplay/js/main.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'gameplay/css/gameplay.css'), 'utf8');
const hitStart = main.indexOf('async function hitDragon(p,v){');
const hitEnd = main.indexOf('\n}', hitStart);
assert.ok(hitStart >= 0 && hitEnd > hitStart, 'Dragon hit handler should exist');
const hitDragon = main.slice(hitStart, hitEnd);

assert.ok(hitDragon.includes("hud('hideCombat')"), 'Dragon attacks should clear any prior boss bar');
assert.ok(hitDragon.includes('bossHitFx(dmg,false,true)'), 'Dragon hits should keep the red fight vignette active');
assert.ok(!hitDragon.includes("hud('showCombat'"), 'Dragon hits should not show the boss bar or HP progress');
assert.ok(!hitDragon.includes("hud('updatePlayer'"), 'Dragon hits should not update a visible boss progress bar');
assert.ok(main.includes("label.textContent='Critical'"), 'Dragon hits should display Critical instead of Boss');
assert.ok(!main.includes("showDragonBoss(p,gid,'Siap menyerang Ender Dragon!'"), 'Crystal completion should not leave a small boss bar before the first hit');
assert.ok(main.includes("root.classList.add('fight')"), 'The red vignette should remain active through the fight');
assert.ok(main.includes("add('hf-cinema')") && main.includes("add('hf-wave'"), 'Dragon hits should use the cinematic impact effect');
assert.match(css, /#bossFx\.critical\.hit \.boss-hit-label\s*\{animation:bossCriticalFlash/, 'Critical should flash during a Dragon hit');
assert.match(css, /#bossFx::before[^}]*box-shadow:inset 0 0 260px rgba\(255,0,0,\.73\)/, 'The fight overlay should retain its red screen-edge vignette');

console.log('ok - Dragon hits show Critical with a persistent red vignette and no boss bar');
