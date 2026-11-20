# Prompt Serah-Terima: Kerjakan SPA Tahap 2

Salin isi di bawah garis ke AI berikutnya.

---

Kamu melanjutkan migrasi SPA di repo `rohmanaa/dragonroll` (game web/PWA/Electron, skrip klasik, three.js, tanpa bundler). Kerjakan **Tahap 2**: Lobby ↔ Karakter berpindah tanpa muat ulang dokumen dan tanpa membuat konteks WebGL baru.

## Baca dulu (urutan)
1. `docs/planing/README.md` (konteks, aturan kerja, status, perintah)
2. `docs/planing/spa-tahap2-detail.md` (terutama bagian 0)
3. `docs/planing/spa-tahap1-detail.md` bagian 9-10 (hasil dan temuan tahap 1)
4. `docs/planing/spa-rencana.md`

## Status
- Tahap 0 dan 1 selesai dan sudah di `main` (SW v294). `UT.PageModule` (`assets/js/core/page-module.js`) membungkus `lobby.js` dan `karakter.js` jadi modul `mount/unmount`.
- Branch kerja tahap 2: `spa-tahap2` (dari `main`, belum ada perubahan kode). Jangan push ke `main` tanpa izin pemilik.
- Jangan menulis token/rahasia ke file atau commit. Token GitHub yang pernah ditempel di chat dianggap bocor.

## Temuan kunci (sudah diverifikasi)
- `play.html` adalah pembungkus: tiap halaman berjalan di `<iframe id="f">`; `assets/js/pages/play.js` mengurus musik, overlay "Memuat", prefetch, dan `?go=<halaman>`. `boot-guard.js` melempar halaman yang dibuka langsung ke `splash.html?next=...` kecuali `sessionStorage['ut:booted']==='1'` dan `localStorage['ut-auth']` ada.
- `play.html` memanggil `UT.PageShell.renderBase({frameGuard:false,bootGuard:false,commonCss:false})`; halaman biasa memanggil `renderBase()` penuh (fonts.css, common.css, session.js, prefs.js, prefs-sync.js) lewat `document.write`.
- `lobby.html` dan `karakter.html`: `<body>` berisi markup khusus halaman; skrip dimuat berurutan di akhir body (three.min.js, item-registry + manifest aura/karakter, player-data, aura-fx, appearance-service, `core/app.js`, `UT.App.init({page})`, lalu `lobby.js`/`karakter.js`). CSS: `assets/css/page.css`, CSS halaman, `bg.css`.
- Lobby menavigasi dengan `location.href` (peta `ACT` + fade 330 ms di `go()`); Karakter dengan `location.href='lobby.html'` dan beberapa ke `shop.html`/`tambang.html`.
- Sisa loop rAF setelah unmount Lobby berasal dari `data/inventory/frame/_shared/js/frame-fx.js` (perlu `stop()`/berhenti saat elemen lepas). Callback async di `lobby.js` (`pullXp/pullQuest/pullFriends/pullMail/pullChest/pullMine`, `loadProgress().then`) perlu guard `if(env.disposed)return`.
- `UT.App.init({page})` memasang listener global; panggil sekali di shell.

## Desain yang disarankan (hybrid, risiko rendah)
Jadikan `play.html` shell. Tambahkan `#view` di samping `<iframe id="f">`.
1. Buat `assets/js/core/shared-gl.js` (`UT.SharedGL.acquire(owner,opts)` / `release(owner)`): satu `WebGLRenderer` + satu canvas; reset state tiap `acquire` (clearColor, shadowMap, pixelRatio, viewport, autoClear, toneMapping); tangani `webglcontextlost/restored`. Pertahankan `antialias` mati di HP (`navigator.maxTouchPoints>0&&/Mobi|Android|iPhone|iPad/i`).
2. Buat `assets/js/core/spa-host.js` (`UT.Spa`): untuk rute `lobby.html` dan `karakter.html`, `fetch` HTML halaman, parse dengan `DOMParser`, pasang `<link>/<style>` halaman (dilepas saat pindah), pasang isi `<body>` ke `#view`, muat skrip yang belum ada (sekali, berurutan), lalu `UT.PageModule.mount(nama)`. Sebelum pindah: `UT.PageModule.unmount` halaman lama + `SharedGL.release`. Rute lain tetap lewat iframe (`f.src`); tampilkan/sembunyikan `#view` vs iframe. Musik/overlay/prefetch `play.js` dipakai ulang.
3. Set `UT.PageModule.managed=true` di shell. Halaman mandiri `lobby.html`/`karakter.html` harus tetap berfungsi (managed=false).
4. Ganti pembuatan `new THREE.WebGLRenderer` di `lobby.js` dan `karakter.js` dengan `UT.SharedGL.acquire(...)` (renderer offscreen di `karakter.js` ±baris 1097 dan `character-face.js` boleh dibiarkan). Ganti navigasi Lobby↔Karakter dengan `UT.Spa.go(...)` bila `UT.Spa` aktif, selain itu `location.href`.
5. Perbaiki temuan: `FrameFX.stop()`, guard `env.disposed` di callback async lobby.
6. `UT.App.init({page})`: panggil sekali di shell; sediakan cara memberi tahu halaman aktif.

## Pengujian dan bukti wajib
- Seluruh test: tidak ada kegagalan baru. Baseline gagal sejak awal: `dice-registry-parity`, `gameplay-assets-external`, `pet-registry-parity`, `pet-viewer-lifecycle`, `power-registry-parity`. Perintah: `for t in tests/*.test.js; do timeout 60 node $t >/dev/null 2>&1 || echo "$t"; done`.
- Hati-hati test yang membaca teks sumber (`aura-view`, `blocky-actions`, `daily-reward-30`, `chest-service`, `lobby-appearance`, `karakter-equip`, `pvp-knight-gear`); pertahankan pola teks yang mereka cocokkan.
- Tambah `tests/shared-gl.test.js` dan `tests/spa-host.test.js` (stub, Node).
- Perluas `tools/smoke-page-module.py` (Chrome headless, buka `play.html?go=lobby.html`): pindah Lobby↔Karakter 20x; hitung `getContext('webgl*')` (harus 1), pastikan `three.min.js` tidak dimuat ulang, draw call berhenti untuk halaman yang di-unmount, tanpa error konsol (error jaringan Supabase diabaikan), memori tidak naik terus.
- Setiap rilis: naikkan `VERSION` di `sw.js` (baris 12), `git add -A`, `python3 tools/gen-preload-manifest.py`, `node tests/sw-incremental-media.test.js`.

## Selesai bila
Pindah Lobby↔Karakter: 0 konteks WebGL baru, 0 muat ulang `three.min.js`, tombol Back/rute awal berfungsi, test tidak ada kegagalan baru, angka sebelum/sesudah dicatat di `spa-tahap2-detail.md` ("Hasil pengukuran"), ceklis tahap 2 dicentang, tabel status di `README.md` diperbarui.

Aturan: commit kecil di branch `spa-tahap2` dengan awalan `feat(spa):`/`fix(...)`/`test:`; tanyakan pemilik sebelum merge ke `main`; perbarui dokumen planning di akhir.
