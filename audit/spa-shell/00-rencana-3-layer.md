# Rencana SPA 3 layer (Vue Router) — Dragon Roll

Status: RENCANA (belum ada kode). Gameplay dibekukan, tidak disentuh.

## 3 layer
1. **Splash/Loading** — `splash.html` tetap halaman terpisah (loading aset, auth, preload, masuk ke shell).
2. **Shell** — satu halaman (`app.html`) + Vue Router: lobby, mode, room, shop, inventory (dadu/frame/efek/pet/powerup/karakter), profile, leaderboard, friendship, hadiah-misi, mail, settings, tambang. Pindah antar halaman = ganti komponen, tanpa muat ulang.
3. **Gameplay** — `gameplay.html` tetap halaman terpisah (Three.js, audio, loading sendiri). Masuk/keluar lewat `location.href` seperti sekarang.

## Temuan audit (kondisi sekarang)
- 23 file HTML; non-gameplay ±20. Tidak ada package.json / bundler; semua classic script + global (`UT.*`, `PlayerData`, `ItemCatalog`).
- Tiap halaman memuat daftar script/manifest sendiri (halaman inventory memuat puluhan manifest item) dan CSS global (`page.css`, `sub.css`, `bg.css`, + CSS per halaman) yang TIDAK di-scope -> bentrok bila banyak halaman hidup di satu dokumen.
- Script halaman (assets/js/pages/*.js) berjalan sekali saat dimuat, memasang listener window/document, interval/rAF, dan scene Three.js tanpa fungsi bersih-bersih (dispose). Di SPA ini harus dibereskan, kalau tidak bocor tiap pindah halaman.
- Navigasi memakai `location.href='xxx.html'` di ±17 tempat (lobby, shop, room, mode, tambang, gameplay).
- Latar/pulau melayang, header koin/gem, navigasi bawah diulang tiap halaman -> inilah yang terasa "loading". Di shell semuanya jadi satu kali, tetap hidup.

## Keputusan teknis (usulan)
- **Tanpa build tool dulu**: Vue + vue-router versi ESM browser ditaruh di `assets/js/vendor/` (sama seperti supabase-js & three), repo tetap statis. Komponen ditulis sebagai modul JS (template string). Pindah ke Vite/SFC bisa belakangan bila perlu.
- **Router mode hash** (`app.html#/shop`): aman di hosting statis, tanpa konfigurasi server. Deep link & tombol Back berfungsi.
- **Adapter halaman lama**: komponen `LegacyPage` memuat fragmen HTML halaman, memasang CSS halaman saat masuk dan MELEPAS saat keluar, lalu memanggil `mount(el)` / `unmount()` milik halaman. Halaman lama dimigrasi satu per satu supaya punya `mount/unmount`.
- File `*.html` lama tetap ada sebagai fallback/redirect ke `app.html#/rute` sampai semua pindah.

## Tahap (tiap tahap: tes -> commit -> push -> STOP)
0. Putuskan: no-build vs Vite, hash vs history.
1. Fondasi: vendor Vue + router, `app.html`, router kosong, `LegacyPage`; pindahkan 2 halaman paling sederhana (settings, mail) sebagai uji.
2. Chrome permanen: latar/pulau, header koin/gem, navigasi bawah di shell (sekali muat).
3. Migrasi halaman satu per commit: profile, leaderboard, friendship, hadiah-misi, shop, inventory + sub-halaman, mode, room, lobby, tambang (yang berat Three.js / realtime terakhir).
4. Navigasi: `location.href` ke halaman shell diganti `router.push`; ke gameplay tetap `location.href` (+ transisi ke loading).
5. Rapikan: `*.html` lama jadi redirect, update service worker (cache `app.html` + chunk), hapus duplikasi.

## Risiko utama
- CSS global bentrok (page.css/sub.css) -> wajib pasang/lepas per rute atau scope.
- Listener/interval/Three.js tidak dibersihkan -> bocor memori; wajib `unmount()`.
- Room/online (subscription realtime) harus berhenti saat keluar halaman room.
- Guard login/boot dan service worker (cache versi) harus mengenal `app.html`.
- Data bersama (`PlayerData`, wallet) kini hidup terus antar halaman: bagus (cepat), tapi harus disegarkan saat balik ke halaman.
