# SPA Inventory tab → view — Tahap 3 (Efek / Aura) + renderer ke SharedGL

Branch: `spa-inv-efek` (dari main 29bafbd). Pola: stage-spa-inv-1 (Pet) dan stage-spa-inv-2 (Frame).

## Berubah
- `data/inventory/aura/_shared/js/efek.js` → modul `UT.PageModule` 'efek' (mandiri/embed = auto-mount seperti sebelumnya).
  - Renderer pratinjau 3D: tidak lagi `new THREE.WebGLRenderer`; `UT.SharedGL.acquire('inv-efek', {shadows:false})`, kanvas bersama dipasang di `#fpv` (pola yang sama dengan profile.js).
  - Unmount (env.own): lepas listener kanvas bersama (kanvas dipakai ulang antar halaman, jadi listener WAJIB dilepas), `ResizeObserver.disconnect`, `AuraSystem.dispose`, dispose geometri/material seluruh scene (termasuk karakter), `SharedGL.release`. Gagal init WebGL juga melepas renderer.
  - Loop rAF lewat `env.requestAnimationFrame`, berhenti saat `env.disposed` (sebelumnya loop abadi). Timer, `keydown`/`resize`, `UT.Events.on`, `PD.subscribe`, LiveSync lewat env; callback async dijaga `env.disposed`.
  - Chrome tab lewat `UT.InvTabs.mountChrome(env, 'efek', …)`.
- `efek.html`: `page-module.js`, `inv-tabs.js`, `shared-gl.js` (setelah three.min.js), `inv-tabbar.css`.
- `inv-tabs.js` VIEW_TABS, `spa-host.js` (VIEWS + INV_VIEW_TABS), `frame-guard.js`, `play.js` (prefetch): efek ditambahkan. `sw.js` v318; preload manifest diregenerasi.
- Tes penjaga `no-webglrenderer-outside-sharedgl`: `efek.js` dihapus dari PELANGGAR_TERSISA (sisa: dice-renderer.js, power-renderer.js).

## Tes
- Baru: `tests/efek-view.test.js` (statis). Diperbarui: spa-host (canon efek), frame-view, pet-view, inventory-module, penjaga WebGLRenderer.
- Seluruh suite: 6 kegagalan yang sama dengan baseline main.
- NOT TESTED di browser: pratinjau 3D karakter + aura (putar/seret, ketuk = aura melompat, ganti aura), pindah Efek↔Frame↔Pet berulang (acquire/release SharedGL bergantian antar tab), bar tab/latar view, Esc/Back.
- Risiko yang perlu dilihat: tiga tab view bergantian memakai SATU kanvas bersama; bila ada kanvas "bocor"/hitam setelah pindah tab, periksa release pada unmount.

## Sisa
dadu, powerup masih iframe (+ dice-renderer.js, power-renderer.js). Setelah itu: hapus iframe + pemanasan dari inventory.js.
