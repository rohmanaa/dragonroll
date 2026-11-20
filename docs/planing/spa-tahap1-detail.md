# SPA Tahap 1 - Modul Halaman (Rincian)

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
| `ev(name, fn)` | `UT.Events.on(...)` |
| `sub(fn)` | `PD.subscribe(...)` |
| `amb(fn)` | `UT.Ambience.on(...)` |
| `observe(observer)` | `ResizeObserver` dan sejenisnya (`disconnect` saat unmount) |
| `dispose(fn)` | cleanup khusus halaman (mis. `renderer.dispose()`, `LS.stop()`) |

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
- `UT.Events.on(` (3x) → `env.ev(`.
- `PD.subscribe(` (2x) → `env.sub(`.
- `UT.Ambience.on(` (1x) → `env.amb(`.
- `document.addEventListener` (1x) → `env.on(document, ...)`.
- `LS.start(...)` di akhir file: daftarkan `env.dispose(() => LS.stop())`
  (cek dulu apakah `LiveSync` punya `stop`; bila belum, tambahkan).
- `renderer.dispose()` didaftarkan lewat `env.dispose` (di tahap 2 diganti
  melepas renderer bersama).
- Hentikan `AUR` (aura view) dan geometri hero saat `unmount`.

### `data/inventory/character/_shared/js/karakter.js`

- Bungkus seluruh isi dalam `define('karakter', ...)`.
- `UT.Events.on(` (1x) → `env.ev(`; `PD.subscribe(` (1x) → `env.sub(`.
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
