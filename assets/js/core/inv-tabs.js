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
    { k: 'pet', page: 'pet.html', label: 'Pet', icon: 'lobby/pet.webp' }
  ];
  /* tab yang sudah menjadi view di shell (bukan iframe) */
  var VIEW_TABS = { frame: 'frame.html', efek: 'efek.html', pet: 'pet.html' };

  function markup(active) {
    return TABS.map(function (t) {
      return '<button class="tab' + (t.k === active ? ' on' : '') + '" type="button" data-k="' + t.k + '" aria-label="' + t.label + '"><img class="ic" src="assets/images/ui/' + t.icon + '" alt=""><span>' + t.label + '</span><img class="ul" src="assets/images/ui/navigation-icons/garis-bawah-tab-emas.webp" alt=""></button>';
    }).join('');
  }
  /* Chrome tab Inventory untuk tab yang berjalan sebagai view di shell: judul "Inventory", bar #invtabs (tab aktif = active),
     latar/grid lewat body.inv-view (inv-tabbar.css). Dilepas otomatis saat modul di-unmount (env.own). navigate(url) & snd(nama) milik halaman. */
  function mountChrome(env, active, navigate, snd) {
    var D = document, stage = D.querySelector('#stage');
    D.body.classList.add('inv-view');
    env.own(function () { D.body.classList.remove('inv-view'); });
    var title = D.querySelector('#title'); if (title) title.textContent = 'Inventory';
    var bar = D.createElement('nav');
    bar.id = 'invtabs'; bar.setAttribute('aria-label', 'Kategori inventory');
    bar.innerHTML = markup(active);
    if (stage) stage.appendChild(bar);
    try { sessionStorage.setItem('ut-inv-tab', active); } catch (e) {}
    bar.addEventListener('click', function (event) {
      var tab = event.target.closest('.tab');
      if (!tab || tab.dataset.k === active) return;
      if (snd) snd('button');
      try { sessionStorage.setItem('ut-inv-tab', tab.dataset.k); } catch (e) {}
      navigate('inventory.html?tab=' + tab.dataset.k);
    });
    return bar;
  }
  return { mountChrome: mountChrome, TABS: TABS, VIEW_TABS: VIEW_TABS, KEY: 'ut-inv-tab', markup: markup, url: function (k) { return 'inventory.html?tab=' + k; } };
});
