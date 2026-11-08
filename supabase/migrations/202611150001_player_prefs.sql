-- Preferensi pemain di server, TAHAP 7b. Terapkan SETELAH 202611140001_buy_set.sql.
--
-- Tujuan: pengaturan (musik, suara, kamera, auto-roll, siang/malam, map & power room, ambience, pengaturan umum)
-- ikut akun ke perangkat lain. Klien (UT.Prefs) tetap menyimpan salinan lokal sebagai cache cepat; server = sumber
-- bersama lintas perangkat.
--
-- Aturan:
--   * Tabel tertutup untuk klien (RLS aktif, semua hak dicabut). Akses HANYA lewat get_my_prefs / set_my_prefs.
--   * set_my_prefs menerima objek JSON, hanya kunci yang ada di daftar putih yang disimpan, ukuran maks 8 KB.
--   * Tidak ada data uang/progres di sini: ini murni preferensi tampilan/perangkat.

create table if not exists public.player_prefs (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  prefs      jsonb not null default '{}'::jsonb
             check (jsonb_typeof(prefs) = 'object' and octet_length(prefs::text) <= 8192),
  updated_at timestamptz not null default now()
);
alter table public.player_prefs enable row level security;
revoke all on public.player_prefs from anon, authenticated;

-- Baca preferensi akun. Return {ok, prefs, updated_at}; akun yang belum pernah menyimpan mendapat prefs = {}.
create or replace function public.get_my_prefs() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_row public.player_prefs;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_row from public.player_prefs where user_id = v_uid;
  return jsonb_build_object('ok', true, 'prefs', coalesce(v_row.prefs, '{}'::jsonb), 'updated_at', v_row.updated_at);
end;
$$;
revoke all on function public.get_my_prefs() from public, anon;
grant execute on function public.get_my_prefs() to authenticated;

-- Simpan (ganti seluruh) preferensi akun. Kunci di luar daftar putih dibuang diam-diam.
create or replace function public.set_my_prefs(p_prefs jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  c_keys  constant text[] := array['settings','musicVol','musicOn','sfxVol','autoDN','night','autoRoll','cam','roomMap','roomPowers','ambience'];
  v_clean jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_prefs is null or jsonb_typeof(p_prefs) <> 'object' then raise exception 'BAD_PREFS'; end if;
  if octet_length(p_prefs::text) > 8192 then raise exception 'PREFS_TOO_LARGE'; end if;
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into v_clean
    from jsonb_each(p_prefs) e where e.key = any (c_keys);
  insert into public.player_prefs(user_id, prefs, updated_at) values (v_uid, v_clean, now())
    on conflict (user_id) do update set prefs = excluded.prefs, updated_at = now();
  return jsonb_build_object('ok', true, 'prefs', v_clean);
end;
$$;
revoke all on function public.set_my_prefs(jsonb) from public, anon;
grant execute on function public.set_my_prefs(jsonb) to authenticated;
