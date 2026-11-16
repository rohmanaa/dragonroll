# Struktur Aset

- `assets/` berisi aset statis dan kode umum yang dipakai lintas halaman atau domain.
- Gunakan `assets/images/`, `assets/audio/{music,sfx}/`, `assets/fonts/`, dan `assets/icons/` untuk aset umum.
- Kode dan CSS bersama berada di `assets/js/` dan `assets/css/`; kode vendor tetap di `assets/js/vendor/`.
- `data/` berisi aset milik satu fitur/domain dengan susunan `css/`, `js/`, `img/`, dan `audio/`.
- Domain: `dice`, `frame`, `power`, `pet`, `karakter`, `aura`, `maps`, `lobby`, dan `tambang`.
- Aset item berada di `data/<domain>/items/<item>/`; akar domain hanya berisi `index.js` bila diperlukan.
- Manifest, model, gambar, dan SFX khusus item tinggal bersama di folder item tersebut.
- Jika aset dipakai dua domain atau lebih, tempatkan di `assets/`, bukan menggandakannya di `data/`.
- Untuk item baru, buat folder `items/<item>/`, tambahkan manifest dan aset item, lalu daftarkan melalui `index.js` domain.
- Perbarui semua referensi path; jangan mengubah ID, harga, atau kunci penyimpanan saat memindahkan aset.
- Setelah perubahan aset, naikkan `VERSION` di `sw.js`, jalankan `python3 tools/gen-preload-manifest.py`, lalu tes.
- `gameplay.html` dan `gameplay/` dibekukan; aset yang dirujuknya tetap di lokasi sampai ada izin khusus.
