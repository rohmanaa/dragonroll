const assert = require('assert');
const fs = require('fs');
const path = require('path');

/* Bug: Enderman teleport ke kepala ular (mis. 62) -> pion diam, tidak turun. Efek mob harus diikuti pemrosesan petak pendaratan. */
const main = fs.readFileSync(path.join(__dirname, '..', 'src/gameplay/js/main.js'), 'utf8');
const start = main.indexOf('async function resolveTileAt(p,gid,depth){');
const end = main.indexOf('async function resolveAfterChestMove', start);
assert.ok(start >= 0 && end > start, 'resolveTileAt should accept a depth guard');
const body = main.slice(start, end);
const duelCheck = body.indexOf('const duel=await A(duelCheck(p,gid));');
const trapCheck = body.indexOf('if(await trapCheck(p,gid))');
assert.ok(duelCheck >= 0 && trapCheck > duelCheck, 'duels should be checked before processing a landing tile');
const mobBranch = body.slice(body.indexOf('}else if(mobOn(p.pos,themeKey)){'));
assert.ok(mobBranch.includes('await A(resolveMobAt(p,gid));'), 'mob branch should still resolve the mob effect');
assert.ok(/p\.pos!==posBefore&&p\.pos>0&&p\.pos<GOAL&&d<6/.test(mobBranch), 'moved pawn should be re-resolved with a depth cap, not on goal');
assert.ok(/const landing=await A\(resolveTileAt\(p,gid,d\+1\)\);\s*if\(landing\)\s*return landing;/.test(mobBranch), 'a duel result on the mob landing tile should propagate to the turn');
assert.ok(mobBranch.indexOf('resolveMobAt') < mobBranch.indexOf('resolveTileAt'), 'landing tile resolves after the mob effect');

console.log('ok - mob-moved pawns resolve their landing tiles and trigger PvP collisions');

