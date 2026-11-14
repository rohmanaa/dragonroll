const assert = require('assert');
const fs = require('fs');
const path = require('path');

/* Bug: Enderman teleport ke kepala ular (mis. 62) -> pion diam, tidak turun. Efek mob harus diikuti pemrosesan petak pendaratan. */
const main = fs.readFileSync(path.join(__dirname, '..', 'gameplay/js/main.js'), 'utf8');
const start = main.indexOf('async function resolveTileAt(p,gid,depth){');
const end = main.indexOf('async function resolveAfterChestMove', start);
assert.ok(start >= 0 && end > start, 'resolveTileAt should accept a depth guard');
const body = main.slice(start, end);
const mobBranch = body.slice(body.indexOf('}else if(mobOn(p.pos,themeKey)){'));
assert.ok(mobBranch.includes('await A(resolveMobAt(p,gid));'), 'mob branch should still resolve the mob effect');
assert.ok(/p\.pos!==posBefore&&p\.pos>0&&p\.pos<GOAL&&d<6/.test(mobBranch), 'moved pawn should be re-resolved with a depth cap, not on goal');
assert.ok(/await A\(resolveTileAt\(p,gid,d\+1\)\)/.test(mobBranch), 'landing tile (snake head, ladder, mob) should be resolved after a mob moves the pawn');
assert.ok(mobBranch.indexOf('resolveMobAt') < mobBranch.indexOf('resolveTileAt'), 'landing tile resolves after the mob effect');

console.log('ok - mob-moved pawns resolve the tile they land on (Enderman -> snake head goes down)');
