# Checkpoint 3.1 — Sword & Weapon Attack

Repository `rohmanaa/dragonroll` · branch `restruktur-fx` · baseline `48581419051d3f612d8b78cf4d44945ad21e7951`.

## Temuan audit

- Baseline memiliki aksi `attack` dan Power pedang yang sudah memanggil animasi rig karakter; belum ada slash atau weapon trail di `UT.GameplayFX`.
- Posisi pawn dan target tersedia pada waktu aksi. Rig karakter menyediakan anchor tangan untuk mengikuti ayunan senjata.
- Tidak ada mekanisme gameplay serangan ganda atau critical hit yang dapat menjadi pemicu visual. Tidak dibuat hasil critical/double palsu.

## Implementasi

- Menambahkan primitive combat di `UT.GameplayFX` tanpa engine baru: `sword-slash`, `weapon-release`, `weapon-trail`, serta emitter projectile/impact/defense yang dipakai checkpoint berikutnya.
- Slash berorientasi ke target aktual. Power yang aktif di baseline, Diamond Sword, memakai sapuan diagonal-berat dengan momentum/impact lebih tegas; style horizontal/vertical/double/critical tersedia di emitter, tetapi tidak dipicu tanpa aksi gameplay yang sesuai.
- Iron Sword dan Netherite Sword sedang dinonaktifkan di katalog; style untuk keduanya tidak mengubah Power atau mengaktifkan kembali item.
- Weapon trail mengambil sampel anchor tangan tiap update lokal; tidak mengirim sampel atau partikel melalui jaringan.
- `spFx` mengirim cue ringan dengan kind, posisi/arah, style, `fid`; seed diturunkan dari `fid` pada klien penerima.
- Tidak mengubah aturan Power, damage, target, perpindahan pawn, maupun audio. Suara tetap melalui `UT.GameplayAudio` yang sudah ada.

## Lifecycle dan pengujian

Semua emitter menggunakan tracking Phase 1, metadata `fid`/seed, kuota kualitas, Reduce Motion, cleanup alami, `Stop`, `Stop All`, reset, dan visibility lifecycle. Anak partikel spasial ikut kategori parent sehingga `stopAll({scope:'spatial'})` juga membersihkan ekor partikel.

Lulus pada regression final: 33 tes Spatial FX; Phase 1 `gameplay-fx-core` (16), `gameplay-fx-lifecycle` (13), `gameplay-fx-cue` (26); serta `power-rules` (17), landing Power, boss-hit, mob-hit, mob-landing, dan game-core (16). Pengujian simulasi mencakup Low–Ultra, Reduce Motion, perbedaan siluet horizontal/diagonal/heavy-diagonal/heavy/double/vertical, gerak weapon anchor, dedup cue, dan cleanup.

## File dan commit

- `gameplay/js/fx.js`
- `gameplay/js/main.js`
- `tests/gameplay-spatial-fx.test.js`

Commit implementasi: `5bd686bd98e1b66fae6c137c72fe60b7924f7b0f`. Penyesuaian style untuk Diamond Sword aktif setelah verifikasi audit: `80b050ac4f9038f789cf415ec282ef0d009382ec`.

## Regression dan risiko tersisa

Tes gameplay yang relevan lulus; aturan gameplay tidak diubah. Belum ada browser/WebGL visual review, uji perangkat desktop/mobile fisik, atau uji dua klien live. Critical slash/double slash tidak diaktifkan karena baseline tidak memiliki hasil gameplay tersebut.
