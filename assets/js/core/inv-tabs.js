/* inv-tabs.js — daftar tab Inventory + penanda bar tab. Dipakai inventory.js (shell dengan iframe) dan tiap tab yang sudah menjadi
   view sendiri (Tahap 1: Pet). Tab yang sudah jadi view dibuka lewat UT.Spa.go('<halaman>.html') — tanpa iframe, tanpa muat ulang dokumen.
   Skrip klasik; dapat dimuat di browser (window.UT.InvTabs) maupun Node (module.exports) untuk tes. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; root.UT.InvTabs = api; }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  var TABS = [
    { k: 'frame', page: 'frame.html', label: 'Frame', icon: 'feature-icons/frame.webp' },
    { k: 'dadu', page: 'dadu.html', label: 'Dadu', icon: 'feature-icons/dadu.webp' },
    { k: 'efek', page: 'efek.html', label: 'Efek', icon: 'gem-medal-icons/kristal-api.webp' },
    { k: 'power', page: 'powerup.html', label: 'Power-up', icon: 'gem-medal-icons/petir-ungu.webp' },
    { k: 'pet', page: 'pet.html', label: 'Pet', icon: 'lobby/pet.webp' },
    { k: 'karakter', page: 'karakter.html', label: 'Karakter', icon: 'item-icons/helm-ksatria.webp' },
    /* native = isi dirender halaman Inventory sendiri (tanpa halaman/iframe); kosong dulu sampai fitur Tambang & Farm masuk */
    { k: 'chest', label: 'Chest', icon: 'chest-packs/peti-kayu.webp', native: true },
    { k: 'ore', label: 'Ore', icon: 'gem-medal-icons/berlian-biru.webp', native: true },
    { k: 'log', label: 'Log', icon: 'item-icons/perisai-kayu.webp', native: true }
  ];
  /* Inventory = HANYA item yang dimiliki (Power-up, Chest, Ore, Log). Frame/Dadu/Efek (dipasang dari Karakter) dan Pet punya bar tab sendiri. */
  var GROUPS = {
    inv: { title: 'Inventory', label: 'Kategori inventory', keys: ['power', 'chest', 'ore', 'log'] },
    gear: { title: 'Perlengkapan', label: 'Kategori perlengkapan', keys: ['karakter', 'frame', 'dadu', 'efek'] },
    pet: { title: 'Pet', label: 'Pet', keys: ['pet'] }
  };
  function groupOf(k) { for (var g in GROUPS) if (GROUPS[g].keys.indexOf(k) >= 0) return g; return 'inv'; }
  function tabsOf(g) { return GROUPS[g].keys.map(function (k) { return TABS.filter(function (t) { return t.k === k; })[0]; }); }
  /* tab yang sudah menjadi view di shell (bukan iframe) */
  var VIEW_TABS = { frame: 'frame.html', dadu: 'dadu.html', efek: 'efek.html', pet: 'pet.html' };

  function markup(active) {
    return tabsOf(groupOf(active || 'power')).map(function (t) {
      return '<button class="tab' + (t.k === active ? ' on' : '') + '" type="button" data-k="' + t.k + '" aria-label="' + t.label + '"><img class="ic" src="assets/images/ui/' + t.icon + '" alt=""><span>' + t.label + '</span><img class="ul" src="assets/images/ui/navigation-icons/garis-bawah-tab-emas.webp" alt=""></button>';
    }).join('');
  }
  /* Chrome tab Inventory untuk tab yang berjalan sebagai view di shell: judul "Inventory", bar #invtabs (tab aktif = active),
     latar/grid lewat body.inv-view (inv-tabbar.css). Dilepas otomatis saat modul di-unmount (env.own). navigate(url) & snd(nama) milik halaman. */
  function mountChrome(env, active, navigate, snd) {
    var D = document, stage = D.querySelector('#stage');
    D.body.classList.add('inv-view');
    env.own(function () { D.body.classList.remove('inv-view'); });
    var title = D.querySelector('#title'); var grp = GROUPS[groupOf(active)]; if (title) title.textContent = grp.title;
    var bar = D.createElement('nav');
    bar.id = 'invtabs'; bar.setAttribute('aria-label', grp.label);
    bar.innerHTML = markup(active);
    if (stage) stage.appendChild(bar);
    try { if (groupOf(active) === 'inv') sessionStorage.setItem('ut-inv-tab', active); else sessionStorage.removeItem('ut-inv-tab'); } catch (e) {}
    bar.addEventListener('click', function (event) {
      var tab = event.target.closest('.tab');
      if (!tab || tab.dataset.k === active) return;
      if (snd) snd('button');
      try { if (groupOf(tab.dataset.k) === 'inv') sessionStorage.setItem('ut-inv-tab', tab.dataset.k); else sessionStorage.removeItem('ut-inv-tab'); } catch (e) {}
      navigate(urlOf(tab.dataset.k));
    });
    return bar;
  }
  /* tujuan klik tab: grup Inventory tetap lewat inventory.html?tab=; Perlengkapan/Pet membuka halamannya langsung */
  function urlOf(k) { var t = TABS.filter(function (x) { return x.k === k; })[0]; return (groupOf(k) === 'inv' || !t || !t.page) ? 'inventory.html?tab=' + k : t.page; }
  return { mountChrome: mountChrome, TABS: TABS, GROUPS: GROUPS, groupOf: groupOf, tabsOf: tabsOf, VIEW_TABS: VIEW_TABS, KEY: 'ut-inv-tab', markup: markup, url: urlOf };
});
