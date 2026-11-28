-- Chest di shop HANYA bisa dibeli dengan EMERALD (gem). Menggantikan _chest_shop() dari 202611370001 (sebelumnya Kayu/Perak/Emas dibeli dengan koin).
--   Harga (gem):   Kayu 2 | Perak 5 | Emas 12 | Diamond 25     (kurs shop ~50 koin per gem)
--   Rata-rata hadiah (koin-setara, termasuk Power & gem): Kayu ~82 | Perak ~222 | Emas ~504 | Diamond ~1400 -> Kayu/Perak/Emas sedikit di bawah harga (sink gem),
--   Diamond sedikit di atas (sengaja, hadiah dibesarkan). Ubah angka HANYA di sini + CHESTS di assets/js/pages/shop-page.js (ada tes yang menjaga keduanya sama).
-- chest_buy tidak berubah: sudah memeriksa gem & koin dari _chest_shop() sebelum chest dibuat (kolom coins kini 0 -> tidak pernah memotong koin).
create or replace function public._chest_shop() returns table(kind text, coins int, gems int)
language sql immutable as $$
  select * from (values
    ('wood',     0,  2),
    ('silver',   0,  5),
    ('gold',     0, 12),
    ('diamond',  0, 25)
  ) v(kind, coins, gems)
$$;
revoke all on function public._chest_shop() from public, anon, authenticated;
