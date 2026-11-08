# Efek = Aura karakter (efek.html)

Halaman **Efek** menampilkan 15 aura voxel 3D (Common → Divine) di atas **karakter pemain yang sebenarnya** (penampilan + gear dari halaman Karakter).
Pilih kartu = preview; **Gunakan** = simpan pilihan.

## File
| File | Isi |
|---|---|
| `assets/js/aura-fx.js` | `UT.AuraFX` — `AuraSystem`, `AURAS`, `RARITY`, `QUALITY`. DIHASILKAN, jangan edit manual. |
| `assets/js/blocky-character.js` | `UT.BlockyCharacter.create(THREE)` — karakter blocky halaman Karakter (rig, katalog gear, builder, pose) tanpa scene/UI. DIHASILKAN dari `karakter.html`. |
| `tools/aura-fx/src/*.js` | Sumber aura (ES module untuk three r169, dari paket `aura-3d`). |
| `tools/aura-fx/build.js` | `node tools/aura-fx/build.js` → ubah jadi satu skrip klasik untuk three **r128** (global `THREE`). Beda r128: shader `<encodings_fragment>` (bukan `<colorspace_fragment>`), `colorSpace` di-guard. |
| `tools/blocky-character/build.js` | `node tools/blocky-character/build.js` → ekstrak bagian 1 & 3–9 `karakter.html`. `karakter.html` TIDAK diubah. **Jalankan ulang bila builder/katalog gear di karakter.html berubah.** |
| `tests/aura-fx.test.js` | `node tests/aura-fx.test.js` — 15 aura × 3 kualitas, karakter, aura menempel, wiring efek.html. |

## Cara kerja di efek.html
- `CI.effect` dibuat dari `UT.AuraFX.AURAS` (id `aura.<id>`, `kind:'effect'`). Bukan item `ItemCatalog` / bukan server: **semua aura gratis**; pilihan disimpan di `localStorage['ut.aura']` (id aura, mis. `emerald`).
  Slot `aura` memang belum ada di katalog (lihat `tests/gear-catalog.test.js`); lobby & gameplay **belum** membaca `ut.aura`.
- Karakter dibuat sekali per rig (`fxShow`), ganti aura = `aura.setAura(id)` (tanpa membangun ulang karakter). Aura menempel ke `ch.root`, jadi lompat/mendarat terdeteksi dari `root.position.y`.
- Tombol **Lompat** / **Jalan** (`#fxbar`) hanya untuk menguji reaksi aura.
- Kualitas partikel: pengaturan Grafis "high" → `detectQuality()`, selain itu `low`.

## Bila ingin dijadikan item sungguhan
Daftarkan slot `aura` di `item-catalog.js` + migrasi Supabase + `PlayerData` (beli/equip), ganti `fxGet/fxSet` di efek.html dengan `PD.equippedId('effect')`, lalu baca di lobby/gameplay lewat `UT.AuraFX`.
