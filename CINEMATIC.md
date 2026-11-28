# Lapisan Sinematik (three.js)
File baru: `src/gameplay/js/cinematic.js` (dimuat sebelum `main.js`). Tanpa library tambahan, 100% offline.
Hook di `main.js`: 5 titik kecil (patch MAT, init, look di applyLook, resize, render). Logika game tidak disentuh.

Efek: HDR + MSAA render target, bloom (mip chain), tilt-shift DOF, aberasi kromatik, soft-shoulder tone mapping,
color grading siang/malam/Nether, vinyet, film grain, kubah langit shader (awan, bintang, aurora, bintang jatuh, langit bara),
bayangan awan bergerak, kabut dasar, kilau air, lava menyala, partikel ambient (serbuk sari / kunang-kunang / bara),
cahaya golden-hour + fill dingin, transisi halus siang<->malam, governor kualitas adaptif.

Debug:  `?cine=0` = tampilan lama.  `UT.Cinema.setQuality('high'|'medium'|'low'|'auto')`.
Tuning: fungsi `setLookTargets()` di cinematic.js (exposure, bloom, vinyet, tint, intensitas cahaya per suasana).

## Mode "Doom" (Dragon Awakening)
Saat kayu bingkai papan berubah jadi bedrock (`ARENA.bed` 0 -> 1 di `awakenDragon`), `main.js` memanggil `UT.Cinema.setDoom(nilai)` tiap frame:
- rumput & daun di luar papan layu: pucat, kering, lebih gelap (shader di material voxel)
- asap hitam MENGELILINGI papan di dunia 3D (ring awan sprite, radius ~8-16, ikut paralaks saat kamera diputar); sisi yang menghadap kamera dibuat tipis supaya papan tetap terbaca
- langit/kabut scene lebih gelap & pekat, cahaya meredup kemerahan, saturasi turun, vinyet menguat
- malam: aurora hijau-ungu di bagian atas layar (samar di malam biasa, penuh saat doom)
Uji manual: `UT.Cinema.debugDoom(1)` di console (`debugDoom(null)` untuk kembali otomatis).

## Tile & aurora langit
- Tile papan menyala tipis (napas pelan, lebih terang malam hari); nomor petak ikut menyala tipis (HDR -> bloom).
- Saat bidak MENDARAT di tile (terdeteksi otomatis dari posisi bidak, semua jenis gerakan): tile menyala sebentar + turun ~0.065 unit lalu kembali (seperti tombol keyboard); nomornya ikut turun & menyala. Hanya saat baru diinjak.
  Tekan dilakukan di vertex shader material voxel (uPress), nomor = plane terpisah (LABS di buildLabels).
- Aurora = 7 tirai 3D yang tertambat ke dunia (ring radius 54 di sekeliling papan), bukan overlay layar; bintang = kubah langit + Points. Terlihat saat kamera diturunkan/diputar ke arah langit.
  Malam: sedang; saat Doom: lebih kuat. Tidak muncul di Nether.

