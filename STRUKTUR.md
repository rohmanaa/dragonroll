# Struktur Aset

- `assets/` berisi aset statis dan kode umum yang dipakai lintas halaman atau domain.
- Gunakan `assets/images/`, `assets/audio/{music,sfx}/`, `assets/fonts/`, dan `assets/icons/` untuk aset umum.
- Kode dan CSS bersama berada di `assets/js/` dan `assets/css/`; kode vendor tetap di `src/vendor/`.
- `data/` berisi aset milik fitur/halaman, seperti `data/lobby/` dan `data/mining/`; fitur tetap di bawah `data/`, bukan inventori.
- Kategori item pemain (`aura`, `character`, `dice`, `frame`, `pet`, `power`) berada di `data/inventory/<kategori>/`.
- Kode dan gaya bersama kategori berada di `_shared/`; data item berada di folder gameKey/ID dalam kategori.
- Aset item Pet berada di `data/inventory/pet/items/<item>/`.
- Manifest, model, gambar, dan SFX khusus item tinggal bersama di folder item tersebut.
- Jika aset dipakai dua domain atau lebih, tempatkan di `assets/`, bukan menggandakannya di `data/`.
- Untuk item baru, buat folder `items/<item>/`, tambahkan manifest dan aset item, lalu daftarkan melalui `index.js` domain.
- Perbarui semua referensi path; jangan mengubah ID, harga, atau kunci penyimpanan saat memindahkan aset.
- Setelah perubahan aset, naikkan `VERSION` di `sw.js`, jalankan `python3 tools/gen-preload-manifest.py`, lalu tes.
- `gameplay.html` dan `gameplay/` dizinkan. tapi WAJIB HATI-HATI

