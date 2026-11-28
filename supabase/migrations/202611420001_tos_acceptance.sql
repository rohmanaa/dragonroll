-- Persetujuan Ketentuan Layanan + Kebijakan Privasi (SERVER-SIDE), satu catatan per akun.
-- Terapkan SETELAH 202611410001_hearts.sql (hanya butuh auth.users + auth.uid()).
--
--   Versi TOS terbaru ada di _tos_current_version() (satu-satunya tempat di server). Naikkan angkanya saat teks TOS/Privasi berubah:
--   semua akun dengan tos_version lebih kecil akan diminta konfirmasi lagi di Lobby. Klien (src/services/tos-service.js) menyimpan
--   salinan angka yang sama (FALLBACK_CURRENT) hanya untuk tamu tanpa akun; tests/tos-service.test.js menjaga keduanya tetap sama.
--   Klien tidak pernah menulis tabel langsung: hanya lewat RPC security definer. Versi tidak bisa diturunkan.

create table if not exists public.player_tos (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  tos_version int not null check (tos_version >= 1),
  accepted_at timestamptz not null default now()
);
alter table public.player_tos enable row level security;           -- tanpa policy: hanya lewat RPC security definer
revoke all on public.player_tos from public, anon, authenticated;

create or replace function public._tos_current_version() returns int language sql immutable as $$ select 1 $$;
revoke all on function public._tos_current_version() from public, anon, authenticated;

create or replace function public._tos_json(r public.player_tos) returns jsonb
language sql stable as $$
  select jsonb_build_object('ok', true,
    'current',     public._tos_current_version(),
    'accepted',    r.tos_version,
    'accepted_at', r.accepted_at,
    'needs',       r.tos_version is null or r.tos_version < public._tos_current_version())
$$;
revoke all on function public._tos_json(public.player_tos) from public, anon, authenticated;

-- Status persetujuan akun yang login. Belum pernah setuju -> accepted null, needs true.
create or replace function public.tos_status() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r public.player_tos;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into r from public.player_tos where user_id = v_uid;
  return public._tos_json(r);
end;
$$;
revoke all on function public.tos_status() from public, anon;
grant execute on function public.tos_status() to authenticated;

-- Catat persetujuan. p_version kosong = versi terbaru. Versi di luar 1..terbaru ditolak. Tidak pernah menurunkan versi tersimpan.
create or replace function public.tos_accept(p_version int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v int; r public.player_tos;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  v := coalesce(p_version, public._tos_current_version());
  if v < 1 or v > public._tos_current_version() then
    return jsonb_build_object('ok', false, 'reason', 'versi-tidak-valid');
  end if;
  insert into public.player_tos(user_id, tos_version) values (v_uid, v)
  on conflict (user_id) do update
    set tos_version = greatest(public.player_tos.tos_version, excluded.tos_version),
        accepted_at = case when excluded.tos_version > public.player_tos.tos_version then now() else public.player_tos.accepted_at end;
  select * into r from public.player_tos where user_id = v_uid;
  return public._tos_json(r);
end;
$$;
revoke all on function public.tos_accept(int) from public, anon;
grant execute on function public.tos_accept(int) to authenticated;

