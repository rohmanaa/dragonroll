const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'gameplay.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src/gameplay/js/main.js'), 'utf8');
const preload = JSON.parse(fs.readFileSync(path.join(root, 'assets/preload-manifest.json'), 'utf8'));

assert.match(html, /id="btnRoll"[^>]*aria-label="Roll"[^>]*><img id="btnRollIcon"[^>]*alt=""/);
assert.match(main, /b\.dataset\.action=action; b\.setAttribute\('aria-label',label\)/);

for (const name of ['roll', 'hancurkan', 'serang']) {
  const asset = `assets/images/ui/gameplay-actions/${name}.webp`;
  const bytes = fs.readFileSync(path.join(root, asset));
  assert.strictEqual(bytes.toString('ascii', 0, 4), 'RIFF', `${name} is a WebP asset`);
  assert.strictEqual(bytes.toString('ascii', 8, 12), 'WEBP', `${name} is a WebP asset`);
  assert.strictEqual(bytes.toString('ascii', 12, 16), 'VP8X', `${name} preserves alpha in extended WebP`);
  assert.ok(bytes[20] & 0x10, `${name} WebP has transparency`);
  assert.ok(main.includes(`${name}:'${asset}'`), `${name} is selected for its matching action`);
  assert.strictEqual(preload[asset], bytes.length, `${name} is included in the preload manifest`);
}

console.log('ok - gameplay Roll/Hancurkan/Serang buttons use transparent WebP icons');


