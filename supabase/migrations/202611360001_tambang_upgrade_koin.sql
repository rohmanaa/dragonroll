-- Tambang: UPGRADE (Kecepatan & Peti) dibayar KOIN, bukan Emerald. Buka slot tetap Emerald, Percepat tetap Koin.
-- Terapkan SETELAH 202611280001_economy_phase3_gems.sql. Aman diulang (create or replace); data pemain tidak diubah.
-- Harga koin sengaja mahal (Emerald tetap hasil eksklusif tambang): naik KE Lv2..5, dikali faktor slot 1,0 / 1,5 / 2,0.
--   Lv3 sudah 50.000 (slot 1). Kecepatan: 10.000 / 50.000 / 150.000 / 400.000   Peti: 8.000 / 50.000 / 130.000 / 350.000

create or replace function public._mine_up_cost(p_kind text, p_slot int, p_to int) returns bigint
language sql immutable as $$
  select round(
    case p_kind when 'speed' then (array[0, 10000, 50000, 150000, 400000]::numeric[])[p_to]
                when 'cap'   then (array[0, 8000, 50000, 130000, 350000]::numeric[])[p_to] end
    * (array[1.0, 1.5, 2.0]::numeric[])[p_slot])::bigint
$$;

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
