const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'assets/js/pages/play.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/styles/pages/play.css'), 'utf8');

const show = js.match(/function showOv\(kind\) \{([\s\S]*?)\n  \}\n  function hideOv/);
assert.ok(show, 'navigation curtain handler exists');
assert.match(show[1], /doShow\(true\);\s*ov\.classList\.add\('pending'\)/, 'navigation immediately covers the destination');
assert.match(show[1], /setTimeout\(function \(\) \{[\s\S]*?doShow\(false\)/, 'loading spinner appears only if the destination stays unready');

const hide = js.match(/function hideOv\(\) \{([\s\S]*?)\n  \}\n  ov\.classList/);
assert.ok(hide, 'ready handler exists');
assert.match(hide[1], /if \(armed\) \{ armed = false; clearTimeout\(showT\); \}\s*if \(!shown\) return;/, 'a fast destination cancels pending loading and still uncovers');
assert.match(css, /#ov\.quiet \.ld,#ov\.pending \.ld\{display:none\}[\s\S]*?#ov\.pending\{background:#4b4162\}/, 'pending cover hides the page without prematurely showing loading UI');
assert.match(css, /@keyframes ovspin/, 'loading spinner is indeterminate');
assert.doesNotMatch(js, /\b(?:pct|setP|creepRaf)\b/, 'between-page loading does not show simulated percentage progress');
assert.match(js, /im\.addEventListener\('error', finish\);[\s\S]*?timer = setTimeout\(finish, 1500\)/, 'a stalled or lazy image cannot keep the curtain open forever');
assert.match(js, /Promise\.all\(all\)\.then\(function \(\)[\s\S]*?settle\(w, d/, 'curtain opens after page readiness checks settle');

console.log('ok - page transitions cover immediately, show the loading spinner only when needed, and avoid fake percentages');
