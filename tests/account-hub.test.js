/* Hub Profil · Teman · Pesan · Pengaturan (satu halaman penuh, bukan modal): helper murni + pemeriksaan statis kode/markup.
   Perilaku DOM (fokus, inert, Esc, ganti tab) diverifikasi terpisah dengan jsdom; tes ini tanpa dependensi agar jalan di CI. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const rd = p => fs.readFileSync(path.join(root, p), 'utf8');
const H = require(path.join(root, 'assets/js/core/account-hub.js'));
const MK = require(path.join(root, 'assets/js/core/modal-kit.js'));
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }

t('canon: friendship/mail/settings -> profile.html?tab=..., ?from= dipertahankan; lainnya tidak berubah', () => {
  assert.strictEqual(H.canon('friendship.html'), 'profile.html?tab=teman');
  assert.strictEqual(H.canon('mail.html?from=shop.html'), 'profile.html?tab=pesan&from=shop.html');
  assert.strictEqual(H.canon('settings.html?from=profile.html'), 'profile.html?tab=setelan');   // from ke halaman hub dibuang
  assert.strictEqual(H.canon('profile.html'), 'profile.html');
  assert.strictEqual(H.canon('shop.html'), 'shop.html');
});
t('canon: leaderboard/hadiah-misi = panel hub; ?tab= lama hadiah-misi jadi &sub=, tanpa ?tab= = Hadiah Harian', () => {
  assert.strictEqual(H.canon('leaderboard.html'), 'profile.html?tab=peringkat');
  assert.strictEqual(H.canon('leaderboard.html?from=shop.html'), 'profile.html?tab=peringkat&from=shop.html');
  assert.strictEqual(H.canon('hadiah-misi.html'), 'profile.html?tab=misi&sub=hadiah');
  assert.strictEqual(H.canon('hadiah-misi.html?tab=ach'), 'profile.html?tab=misi&sub=ach');
  assert.strictEqual(H.canon('hadiah-misi.html?tab=misi&from=lobby.html'), 'profile.html?tab=misi&from=lobby.html&sub=misi');
  assert.strictEqual(H.hubUrl('misi', '', 'Salah!'), 'profile.html?tab=misi');   // sub tidak valid dibuang
  assert.strictEqual(H.tabOf('profile.html?tab=peringkat'), 'peringkat');
  assert.strictEqual(H.tabOf('leaderboard.html'), 'peringkat');
  assert.strictEqual(H.tabOf('hadiah-misi.html'), 'misi');
  assert.deepStrictEqual(H.TABS.map(x => x.key), ['profil', 'teman', 'pesan', 'peringkat', 'misi', 'setelan']);
});
t('tabOf: ?tab= menang, lalu nama halaman, default profil; nilai tak dikenal -> profil', () => {
  assert.strictEqual(H.tabOf('profile.html?tab=pesan'), 'pesan');
  assert.strictEqual(H.tabOf('profile.html?tab=ngawur'), 'profil');
  assert.strictEqual(H.tabOf('mail.html'), 'pesan');
  assert.strictEqual(H.tabOf('profile.html'), 'profil');
  assert.strictEqual(H.tabOf(''), 'profil');
});
t('validFrom / homeUrl: hanya halaman .html lokal non-hub; dasar ke lobby; referrer sama-origin dipakai', () => {
  assert.strictEqual(H.validFrom('shop.html?coin=1'), 'shop.html?coin=1');
  ['profile.html', 'mail.html', 'leaderboard.html', 'hadiah-misi.html', 'splash.html', 'http://evil.example/x.html', '../x.html', 'javascript:alert(1)', ''].forEach(x => assert.strictEqual(H.validFrom(x), ''));
  assert.strictEqual(H.homeUrl('profile.html?tab=teman&from=shop.html%3Fcoin%3D1', '', ''), 'shop.html?coin=1');
  assert.strictEqual(H.homeUrl('profile.html?tab=teman', '', ''), 'lobby.html');
  assert.strictEqual(H.homeUrl('profile.html', 'https://g.test/tambang.html', 'https://g.test'), 'tambang.html');
  assert.strictEqual(H.homeUrl('profile.html', 'https://evil.test/tambang.html', 'https://g.test'), 'lobby.html');
  assert.strictEqual(H.homeUrl('profile.html', 'https://g.test/mail.html', 'https://g.test'), 'lobby.html');
});
t('hubUrl mengunci from yang tidak valid', () => {
  assert.strictEqual(H.hubUrl('teman', 'shop.html'), 'profile.html?tab=teman&from=shop.html');
  assert.strictEqual(H.hubUrl('teman', 'https://evil.test'), 'profile.html?tab=teman');
  assert.strictEqual(H.hubUrl('xx'), 'profile.html?tab=profil');
});

const hub = rd('assets/js/core/account-hub.js');
t('hub = halaman penuh (bukan modal): tanpa role=dialog/aria-modal/inert/focus trap/klik-luar; ada tombol Tutup, Esc, tablist/tab/tabpanel', () => {
  assert(!/hub\.setAttribute\('role', 'dialog'\)/.test(hub) && !/hub\.setAttribute\('aria-modal'/.test(hub), 'kerangka hub tidak boleh role=dialog/aria-modal (dialog kecil dalam panel tetap boleh)');
  assert(!/inertOthers/.test(hub) && !/trapTab/.test(hub) && !/pointerdown/.test(hub) && !/backdrop/.test(hub) && !/EMBED/.test(hub));
  assert(/'role', 'region'/.test(hub) && /aria-labelledby/.test(hub));
  assert(/'role', 'tablist'/.test(hub) && /'role', 'tab'/.test(hub) && /'role', 'tabpanel'/.test(hub) && /aria-selected/.test(hub) && /aria-controls/.test(hub));
  assert(/e\.key === 'Escape'/.test(hub) && /dialogOpen\(\)/.test(hub));
  assert(/ArrowRight/.test(hub) && /ArrowLeft/.test(hub) && /'Home'/.test(hub) && /'End'/.test(hub));
  assert(/tombol-tutup-bulat\.webp/.test(hub) && /'pclose'/.test(hub) && !/panah-kembali/.test(hub));
});
t('CSS hub: latar halaman standar (tanpa lapisan gelap/embed), tombol Tutup #pclose', () => {
  const css = rd('assets/css/account-hub.css');
  assert(!/pbackdrop|ut-hub-embed|has-hub\)\{?\s*background|rgba\(10,8,24,\.66\)/.test(css), 'tidak ada lapisan gelap/embed');
  assert(/#pclose\{/.test(css) && !/#pback/.test(css));
  assert(!/embed=lobby|ut-hub-embed/.test(rd('profile.html')));
});
t('Lobby membuka hub sebagai halaman (navigasi), bukan iframe overlay', () => {
  const lb = rd('data/lobby/js/lobby.js');
  assert(!/hubModal|openHub|closeHub|embed=lobby|createElement\('iframe'\)/.test(lb));
  assert(/navTo\('profile\.html\?tab='\+HUB_TAB\[act\]\+'&from=lobby\.html'\)/.test(lb));
});
t('ganti tab = in-place: replaceState (bukan pushState/location.href), unmount sebelum mount, hanya satu transisi sekaligus', () => {
  assert(/replaceState/.test(hub) && !/pushState/.test(hub));
  assert(hub.indexOf('PM.unmount(rec.tab.module)') > 0 && hub.indexOf('PM.mount(tab.module)') > hub.indexOf('PM.unmount(rec.tab.module)'));
  assert(/busy/.test(hub) && /want/.test(hub));
});
t('pane Teman/Pesan/Pengaturan tidak lagi memasang tab lama; Esc Pengaturan/Profil tidak meninggalkan halaman', () => {
  ['friendship-page.js', 'mail.js', 'settings.js', 'profile.js'].forEach(f => assert(!/ProfileTabs/.test(rd('assets/js/pages/' + f)), f));
  assert(!/else home\(\)/.test(rd('assets/js/pages/settings.js')));
  assert(!/Escape/.test(rd('assets/js/pages/profile.js')));
});
t('profile.html = host hub: #stage kosong, template Profil, managed=true sebelum modul panel, account.js lalu mount mandiri', () => {
  const h = rd('profile.html');
  assert(/<div id="stage"><\/div>/.test(h) && /<template id="tpl-profil"/.test(h));
  const i = s => h.indexOf(s);
  assert(i('core/modal-kit.js') > 0 && i('core/account-hub.js') > i('core/modal-kit.js'));
  assert(i('PageModule.managed=true') > i('core/page-module.js') && i('PageModule.managed=true') < i('pages/profile.js'));
  assert(i('pages/account.js') > i('pages/profile.js') && i('PageModule.mount("profile")') > i('pages/account.js'));
  assert(!/profile-tabs/.test(h));
});
t('friendship/mail/leaderboard/hadiah-misi/settings.html: dialihkan ke hub bila dibuka langsung; tab lama dibuang', () => {
  ['friendship.html', 'mail.html', 'leaderboard.html', 'hadiah-misi.html', 'settings.html'].forEach(f => {
    const h = rd(f);
    assert(/core\/hub-redirect\.js/.test(h), f);
    assert(h.indexOf('hub-redirect.js') < h.indexOf('page-shell.js'), f + ': pengalihan harus paling awal');
    assert(!/profile-tabs/.test(h), f);
  });
  assert(/profile\.html\?tab=/.test(rd('assets/js/core/hub-redirect.js')));
  assert(/hub-redirect/.test(rd('assets/js/core/spa-host.js')) && /hub-redirect/.test(hub));   // tidak boleh ikut dimuat pemuat view
});
t('CSS hub: latar masing-masing panel (bukan satu profile-bg untuk semua)', () => {
  const css = rd('assets/css/account-hub.css');
  [['teman', 'friendship-bg'], ['pesan', 'mail-voxel-pesan'], ['peringkat', 'leaderboard-bg'], ['misi', 'misi-bg'], ['setelan', 'settings-voxel-bengkel']].forEach(([k, img]) => {
    assert(new RegExp('#pane\\[data-tab="' + k + '"\\][^{]*\\{background:url\\(\\.\\./images/background/' + img + '\\.webp\\)').test(css), k + ' -> ' + img);
  });
  assert(!/profile-bg/.test(rd('data/inventory/pet/_shared/css/pet-page.css')), 'Pet tidak lagi memakai profile-bg');
});
t('ModalKit: API lengkap & trapTab membungkus di batas', () => {
  ['watch', 'trapTab', 'inertOthers', 'focusables'].forEach(k => assert.strictEqual(typeof MK[k], 'function', k));
  const mk = (id, vis = true) => ({ id, hidden: false, offsetWidth: vis ? 5 : 0, getAttribute: () => null, closest: () => null, focus() { doc.activeElement = this; } });
  const a = mk('a'), b = mk('b'), doc = { activeElement: b };
  const root = { querySelectorAll: () => [a, b], contains: x => x === a || x === b, focus() {} };
  let prevented = 0;
  assert.strictEqual(MK.trapTab({ key: 'Tab', shiftKey: false, preventDefault() { prevented++; } }, root, doc), true);
  assert.strictEqual(doc.activeElement, a);                                     // Tab di elemen terakhir -> pertama
  assert.strictEqual(MK.trapTab({ key: 'Tab', shiftKey: true, preventDefault() { prevented++; } }, root, doc), true);
  assert.strictEqual(doc.activeElement, b);                                     // Shift+Tab di pertama -> terakhir
  doc.activeElement = a; b.focus = () => {};
  assert.strictEqual(MK.trapTab({ key: 'Tab', shiftKey: false, preventDefault() { prevented++; } }, root, doc), false);   // tengah: biarkan bawaan browser
  assert.strictEqual(MK.trapTab({ key: 'Enter' }, root, doc), false);
  assert.strictEqual(prevented, 2);
});
console.log(n + ' tes lulus');
