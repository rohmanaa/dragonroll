# Konteks Proyek: Dragon Roll (Ular Tangga Blok)

Dokumen serah-terima untuk melanjutkan kerja di sesi baru. Diperbarui 13 Nov 2026.

## 1. Gambaran singkat
- Game web multi-halaman bertema blok (Minecraft-like), Three.js r128 global, Supabase sebagai server.
- Repo: `rohmanaa/ular-tangga` (GitHub sudah menyatakan pindah ke `rohmanaa/dragonroll`; push tetap masuk, remote sebaiknya diperbarui).
- Branch kerja: **`ui-newgui`**. Pemilik berbahasa Indonesia; balas dalam bahasa Indonesia, singkat.
- Halaman utama: `splash.html` (tap to start) -> `lobby.html` -> `gameplay.html`; plus `dailyreward.html`, `misi.html`, `hadiah-misi.html`, shop, profil, tambang, dll.

## 2. Aturan kerja (wajib)
- Setiap ubah aset/kode yang di-cache: naikkan `VERSION` di `sw.js` (sekarang **`ut-pwa-v123`**) lalu `python3 tools/gen-preload-manifest.py`.
- Menambah migrasi: `sh tools/build-schema-snapshot.sh` (tes `schema-snapshot` memeriksanya).
- Ubah harga item: edit `assets/js/item-catalog.js`, jalankan `node tools/wallet/gen-item-seed.js --check`.
- Jangan regenerasi `assets/js/blocky-character.js` dengan `build.js` (hasil edit tangan, mis. animasi busur/lempar dadu, akan hilang).
- Tes: `for f in tests/*.test.js; do node $f; done`. Dua tes gagal sejak sebelum perubahan ekonomi (di remote juga): `blocky-actions`, `store-card-status`.
- Hook "stop" mengeluh soal commit belum ter-push atau file untracked. Setelah push, segarkan ref: `git fetch -q origin +ui-newgui:refs/remotes/origin/ui-newgui`.
- Commit diakhiri baris `Co-Authored-By` dan `Claude-Session` sesuai instruksi sesi.
- Pemilik tidak suka pull tanpa izin; tanyakan dulu bila remote berubah (konflik biasanya di `sw.js` dan `assets/preload-manifest.json`: ambil versi remote, naikkan versi, buat ulang manifest).
- Sistem suasana: `UT.Prefs` (`ut:prefs:v1`), `assets/js/ambience.js` mengatur `html[data-ambience="day|night"]`.

## 3. Yang sudah selesai (sesi ini dan sebelumnya)
Kamera default, efek power di tengah layar, tinggi/gerak naga, animasi busur saat menyerang naga, perbaikan pion melayang, tombol LOCK/ANGLE dihapus (POV bisa lihat sekitar), suasana siang/malam tersinkron (Settings, gameplay, lobby), lampu/tungku malam di lobby, bulan/bintang diredam, gambar lobby siang dan malam terpisah, kabut malam sebagai pita tipis di belakang karakter.

### Ekonomi fase 1 (sudah di remote)
Migrasi `202611270001_economy_phase1_login_firstjoin_box.sql`:
- Login 7 hari: H1 300 koin, H2 500 koin, H3 Mystery Box, H4 5 emerald, H5 800 koin, H6 10 emerald, H7 2.000 koin + 15 emerald. Tanpa dadu/skin.
- `open_mystery_box()`: 500 koin 40%, 1.000 koin 30%, 2.000 koin 15%, 3 emerald 10%, 8 emerald 4%, 20 emerald 1%. Tombol "Buka Box" di `dailyreward.html`.
- First join: surat 500 koin + 20 emerald (`dedupe_key='first-join'`) untuk akun dibuat sejak 13 Nov 2026; akun lama tidak dapat.
- Tabel hadiah login juga ada di `hadiah-misi.html` (array `R`); keduanya harus sama.

### Ekonomi fase 2 (sudah dibuat, BELUM di-push saat dokumen ini ditulis, lihat bagian 6)
Migrasi `202611270002_economy_phase2_quests_achievements.sql`:
- 8 misi harian: login 100, main 150, menang x3 250, dadu x30 120, naik tangga x5 120, serang naga x3 200, buka peti x3 120, pakai skill x3 120 (total 1.180). Bonus semua selesai: 300 koin + 3 emerald.
- Misi turunan dihitung server dari selisih counter `player_stats` terhadap baseline harian (`player_quest.base`); klien hanya melaporkan login/play/win.
- Achievement: 18 buah, target dan hadiah per kelas (mudah/sedang/sulit/legendaris). Naga 10/50/500. `papan` jadi Penyelesai Misi, `skin` jadi Kolektor (total koleksi 5/15/30). Baru: Pemburu Boss, Si Ramah (teman), Naik Level.
- Klien: `quest-data.js`, `achievement-data.js`, `misi.html` (daftar bisa di-scroll), `hadiah-misi.html` (daftar misi scroll `.qlist`).
- Tes SQL: `supabase/tests/economy_phase12_test.sql` (lulus di Postgres 16 lokal setelah semua migrasi diterapkan).

### Ekonomi fase 3 (dibuat, BELUM dites manual, migrasi BELUM di produksi)
Migrasi `202611280001_economy_phase3_gems.sql`. Harga naik tiap tier; tier atas hanya emerald. Harga ada di `TIER_PRICE` (`assets/js/item-catalog.js`), seed server dijaga `node tools/wallet/gen-item-seed.js --write/--check`.
- Dadu: T1 500, T2 1.500, T3 9.000, T4 30.000 koin; T5 600, T6 1.500, T7 3.000 emerald.
- Frame: 500/1.500/2.500/6.000/9.000/12.000/20.000 koin (Batu..Nether); Ender 450, Badai 600, Naga 800, Phoenix 1.100, Surgawi 1.500, Kosmik 2.000 emerald.
- Aura: 600/2.000/5.000/15.000 koin; Solar/Shadow/Sculk 500, Dragon 1.500, Celestial 3.000 emerald.
- Tambang dibeli EMERALD: buka 20/60/150; kecepatan Lv2-5 20/40/70/120; peti 15/30/55/95 (x1,0/1,5/2,0 per slot). Boost tetap koin, diturunkan 150/200/300.
- Kurs tukar seragam 50 koin/emerald (10->500, 40->2.000, 120->6.000). Hadiah boss online emerald 10 -> 2 (`claim_boss_reward`, `Config.DRAGON_REWARD`).
- `buy_item` mendukung `price_gems` (alasan gagal baru `gem-kurang`). UI emerald: dadu, frame, efek, tambang. Skin, tema, gear, power-up, pet tidak diubah.
- Pet (`supabase/pet_catalog.sql`, belum ada UI beli): T1-T4 koin 3.000/9.000/25.000/60.000; T5-T7 emerald 1.500/3.000/6.000. Jalankan ulang file di SQL Editor.
- Sisa: Chest di toko, fase 4 (invite), kabut malam. Boss CPU tetap 100 koin.

## 4. Keputusan ekonomi yang sudah dikunci
Rencana lengkap: lampiran `EKONOMI_PLAN.md` (tabel harga, estimasi, fase).
- Tier tertentu hanya bisa dibeli dengan emerald (semua koleksi); tambang dibeli emerald, makin tinggi level makin mahal; boost tambang tetap pakai koin.
- Boss online: turunkan emerald ke **1-2 per menang** (belum dikerjakan).
- Kurs tukar emerald ke koin: seragam **50 koin per emerald** (belum dikerjakan).
- Mystery Box: dibangun (selesai di fase 1).
- Skin tidak boleh jadi hadiah apa pun.
- Skala acuan: LINE Let's Get Rich (data belum ada; menunggu screenshot dari pemilik).

## 5. Sisa pekerjaan
1. **Fase 3 (terbesar):** kolom `price_gems` di `item_catalog`, ubah RPC `buy_item`/`buy_set`, harga baru dadu/frame/aura (tier atas emerald), UI toko, tambang dibeli emerald (`_mine_*`, `mine_unlock/upgrade`), turunkan emerald boss, seragamkan kurs tukar. Perhatikan: harga emerald-only harus >= nilai tukar koin tier sebelumnya.
2. **Fase 4:** fitur invite/gabung (tabel referral, hadiah setelah yang diundang main pertama kali, batas jumlah), achievement Undangan.
3. Chest di toko belum punya harga/isi.
4. Skala pet sudah diseragamkan (lihat Fase 3); UI beli pet belum ada.
5. **Kabut malam:** pasang animasi 3 lapis dari `referensi/fog.html` ke `splash.html` dan `lobby.html`, hanya saat `html[data-ambience="night"]`. Tekstur lokal sudah ada di `assets/Images/fog/` (fog1.webp, fog2.webp, tileable horizontal). Rencana: `assets/css/night-fog.css` + `assets/js/night-fog.js` (`UT.NightFog.mount`), di lobby dipasang di dalam `.sbg`, di splash perlu memuat `prefs.js` dan `ambience.js` lalu mount ke `#scene` sebelum `#vig`. Matikan di `data-graphics="low"` dan `prefers-reduced-motion`.
6. Migrasi 202611270001 dan 202611270002 **belum dijalankan ke Supabase produksi**; fitur baru belum aktif sebelum itu.

## 6. Status git saat dokumen ini dibuat
Fase 1 dan tekstur kabut sudah ter-push. Fase 2 (migrasi, klien, tes, sw v123) di-commit bersama dokumen ini; periksa `git status` dan `git log origin/ui-newgui..HEAD`.

## 7. Jebakan yang pernah terjadi
- `Box3.setFromObject` menghitung objek tak terlihat (penyebab pion melayang bila busur tersembunyi di tangan).
- Lobby punya guard sesi yang mengalihkan ke `play.html`; uji headless memakai halaman minimal `lobbytest.html`.
- Unduhan `raw.githubusercontent.com` diblokir (403); aset dibuat lokal.
- Uji visual headless: Playwright + swiftshader dengan server `python3 -m http.server`.
