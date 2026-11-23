# spa-inv tahap 2: redesain UI Pet (branch spa-inv-pet)

Perubahan: pet.html, pet-page.js, pet-page.css, pet.css, pet-viewer.js, tests/pet-ui.test.js, sw.js (v317).

- Tab Inventory dihapus dari halaman Pet (blok #invtabs di pet-page.js dibuang). Navigasi hanya lewat tombol kembali ke lobby.
- Panel preview kanan diganti modal `#pv` (overlay di dalam #stage, z 60; konfirmasi #md z 70 tetap di atasnya). Viewer 3D (#fpv/#petGl), nama, rarity, deskripsi, tombol info, dan tombol aksi #use pindah ke modal. Tutup: X, klik backdrop, Esc.
- Thumbnail baru: kartu `.pcard` bergaya kartu skin (nama di atas, area gambar bergradien sesuai warna rarity, sparkle, bar bawah). Satu baris, bisa scroll horizontal.
- Ikon mata (inline SVG Phosphor) dan #petInfoOpen tanpa kotak tombol.
- Tombol beli/gunakan/lepas = bar bawah tiap kartu (logika buy/equip/unequip tidak diubah, lewat runAction).
- Saldo emerald + koin dipindah ke kiri bawah.
- pet-viewer.js: tidak render dan tidak memutar suara saat #fpv tersembunyi (modal tertutup), karena sebelumnya suara pet diputar berkala di latar.

Tes: pet-ui, pet-view, pet-catalog, pet-viewer-lifecycle, inventory-tabs, no-webglrenderer-outside-sharedgl, sw-incremental-media lulus.
Catatan: tests/pet-registry-parity.test.js gagal sebelum perubahan ini ("PetViewer IIFE terminator", regex tes belum mengikuti modul PageModule); tidak disentuh.
NOT TESTED: tampilan visual di browser (layout kartu, modal 3D, mobile), alur beli end-to-end dengan server.

## Merge dengan main (45eeb73, panel gaya hub)
Main sudah punya redesain Pet lain (panel #pmodal ala hub Profil, kartu .pc per tier, SW v376). Digabung: dasar = versi main (panel, warna rarity, kartu .pc, ikon mata/info), lalu ditambah dari tahap ini: tanpa bar tab (mountChrome dibuang), preview 3D di modal #pv (klik kartu / ikon mata), bar harga kartu = tombol beli/GUNAKAN/LEPAS, ikon tanpa kotak tombol, grid selebar layar, saldo kiri bawah, viewer berhenti render+suara saat modal tertutup. SW v377.
Tes yang gagal di main juga (bukan dari perubahan ini): aura-view, dice-registry-parity, gameplay-assets-external, lobby-appearance, pet-registry-parity, power-registry-parity.
