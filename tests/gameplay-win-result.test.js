const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'gameplay.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'gameplay/css/win-screen.css'), 'utf8');
const main = fs.readFileSync(path.join(root, 'gameplay/js/main.js'), 'utf8');
const start = html.indexOf('<section class="overlay lm-ov win-result" id="win"');
const end = html.indexOf('<section class="overlay lm-ov" id="pauseMenu"', start);

assert.ok(start >= 0 && end > start, 'expected a dedicated gameplay result screen');
assert.ok(html.includes('gameplay/css/win-screen.css'), 'expected the result screen stylesheet to load');
const screen = html.slice(start, end);
const rewards = [...screen.matchAll(/data-reward="([^"]+)"/g)].map((match) => match[1]);
assert.deepStrictEqual(rewards, ['xp', 'points', 'coins', 'gems']);
assert.strictEqual((screen.match(/bintang-stage-emas\.webp/g) || []).length, 3);

for (const [, asset] of screen.matchAll(/src="(assets\/ng\/[^"]+)"/g)) {
  assert.ok(fs.existsSync(path.join(root, asset)), `expected copied reference asset ${asset}`);
}
for (const [, asset] of css.matchAll(/url\(["']?([^"')]+\.webp)["']?\)/g)) {
  assert.ok(fs.existsSync(path.resolve(root, 'gameplay/css', asset)), `expected result screen asset ${asset}`);
}

assert.match(css, /#win\.win-result #btnToMenu\s*\{[^}]*tombol-biru-polos\.webp/s);
assert.match(css, /display:\s*contents\s*!important/);
assert.match(main, /setWinReward\(m\.gameId,'xp',r\.xp_gain\)/);
assert.match(main, /setWinReward\(m\.gameId,'points',r\.points\)/);
assert.match(main, /setWinReward\(gid,'coins',r\.reward_coins\)/);
assert.match(main, /updateWinLevelProgress\(m\.gameId\)/);
console.log('ok - result screen uses local reference assets and server-backed rewards/level progress');
