-- Tambang (penambang emerald pasif), SERVER-SIDE. Terapkan SETELAH 202611150001_player_prefs.sql
-- (butuh dompet B1-B4: _wallet_apply, _wallet_ensure, _wib_today). Spesifikasi: doc/fitur/tambang/TAMBANG.md.
--
--   3 slot per akun. Slot terkunci sampai dibuka dengan Coin. Tiap slot menghasilkan Emerald per jam ke "peti" (kapasitas terbatas).
--   Produksi dihitung MALAS (lazy) dari jam server: tidak butuh cron. Klien tidak pernah mengirim nominal/waktu.
--   Collect memindahkan bagian BULAT isi peti ke dompet lewat _wallet_apply (ledger idempoten); pecahan tetap di peti.
--   Semua angka ekonomi ada di fungsi _mine_* di bawah (satu-satunya tempat); mine_get() mengirimnya ke klien.

-- ============ 1. Tabel ============
create table if not exists public.player_mines (
  user_id     uuid not null references auth.users(id) on delete cascade,
  slot        smallint not null check (slot between 1 and 3),
  speed_lv    smallint not null default 1 check (speed_lv between 1 and 5),
  cap_lv      smallint not null default 1 check (cap_lv between 1 and 5),
  stock       numeric(12,4) not null default 0 check (stock >= 0),   -- isi peti saat stock_at
  stock_at    timestamptz not null default now(),
  boost_until timestamptz,
  boost_day   date,                                                  -- hari WIB penghitung boost_count
  boost_count smallint not null default 0,
  boost_seq   int not null default 0,                                -- total boost seumur akun (kunci ledger unik)
  collect_seq int not null default 0,                                -- total collect seumur slot (kunci ledger unik)
  created_at  timestamptz not null default now(),
  primary key (user_id, slot)
);
alter table public.player_mines enable row level security;           -- tanpa policy: hanya lewat RPC security definer
revoke all on public.player_mines from public, anon, authenticated;

-- ============ 2. Konfigurasi ekonomi (ubah angka DI SINI) ============
create or replace function public._mine_base_rate(p_slot int) returns numeric
language sql immutable as $$ select (array[0.20, 0.30, 0.50]::numeric[])[p_slot] $$;            -- Emerald/jam Lv1
create or replace function public._mine_unlock_cost(p_slot int) returns bigint
language sql immutable as $$ select (array[500, 2500, 10000]::bigint[])[p_slot] $$;             -- Coin buka slot
create or replace function public._mine_speed_mult(p_lv int) returns numeric
language sql immutable as $$ select (array[1.00, 1.25, 1.50, 1.75, 2.00]::numeric[])[p_lv] $$;
create or replace function public._mine_cap(p_lv int) returns int
language sql immutable as $$ select (array[15, 20, 25, 30, 40]::int[])[p_lv] $$;                -- kapasitas peti (Emerald)
-- Biaya naik KE level p_to (2..5), dikali faktor slot 1.0 / 1.5 / 2.0
create or replace function public._mine_up_cost(p_kind text, p_slot int, p_to int) returns bigint
language sql immutable as $$
  select round(
    case p_kind when 'speed' then (array[0, 400, 1000, 2500, 6000]::numeric[])[p_to]
                when 'cap'   then (array[0, 300,  800, 2000, 5000]::numeric[])[p_to] end
    * (array[1.0, 1.5, 2.0]::numeric[])[p_slot])::bigint
$$;
create or replace function public._mine_boost_cost(p_slot int) returns bigint
language sql immutable as $$ select (array[150, 200, 300]::bigint[])[p_slot] $$;
create or replace function public._mine_boost_mult() returns numeric language sql immutable as $$ select 2::numeric $$;
create or replace function public._mine_boost_secs() returns int     language sql immutable as $$ select 4 * 3600 $$;
create or replace function public._mine_boost_daily() returns int    language sql immutable as $$ select 2 $$;   -- per slot per hari WIB
revoke all on function public._mine_base_rate(int), public._mine_unlock_cost(int), public._mine_speed_mult(int), public._mine_cap(int),
  public._mine_up_cost(text, int, int), public._mine_boost_cost(int), public._mine_boost_mult(), public._mine_boost_secs(),
  public._mine_boost_daily() from public, anon, authenticated;

-- ============ 3. Hitung isi peti SAAT INI (tanpa menulis) ============
-- stock + laju x jam; jam di dalam boost dihitung boost_mult kali; dibatasi kapasitas.
create or replace function public._mine_stock_now(r public.player_mines) returns numeric
language plpgsql stable as $$
declare
  v_rate  numeric := public._mine_base_rate(r.slot) * public._mine_speed_mult(r.speed_lv);
  v_cap   numeric := public._mine_cap(r.cap_lv);
  v_h     numeric := greatest(extract(epoch from (now() - r.stock_at)) / 3600.0, 0);
  v_bh    numeric := 0;
begin
  if r.boost_until is not null and r.boost_until > r.stock_at then
    v_bh := greatest(extract(epoch from (least(r.boost_until, now()) - r.stock_at)) / 3600.0, 0);
  end if;
  return round(least(v_cap, r.stock + v_rate * (v_h + v_bh * (public._mine_boost_mult() - 1))), 4);
end;
$$;
revoke all on function public._mine_stock_now(public.player_mines) from public, anon, authenticated;

-- ============ 4. JSON satu slot untuk klien ============
create or replace function public._mine_slot_json(p_user uuid, p_slot int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r        public.player_mines;
  v_stock  numeric; v_cap numeric; v_rate numeric; v_mult numeric := public._mine_boost_mult();
  v_left   int := 0;            -- sisa detik boost
  v_full   int;                 -- detik sampai peti penuh
  v_gain   numeric; v_used int := 0;
begin
  select * into r from public.player_mines where user_id = p_user and slot = p_slot;
  if not found then
    return jsonb_build_object('slot', p_slot, 'unlocked', false, 'unlock_cost', public._mine_unlock_cost(p_slot),
                              'base_rate', public._mine_base_rate(p_slot));
  end if;
  v_stock := public._mine_stock_now(r);
  v_cap   := public._mine_cap(r.cap_lv);
  v_rate  := public._mine_base_rate(p_slot) * public._mine_speed_mult(r.speed_lv);
  if r.boost_until is not null and r.boost_until > now() then
    v_left := ceil(extract(epoch from (r.boost_until - now())))::int;
  end if;
  if r.boost_day = public._wib_today() then v_used := r.boost_count; end if;

  if v_stock >= v_cap then v_full := 0;
  elsif v_left > 0 then
    v_gain := v_rate * v_mult * v_left / 3600.0;                   -- hasil sampai boost berakhir
    if v_cap - v_stock <= v_gain then v_full := ceil((v_cap - v_stock) / (v_rate * v_mult) * 3600)::int;
    else v_full := v_left + ceil((v_cap - v_stock - v_gain) / v_rate * 3600)::int; end if;
  else v_full := ceil((v_cap - v_stock) / v_rate * 3600)::int;
  end if;

  return jsonb_build_object(
    'slot', p_slot, 'unlocked', true,
    'speed_lv', r.speed_lv, 'cap_lv', r.cap_lv,
    'rate', v_rate, 'rate_now', case when v_left > 0 then v_rate * v_mult else v_rate end,
    'cap', v_cap, 'stock', v_stock, 'collectable', floor(v_stock)::int, 'full_in_secs', v_full,
    'next_speed_cost', case when r.speed_lv < 5 then public._mine_up_cost('speed', p_slot, r.speed_lv + 1) end,
    'next_cap_cost',   case when r.cap_lv   < 5 then public._mine_up_cost('cap',   p_slot, r.cap_lv   + 1) end,
    'boost', jsonb_build_object('active', v_left > 0, 'left_secs', v_left, 'cost', public._mine_boost_cost(p_slot),
                                'left_today', greatest(public._mine_boost_daily() - v_used, 0))
  );
end;
$$;
revoke all on function public._mine_slot_json(uuid, int) from public, anon, authenticated;

-- ============ 5. RPC ============
create or replace function public.mine_get() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_w public.player_wallet; v_slots jsonb := '[]'::jsonb; i int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public._wallet_ensure(v_uid);
  select * into v_w from public.player_wallet where user_id = v_uid;
  for i in 1..3 loop v_slots := v_slots || jsonb_build_array(public._mine_slot_json(v_uid, i)); end loop;
  return jsonb_build_object('ok', true, 'coins', v_w.coins, 'gems', v_w.gems, 'slots', v_slots,
    'config', jsonb_build_object('boost_mult', public._mine_boost_mult(), 'boost_secs', public._mine_boost_secs(),
                                 'boost_daily', public._mine_boost_daily(), 'max_speed_lv', 5, 'max_cap_lv', 5));
end;
$$;
revoke all on function public.mine_get() from public, anon;
grant execute on function public.mine_get() to authenticated;

create or replace function public.mine_unlock(p_slot int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_cost bigint; v_coins bigint; v_res jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_slot is null or p_slot not between 1 and 3 then return jsonb_build_object('ok', false, 'reason', 'slot-tidak-valid'); end if;
  perform public._wallet_ensure(v_uid);
  select coins into v_coins from public.player_wallet where user_id = v_uid for update;   -- serialisasi semua aksi tambang akun ini
  if exists (select 1 from public.player_mines where user_id = v_uid and slot = p_slot) then
    return jsonb_build_object('ok', false, 'reason', 'sudah-dibuka');
  end if;
  v_cost := public._mine_unlock_cost(p_slot);
  if v_coins < v_cost then return jsonb_build_object('ok', false, 'reason', 'saldo-kurang', 'butuh', v_cost, 'coins', v_coins); end if;
  v_res := public._wallet_apply(v_uid, -v_cost, 0, 'mine_unlock', 'slot:' || p_slot);
  insert into public.player_mines(user_id, slot) values (v_uid, p_slot);
  return v_res || jsonb_build_object('slot_data', public._mine_slot_json(v_uid, p_slot));
end;
$$;
revoke all on function public.mine_unlock(int) from public, anon;
grant execute on function public.mine_unlock(int) to authenticated;

create or replace function public.mine_upgrade(p_slot int, p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r public.player_mines; v_coins bigint; v_lv int; v_cost bigint; v_res jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_slot is null or p_slot not between 1 and 3 then return jsonb_build_object('ok', false, 'reason', 'slot-tidak-valid'); end if;
  if p_kind is null or p_kind not in ('speed', 'cap') then return jsonb_build_object('ok', false, 'reason', 'jenis-tidak-valid'); end if;
  perform public._wallet_ensure(v_uid);
  select coins into v_coins from public.player_wallet where user_id = v_uid for update;
  select * into r from public.player_mines where user_id = v_uid and slot = p_slot for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'terkunci'); end if;
  v_lv := case p_kind when 'speed' then r.speed_lv else r.cap_lv end;
  if v_lv >= 5 then return jsonb_build_object('ok', false, 'reason', 'level-maks'); end if;
  v_cost := public._mine_up_cost(p_kind, p_slot, v_lv + 1);
  if v_coins < v_cost then return jsonb_build_object('ok', false, 'reason', 'saldo-kurang', 'butuh', v_cost, 'coins', v_coins); end if;
  v_res := public._wallet_apply(v_uid, -v_cost, 0, 'mine_upgrade', 'slot:' || p_slot || ':' || p_kind || ':' || (v_lv + 1));
  -- selesaikan produksi dengan laju LAMA sampai sekarang, baru ganti level
  update public.player_mines set
    stock = public._mine_stock_now(r), stock_at = now(),
    speed_lv = case when p_kind = 'speed' then v_lv + 1 else speed_lv end,
    cap_lv   = case when p_kind = 'cap'   then v_lv + 1 else cap_lv end
  where user_id = v_uid and slot = p_slot;
  return v_res || jsonb_build_object('slot_data', public._mine_slot_json(v_uid, p_slot));
end;
$$;
revoke all on function public.mine_upgrade(int, text) from public, anon;
grant execute on function public.mine_upgrade(int, text) to authenticated;

create or replace function public.mine_boost(p_slot int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r public.player_mines; v_coins bigint; v_cost bigint; v_today date := public._wib_today();
        v_used int; v_res jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_slot is null or p_slot not between 1 and 3 then return jsonb_build_object('ok', false, 'reason', 'slot-tidak-valid'); end if;
  perform public._wallet_ensure(v_uid);
  select coins into v_coins from public.player_wallet where user_id = v_uid for update;
  select * into r from public.player_mines where user_id = v_uid and slot = p_slot for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'terkunci'); end if;
  if r.boost_until is not null and r.boost_until > now() then return jsonb_build_object('ok', false, 'reason', 'boost-aktif'); end if;
  v_used := case when r.boost_day = v_today then r.boost_count else 0 end;
  if v_used >= public._mine_boost_daily() then
    return jsonb_build_object('ok', false, 'reason', 'batas-harian', 'seconds_to_reset', public._secs_to_wib_reset());
  end if;
  v_cost := public._mine_boost_cost(p_slot);
  if v_coins < v_cost then return jsonb_build_object('ok', false, 'reason', 'saldo-kurang', 'butuh', v_cost, 'coins', v_coins); end if;
  v_res := public._wallet_apply(v_uid, -v_cost, 0, 'mine_boost', 'slot:' || p_slot || ':b:' || (r.boost_seq + 1));
  update public.player_mines set
    stock = public._mine_stock_now(r), stock_at = now(),
    boost_until = now() + make_interval(secs => public._mine_boost_secs()),
    boost_day = v_today, boost_count = v_used + 1, boost_seq = r.boost_seq + 1
  where user_id = v_uid and slot = p_slot;
  return v_res || jsonb_build_object('slot_data', public._mine_slot_json(v_uid, p_slot));
end;
$$;
revoke all on function public.mine_boost(int) from public, anon;
grant execute on function public.mine_boost(int) to authenticated;

create or replace function public.mine_collect(p_slot int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r public.player_mines; v_stock numeric; v_n bigint; v_seq int; v_res jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_slot is null or p_slot not between 1 and 3 then return jsonb_build_object('ok', false, 'reason', 'slot-tidak-valid'); end if;
  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;
  select * into r from public.player_mines where user_id = v_uid and slot = p_slot for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'terkunci'); end if;
  v_stock := public._mine_stock_now(r);
  v_n := floor(v_stock);
  if v_n < 1 then return jsonb_build_object('ok', false, 'reason', 'peti-kosong', 'slot_data', public._mine_slot_json(v_uid, p_slot)); end if;
  v_seq := r.collect_seq + 1;
  v_res := public._wallet_apply(v_uid, 0, v_n, 'mine_collect', 'slot:' || p_slot || ':' || v_seq);
  update public.player_mines set stock = v_stock - v_n, stock_at = now(), collect_seq = v_seq
  where user_id = v_uid and slot = p_slot;
  return v_res || jsonb_build_object('collected', v_n, 'slot_data', public._mine_slot_json(v_uid, p_slot));
end;
$$;
revoke all on function public.mine_collect(int) from public, anon;
grant execute on function public.mine_collect(int) to authenticated;
