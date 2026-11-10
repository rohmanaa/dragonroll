-- Power-up berstok (consumable). Aturan:
--   * Stok = player_inventory.qty milik tiap akun. Power tidak otomatis dimiliki; dibeli per JUMLAH (buy_powerup).
--   * Memilih Loadout di Room TIDAK mengurangi stok. Stok baru berkurang saat Power benar-benar dipakai (use_powerup).
--   * Yang tidak terpakai tidak pernah dipotong, jadi otomatis "kembali" ke Inventory setelah pertandingan.
--   * Skin, Dice, karakter, dll tetap permanen: hanya kind 'powerup' memakai sistem ini.
-- Harga di bawah HARUS sama dengan assets/js/item-catalog.js (klien hanya menampilkan; server yang menagih).
-- Catatan: buy_item lama memakai kunci ledger item#(qty+1); begitu stok bisa berkurang kunci itu bisa bentrok,
-- jadi power-up dibeli lewat buy_powerup dengan ID operasi unik (p_op_id; kirim ulang ID sama tidak menagih dua kali).

update public.item_catalog c set price_coins = v.p
from (values ('feather', 80), ('tnt', 150), ('totem', 200), ('potion_odd', 60), ('potion_even', 60), ('grass', 100),
             ('sword', 120), ('diamond_sword', 250), ('netherite_sword', 450), ('wooden_shield', 90), ('golden_apple', 200),
             ('fire_charge', 120), ('ice_crystal', 250), ('blaze_core', 400), ('trident', 600), ('dragon_crystal', 800),
             ('nether_star', 1000)) as v(id, p)
where c.id = v.id and c.kind = 'powerup';

create table if not exists public.player_powerup_use (
  user_id uuid not null references auth.users(id) on delete cascade,
  use_id  text not null check (length(use_id) between 8 and 80),
  item_id text not null references public.item_catalog(id),
  used_at timestamptz not null default now(),
  primary key (user_id, use_id)
);
create index if not exists player_powerup_use_recent on public.player_powerup_use(user_id, used_at);
alter table public.player_powerup_use enable row level security;
revoke all on public.player_powerup_use from anon, authenticated;

-- Beli N unit power-up (1..99). Stok maksimum 999 per jenis.
create or replace function public.buy_powerup(p_item_id text, p_qty int, p_op_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_it   public.item_catalog;
  v_res  jsonb;
  v_have int;
  v_cost bigint;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_qty is null or p_qty < 1 or p_qty > 99 then
    return jsonb_build_object('ok', false, 'reason', 'jumlah-tidak-valid');
  end if;
  if p_op_id is null or length(p_op_id) < 8 or length(p_op_id) > 60 then
    return jsonb_build_object('ok', false, 'reason', 'op-id-tidak-valid');
  end if;
  select * into v_it from public.item_catalog where id = p_item_id;
  if not found or v_it.kind <> 'powerup' or v_it.price_coins is null then
    return jsonb_build_object('ok', false, 'reason', 'tidak-tersedia');
  end if;

  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;   -- serialisasi beli/pakai/tukar

  select qty into v_have from public.player_inventory where user_id = v_uid and item_id = p_item_id;
  if coalesce(v_have, 0) + p_qty > 999 then
    return jsonb_build_object('ok', false, 'reason', 'stok-penuh', 'qty', coalesce(v_have, 0));
  end if;

  v_cost := v_it.price_coins::bigint * p_qty;
  begin
    v_res := public._wallet_apply(v_uid, -v_cost, 0, 'buy_power', p_item_id || '#' || p_op_id);
  exception when others then
    if sqlerrm = 'INSUFFICIENT_COINS' then
      return jsonb_build_object('ok', false, 'reason', 'saldo-kurang',
        'kurang', v_cost - (select coins from public.player_wallet where user_id = v_uid));
    end if;
    raise;
  end;
  if (v_res ->> 'duplicate')::boolean then   -- op_id sama dikirim ulang: sudah diproses, jangan tambah stok lagi
    return jsonb_build_object('ok', true, 'duplicate', true, 'item', p_item_id, 'qty', coalesce(v_have, 0),
                              'coins', (v_res ->> 'coins')::bigint, 'gems', (v_res ->> 'gems')::bigint);
  end if;

  insert into public.player_inventory(user_id, item_id, qty) values (v_uid, p_item_id, p_qty)
    on conflict (user_id, item_id) do update set qty = public.player_inventory.qty + p_qty;
  return jsonb_build_object('ok', true, 'item', p_item_id, 'bought', p_qty, 'spent', v_cost,
                            'qty', coalesce(v_have, 0) + p_qty,
                            'coins', (v_res ->> 'coins')::bigint, 'gems', (v_res ->> 'gems')::bigint);
end;
$$;
revoke all on function public.buy_powerup(text, int, text) from public, anon;
grant execute on function public.buy_powerup(text, int, text) to authenticated;

-- Pakai 1 unit: stok akun pemanggil -1. use_id unik per pemakaian; kirim ulang use_id sama tidak memotong lagi.
create or replace function public.use_powerup(p_item_id text, p_use_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_it   public.item_catalog;
  v_qty  int;
  v_used public.player_powerup_use;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_use_id is null or length(p_use_id) < 8 or length(p_use_id) > 80 then
    return jsonb_build_object('ok', false, 'reason', 'use-id-tidak-valid');
  end if;
  select * into v_it from public.item_catalog where id = p_item_id;
  if not found or v_it.kind <> 'powerup' then
    return jsonb_build_object('ok', false, 'reason', 'tidak-tersedia');
  end if;

  -- kunci baris stok: dua pemakaian bersamaan untuk item yang sama diproses bergantian
  select qty into v_qty from public.player_inventory where user_id = v_uid and item_id = p_item_id for update;

  select * into v_used from public.player_powerup_use where user_id = v_uid and use_id = p_use_id;
  if found then
    if v_used.item_id <> p_item_id then
      return jsonb_build_object('ok', false, 'reason', 'use-id-dipakai');
    end if;
    return jsonb_build_object('ok', true, 'duplicate', true, 'item', p_item_id, 'qty', coalesce(v_qty, 0));
  end if;

  if v_qty is null then
    return jsonb_build_object('ok', false, 'reason', 'stok-habis', 'qty', 0);
  end if;

  if v_qty <= 1 then
    delete from public.player_inventory where user_id = v_uid and item_id = p_item_id;   -- qty >= 1 (constraint): stok 0 = baris dihapus
    v_qty := 0;
  else
    update public.player_inventory set qty = qty - 1 where user_id = v_uid and item_id = p_item_id;
    v_qty := v_qty - 1;
  end if;
  insert into public.player_powerup_use(user_id, use_id, item_id) values (v_uid, p_use_id, p_item_id);
  delete from public.player_powerup_use where user_id = v_uid and used_at < now() - interval '3 days';
  return jsonb_build_object('ok', true, 'item', p_item_id, 'qty', v_qty);
end;
$$;
revoke all on function public.use_powerup(text, text) from public, anon;
grant execute on function public.use_powerup(text, text) to authenticated;

-- buy_item (satuan, permanen) TIDAK lagi menjual power-up: power-up consumable dibeli per jumlah lewat buy_powerup.
-- (Kunci ledger buy_item = item#(qty+1) akan bentrok begitu stok bisa berkurang.) Selain itu fungsinya sama dengan 202611110002.
create or replace function public.buy_item(p_item_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_it   public.item_catalog;
  v_res  jsonb;
  v_have int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_it from public.item_catalog where id = p_item_id;
  if not found or v_it.starter or v_it.price_coins is null or v_it.kind = 'powerup' then
    return jsonb_build_object('ok', false, 'reason', 'tidak-tersedia');
  end if;

  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;   -- serialisasi: tidak ada beli ganda/balapan

  select qty into v_have from public.player_inventory where user_id = v_uid and item_id = p_item_id;
  if v_have is not null and not v_it.stackable then
    return jsonb_build_object('ok', false, 'reason', 'sudah-dimiliki');
  end if;

  begin
    v_res := public._wallet_apply(v_uid, -v_it.price_coins, 0, 'buy',
               case when v_it.stackable then p_item_id || '#' || (coalesce(v_have, 0) + 1) else p_item_id end);
  exception when others then
    if sqlerrm = 'INSUFFICIENT_COINS' then
      return jsonb_build_object('ok', false, 'reason', 'saldo-kurang',
        'kurang', v_it.price_coins - (select coins from public.player_wallet where user_id = v_uid));
    end if;
    raise;
  end;
  if (v_res ->> 'duplicate')::boolean then
    return jsonb_build_object('ok', false, 'reason', 'sudah-dimiliki');
  end if;

  insert into public.player_inventory(user_id, item_id) values (v_uid, p_item_id)
    on conflict (user_id, item_id) do update set qty = public.player_inventory.qty + 1;
  return jsonb_build_object('ok', true, 'item', p_item_id, 'spent', v_it.price_coins,
                            'coins', (v_res ->> 'coins')::bigint, 'gems', (v_res ->> 'gems')::bigint);
end;
$$;
revoke all on function public.buy_item(text) from public, anon;
grant execute on function public.buy_item(text) to authenticated;
