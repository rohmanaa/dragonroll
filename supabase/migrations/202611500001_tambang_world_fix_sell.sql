-- Perbaikan: hasil jual memakai kunci 'earned' (bukan 'coins') agar tidak menimpa saldo dompet di JSON keadaan.
-- create or replace: aman dijalankan ulang, hak akses (grant) tetap.

create or replace function public.tambang_sell(p_grp text, p_item text, p_qty int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.tambang_player; cfg jsonb := public._tb_cfg(); price numeric; have bigint; q bigint; c bigint;
begin
  p := public._tb_ensure(uid);
  price := (cfg->'sell'->p_grp->>p_item)::numeric;
  if price is null then return jsonb_build_object('ok', false, 'reason', 'barang-tidak-ada'); end if;
  have := public._tb_bag_get(p.bag, p_grp, p_item);
  q := least(coalesce(p_qty, have), have);
  if q < 1 then return jsonb_build_object('ok', false, 'reason', 'inventori-kosong'); end if;
  c := (price * q)::bigint;
  update public.tambang_player set bag = public._tb_bag_add(bag, p_grp, p_item, -q), sell_n = sell_n + 1, updated_at = now() where user_id = uid returning sell_n into p.sell_n;
  perform public._wallet_apply(uid, c, 0, 'tb_sell', p.sell_n::text);
  return public._tb_state(uid) || jsonb_build_object('sold', q, 'earned', c);
end $$;

create or replace function public.tambang_sell_all() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.tambang_player; cfg jsonb := public._tb_cfg(); grp text; item text; price numeric; have bigint; total bigint := 0; n bigint := 0; b jsonb;
begin
  p := public._tb_ensure(uid); b := p.bag;
  for grp in select jsonb_object_keys(cfg->'sell') loop
    for item, price in select key, value::numeric from jsonb_each_text(cfg->'sell'->grp) loop
      have := public._tb_bag_get(b, grp, item);
      if have > 0 then total := total + (price * have)::bigint; n := n + have; b := public._tb_bag_add(b, grp, item, -have); end if;
    end loop;
  end loop;
  if n < 1 then return jsonb_build_object('ok', false, 'reason', 'inventori-kosong'); end if;
  update public.tambang_player set bag = b, sell_n = sell_n + 1, updated_at = now() where user_id = uid returning sell_n into p.sell_n;
  perform public._wallet_apply(uid, total, 0, 'tb_sell', p.sell_n::text);
  return public._tb_state(uid) || jsonb_build_object('sold', n, 'earned', total);
end $$;
