-- Hati / nyawa (tahap 1, SERVER-SIDE): tiap pemain punya 5 hati, 1 hati terpakai tiap match dimulai (semua mode),
-- terisi lagi otomatis 1 hati per 5 menit sampai penuh (5). Terapkan SETELAH 202611400001_chest_power.sql (hanya butuh auth.users + auth.uid()).
--
--   Isi ulang dihitung MALAS (lazy) dari jam server: tanpa cron. Klien tidak pernah mengirim jumlah/waktu.
--   hearts boleh > 5 (disiapkan untuk hadiah teman/chest di tahap berikutnya): isi ulang otomatis hanya berjalan saat hearts < 5.
--   regen_at = awal hitungan 5 menit berikutnya; saat hati terpakai dari kondisi penuh, hitungan dimulai dari sekarang.
--   Angka ada di _hearts_max() / _hearts_regen_secs() (satu-satunya tempat); hearts_get() mengirimnya ke klien.

create table if not exists public.player_hearts (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  hearts     int not null default 5 check (hearts >= 0),
  regen_at   timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.player_hearts enable row level security;          -- tanpa policy: hanya lewat RPC security definer
revoke all on public.player_hearts from public, anon, authenticated;

create or replace function public._hearts_max() returns int language sql immutable as $$ select 5 $$;
create or replace function public._hearts_regen_secs() returns int language sql immutable as $$ select 300 $$;   -- 1 hati / 5 menit

create or replace function public._hearts_ensure(p_user uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.player_hearts(user_id) values (p_user) on conflict (user_id) do nothing
$$;

-- Jumlah hati SAAT INI (tanpa menulis): stok + isi ulang yang sudah berjalan, dibatasi 5 (kecuali stok memang > 5).
create or replace function public._hearts_now(r public.player_hearts) returns int
language sql stable as $$
  select case when r.hearts >= public._hearts_max() then r.hearts
    else least(public._hearts_max(),
               r.hearts + floor(greatest(extract(epoch from (now() - r.regen_at)), 0) / public._hearts_regen_secs())::int)
  end
$$;

create or replace function public._hearts_json(r public.player_hearts) returns jsonb
language plpgsql stable as $$
declare v_h int := public._hearts_now(r); v_next int;
begin
  if v_h >= public._hearts_max() then v_next := null;
  else v_next := public._hearts_regen_secs()
               - (floor(greatest(extract(epoch from (now() - r.regen_at)), 0))::bigint % public._hearts_regen_secs())::int;
  end if;
  return jsonb_build_object('ok', true, 'hearts', v_h, 'max', public._hearts_max(),
                            'regen_secs', public._hearts_regen_secs(), 'next_in_secs', v_next);
end;
$$;
revoke all on function public._hearts_max(), public._hearts_regen_secs(), public._hearts_ensure(uuid),
  public._hearts_now(public.player_hearts), public._hearts_json(public.player_hearts) from public, anon, authenticated;

create or replace function public.hearts_get() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r public.player_hearts;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public._hearts_ensure(v_uid);
  select * into r from public.player_hearts where user_id = v_uid;
  return public._hearts_json(r);
end;
$$;
revoke all on function public.hearts_get() from public, anon;
grant execute on function public.hearts_get() to authenticated;

-- Potong 1 hati saat match dimulai. Habis -> {ok:false, reason:'hati-habis'} + next_in_secs.
create or replace function public.hearts_consume() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r public.player_hearts; v_cur int; v_gain int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public._hearts_ensure(v_uid);
  select * into r from public.player_hearts where user_id = v_uid for update;
  v_cur := public._hearts_now(r);
  if v_cur < 1 then
    return public._hearts_json(r) || jsonb_build_object('ok', false, 'reason', 'hati-habis');
  end if;
  if v_cur >= public._hearts_max() then
    -- penuh (atau lebih): hitungan 5 menit baru mulai dari sekarang
    update public.player_hearts set hearts = v_cur - 1, regen_at = now() where user_id = v_uid;
  else
    -- sebagian sudah terisi: simpan hasil isi ulang, sisa menit menuju hati berikutnya tetap berjalan
    v_gain := v_cur - r.hearts;
    update public.player_hearts
       set hearts = v_cur - 1, regen_at = r.regen_at + make_interval(secs => v_gain * public._hearts_regen_secs())
     where user_id = v_uid;
  end if;
  select * into r from public.player_hearts where user_id = v_uid;
  return public._hearts_json(r) || jsonb_build_object('consumed', 1);
end;
$$;
revoke all on function public.hearts_consume() from public, anon;
grant execute on function public.hearts_consume() to authenticated;
