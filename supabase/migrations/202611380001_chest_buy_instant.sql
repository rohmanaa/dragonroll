-- Chest yang DIBELI di shop langsung terbuka (tanpa timer, tanpa masuk penyimpanan): bayar -> hadiah diundi & dibayar dalam satu transaksi.
-- (Timer + penyimpanan hanya untuk chest yang DIDAPAT: chest harian.) Menggantikan chest_buy dari 202611370001; harga tetap di _chest_shop(), hadiah di _chest_roll().
--   * Dua baris ledger idempoten: 'chest_buy' (kunci 'buy:<id>') = harga, 'chest' (kunci 'collect:<id>') = hadiah. Saldo dicek SEBELUM apa pun dibuat.
--   * Baris player_chest dicatat langsung berstatus 'collected' (source 'shop') sebagai id transaksi; tidak memakai slot penyimpanan (maks 10) maupun slot proses (maks 3).
--   * Menambah player_stats.chests + XP chest, sama seperti mengambil chest harian.
create or replace function public.chest_buy(p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_p record; v_wal public.player_wallet; v_id bigint; v_rw jsonb; v_xp int; v_w jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_p from public._chest_shop() where kind = p_kind;
  if not found then raise exception 'BAD_CHEST_KIND'; end if;
  perform public._wallet_ensure(v_uid);
  select * into v_wal from public.player_wallet where user_id = v_uid for update;

  if v_wal.coins < v_p.coins then return jsonb_build_object('ok', false, 'reason', 'saldo-kurang'); end if;
  if v_wal.gems  < v_p.gems  then return jsonb_build_object('ok', false, 'reason', 'gem-kurang'); end if;

  insert into public.player_chest(user_id, kind, source, status, collected_at)
    values (v_uid, p_kind, 'shop', 'collected', now()) returning id into v_id;

  v_rw := public._chest_roll(p_kind);
  v_xp := (v_rw ->> 'xp')::int;
  perform public._wallet_apply(v_uid, -v_p.coins, -v_p.gems, 'chest_buy', 'buy:' || v_id);
  v_w := public._wallet_apply(v_uid, (v_rw ->> 'coins')::bigint, (v_rw ->> 'gems')::bigint, 'chest', 'collect:' || v_id);

  insert into public.player_stats(user_id) values (v_uid) on conflict (user_id) do nothing;
  update public.player_stats
     set chests = chests + 1, xp = xp + v_xp, level = public.level_from_xp(xp + v_xp), updated_at = now()
   where user_id = v_uid;

  return jsonb_build_object('ok', true, 'kind', p_kind, 'id', v_id, 'price_coins', v_p.coins, 'price_gems', v_p.gems,
           'coins', (v_rw ->> 'coins')::int, 'gems', (v_rw ->> 'gems')::int, 'xp', v_xp,
           'wallet_coins', (v_w ->> 'coins')::bigint, 'wallet_gems', (v_w ->> 'gems')::bigint);
end;
$$;
revoke all on function public.chest_buy(text) from public, anon;
grant execute on function public.chest_buy(text) to authenticated;
