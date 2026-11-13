const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const scaleScript = fs.readFileSync(path.join(__dirname, '../gameplay/hud-scale.js'), 'utf8');
const hudCss = fs.readFileSync(path.join(__dirname, '../gameplay/hud-mockup.css'), 'utf8');
const properties = {};
const root = {
  clientWidth: 740,
  style: { setProperty(name, value) { properties[name] = value; } },
};
const win = {
  innerWidth: 740,
  innerHeight: 323,
  addEventListener() {},
  visualViewport: { addEventListener() {} },
};

vm.runInNewContext(scaleScript, { window: win, document: { documentElement: root } });

const scale = Number(properties['--ghud-stage-scale']);
const stageHeight = parseFloat(properties['--ghud-stage-height']);
assert.ok(Math.abs(1920 * scale - win.innerWidth) < 0.001, 'HUD stage should fill viewport width');
assert.ok(Math.abs(stageHeight * scale - win.innerHeight) < 0.001, 'HUD stage should fit viewport height');
assert.match(hudCss, /height:\s*var\(--ghud-stage-height,\s*1080px\)\s*!important/);
console.log('ok - gameplay HUD fills viewport width without vertical cropping');
