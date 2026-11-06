-- Dompet server, TAHAP B1 (fondasi). Terapkan SETELAH 202611100004_friend_live_names.sql.
--
-- Tujuan: saldo coins/gems pemain login disimpan SERVER, bukan localStorage, supaya tidak bisa diedit lewat devtools.
-- B1 hanya fondasi: tabel, ledger anti-dobel, fungsi internal, dan RPC BACA. Belum ada RPC yang menambah/mengurangi
-- saldo dari klien (itu B2/B3: beli di toko, reward boss, achievement, daily, misi). Klien lama tetap jalan memakai
-- PlayerData lokal sampai B2 dipasang, jadi migrasi ini aman diterapkan sendirian.
--
-- Aturan:
--   * Klien TIDAK pernah mengirim nominal. Tiap jenis reward punya RPC sendiri (B2+) dengan nominal ditentukan server.
--   * Tiap perubahan saldo = 1 baris ledger dengan kunci unik (user_id, reason, ref_key) -> klaim yang sama tidak bisa dobel.
--   * Saldo tidak boleh negatif; pembelian yang melebihi saldo ditolak dan tidak menulis apa pun.
--   * Saldo awal akun baru: 1000 coins, 0 gems (sama dengan START_COINS/START_GEMS di PlayerData). Saldo lama di
--     localStorage TIDAK diimpor (itu celah); ubah c_start_coins di _wallet_ensure bila kebijakannya berubah.

-- ============ 1. Tabel ============
create table if not exists public.player_wallet (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  coins      bigint not null default 0 check (coins between 0 and 1000000000000),
  gems       bigint not null default 0 check (gems  between 0 and 1000000000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.player_wallet enable row level security;
revoke all on public.player_wallet from anon, authenticated;

create table if not exists public.wallet_ledger (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  delta_coins bigint not null default 0,
  delta_gems  bigint not null default 0,
  reason      text not null check (char_length(reason) between 1 and 40),
  ref_key     text not null check (char_length(ref_key) between 1 and 120),
  coins_after bigint not null,
  gems_after  bigint not null,
  created_at  timestamptz not null default now(),
  unique (user_id, reason, ref_key)
);
create index if not exists wallet_ledger_user_idx on public.wallet_ledger (user_id, id desc);
alter table public.wallet_ledger enable row level security;
revoke all on public.wallet_ledger from anon, authenticated;

-- ============ 2. Fungsi internal (TIDAK bisa dipanggil klien) ============
-- Terapkan perubahan saldo satu kali. Idempoten per (user, reason, ref_key).
-- Return {ok, duplicate, coins, gems}. Raise INSUFFICIENT_COINS / INSUFFICIENT_GEMS bila saldo kurang
-- (exception membatalkan seluruh panggilan, jadi tidak ada ledger yang tertinggal).
create or replace function public._wallet_apply(
  p_user uuid, p_dcoins bigint, p_dgems bigint, p_reason text, p_ref text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_w    public.player_wallet;
  v_rows integer;
  v_nc   bigint;
  v_ng   bigint;
begin
  if p_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_reason is null or p_ref is null then raise exception 'BAD_REF'; end if;

  insert into public.player_wallet(user_id) values (p_user) on conflict (user_id) do nothing;
  select * into v_w from public.player_wallet where user_id = p_user for update;  -- kunci baris: tidak ada balapan

  v_nc := v_w.coins + coalesce(p_dcoins, 0);
  v_ng := v_w.gems  + coalesce(p_dgems, 0);

  insert into public.wallet_ledger(user_id, delta_coins, delta_gems, reason, ref_key, coins_after, gems_after)
  values (p_user, coalesce(p_dcoins, 0), coalesce(p_dgems, 0), p_reason, p_ref, v_nc, v_ng)
  on conflict (user_id, reason, ref_key) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return jsonb_build_object('ok', true, 'duplicate', true, 'coins', v_w.coins, 'gems', v_w.gems);
  end if;

  if v_nc < 0 then raise exception 'INSUFFICIENT_COINS'; end if;
  if v_ng < 0 then raise exception 'INSUFFICIENT_GEMS'; end if;

  update public.player_wallet set coins = v_nc, gems = v_ng, updated_at = now() where user_id = p_user;
  return jsonb_build_object('ok', true, 'duplicate', false, 'coins', v_nc, 'gems', v_ng);
end;
$$;
revoke all on function public._wallet_apply(uuid, bigint, bigint, text, text) from public, anon, authenticated;

-- Buat dompet akun baru dengan saldo awal (sekali; aman dipanggil berulang).
create or replace function public._wallet_ensure(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c_start_coins constant bigint := 1000; c_start_gems constant bigint := 0;
begin
  if not exists (select 1 from public.player_wallet where user_id = p_user) then
    perform public._wallet_apply(p_user, c_start_coins, c_start_gems, 'start', 'start');
  end if;
end;
$$;
revoke all on function public._wallet_ensure(uuid) from public, anon, authenticated;

-- ============ 3. RPC baca untuk klien ============
create or replace function public.wallet_get() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_w public.player_wallet;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public._wallet_ensure(v_uid);
  select * into v_w from public.player_wallet where user_id = v_uid;
  return jsonb_build_object('coins', v_w.coins, 'gems', v_w.gems, 'updated_at', v_w.updated_at);
end;
$$;
revoke all on function public.wallet_get() from public, anon;
grant execute on function public.wallet_get() to authenticated;

create or replace function public.wallet_history(p_limit int default 20) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_lim int := least(greatest(coalesce(p_limit, 20), 1), 100);
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'coins', delta_coins, 'gems', delta_gems, 'reason', reason, 'at', created_at) order by id desc)
    from (select * from public.wallet_ledger where user_id = v_uid order by id desc limit v_lim) t
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.wallet_history(int) from public, anon;
grant execute on function public.wallet_history(int) to authenticated;
