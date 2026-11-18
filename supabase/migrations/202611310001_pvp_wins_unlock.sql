-- PVP Clash: kemenangan duel -> membuka item terkunci (Ksatria Mahkota dst.).
-- Terapkan SETELAH 202611190004_server_derived_counters.sql (butuh player_counter_daily, player_stats) dan 202611130001+ (item_catalog, player_inventory).
--
-- Catatan keamanan: duel berjalan di klien, jadi server TIDAK bisa memverifikasi menang. Karena itu:
--   * record_pvp_win() hanya menaikkan counter dengan BATAS HARIAN (WIB), sama pola dengan peti (bump_player_counter);
--   * klien tidak mengirim jumlah/ID item; server membaca aturan buka dari tabel pvp_unlocks;
--   * item hanya masuk inventori lewat claim_pvp_unlock() setelah pvp_wins server >= min_wins.
-- Membuka dengan curang tetap butuh (min_wins / batas harian) hari berbeda; ubah c_cap_daily bila perlu.

alter table public.player_stats add column if not exists pvp_wins int not null default 0 check (pvp_wins >= 0);

-- Katalog server: skin.ksatria (tidak dijual; didapat lewat PVP).
insert into public.item_catalog(id, kind, price_coins, starter, stackable) values
  ('skin.ksatria', 'skin', null, false, false)
on conflict (id) do update set kind = excluded.kind, price_coins = excluded.price_coins, starter = excluded.starter, stackable = excluded.stackable;

-- Aturan buka: item_id -> jumlah kemenangan PVP minimal. Tabel tertutup (hanya lewat RPC).
create table if not exists public.pvp_unlocks (
  item_id  text primary key references public.item_catalog(id),
  min_wins int  not null check (min_wins > 0)
);
alter table public.pvp_unlocks enable row level security;
revoke all on public.pvp_unlocks from anon, authenticated;

insert into public.pvp_unlocks(item_id, min_wins) values
  ('skin.ksatria', 10)
on conflict (item_id) do update set min_wins = excluded.min_wins;

-- ============ record_pvp_win: +1 kemenangan, batas harian ============
create or replace function public.record_pvp_win()
returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  c_cap_daily constant int := 20;   -- kemenangan PVP yang dihitung per hari WIB
  v_uid  uuid := auth.uid();
  v_day  date := (now() at time zone 'Asia/Jakarta')::date;
  v_used int;
  v_val  int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  insert into public.player_stats(user_id) values (v_uid) on conflict (user_id) do nothing;
  insert into public.player_counter_daily(user_id, day, kind) values (v_uid, v_day, 'pvp_wins') on conflict do nothing;
  select total into v_used from public.player_counter_daily
    where user_id = v_uid and day = v_day and kind = 'pvp_wins' for update;   -- serialisasi: batas tidak bisa dilompati paralel

  if v_used >= c_cap_daily then
    select pvp_wins into v_val from public.player_stats where user_id = v_uid;
    return jsonb_build_object('ok', false, 'reason', 'daily_cap', 'cap', c_cap_daily, 'value', v_val);
  end if;

  update public.player_counter_daily set total = total + 1 where user_id = v_uid and day = v_day and kind = 'pvp_wins';
  update public.player_stats set pvp_wins = pvp_wins + 1, updated_at = now() where user_id = v_uid;
  select pvp_wins into v_val from public.player_stats where user_id = v_uid;
  return jsonb_build_object('ok', true, 'value', v_val, 'cap', c_cap_daily);
end;
$$;
revoke all on function public.record_pvp_win() from public, anon;
grant execute on function public.record_pvp_win() to authenticated;

-- ============ claim_pvp_unlock: klaim item yang syaratnya sudah terpenuhi ============
-- Hasil ok     : {ok:true, item, wins}  (sudah dimiliki -> ok dengan already:true, tanpa menulis)
-- Hasil gagal  : tidak-tersedia (ID tak ada di pvp_unlocks) | belum-cukup (dengan wins & min_wins)
create or replace function public.claim_pvp_unlock(p_item_id text)
returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid  uuid := auth.uid();
  v_min  int;
  v_wins int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_item_id is null then return jsonb_build_object('ok', false, 'reason', 'tidak-tersedia'); end if;

  select min_wins into v_min from public.pvp_unlocks where item_id = p_item_id;
  if v_min is null then return jsonb_build_object('ok', false, 'reason', 'tidak-tersedia'); end if;

  insert into public.player_stats(user_id) values (v_uid) on conflict (user_id) do nothing;
  select pvp_wins into v_wins from public.player_stats where user_id = v_uid for update;
  if v_wins < v_min then
    return jsonb_build_object('ok', false, 'reason', 'belum-cukup', 'wins', v_wins, 'min_wins', v_min);
  end if;

  if exists (select 1 from public.player_inventory where user_id = v_uid and item_id = p_item_id) then
    return jsonb_build_object('ok', true, 'already', true, 'item', p_item_id, 'wins', v_wins);
  end if;
  insert into public.player_inventory(user_id, item_id) values (v_uid, p_item_id) on conflict do nothing;
  return jsonb_build_object('ok', true, 'item', p_item_id, 'wins', v_wins);
end;
$$;
revoke all on function public.claim_pvp_unlock(text) from public, anon;
grant execute on function public.claim_pvp_unlock(text) to authenticated;
