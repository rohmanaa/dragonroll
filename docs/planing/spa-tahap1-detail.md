# SPA Tahap 1 - Modul Halaman (Rincian)

**STATUS: SELESAI (2026-11-20)**, commit di branch `spa-pilot`, SW v294. Lihat ceklis dan catatan hasil di bagian bawah file ini.

Bagian dari `spa-rencana.md`. Tujuan: ubah `lobby.js` dan `karakter.js` menjadi
modul dengan `mount` dan `unmount`, tanpa mengubah perilaku halaman mandiri.

## 1. File baru

`assets/js/core/page-module.js`, dimuat sebelum skrip halaman.

API:

```js
UT.PageModule.define(name, body)   // body(env) menjalankan isi skrip halaman
UT.PageModule.mount(name)          // buat env, jalankan body; kembalikan {unmount}
UT.PageModule.unmount(name)        // jalankan semua disposer (urutan terbalik)
UT.PageModule.managed = false      // true bila shell SPA yang memanggil mount
```

Bila `managed` bukan `true`, `define` langsung memanggil `mount` (perilaku halaman
mandiri tidak berubah).

## 2. Isi `env`

Semua fungsi mendaftarkan pembersihan otomatis dan tidak berjalan setelah
`unmount`.

| Anggota | Pengganti untuk |
| --- | --- |
| `setTimeout`, `clearTimeout` | pemanggilan bare di skrip |
| `setInterval`, `clearInterval` | pemanggilan bare di skrip |
| `requestAnimationFrame`, `cancelAnimationFrame` | loop animasi (loop berhenti sendiri setelah `unmount`) |
| `addEventListener`, `removeEventListener` | pemanggilan bare (target `window`) |
| `on(target, type, fn, opt)` | `document.addEventListener(...)` dan sejenis |
| `own(off)` | langganan yang mengembalikan fungsi pelepas: `env.own(UT.Events.on(...))`, `env.own(PD.subscribe(...))`, `env.own(UT.Ambience.on(...))` |
| `observe(observer)` | `ResizeObserver` dan sejenisnya (`disconnect` saat unmount) |
| `dispose(fn)` | alias `own`; cleanup khusus halaman (mis. `renderer.dispose()`, `LS.stop()`) |

(Rancangan awal memakai `ev`/`sub`/`amb`; diganti satu `own(off)` generik karena
semua API langganan di repo ini mengembalikan fungsi pelepas.)

Skrip memakai bayangan variabel di awal body:

```js
UT.PageModule.define('lobby', function (env) {
  const { setTimeout, clearTimeout, setInterval, clearInterval,
          requestAnimationFrame, cancelAnimationFrame,
          addEventListener, removeEventListener } = env;
  /* ...isi skrip lama tanpa perubahan lain... */
});
```

Dengan begitu hampir seluruh baris lama tidak perlu disentuh; hanya titik
registrasi yang bukan pemanggilan bare yang diganti (daftar di bawah).

## 3. Perubahan per file

### `data/lobby/js/lobby.js`

- Bungkus seluruh isi dalam `define('lobby', ...)`.
- `UT.Events.on(` (3x), `PD.subscribe(` (2x), `UT.Ambience.on(` (1x) → dibungkus `env.own(...)`.
- `UT.CharacterFace.watch(...)` → `env.own(...)` (watch kini mengembalikan pelepas).
- `document.addEventListener` (1x) → `env.on(document, ...)`.
- `LS.start(...)` di akhir file: daftarkan `env.dispose(() => LS.stop())`
  (cek dulu apakah `LiveSync` punya `stop`; bila belum, tambahkan).
- `renderer.dispose()` didaftarkan lewat `env.dispose` (di tahap 2 diganti
  melepas renderer bersama).
- Hentikan `AUR` (aura view) dan geometri hero saat `unmount`.

### `data/inventory/character/_shared/js/karakter.js`

- Bungkus seluruh isi dalam `define('karakter', ...)`.
- `UT.Events.on(` (1x) dan `PD.subscribe(` (1x) → `env.own(...)`.
- Hapus guard `window.__curSub` (diganti pelepasan lewat `env.sub`).
- `new ResizeObserver(fit)` → `env.observe(new ResizeObserver(fit))`.
- `window.BlockyCharacter = {...}` (baris ±1821): tetap di `window`, karena
  dipakai pihak lain; pastikan aman bila `mount` terjadi dua kali.
- `renderer.dispose()` dan pembuangan scene lewat `env.dispose`.

## 4. Jebakan yang harus dicek

1. Deklarasi `function` di level atas skrip klasik otomatis menjadi global
   `window`. Setelah dibungkus, tidak lagi. Cari pemakai dari file lain
   (`grep` nama fungsi di seluruh repo) sebelum membungkus.
2. Mode `'use strict'` atau tidaknya skrip: pembungkusan fungsi tidak mengubahnya,
   tapi pastikan tidak ada `this` di level atas yang bergantung pada `window`.
3. `pageshow`/`persisted` (bfcache) dipakai di lobby: tetap berfungsi pada
   halaman mandiri; di SPA nanti digantikan event router.
4. Test yang membaca teks sumber atau `new Function(...)` (lihat bagian 5).

## 5. Test yang terpengaruh

| Test | Cara memakai skrip | Yang perlu dicek |
| --- | --- | --- |
| `aura-view` | regex `AUR\.update\(motionDt\)` pada `lobby.js`; urutan elemen di `karakter.html` dan isi `karakter.js` | pola teks masih ada |
| `blocky-actions` | regex `bc\.act\('...'\)` pada `lobby.js` | tidak berubah |
| `daily-reward-30` | membaca `lobby.js` | pola teks masih ada |
| `chest-service` | membaca `lobby.js` dan `lobby.html` | pola teks masih ada |
| `karakter-equip` | `new Function(source)` untuk cek sintaks | tetap sintaks valid |
| `pvp-knight-gear` | membaca `karakter.js` dan menjalankan blok set PVP dengan stub | blok masih bisa diekstrak |

Baseline: 5 test sudah gagal sebelum perubahan (lihat `spa-rencana.md`, bagian 7).
Jalankan seluruh test sebelum dan sesudah tiap langkah; bandingkan daftar gagal.

## 6. Test baru

`tests/page-module.test.js` (Node, tanpa browser):

- `mount` menjalankan body sekali; `unmount` memanggil semua disposer berurutan
  terbalik.
- Timer, interval, dan rAF yang terdaftar tidak berjalan setelah `unmount`.
- Loop rAF yang menjadwal ulang dirinya berhenti setelah `unmount`.
- `ev`, `sub`, `amb` memanggil fungsi unsubscribe saat `unmount`.
- `mount` dua kali berturut-turut aman (unmount otomatis dulu).
- Error di body tidak merusak `PageModule` (mount gagal dilaporkan, env dibersihkan).

## 7. Verifikasi

1. Seluruh `tests/*.test.js`: tidak ada kegagalan baru dibanding baseline.
2. Smoke test headless Chrome pada `lobby.html` dan `karakter.html`:
   tidak ada error konsol, canvas WebGL terbentuk, `unmount()` dipanggil dari
   konsol tanpa error dan menghentikan loop render.
3. Cek manual di HP: Lobby dan Karakter tampil dan berperilaku seperti sebelumnya.
4. Naikkan `VERSION` di `sw.js` dan jalankan `python3 tools/gen-preload-manifest.py`.

## 8. Urutan kerja

1. Tulis `page-module.js` beserta `tests/page-module.test.js`.
2. Sisipkan `page-module.js` ke `lobby.html` dan `karakter.html`.
3. Bungkus `lobby.js` dan ganti titik registrasi; jalankan test dan smoke test.
4. Bungkus `karakter.js` dan ganti titik registrasi; jalankan test dan smoke test.
5. Naikkan versi SW, regenerasi manifest, commit di branch `spa-pilot`.

## 9. Ceklis tahap 1

- [x] `assets/js/core/page-module.js` ditulis (`create/define/mount/unmount/isMounted/managed`, env pelacak)
- [x] `tests/page-module.test.js`: 18 tes lulus
- [x] `page-module.js` dimuat di `lobby.html` dan `karakter.html` sebelum skrip halaman
- [x] `lobby.js` dibungkus `define('lobby')`; semua titik registrasi diganti (own/on/dispose)
- [x] `karakter.js` dibungkus `define('karakter')` (sudah berupa IIFE, jadi tinggal diganti pembungkusnya); guard `window.__curSub` dihapus
- [x] `LiveSync.remove(name)` ditambahkan; lobby melepas 8 tugas dan `LS.stop()` saat unmount
- [x] `CharacterFace.watch` mengembalikan fungsi pelepas (langganan PlayerData dan `pageshow`)
- [x] Disposer renderer: geometri/material/tekstur adegan + `renderer.dispose()`
- [x] Seluruh test: sama dengan baseline (hanya 5 gagal lama; tidak ada kegagalan baru)
- [x] Smoke test Chrome headless (`tools/smoke-page-module.py`): Lobby dan Karakter mounted, `unmount` → 0 draw call WebGL, mount ulang → render lagi
- [x] `sw.js` VERSION v293 → v294, `gen-preload-manifest.py` dijalankan, tes SW lulus
- [x] Commit di branch `spa-pilot`
- [ ] Verifikasi manual di HP oleh pemilik (halaman mandiri harus tampil/berperilaku sama)
- [ ] Merge `spa-pilot` ke `main` (menunggu persetujuan pemilik)

## 10. Catatan hasil dan temuan (penting untuk tahap 2)

Hasil smoke test (Chrome headless + SwiftShader, tanpa jaringan Supabase):

| Halaman | Draw call/detik saat mounted | Draw call 1,5 dtk setelah unmount | Mount ulang |
| --- | --- | --- | --- |
| lobby | ±2680 | 0 | render lagi |
| karakter | ±1600 | 0 | render lagi |

Temuan:

1. **Arsitektur sebenarnya: `play.html` membungkus tiap halaman dalam `<iframe>`.**
   `boot-guard.js` mengalihkan halaman yang dibuka langsung ke `splash.html?next=...`
   kecuali `sessionStorage['ut:booted']==='1'` dan ada `localStorage['ut-auth']`.
   Halaman Lobby dan Karakter berjalan di dalam iframe `play.html`; wrapper itu
   sudah mengurus musik, layar memuat, dan prefetch. Ini memengaruhi desain tahap 2
   (lihat `spa-tahap2-detail.md`, bagian 0).
2. **Sisa loop `requestAnimationFrame` setelah unmount Lobby (±60/detik) berasal dari
   `data/inventory/frame/_shared/js/frame-fx.js`** (animasi bingkai avatar), bukan dari
   modul. Draw call WebGL tetap 0. Di tahap 2 loop ini harus berhenti sendiri saat
   elemen bingkai tidak ada di DOM (atau FrameFX menyediakan `stop()` yang dipanggil
   lewat `env.own`).
3. **Callback async setelah unmount.** Di `lobby.js`, `pullXp/pullQuest/pullFriends/
   pullMail/pullChest/pullMine` dan `loadProgress().then(...)` adalah promise yang
   bisa selesai setelah `unmount`; mereka menyentuh DOM (`$('#...')`). Saat ini error
   tertangkap `.catch`, tetapi di SPA DOM sudah diganti; tambahkan guard
   `if(env.disposed)return` di awal callback tersebut (tahap 2).
4. **`PageShell`/`UT.App.init({page})` tidak ikut modul.** `UT.App.init` dipanggil dari
   HTML dan memasang listener/langganan global sendiri (musik, tombol, sinkron).
   Di SPA perlu dipanggil sekali oleh shell, bukan per halaman.
5. **`window.BlockyCharacter`** (di `karakter.js`) tetap ditulis ke `window` tiap mount;
   aman diulang. `lobby.js`/`karakter.js` tidak mengekspor global lain (fungsi
   level-atas kini lokal modul; tidak ada pemakai luar yang ditemukan).
6. **Test yang sensitif bentuk teks:** `lobby-appearance.test.js` mencocokkan pola
   `PD.subscribe(r=>{if(r==='equip'...});` di `lobby.js`. Pembungkusan
   `env.own(PD.subscribe(...))` merusak pola itu, jadi dipakai
   `const unsubHero=PD.subscribe&&PD.subscribe(...);env.own(unsubHero);`.
   Untuk halaman berikutnya, periksa test yang `readFileSync` skrip halaman sebelum
   mengubah bentuk baris.
7. **Renderer yang dibuat di dalam `try` pada `lobby.js`** tetap dibuat dengan
   `new THREE.WebGLRenderer` (belum bersama). Itu sengaja: berbagi renderer adalah tahap 2.
8. Versi cache-bust `karakter.js?v=218` → `?v=219` di `karakter.html`.
