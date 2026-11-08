# Prompt lanjutan (salin seluruh blok di bawah ke AI lain)

```
Kamu melanjutkan fitur "Tambang" di repo GitHub rohmanaa/ular-tangga (game Ular Tangga voxel, HTML/JS vanilla + Supabase).
Branch kerja: feat/tambang. Bahasa jawaban: Indonesia santai.

LANGKAH PERTAMA (wajib):
1. Baca doc/fitur/tambang/TAMBANG.md sampai habis. Itu spesifikasi, ekonomi, desain DB/RPC, navigasi, dan CHECKLIST pekerjaan.
2. Lihat bagian "9. Checklist pekerjaan": kerjakan item [ ] yang paling atas yang belum selesai. Jangan ulang item [x].
3. Baca pola yang dipakai repo sebelum menulis kode:
   - supabase/migrations/202611120001_wallet_b6_ad_reward.sql (pola RPC security definer, batas harian WIB, ledger idempoten)
   - supabase/migrations/202611110001_wallet_b1.sql (_wallet_apply, _wallet_ensure)
   - assets/js/wallet-service.js (pola service klien) dan tests/ (pola tes Node)
   - shop.html dan karakter.html (pola halaman, tombol #back, .ut-curbar)
   - assets/js/character-view.js (UT.CharacterView.make(THREE, skinKey, emote))

ATURAN KERAS:
- Semua data dan hitungan di SERVER (RPC Supabase). Dilarang localStorage sebagai sumber data, dilarang mockup, dilarang angka ekonomi di-hardcode di klien
  (klien membaca konfigurasi dari mine_get()). Waktu = now() server.
- Perubahan saldo lewat _wallet_apply (idempoten per user, reason, ref_key). Tidak boleh ada jalan lain mengubah saldo.
- Jangan ubah migrasi yang sudah ada. Migrasi baru = file baru bernama urut (202611180001_tambang.sql, dst).
- Setelah menambah/mengubah migrasi: jalankan  sh tools/build-schema-snapshot.sh  dan commit snapshot (tests/schema-snapshot.test.js akan gagal bila lupa).
- Jalankan semua tes Node di tests/ (node tests/<nama>.test.js) sebelum commit. Cek sintaks script inline di HTML yang diubah.
- Jangan sentuh gameplay.html. Jangan terapkan migrasi ke produksi; beri tahu pemilik untuk menjalankannya di Supabase SQL Editor.
- Navigasi: Back kembali ke halaman asal lewat ?from=<file.html> (daftar putih nama file), tanpa from -> lobby.html. Tombol Home di kanan atas -> lobby.html.
- Ikuti gaya kode yang ada (satu file HTML besar, CSS di dalam, rem, font Baloo 2, tombol .ab). Jangan mengimpor library baru.

SETIAP SELESAI SATU PEKERJAAN:
- Ubah [ ] menjadi [x] di checklist TAMBANG.md, tambahkan satu baris di "11. Log pekerjaan" (tanggal + apa yang dikerjakan + apa yang belum).
- Commit kecil dengan pesan Indonesia yang jelas, push ke branch feat/tambang.
- Bila ada keputusan terbuka (bagian 8) yang menghalangi, JANGAN menebak: tulis pertanyaannya ke pemilik dan kerjakan item lain dulu.

JIKA TOKEN/WAKTUMU HABIS SEBELUM SELESAI:
- Pastikan checklist dan log sudah mutakhir dan sudah di-commit, lalu tulis ringkasan 5 baris: yang selesai, yang sedang dikerjakan (file + fungsi), langkah berikutnya, hal yang diuji, hal yang belum diuji.

Mulai sekarang: baca TAMBANG.md, laporkan singkat item checklist berikutnya yang akan kamu kerjakan, lalu kerjakan.
```
