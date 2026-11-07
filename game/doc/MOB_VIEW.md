# Mob View (mob dekoratif reusable)

Mob voxel berdetail + animasi untuk halaman non-gameplay. Beda dengan `UT.CharacterData` (karakter pemain dari gameplay).

- File: `assets/js/mob-view.js` (skrip klasik, global `UT.MobView`, tanpa dependency; three.js lewat argumen)
- Dipakai: **Teman** (`friendship.html`) = `butterfly-garden`; **Hadiah Harian** (`dailyreward.html`) = `chicken` mood `happy`.

## API
```js
UT.MobView.make(THREE, 'chicken', { mood: 'idle' | 'happy', scale: 1 })   // -> THREE.Group, g.userData.anim(t)
UT.MobView.make(THREE, 'butterfly', { palette: 'blue' | 'orange' | 'pink' })
UT.MobView.make(THREE, 'flowers')                    // 5 bunga + rumput, bergoyang
UT.MobView.make(THREE, 'butterfly-garden')           // kupu-kupu terbang di atas bunga
UT.MobView.list()                                    // ['chicken','butterfly','flowers','butterfly-garden']
UT.MobView.register('nama', ctx => ({ root, anim })) // tambah mob baru (ctx.part(parent, boxes, pivot), ctx.mesh, ctx.rnd)
```
Box = `[x, y, z, w, h, d, '#rrggbb', grain?]` (pusat box). `grain` = ukuran kubus kecil → bulu/tekstur berbintik. Mob menghadap +z, dasar di y = 0.

## Isi
| Key | Detail |
|---|---|
| `chicken` | badan berbulu (kubus 1 px), jengger, paruh atas/bawah, pial, mata berkilau, kaki + jari, sayap, ekor. Idle: mematuk & menoleh. Happy: melompat, mengepak, mengibas ekor |
| `butterfly` | dada, perut bergaris, kepala bermata, 2 antena berujung, 4 sayap piksel (pola + bintik putih) mendatar di kiri-kanan dada (kolom grid = ke samping, baris = sepanjang badan), 3 palet; sayap mengepak naik-turun |
| `flowers` | 5 bunga (merah, kuning, putih, biru, pink) dengan batang, daun, kelopak, putik, + rumput; bergoyang tertiup |
| `butterfly-garden` | gabungan kupu-kupu (jalur oval kecil, badan miring hidung ke atas supaya sayap terlihat dari kamera; selalu di dalam bingkai halaman Teman) di atas bunga |

Menambah mob baru = satu `register(...)`; tidak perlu mengubah halaman selain memanggil `make()`.
