-- Chest TANPA timer: chest di penyimpanan (stored) langsung bisa dibuka & diambil hadiahnya dalam satu langkah.
--   * chest_collect sekarang menerima status 'stored' (dan 'opening' warisan lama, tanpa menunggu open_ready_at).
--   * Syarat klaim harian (jumlah game), batas penyimpanan 10, hadiah (_chest_roll), idempotensi dompet ('collect:<id>'), stat chests/XP tidak berubah.
--   * chest_start / chest_open_now (timer & percepat gem) tidak dipakai lagi oleh klien; dibiarkan agar tidak merusak klien lama.
-- Terapkan SETELAH 202611420001_tos_acceptance.sql (mendefinisi ulang chest_collect dari 202611400001_chest_power.sql).
create or replace function public.chest_collect(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_c public.player_chest; v_rw jsonb; v_w jsonb; v_xp int; v_pw text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;
  select * into v_c from public.player_chest where id = p_id and user_id = v_uid for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'tidak-ada'); end if;
  if v_c.status = 'collected' then return jsonb_build_object('ok', false, 'reason', 'sudah-diambil'); end if;
  if v_c.status not in ('stored', 'opening') then return jsonb_build_object('ok', false, 'reason', 'tidak-ada'); end if;

  v_rw := public._chest_roll(v_c.kind);
  v_xp := (v_rw ->> 'xp')::int;
  v_w := public._wallet_apply(v_uid, (v_rw ->> 'coins')::bigint, (v_rw ->> 'gems')::bigint, 'chest', 'collect:' || p_id);
  if (v_w ->> 'duplicate')::boolean then return jsonb_build_object('ok', false, 'reason', 'sudah-diambil'); end if;

  v_pw := v_rw ->> 'power';
  if v_pw is not null then   -- Power hadiah masuk stok akun (maks 999 per jenis)
    insert into public.player_inventory(user_id, item_id, qty) values (v_uid, v_pw, 1)
      on conflict (user_id, item_id) do update set qty = least(999, public.player_inventory.qty + 1);
  end if;

  update public.player_chest set status = 'collected', collected_at = now() where id = p_id;
  insert into public.player_stats(user_id) values (v_uid) on conflict (user_id) do nothing;
  update public.player_stats
     set chests = chests + 1, xp = xp + v_xp, level = public.level_from_xp(xp + v_xp), updated_at = now()
   where user_id = v_uid;

  return jsonb_build_object('ok', true, 'id', p_id, 'kind', v_c.kind,
           'coins', (v_rw ->> 'coins')::int, 'gems', (v_rw ->> 'gems')::int, 'xp', v_xp, 'power', v_pw,
           'wallet_coins', (v_w ->> 'coins')::bigint, 'wallet_gems', (v_w ->> 'gems')::bigint) || public._chest_json(v_uid);
end;
$$;
revoke all on function public.chest_collect(bigint) from public, anon;
grant execute on function public.chest_collect(bigint) to authenticated;
