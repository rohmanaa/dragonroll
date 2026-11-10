# Bug: fix or not

Dicentang setelah diperbaiki dan di-push (satu commit per bug). Belum ada yang diuji di perangkat.

- [x] 1. Aura di pion sendiri tidak terlihat lengkap (di pemain lain terlihat) — dugaan penyebab: bidang potong dekat (near) kamera terlalu besar (0,8–5) sehingga memotong aura pion yang diikuti kamera; sekarang 0,4–2. Belum diuji.
- [ ] 2. Outfit, aksesoris, dll. pemain lain tidak terlihat di POV orang lain (hanya diri sendiri)
- [ ] 3. Ledakan TNT di tengah layar (pemain lain dan diri sendiri) dihapus; cukup efek di board, sama seperti Blaze dll.
- [ ] 4. Auto roll jalan saat giliran sedang menaruh TNT di tile
- [ ] 5. Tombol +/- saat menaruh TNT dihapus; tile yang boleh diberi outline hijau, yang tidak boleh tanpa outline (seperti ganjil/genap)
