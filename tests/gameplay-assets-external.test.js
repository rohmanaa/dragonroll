const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'gameplay.html'), 'utf8');

assert.doesNotMatch(html, /<style\b/i, 'gameplay styles should live in external stylesheets');
const scriptTags = [...html.matchAll(/<script\b([^>]*)>/gi)].map((match) => match[1]);
const inlineScripts = scriptTags.filter((attrs) => !/\bsrc\s*=/i.test(attrs));
assert.strictEqual(inlineScripts.length, 1, 'only the required inline importmap should remain');
assert.match(inlineScripts[0], /\btype\s*=\s*["']importmap["']/i);

const externalAssets = [
  'gameplay/css/gameplay-base.css',
  'gameplay/css/gameplay.css',
  'gameplay/css/gameplay-overrides.css',
  'gameplay/js/three-fallback.js',
  'gameplay/js/app-init.js',
  'gameplay/js/power3d-loader.js',
  'gameplay/js/main.js',
  'gameplay/js/hud-sync.js',
  'gameplay/js/multiplayer-init.js',
];
for (const asset of externalAssets) {
  assert.ok(fs.existsSync(path.join(root, asset)), `expected external gameplay asset ${asset}`);
  assert.ok(html.includes(asset), `expected gameplay.html to load ${asset}`);
}

assert.ok(html.indexOf('href="gameplay/css/gameplay.css"') < html.indexOf('href="gameplay/css/dice-pad.css"'));
assert.ok(html.indexOf('href="gameplay/css/dice-pad.css"') < html.indexOf('href="gameplay/css/gameplay-overrides.css"'));
assert.ok(html.indexOf('href="gameplay/css/gameplay-overrides.css"') < html.indexOf('href="gameplay/css/hud-mockup.css"'));

const main = fs.readFileSync(path.join(root, 'gameplay/js/main.js'), 'utf8');
assert.strictEqual((main.match(/new URL\('assets\/js\/multiplayer\/progress-service\.js', document\.baseURI\)/g) || []).length, 3);
assert.strictEqual((main.match(/new URL\('assets\/js\/multiplayer\/room-service\.js', document\.baseURI\)/g) || []).length, 1);
console.log('ok - gameplay CSS and JavaScript are external with load order preserved');
