-- Hati tahap 2: KIRIM HATI KE TEMAN (server-side). Terapkan SETELAH 202611410001_hearts.sql.
--
--   * 1 hati / hari / teman (hari = tanggal Asia/Jakarta); maksimal 25 teman berbeda per hari (batas harian pengirim).
--   * Penerima langsung dapat +1 hati (otomatis, tanpa klaim); boleh melewati 5 (isi ulang otomatis tetap berhenti di 5).
--   * Pengirim dapat fee 1 Emerald. Bila penerima TIDAK AKTIF >= 30 hari: fee 2 Emerald dan ikon hati teman itu EMAS (gold).
--   * "Aktif terakhir" = last_seen_at (disentuh hearts_get / hearts_friends / hearts_consume); pemain yang belum punya jejak
--     memakai auth.users.last_sign_in_at, lalu created_at.
--   Angka ada di _hg_* (satu tempat). Klien tidak pernah mengirim jumlah/fee.

alter table public.player_hearts add column if not exists last_seen_at timestamptz;

create or replace function public._hg_day_limit()  returns int      language sql immutable as $$ select 25 $$;
create or replace function public._hg_fee()        returns int      language sql immutable as $$ select 1 $$;
create or replace function public._hg_fee_gold()   returns int      language sql immutable as $$ select 2 $$;
create or replace function public._hg_dormant()    returns interval language sql immutable as $$ select interval '30 days' $$;
create or replace function public._hg_today()      returns date     language sql stable as $$ select (now() at time zone 'Asia/Jakarta')::date $$;

create table if not exists public.hearts_gifts (
  sender_id   uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  day         date not null,
  gold        boolean not null default false,
  fee_gems    int not null,
  created_at  timestamptz not null default now(),
  primary key (sender_id, receiver_id, day)
);
create index if not exists hearts_gifts_sender_day on public.hearts_gifts(sender_id, day);
alter table public.hearts_gifts enable row level security;
revoke all on public.hearts_gifts from public, anon, authenticated;

-- Terakhir aktif (tanpa menulis).
create or replace function public._hg_last_active(p_user uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select coalesce(greatest(h.last_seen_at, u.last_sign_in_at), h.last_seen_at, u.last_sign_in_at, u.created_at)
    from auth.users u left join public.player_hearts h on h.user_id = u.id
   where u.id = p_user
$$;
create or replace function public._hg_is_dormant(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public._hg_last_active(p_user) < now() - public._hg_dormant(), false)
$$;

-- Sentuh jejak aktif (maks. 1 tulis / jam per pemain).
create or replace function public._hg_touch(p_user uuid) returns void
language sql security definer set search_path = public as $$
  update public.player_hearts set last_seen_at = now()
   where user_id = p_user and (last_seen_at is null or last_seen_at < now() - interval '1 hour')
$$;
revoke all on function public._hg_day_limit(), public._hg_fee(), public._hg_fee_gold(), public._hg_dormant(), public._hg_today(),
  public._hg_last_active(uuid), public._hg_is_dormant(uuid), public._hg_touch(uuid) from public, anon, authenticated;

-- hearts_get / hearts_consume: sama seperti tahap 1 + sentuh jejak aktif.
create or replace function public.hearts_get() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r public.player_hearts;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public._hearts_ensure(v_uid);
  perform public._hg_touch(v_uid);
  select * into r from public.player_hearts where user_id = v_uid;
  return public._hearts_json(r);
end;
$$;
revoke all on function public.hearts_get() from public, anon;
grant execute on function public.hearts_get() to authenticated;

-- Daftar status kirim-hati untuk semua teman: sudah dikirim hari ini? hati emas (penerima tak aktif)?
create or replace function public.hearts_friends() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_day date := public._hg_today(); v_rows jsonb; v_n int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public._hearts_ensure(v_uid);
  perform public._hg_touch(v_uid);
  select count(*) into v_n from public.hearts_gifts where sender_id = v_uid and day = v_day;
  select coalesce(jsonb_agg(jsonb_build_object(
           'friend_id', f.friend_id,
           'sent_today', g.sender_id is not null,
           'gold', public._hg_is_dormant(f.friend_id))), '[]'::jsonb)
    into v_rows
    from public.friendships f
    left join public.hearts_gifts g on g.sender_id = v_uid and g.receiver_id = f.friend_id and g.day = v_day
   where f.user_id = v_uid;
  return jsonb_build_object('ok', true, 'limit', public._hg_day_limit(), 'sent_today', v_n,
                            'fee', public._hg_fee(), 'fee_gold', public._hg_fee_gold(), 'friends', v_rows);
end;
$$;
revoke all on function public.hearts_friends() from public, anon;
grant execute on function public.hearts_friends() to authenticated;

-- Kirim 1 hati ke satu teman. Gagal -> {ok:false, reason: bukan-teman | sudah-dikirim | batas-harian | diri-sendiri}.
create or replace function public.hearts_send(p_friend uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_day date := public._hg_today();
  v_n int; v_gold boolean; v_fee int; r public.player_hearts; v_cur int; v_wallet jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_friend is null or p_friend = v_uid then return jsonb_build_object('ok', false, 'reason', 'diri-sendiri'); end if;
  if not exists (select 1 from public.friendships where user_id = v_uid and friend_id = p_friend) then
    return jsonb_build_object('ok', false, 'reason', 'bukan-teman');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('hearts_send:' || v_uid::text, 0));   -- batas harian tidak bisa dibobol lewat permintaan paralel
  if exists (select 1 from public.hearts_gifts where sender_id = v_uid and receiver_id = p_friend and day = v_day) then
    return jsonb_build_object('ok', false, 'reason', 'sudah-dikirim');
  end if;
  select count(*) into v_n from public.hearts_gifts where sender_id = v_uid and day = v_day;
  if v_n >= public._hg_day_limit() then
    return jsonb_build_object('ok', false, 'reason', 'batas-harian', 'limit', public._hg_day_limit(), 'sent_today', v_n);
  end if;

  v_gold := public._hg_is_dormant(p_friend);
  v_fee  := case when v_gold then public._hg_fee_gold() else public._hg_fee() end;

  -- penerima: +1 hati (normalkan isi ulang dulu supaya hadiah tidak hilang oleh batas 5)
  perform public._hearts_ensure(p_friend);
  select * into r from public.player_hearts where user_id = p_friend for update;
  v_cur := public._hearts_now(r);
  if v_cur >= public._hearts_max() then
    update public.player_hearts set hearts = v_cur + 1, regen_at = now() where user_id = p_friend;
  else
    update public.player_hearts
       set hearts = v_cur + 1, regen_at = r.regen_at + make_interval(secs => (v_cur - r.hearts) * public._hearts_regen_secs())
     where user_id = p_friend;
  end if;

  insert into public.hearts_gifts(sender_id, receiver_id, day, gold, fee_gems) values (v_uid, p_friend, v_day, v_gold, v_fee);
  v_wallet := public._wallet_apply(v_uid, 0, v_fee, 'heart_gift', p_friend::text || ':' || v_day::text);

  return jsonb_build_object('ok', true, 'fee', v_fee, 'gold', v_gold, 'sent_today', v_n + 1,
                            'limit', public._hg_day_limit(), 'gems', v_wallet->'gems');
end;
$$;
revoke all on function public.hearts_send(uuid) from public, anon;
grant execute on function public.hearts_send(uuid) to authenticated;
