# Checkpoint 4.1 — Aura & Buff FX

## Baseline

- Branch: `restruktur-fx`
- Baseline commit: `e5bb4ed1212f0419a9a07793f190d2d7637fbf35`
- Pemeriksaan dilakukan pada repository `rohmanaa/dragonroll`; perubahan gameplay di luar visual tidak dibuat.

## File yang diperiksa dan diubah

- Sumber aura: `tools/aura-fx/src/AuraConfig.js`, `AuraParticles.js`, `AuraSystem.js`, `AuraDecor.js`.
- Hasil generator: `assets/js/renderers/aura-fx.js`.
- Integrasi karakter: `assets/js/renderers/aura-view.js`, `gameplay/js/main.js`.
- Integrasi FX: `gameplay/js/fx.js`.
- Tes: `tests/aura-fx.test.js`, `aura-view.test.js`, `gameplay-spatial-fx.test.js`.
- Jalur katalog, registry, kualitas, lifecycle, multiplayer cue, dan aturan Power juga diperiksa.

## Implementasi

- Menambahkan preset kualitas `Ultra` dan deteksi empat tingkat kualitas tanpa mengganti renderer AuraFX yang ada. Profil High gameplay tetap dibatasi ke Medium untuk banyak pion; perangkat Ultra memakai preset Ultra.
- Reduce Motion kini dapat dibaca secara live dari `AuraView`; gerak aura/partikel diperlambat, emisi dan burst berkurang, pulse berulang dan semburan lompatan dinonaktifkan, sementara posisi aura tetap mengikuti karakter dan partikel tetap habis normal.
- Menambahkan feedback aktivasi/akhir Wooden Shield berupa siluet shield, ring, dan partikel. Cue dipicu oleh event aktivasi dan penggunaan shield yang sudah diproses gameplay, memakai `UT.GameplayFX` spatial lifecycle, fid/seed, follow pawn, dan jalur cue multiplayer yang ada.
- Tidak mengubah aturan perlindungan, damage, HP, turn, inventory, atau jaringan gameplay. Tidak ada engine/manager baru.
- Kepadatan aura tetap memakai tier rarity 1–7 milik katalog AuraFX; katalog aura tidak memiliki metadata L1–L4 terpisah.

## Hasil pengujian

- `node tools\\aura-fx\\build.js` — lulus; hasil generator diperbarui.
- `aura-fx.test.js` — 8 lulus; seluruh 15 aura diuji di Low/Medium/High/Ultra, termasuk Reduce Motion, gerak/teleport, dan cleanup.
- `aura-view.test.js` — 6 lulus.
- `aura-catalog.test.js` — 6 lulus.
- `aura-registry-parity.test.js` — 7/7 lulus.
- `gameplay-spatial-fx.test.js` — 34 lulus, termasuk feedback shield, seed/fid, Reduce Motion, cue duplikat, reset/game over, visibility, dan cleanup.
- `gameplay-fx-core.test.js` — 16 lulus; `gameplay-fx-lifecycle.test.js` — 13 lulus; `gameplay-fx-cue.test.js` — 26 lulus.
- `power-rules.test.js` — 17 lulus.
- `node --check` untuk renderer hasil generator, AuraView, `gameplay/js/main.js`, dan `gameplay/js/fx.js` — lulus. `git diff --check` — lulus.

## Masalah ditemukan dan penyelesaian

- AuraFX belum memiliki preset Ultra dan Reduce Motion tidak membatasi seluruh gerak/emisi aura. Ditangani di sistem aura yang ada, tanpa menambah loop atau engine.
- Tes Ultra/Reduce Motion semula tersarang dalam loop kualitas sehingga berjalan berulang. Penempatannya diperbaiki; tes sekarang berjalan sekali, dan tes semua aura mencakup empat preset.
- Katalog item aura saat ini berisi 15 aura, tetapi tidak memiliki item Poison atau Wind. Checkpoint ini tidak menambah item, harga, atau data inventori yang tidak tersedia.

## Batasan tersisa

- Poison Aura dan Wind Aura belum tersedia sebagai aura terdaftar; AuraFX mempertahankan katalog dan identitas item lama. Efek elemental pada checkpoint 4.2 tetap dibatasi pada event dan elemen yang benar-benar didukung gameplay.
- Validasi kualitas dan lifecycle dilakukan lewat tes otomatis/simulasi, bukan perangkat fisik desktop/mobile atau dua klien multiplayer yang berjalan langsung. Tidak ada klaim bahwa uji perangkat tersebut telah dilakukan.
