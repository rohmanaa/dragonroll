/* UT.Spa: rute Lobby/Karakter jadi view di #view (tanpa iframe), rute lain lewat iframe; urutan unmount -> release -> leave -> mount; fallback bila gagal. */
const assert = require('assert');
const path = require('path');
const Spa = require(path.join(__dirname, '..', 'assets/js/core/spa-host.js'));
let n = 0;
async function t(name, fn) { await fn(); n++; console.log('ok -', name); }
const tick = () => new Promise(r => setTimeout(r, 0));

function setup(o) {
  o = o || {};
  const log = [], ls = {}, hist = [];
  const G = {
    console: { error() {} },
    location: { search: o.search || '', pathname: '/play.html' },
    sessionStorage: { getItem: k => (k === 'ut:booted' && o.booted !== false ? '1' : null) },
    matchMedia: () => ({ matches: !!o.rotated, addEventListener() {} }),
    history: { pushState(s, _t, u) { hist.push(['push', u]); }, replaceState(s, _t, u) { hist.push(['replace', u]); } },
    addEventListener(type, fn) { ls[type] = fn; },
    UT: { Session: { loggedIn: () => o.loggedIn !== false }, App: { ready: false, init(x) { log.push('app.init:' + x.page); this.ready = true; }, setPage(p) { log.push('app.setPage:' + p); } } }
  };
  const PageModule = { managed: false, mount: m => log.push('mount:' + m), unmount: m => log.push('unmount:' + m) };
  const SharedGL = { release: m => log.push('release:' + m) };
  const loader = { enter(name) { if (o.failEnter === name) return Promise.reject(new Error('x')); log.push('enter:' + name); return Promise.resolve(() => log.push('leave:' + name)); } };
  const view = { hidden: true }, frame = { classList: { toggle(c, on) { log.push('frame.off:' + !on); } }, contentWindow: { location: { href: 'about:blank', replace(u) { log.push('frame.go:' + u); } } } };
  const hooks = { leave: k => log.push('hook.leave:' + k), ready: (nm, v) => log.push('hook.ready:' + nm + ':' + v) };
  const spa = Spa.create({ G, PageModule, SharedGL, loader });
  spa.mount({ frame, view, hooks });
  return { spa, log, ls, hist, view, G, PageModule };
}

(async () => {
  await t('viewName/pageOf mengenali lobby, karakter, profile, dan leaderboard', () => {
    assert.strictEqual(Spa.viewName('lobby.html'), 'lobby');
    assert.strictEqual(Spa.viewName('karakter.html?x=1'), 'karakter');
    assert.strictEqual(Spa.viewName('profile.html'), 'profile');
    assert.strictEqual(Spa.viewName('leaderboard.html'), 'leaderboard');
    assert.strictEqual(Spa.viewName('tambang.html?from=profile.html'), 'tambang');
    assert.strictEqual(Spa.viewName('friendship.html'), 'friendship');
    assert.strictEqual(Spa.viewName('shop.html?coin=1'), 'shop');
    assert.strictEqual(Spa.viewName('mode.html'), null);
    assert.strictEqual(Spa.pageOf('mode.html#a'), 'mode.html');
  });
  await t('mount menandai PageModule.managed', () => { assert.strictEqual(setup().PageModule.managed, true); });
  await t('canView: syarat sesi, boot, rotasi, noframe, from=room', () => {
    assert.strictEqual(setup().spa.canView('lobby.html'), true);
    assert.strictEqual(setup({ booted: false }).spa.canView('lobby.html'), false);
    assert.strictEqual(setup({ loggedIn: false }).spa.canView('lobby.html'), false);
    assert.strictEqual(setup({ rotated: true }).spa.canView('lobby.html'), false);
    assert.strictEqual(setup({ search: '?noframe=1' }).spa.canView('lobby.html'), false);
    assert.strictEqual(setup().spa.canView('karakter.html?from=room'), false);
    assert.strictEqual(setup().spa.canView('mode.html'), false);
  });
  await t('start: view untuk lobby, false untuk halaman iframe', async () => {
    const a = setup();
    assert.strictEqual(a.spa.start('mode.html'), false);
    const b = setup();
    assert.strictEqual(b.spa.start('lobby.html'), true);
    await tick(); await tick();
    assert.ok(b.log.includes('enter:lobby') && b.log.includes('mount:lobby'));
    assert.ok(b.log.indexOf('app.init:lobby') < b.log.indexOf('mount:lobby'));
    assert.strictEqual(b.view.hidden, false);
    assert.strictEqual(b.spa.viewActive, true);
  });
  await t('pindah Lobby -> Karakter: unmount, release, leave, lalu mount; riwayat bertambah', async () => {
    const a = setup(); a.spa.start('lobby.html'); await tick(); await tick(); a.log.length = 0;
    const r = await a.spa.go('karakter.html');
    assert.strictEqual(r, true);
    const order = ['unmount:lobby', 'release:lobby', 'leave:lobby', 'enter:karakter', 'app.setPage:karakter', 'mount:karakter'];
    let last = -1; order.forEach(x => { const i = a.log.indexOf(x); assert.ok(i > last, x + ' harus setelah langkah sebelumnya: ' + a.log.join(',')); last = i; });
    assert.ok(a.hist.some(h => h[0] === 'push' && /go=karakter\.html/.test(h[1])));
  });
  await t('pindah ke halaman biasa: view dilepas, iframe dimuat', async () => {
    const a = setup(); a.spa.start('lobby.html'); await tick(); await tick(); a.log.length = 0;
    const r = await a.spa.go('mode.html');
    assert.strictEqual(r, false);
    assert.ok(a.log.includes('unmount:lobby') && a.log.includes('frame.go:mode.html'));
    assert.strictEqual(a.spa.viewActive, false); assert.strictEqual(a.view.hidden, true);
  });
  await t('navigasi yang kalah balapan tidak mount', async () => {
    const a = setup(); a.spa.start('lobby.html'); await tick(); await tick(); a.log.length = 0;
    const p1 = a.spa.go('karakter.html'); const p2 = a.spa.go('mode.html');
    await Promise.all([p1, p2]); await tick();
    assert.ok(!a.log.includes('mount:karakter'), a.log.join(','));
  });
  await t('loader gagal: jatuh ke iframe dan halaman itu ditandai rusak', async () => {
    const a = setup({ failEnter: 'karakter' }); a.spa.start('lobby.html'); await tick(); await tick(); a.log.length = 0;
    await a.spa.go('karakter.html'); await tick();
    assert.ok(a.log.includes('frame.go:karakter.html'));
    assert.strictEqual(a.spa.canView('karakter.html'), false);
  });
  await t('Back/Forward (popstate) memakai url dari state tanpa menambah riwayat', async () => {
    const a = setup(); a.spa.start('lobby.html'); await tick(); await tick(); a.hist.length = 0; a.log.length = 0;
    a.ls.popstate({ state: { spa: 'karakter.html' } }); await tick(); await tick();
    assert.ok(a.log.includes('mount:karakter')); assert.strictEqual(a.hist.length, 0);
    a.log.length = 0; a.ls.popstate({ state: null }); await tick();
    assert.strictEqual(a.log.length, 0);
  });
  console.log(n + ' tes lulus');
})().catch(e => { console.error(e); process.exit(1); });
