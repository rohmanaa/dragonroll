-- Tambang: seimbangkan ulang ekonomi (Emerald = alat tukar tertinggi, jadi peti kecil dan upgrade mahal).
-- Aman dijalankan walau 202611180001_tambang.sql sudah diterapkan: hanya mengganti fungsi konfigurasi (create or replace).
-- Data pemain tidak diubah; isi peti dibatasi kapasitas baru saat dibaca (least(...) di _mine_stock_now).

create or replace function public._mine_unlock_cost(p_slot int) returns bigint
language sql immutable as $$ select (array[1500, 7500, 30000]::bigint[])[p_slot] $$;            -- Coin buka slot
create or replace function public._mine_cap(p_lv int) returns int
language sql immutable as $$ select (array[5, 8, 12, 16, 20]::int[])[p_lv] $$;                  -- kapasitas peti (Emerald), Lv1 = 5
-- Biaya naik KE level p_to (2..5), dikali faktor slot 1.0 / 1.5 / 2.0
create or replace function public._mine_up_cost(p_kind text, p_slot int, p_to int) returns bigint
language sql immutable as $$
  select round(
    case p_kind when 'speed' then (array[0, 1200, 3500, 9000, 20000]::numeric[])[p_to]
                when 'cap'   then (array[0, 1000, 3000, 7500, 18000]::numeric[])[p_to] end
    * (array[1.0, 1.5, 2.0]::numeric[])[p_slot])::bigint
$$;
create or replace function public._mine_boost_cost(p_slot int) returns bigint
language sql immutable as $$ select (array[400, 600, 900]::bigint[])[p_slot] $$;
