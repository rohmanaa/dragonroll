-- Beli SET gear atomik (tahap c). Terapkan SETELAH 202611130001_player_outfits.sql
-- (butuh item_catalog, player_inventory, _wallet_apply, _wallet_ensure dari B1/B2).
--
-- buy_set(p_item_ids text[]): server menghitung total dari item_catalog, memotong koin SEKALI, dan memasukkan
-- semua item belum-dimiliki dalam SATU transaksi. Semua berhasil atau semua gagal; klien tidak mengirim harga.
-- Pola mengikuti buy_item: kunci baris dompet, _wallet_apply untuk ledger, alasan penolakan sama.
--
-- Hasil ok  : {ok:true, items:[id baru], skipped:[id sudah dimiliki], spent, coins, gems}
--             semua sudah dimiliki -> ok dengan spent 0 dan items [] (tidak ada ledger).
-- Hasil gagal (tidak menulis apa pun):
--   tidak-tersedia : daftar kosong/null, elemen null, id tak dikenal, bukan gear, item starter, tanpa harga.
--                    SATU item tidak dijual menolak SELURUH set (bukan beli sebagian).
--   terlalu-banyak : > 20 id unik (dihitung setelah id berulang digabung) atau > 200 elemen mentah.
--   saldo-kurang   : total item belum dimiliki > koin, dengan nilai 'kurang'.
-- Urutan pemeriksaan (ditiru persis oleh PlayerData.purchaseSet di klien untuk tamu):
--   kosong/null -> elemen mentah > 200 -> elemen null -> gabung id, unik > 20 -> validitas katalog -> kepemilikan -> saldo.
-- Ledger: satu baris reason 'buy_set', ref_key 'set:' || md5(id baru terurut) -> retry set yang sama tidak menagih dua kali.

create or replace function public.buy_set(p_item_ids text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c_max_unique constant int := 20;
  c_max_raw    constant int := 200;
  v_uid    uuid := auth.uid();
  v_ids    text[];
  v_good   int;
  v_new    text[];
  v_skip   text[];
  v_total  bigint;
  v_coins  bigint;
  v_gems   bigint;
  v_res    jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  if p_item_ids is null or cardinality(p_item_ids) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'tidak-tersedia');
  end if;
  if cardinality(p_item_ids) > c_max_raw then
    return jsonb_build_object('ok', false, 'reason', 'terlalu-banyak');
  end if;
  if exists (select 1 from unnest(p_item_ids) x where x is null) then
    return jsonb_build_object('ok', false, 'reason', 'tidak-tersedia');
  end if;

  -- id berulang digabung (anti-dobel)
  select array_agg(distinct x order by x) into v_ids from unnest(p_item_ids) x;
  if cardinality(v_ids) > c_max_unique then
    return jsonb_build_object('ok', false, 'reason', 'terlalu-banyak');
  end if;

  -- semua id harus gear yang dijual
  select count(*) into v_good from public.item_catalog
    where id = any(v_ids) and kind = 'gear' and not starter and not stackable and price_coins is not null;
  if v_good <> cardinality(v_ids) then
    return jsonb_build_object('ok', false, 'reason', 'tidak-tersedia');
  end if;

  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;   -- kunci dompet DULU, baru baca kepemilikan

  select coalesce(array_agg(id order by id), '{}') into v_skip
    from public.item_catalog c
    where c.id = any(v_ids) and exists (select 1 from public.player_inventory i where i.user_id = v_uid and i.item_id = c.id);
  select coalesce(array_agg(id order by id), '{}') into v_new
    from public.item_catalog c
    where c.id = any(v_ids) and not (c.id = any(v_skip));

  select coins, gems into v_coins, v_gems from public.player_wallet where user_id = v_uid;

  if cardinality(v_new) = 0 then
    return jsonb_build_object('ok', true, 'items', '[]'::jsonb, 'skipped', to_jsonb(v_skip), 'spent', 0,
                              'coins', v_coins, 'gems', v_gems);
  end if;

  select sum(price_coins) into v_total from public.item_catalog where id = any(v_new);
  if v_coins < v_total then
    return jsonb_build_object('ok', false, 'reason', 'saldo-kurang', 'kurang', v_total - v_coins);
  end if;

  v_res := public._wallet_apply(v_uid, -v_total, 0, 'buy_set', 'set:' || md5(array_to_string(v_new, ',')));
  if (v_res ->> 'duplicate')::boolean then
    return jsonb_build_object('ok', false, 'reason', 'sudah-dimiliki');
  end if;

  insert into public.player_inventory(user_id, item_id)
    select v_uid, unnest(v_new)
    on conflict (user_id, item_id) do nothing;

  return jsonb_build_object('ok', true, 'items', to_jsonb(v_new), 'skipped', to_jsonb(v_skip), 'spent', v_total,
                            'coins', (v_res ->> 'coins')::bigint, 'gems', (v_res ->> 'gems')::bigint);
end;
$$;
revoke all on function public.buy_set(text[]) from public, anon;
grant execute on function public.buy_set(text[]) to authenticated;
