require("./_boot-compat.js");
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const htmls = fs.readdirSync(root).filter(name => name.endsWith('.html'));
const baseRefs = [
  'src/boot/frame-guard.js',
  'src/core/session.js',
  'src/boot/boot-guard.js',
  'src/styles/fonts.css',
  'src/styles/common.css',
  'src/core/prefs.js',
  'src/core/prefs-sync.js'
];

const t = (name, fn) => { fn(); console.log('ok - ' + name); };

t('root pages share base imports except gameplay and standalone redirects/demos', () => {
  const standalone = new Set(['gameplay.html', 'index.html', 'floatingsample.html']);
  htmls.filter(name => !standalone.has(name)).forEach(name => {
    const html = fs.readFileSync(path.join(root, name), 'utf8');
    assert.match(html, /src\/core\/page-shell\.js/, name);
    assert.match(html, /PageShell\.renderBase/, name);
    baseRefs.forEach(ref => assert.ok(!html.includes(ref), name + ' still duplicates ' + ref));
  });
});

t('shared shell writes base scripts and styles in dependency-safe order', () => {
  const writes = [];
  const window = {};
  const document = { write: html => writes.push(html) };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/core/page-shell.js'), 'utf8'), { window, document });
  window.UT.PageShell.renderBase();
  const output = writes.join('');
  const positions = baseRefs.map(ref => output.indexOf(ref));
  positions.forEach((position, index) => assert.ok(position >= 0, baseRefs[index]));
  assert.deepStrictEqual(positions.slice().sort((a, b) => a - b), positions);
});

t('shared shell supports pages that omit optional imports', () => {
  const writes = [];
  const window = {};
  const document = { write: html => writes.push(html) };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/core/page-shell.js'), 'utf8'), { window, document });
  window.UT.PageShell.renderBase({ frameGuard: false, bootGuard: false, commonCss: false, prefsSync: false });
  const output = writes.join('');
  ['frame-guard.js', 'boot-guard.js', 'common.css', 'prefs-sync.js'].forEach(ref => assert.ok(!output.includes(ref), ref));
  ['core/session.js', 'fonts.css', 'core/prefs.js'].forEach(ref => assert.ok(output.includes(ref), ref));
});

