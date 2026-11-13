const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'leaderboard.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/ng/css/leaderboard.css'), 'utf8');

assert.ok(css.includes('banner-judul-nila-polos.webp'));
assert.ok(!css.includes('pita-sudut-nila.webp'));
assert.ok(css.includes('margin-top:4px'));
assert.ok(!css.includes('.pd.p1 .ps{bottom:'));
assert.ok(html.includes('fmt(p.score)'));

const frameFx = html.indexOf('assets/js/frame-fx.js');
const frameAvatar = html.indexOf('assets/js/frame-avatar.js');
assert.ok(frameFx >= 0 && frameFx < frameAvatar, 'FrameFX must load before FrameAvatar');
console.log('ok - leaderboard banners, scores, and animated frames');
