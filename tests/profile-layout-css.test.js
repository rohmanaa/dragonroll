const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'profile.html'), 'utf8');
const baseCss = 'assets/css/pages/profile-legacy.css';
const pageCss = 'assets/css/pages/profile.css';

assert.ok(html.includes(`href="${baseCss}"`));
assert.ok(html.indexOf(`href="${baseCss}"`) < html.indexOf(`href="${pageCss}"`));
assert.strictEqual(html.split(`href="${pageCss}"`).length - 1, 1);

console.log('ok - profile loads its base layout before page-specific overrides');
