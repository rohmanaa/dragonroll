const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const lobby = fs.readFileSync(path.join(root, 'lobby.html'), 'utf8');

assert.ok(lobby.includes('id="bdrop" aria-hidden="true"'));
assert.ok(lobby.includes('assets/ng/komponen/lobby/lobby-castle.webp'));
assert.ok(!lobby.includes('<iframe id="bdrop"'));
assert.ok(!lobby.includes('backdrop.html?embed'));
assert.ok(!lobby.includes('LOBBY_ACTS'));
assert.ok(!lobby.includes("bc.act('roll')"));
assert.ok(!lobby.includes('bc.jump()'));
assert.ok(!lobby.includes("bc.setMode('run')"));

const image = fs.readFileSync(path.join(root, 'assets/ng/komponen/lobby/lobby-castle.webp'));
assert.strictEqual(image.toString('ascii', 0, 4), 'RIFF');
assert.strictEqual(image.toString('ascii', 8, 12), 'WEBP');
console.log('ok - lobby uses a static WebP background and minimal character idle');
