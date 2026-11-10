# Bug: fix or not

Dicentang setelah diperbaiki dan di-push (satu commit per bug). Belum ada yang diuji di perangkat.

- [x] 1. Aura di pion sendiri tidak terlihat lengkap (di pemain lain terlihat) — dugaan penyebab: bidang potong dekat (near) kamera terlalu besar (0,8–5) sehingga memotong aura pion yang diikuti kamera; sekarang 0,4–2. Belum diuji.
- [x] 2. Outfit, aksesoris, dll. pemain lain tidak terlihat di POV orang lain (hanya diri sendiri) — dugaan penyebab: tampilan pemain lain hanya ditarik sekali (bisa usang bila mereka belum selesai mengirim); sekarang ditarik ulang berkala (14x) dan tampilan sendiri dikirim ulang (3x). Belum diuji.
- [x] 3. Ledakan TNT di tengah layar (pemain lain dan diri sendiri) dihapus; cukup efek di board, sama seperti Blaze dll. — jebakan (TNT/Fire Charge/Blaze Core) saat terpicu tidak lagi memanggil overlay tengah layar; diganti ledakan kecil di petak jebakan. Belum diuji.
- [ ] 4. Auto roll jalan saat giliran sedang menaruh TNT di tile
- [ ] 5. Tombol +/- saat menaruh TNT dihapus; tile yang boleh diberi outline hijau, yang tidak boleh tanpa outline (seperti ganjil/genap)
