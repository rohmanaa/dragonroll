const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'gameplay.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/gameplay/css/win-screen.css'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src/gameplay/js/main.js'), 'utf8');
const start = html.indexOf('<section class="overlay lm-ov win-result" id="win"');
const end = html.indexOf('<section class="overlay lm-ov" id="pauseMenu"', start);

assert.ok(start >= 0 && end > start, 'expected a dedicated gameplay result screen');
assert.ok(html.includes('src/gameplay/css/win-screen.css'), 'expected the result screen stylesheet to load');
const screen = html.slice(start, end);
const rewards = [...screen.matchAll(/data-reward="([^"]+)"/g)].map((match) => match[1]);
assert.deepStrictEqual(rewards, ['xp', 'points', 'coins', 'gems']);
assert.strictEqual((screen.match(/bintang-hasil-emas\.webp/g) || []).length, 3);

for (const [, asset] of screen.matchAll(/src="(assets\/ng\/[^"]+)"/g)) {
  assert.ok(fs.existsSync(path.join(root, asset)), `expected copied reference asset ${asset}`);
}
for (const [, asset] of css.matchAll(/url\(["']?([^"')]+\.webp)["']?\)/g)) {
  assert.ok(fs.existsSync(path.resolve(root, 'gameplay/css', asset)), `expected result screen asset ${asset}`);
}

assert.match(require('fs').readFileSync(require('path').join(__dirname, '../gameplay.html'), 'utf8'), /id="btnToMenu"/);
assert.match(require('fs').readFileSync(require('path').join(__dirname, '../gameplay.html'), 'utf8'), /class="lm-mode lm-blue ut-gl ut-c-b"[^>]*id="btnToMenu"/);  // tombol memakai komponen HUD (ut-gl biru), tanpa gambar bingkai
assert.match(css, /display:\s*contents\s*!important/);
assert.match(css, /#win\[data-state="lose"\]\.win-result \.lm-eyebrow\s*\{[^}]*width:\s*fit-content\s*!important/s);
assert.match(main, /setWinReward\(m\.gameId,'xp',r\.xp_gain\)/);
assert.match(main, /setWinReward\(m\.gameId,'points',r\.points\)/);
assert.match(main, /setWinCoins\(gid,'boss',r\.reward_coins\)/);
assert.match(main, /setWinCoins\(m\.gameId,'match',r\.reward_coins\)/); /* koin match (menang/kalah) dari server */
assert.match(main, /updateWinLevelProgress\(m\.gameId\)/);
console.log('ok - result screen uses local reference assets and server-backed rewards/level progress');


