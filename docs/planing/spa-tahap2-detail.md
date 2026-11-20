# SPA Tahap 2 - Shell, Router, Renderer Bersama (Pilot)

Prasyarat: tahap 1 selesai (Lobby dan Karakter sudah berupa modul
`UT.PageModule` dengan `mount`/`unmount` yang bersih).
Tujuan: Lobby ↔ Karakter berpindah tanpa muat ulang halaman, tanpa
`three.min.js` baru, tanpa konteks WebGL baru.

## 0. Temuan dari tahap 1 yang mengubah desain (BACA DULU)

1. **`play.html` sudah menjadi shell.** Ia memuat tiap halaman di `<iframe id="f">`
   (`assets/js/pages/play.js`), mengurus musik latar, overlay "Memuat halaman",
   prefetch halaman berikutnya (`prefetchNext`), dan menerima `?go=<halaman>`.
   `boot-guard.js` mengalihkan halaman yang dibuka langsung ke
   `splash.html?next=...` kecuali `sessionStorage['ut:booted']==='1'` dan
   `localStorage['ut-auth']` ada.
2. **Dua opsi desain:**
   - **Opsi A (disarankan): `play.html` tetap shell, iframe diganti tampilan modul.**
     `#view` menggantikan `<iframe>`; musik/overlay/prefetch dipakai ulang; router
     menjadi pengganti `f.src = go`. Perlu memindahkan `frame-guard.js` dan
     `boot-guard.js` (halaman tidak lagi di iframe) dan mengganti
     `UT.App.init({page})` per halaman dengan satu kali init di shell.
   - **Opsi B: shell baru `app.html`.** Lebih bersih tetapi menduplikasi fungsi
     musik/overlay/prefetch yang sudah ada di `play.js`.
   Catat pilihan di `README.md` bagian "Catatan keputusan".
3. **Sisa loop rAF setelah unmount** di Lobby berasal dari
   `data/inventory/frame/_shared/js/frame-fx.js`. Beri `FrameFX` cara berhenti
   (mis. `FrameFX.stop()` atau loop berhenti bila elemen bingkai terlepas) dan
   daftarkan lewat `env.own`.
4. **Callback async** (`pullXp`, `pullQuest`, `pullFriends`, `pullMail`,
   `pullChest`, `pullMine`, `loadProgress().then`) di `lobby.js` perlu guard
   `if(env.disposed)return` karena DOM sudah diganti setelah pindah halaman.
5. **`UT.App.init({page})`** memasang listener/langganan global; panggil sekali
   di shell dan sediakan cara memberi tahu halaman aktif (mis. `UT.App.setPage`).
6. **Smoke test sudah ada:** `tools/smoke-page-module.py` (lihat README
   `docs/planing`). Perluas untuk pindah rute 20x dan hitung konteks WebGL.

## 1. Komponen baru

### `assets/js/core/shared-gl.js` (`UT.SharedGL`)

Satu `WebGLRenderer` dan satu `<canvas>` untuk seluruh sesi.

```js
UT.SharedGL.acquire(owner, opts) -> { renderer, canvas }
UT.SharedGL.release(owner)       // lepas milik halaman, bersihkan state
UT.SharedGL.setQuality(q)        // DPR, shadowMap, antialias (lihat catatan)
```

Aturan:
- `acquire` pertama membuat renderer; `acquire` berikutnya memakai ulang dan
  menyetel ulang `setClearColor`, `shadowMap.enabled/type`, `setPixelRatio`,
  `setViewport/Scissor`, `autoClear`, `outputColorSpace`, dan
  `toneMapping` ke default sebelum halaman mengubahnya.
- `release` memanggil `renderer.renderLists.dispose()`, melepas render target
  milik halaman, dan memastikan satu pemilik pada satu waktu.
- `antialias` hanya bisa ditentukan saat konteks dibuat. Pakai nilai yang sama
  seperti sekarang (mati di HP, hidup di desktop). Perubahan kualitas yang
  butuh antialias baru = buat ulang renderer (jarang; lewat `setQuality`).
- Dengarkan `webglcontextlost`/`webglcontextrestored`; saat hilang, beri tahu
  pemilik aktif (`owner.onContextLost`) dan bangun ulang saat pulih.

### `assets/js/core/router.js` (`UT.Router`)

```js
UT.Router.register(route, { module, html, css, title })
UT.Router.go(route, params)      // pushState/hash, transisi
UT.Router.start()                // baca lokasi awal, tangani Back/Forward
```

- Route hash: `#/lobby`, `#/karakter`. Parameter lewat query hash
  (`#/tambang?from=karakter`).
- Urutan pindah: tampilkan spinner → `unmount` halaman lama → lepas
  `SharedGL` → ganti isi `#view` (HTML) dan CSS halaman → `mount` halaman baru
  → sembunyikan spinner.
- CSS per halaman dimuat sebagai `<link data-page="...">` dan dilepas saat
  pindah, supaya selector tidak saling menimpa.
- Judul dokumen mengikuti `title`.
- Tombol Back/Forward browser dan tombol Back Android/Electron harus bekerja.

### Shell (`app.html` atau `play.html`, lihat bagian 0)

- Memuat sekali: CSS dasar, `three.min.js`, `item-registry`, `player-data`,
  `app.js`, `ui-core`, `live-sync`, `page-module`, `shared-gl`, `router`.
- Berisi `#view`, `#fade`/spinner, dan elemen global (toast, modal global).
- Mendaftarkan route Lobby dan Karakter, lalu `UT.Router.start()`.

## 2. Perubahan pada modul halaman

Setiap halaman memisahkan:
- **Templat HTML** (isi `<body>` yang khusus halaman) → `data/.../view.html`
  (atau string di modul), dimuat lewat `fetch` dengan cache SW.
- **CSS halaman** → tetap file CSS yang ada, dimuat saat route aktif.
- **Skrip** → modul tahap 1, kini memakai `UT.SharedGL.acquire(...)` bukan
  `new THREE.WebGLRenderer(...)`.

Lobby:
- Ganti `new THREE.WebGLRenderer({canvas:cv,...})` dengan
  `const {renderer}=UT.SharedGL.acquire('lobby')`; canvas `#gl3d` dipindah
  atau diganti kanvas bersama di dalam `#stage`.
- `go(act)`: untuk `karakter` panggil `UT.Router.go('karakter')`; aksi lain
  tetap `location.href` sampai tahap 3 (fade 330 ms diganti spinner router).

Karakter:
- Ganti pembuatan renderer yang sama (`canvas #gl`).
- `$('#back')` → `UT.Router.go('lobby')`; tombol lain (`shop`, `tambang`) tetap
  `location.href`.
- Renderer kedua pada baris ±1097 (`preserveDrawingBuffer:true`, untuk
  render ke gambar) tetap terpisah: ia luring dan sekali pakai. Jika perlu,
  ganti dengan render ke `WebGLRenderTarget` pada renderer bersama.

## 3. Service worker

- Tambahkan `app.html`, `shared-gl.js`, `router.js`, `page-module.js`, dan
  templat halaman ke precache (lihat `tools/gen-preload-manifest.py`).
- Pastikan `sw.js` menganggap `app.html` sebagai navigasi utama (fallback
  offline).
- Naikkan `VERSION`, regenerasi manifest.

## 4. Kompatibilitas

- `lobby.html` dan `karakter.html` mandiri tetap ada dan tetap jalan
  (mereka memanggil modul yang sama dengan `managed=false`).
- Titik masuk SPA: `app.html#/lobby`. Jangan mengubah `index.html`/`splash.html`
  sebelum tahap 4 kecuali pemilik meminta.

## 5. Pengukuran (wajib dicatat di dokumen ini)

Catat sebelum (halaman mandiri) dan sesudah (SPA), di HP uji dan di desktop:

| Metrik | Cara ukur |
| --- | --- |
| Jumlah konteks WebGL dibuat per sesi | patch `HTMLCanvasElement.prototype.getContext` untuk hitung `webgl*` |
| Waktu klik → halaman tujuan interaktif | `performance.now()` dari klik sampai `mount` selesai dan frame pertama |
| Byte JS yang diunduh saat pindah | tab Network / `performance.getEntriesByType('resource')` |
| Memori setelah 20x bolak-balik | `performance.memory` (Chrome) atau heap snapshot |

## 6. Test

- `tests/shared-gl.test.js`: `acquire`/`release` bergantian memakai satu renderer
  (stub), state direset, konteks hilang memanggil `onContextLost`.
- `tests/router.test.js`: urutan unmount → mount, Back/Forward, parameter,
  route tak dikenal jatuh ke `#/lobby`.
- Perbarui test yang membaca `lobby.js`/`karakter.js` bila bentuk kodenya berubah
  (`aura-view`, `blocky-actions`, `daily-reward-30`, `chest-service`,
  `karakter-equip`, `pvp-knight-gear`).
- Smoke test Chrome headless: buka `app.html#/lobby`, panggil
  `UT.Router.go('karakter')` dan kembali 20 kali; tanpa error konsol, jumlah
  konteks WebGL tetap 1, memori tidak naik terus.

## 7. Kriteria selesai

- Pindah Lobby ↔ Karakter: 0 konteks WebGL baru, 0 muat ulang `three.min.js`.
- Tombol Back bekerja; reload di `#/karakter` membuka Karakter langsung.
- Seluruh test: tidak ada kegagalan baru dibanding baseline.
- Angka sebelum/sesudah tercatat di bagian "Hasil pengukuran" di bawah.
- Diverifikasi di HP oleh pemilik.

## 8. Risiko khusus tahap ini

| Risiko | Mitigasi |
| --- | --- |
| State renderer bocor antar halaman (clear color, tone mapping, shadow) | `acquire` selalu menyetel ulang ke default |
| Geometri/tekstur halaman lama tidak dibuang → memori naik | `unmount` memanggil `dispose` untuk geometri, material, tekstur, render target |
| Kehilangan konteks GPU di HP saat tab di latar | tangani `webglcontextlost/restored` |
| Elemen DOM lama dipakai skrip yang sudah `unmount` | setelah `unmount`, semua callback ditolak (`env` mati) |
| FOUC karena CSS halaman dimuat telat | pasang CSS dulu, tampilkan `#view` setelah CSS siap |

## 9. Ceklis tahap 2

Desain yang dipakai: Opsi A hybrid (lihat `README.md` > Catatan keputusan). `router.js` dan `app.html` TIDAK dibuat; fungsinya dipegang `UT.Spa` (`assets/js/core/spa-host.js`).

- [x] `assets/js/core/shared-gl.js` (`UT.SharedGL`: `acquire/release/offscreen/setQuality/stats`, reset state tiap acquire, `webglcontextlost/restored`)
- [x] `assets/js/core/spa-host.js` (`UT.Spa`: `mount/start/go/canView`, fetch + DOMParser, CSS dilepas saat pindah, `popstate`, fallback iframe bila view gagal)
- [x] `play.html`: `#view` + `page-module.js`, `shared-gl.js`, `spa-host.js`; `play.js` memanggil `UT.Spa.start` dan memakai ulang musik/overlay/prefetch
- [x] `lobby.js` dan `karakter.js` memakai `SharedGL.acquire`; navigasi Lobby↔Karakter lewat `UT.Spa.go`; renderer offscreen karakter lewat `SharedGL.offscreen()`
- [x] `FrameFX` berhenti saat tidak ada kanvas (loop rAF tidak tersisa)
- [x] Guard `env.disposed` di callback async lobby (`pullXp/Quest/Friends/Mail/Chest/Mine`, `loadProgress`, klaim chest)
- [x] `UT.App.setPage`; `frame-guard.js` mengalihkan Lobby/Karakter di iframe `#f` ke view
- [x] `sw.js` v295 dan `preload-manifest.json` memuat `page-module.js`, `shared-gl.js`, `spa-host.js`
- [x] Cek sintaks (`node --check`) semua file yang diubah: lulus
- [x] `tests/shared-gl.test.js` (10 tes) dan `tests/spa-host.test.js` (9 tes) ditulis dan lulus di Node (`router.test.js` tidak perlu karena tidak ada router)
- [x] Seluruh test: hanya 5 gagal baseline lama, tidak ada kegagalan baru (dijalankan 2026-11-20)
- [x] Smoke test browser `tools/smoke-spa.py` dijalankan (Chromium 153 headless, SwiftShader, 1280x720 landscape, 2026-11-20): LULUS pada 20x dan 40x pindah (CHROME=/path/ke/chrome bila Chrome tidak di /usr/bin/google-chrome)
- [x] Hasil pengukuran sebelum/sesudah (di bawah)
- [x] Temuan smoke test: `character-face.js` membuat renderer WebGL sendiri (konteks ke-2 sejak Lobby) -> dialihkan ke `UT.SharedGL.offscreen()` bersama thumbnail Karakter; ukuran diset tiap render
- [ ] Verifikasi di HP oleh pemilik (HP portrait memakai jalur iframe; lihat catatan keputusan)
- [ ] Merge `spa-tahap2` ke `main` (menunggu persetujuan pemilik)

## Hasil pengukuran

Diukur 2026-11-20 dengan `tools/smoke-spa.py` (sesudah) dan skrip setara untuk `main` (sebelum, pindah lewat iframe `#f`): Chromium 153 headless, WebGL software (SwiftShader), viewport 1280x720 landscape, 20 perpindahan Lobby↔Karakter setelah pemanasan.

| Metrik | Sebelum (`main`, iframe) | Sesudah (`spa-tahap2`, view) |
| --- | --- | --- |
| `three.min.js` diunduh ulang per 20 perpindahan | 20 (satu per perpindahan, tipe script) | 0 |
| Konteks WebGL baru per 20 perpindahan | satu set baru per dokumen (>=2 per halaman: renderer halaman + wajah karakter; Karakter juga renderer thumbnail) | 0 (total sesi 2: renderer bersama + renderer luring) |
| Waktu pindah sampai modul tujuan mounted (rata-rata / maks) | 2712 ms / 3973 ms | 359-424 ms / 768-873 ms |
| Memori JS heap setelah perpindahan | 15,7 MB (akhir) | 9,7 -> 18,9 MB (20x); 12,7 -> 10,9 MB (40x): mendatar, tidak naik terus |
| Draw call halaman aktif | normal | normal (±1000-1500/dtk di SwiftShader) |
| Error konsol/halaman (selain jaringan yang diblok) | tidak diukur | 0 |
| Tombol Back setelah pindah | tidak diukur | kembali ke rute sebelumnya (`UT.Spa.current()`) |

Catatan dan batas:
- Waktu mutlak TIDAK mewakili HP (GPU software di sandbox); yang bermakna adalah rasio dan hitungan.
- Angka sesudah di atas diambil setelah `character-face.js` dialihkan ke renderer luring bersama (sebelumnya 3 konteks total).
- Konteks "sebelum" dihitung per dokumen iframe (tiap dokumen baru membuat ulang konteksnya); total GPU memory tidak diukur.
- HP portrait memakai iframe (bukan view), jadi tidak tercakup ukuran ini. Verifikasi di HP oleh pemilik masih diperlukan.
