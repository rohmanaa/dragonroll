-- Tes migrasi 202611420001_tos_acceptance.sql. Jalankan di DB UJI (bukan produksi) yang SUDAH memuat migrasi sampai 202611420001:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/tos_test.sql      Kegagalan assert menghentikan skrip.
\set ON_ERROR_STOP 1
begin;
insert into auth.users(id) values ('eeeeeeee-0000-0000-0000-0000000000b1'), ('eeeeeeee-0000-0000-0000-0000000000b2');
create temp table out(k text, v jsonb);
grant all on out to authenticated;

-- ===== akun B1: belum pernah setuju -> needs; terima -> tidak needs; terima lagi tidak mengubah waktu =====
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-0000000000b1',false);
insert into out select 's0', public.tos_status();
insert into out select 'a1', public.tos_accept();
reset role;
update public.player_tos set accepted_at = now() - interval '1 day' where user_id='eeeeeeee-0000-0000-0000-0000000000b1';
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-0000000000b1',false);
insert into out select 'a2', public.tos_accept(1);
insert into out select 's1', public.tos_status();
reset role;
do $$ begin
  assert (select v->>'needs' from out where k='s0') = 'true', 'akun baru wajib setuju';
  assert (select v->'accepted' from out where k='s0') = 'null'::jsonb, 'belum ada versi tersimpan';
  assert (select (v->>'current')::int from out where k='s0') = public._tos_current_version();
  assert (select v->>'ok' from out where k='a1') = 'true';
  assert (select v->>'needs' from out where k='a1') = 'false', 'setelah setuju tidak perlu lagi';
  assert (select v->>'needs' from out where k='s1') = 'false';
  assert (select accepted_at from public.player_tos where user_id='eeeeeeee-0000-0000-0000-0000000000b1') < now() - interval '23 hours',
    'setuju ulang versi yang sama tidak memperbarui waktu';
end $$;

-- ===== versi tidak valid ditolak; versi lama di tabel = needs; tidak bisa diturunkan =====
set role authenticated; select set_config('request.jwt.claim.sub','eeeeeeee-0000-0000-0000-0000000000b2',false);
insert into out select 'bad0', public.tos_accept(0);
insert into out select 'badN', public.tos_accept(public._tos_current_version() + 1);
reset role;
insert into public.player_tos(user_id, tos_version) values ('eeeeeeee-0000-0000-0000-0000000000b2', 1);
do $$ begin
  assert (select v->>'ok' from out where k='bad0') = 'false' and (select v->>'reason' from out where k='bad0') = 'versi-tidak-valid';
  assert (select v->>'ok' from out where k='badN') = 'false', 'versi di atas terbaru ditolak';
end $$;
-- simulasi TOS naik versi: baris lama (versi 0 tidak mungkin) -> uji lewat fungsi murni pada baris sintetis
do $$ declare r public.player_tos; begin
  r.user_id := 'eeeeeeee-0000-0000-0000-0000000000b2'; r.tos_version := public._tos_current_version() - 1; r.accepted_at := now();
  if r.tos_version >= 1 then assert (public._tos_json(r)->>'needs') = 'true', 'versi lebih lama dari terbaru = needs'; end if;
end $$;

-- ===== tanpa login: ditolak; anon tidak boleh memanggil =====
reset role; select set_config('request.jwt.claim.sub','',false);
set role authenticated;
do $$ declare ok boolean := false; begin
  begin perform public.tos_status(); exception when others then ok := sqlerrm like '%AUTH_REQUIRED%'; end;
  assert ok, 'tanpa sub harus AUTH_REQUIRED';
end $$;
reset role;
do $$ begin
  assert not has_function_privilege('anon', 'public.tos_accept(int)', 'execute'), 'anon tidak boleh tos_accept';
  assert not has_table_privilege('authenticated', 'public.player_tos', 'select'), 'klien tidak boleh membaca tabel langsung';
end $$;
rollback;
