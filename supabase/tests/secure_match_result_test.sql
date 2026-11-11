-- Tes migrasi 202611100001_secure_match_result.sql. Jalankan sebagai superuser di DB KOSONG/UJI (bukan produksi).
-- Semua assertion memakai `assert`; kegagalan menghentikan skrip (psql -v ON_ERROR_STOP=1).
\set ON_ERROR_STOP 1
begin;
insert into auth.users(id) values
  ('aaaaaaaa-0000-0000-0000-000000000001'), ('aaaaaaaa-0000-0000-0000-000000000002'), ('aaaaaaaa-0000-0000-0000-000000000003'),
  ('aaaaaaaa-0000-0000-0000-000000000004');
-- room selesai: pemenang = pemain index 0 (user 1). user 3 bukan anggota.
insert into public.game_rooms(id, code, host_id, status, players, game_state, revision) values
 ('bbbbbbbb-0000-0000-0000-000000000001','ROOM0001','aaaaaaaa-0000-0000-0000-000000000001','finished',
  '[{"id":"aaaaaaaa-0000-0000-0000-000000000001"},{"id":"aaaaaaaa-0000-0000-0000-000000000002"}]',
  '{"snapshot":{"gameOver":true,"winnerIndex":0,"players":[{"networkId":"aaaaaaaa-0000-0000-0000-000000000001"},{"networkId":"aaaaaaaa-0000-0000-0000-000000000002"}]}}', 9),
 ('bbbbbbbb-0000-0000-0000-000000000002','ROOM0002','aaaaaaaa-0000-0000-0000-000000000001','playing',
  '[{"id":"aaaaaaaa-0000-0000-0000-000000000001"},{"id":"aaaaaaaa-0000-0000-0000-000000000002"}]', '{"snapshot":{"gameOver":false}}', 3),
 -- ROOM0003: selesai tetapi TIDAK ada log event server -> tak terverifikasi (diperlakukan seperti lawan CPU). Pemenang = user 4.
 ('bbbbbbbb-0000-0000-0000-000000000003','ROOM0003','aaaaaaaa-0000-0000-0000-000000000004','finished',
  '[{"id":"aaaaaaaa-0000-0000-0000-000000000004"},{"id":"aaaaaaaa-0000-0000-0000-000000000002"}]',
  '{"snapshot":{"gameOver":true,"winnerIndex":0,"players":[{"networkId":"aaaaaaaa-0000-0000-0000-000000000004"},{"networkId":"aaaaaaaa-0000-0000-0000-000000000002"}]}}', 9);

-- Log event ROOM0001 agar TERVERIFIKASI (syarat migrasi 202611190003: >=16 event roll, >=2 akun berbeda, rentang >=90 dtk).
insert into public.game_events(room_id, seq, player_id, type, created_at)
select 'bbbbbbbb-0000-0000-0000-000000000001', g,
       case when g % 2 = 0 then 'aaaaaaaa-0000-0000-0000-000000000001'::uuid else 'aaaaaaaa-0000-0000-0000-000000000002'::uuid end,
       'roll', now() - interval '10 minutes' + make_interval(secs => g * 10)
from generate_series(1, 20) g;

create temp table out(k text, v jsonb);
grant all on out to authenticated;

-- 1. CPU: klien mengklaim XP 1.000.000 + menang -> XP klien DIABAIKAN; server hanya beri +30 XP (kecil, S5 migrasi 202611190003), 0 poin
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000003',false);
insert into out select 'cpu', public.submit_match_result('cpu-1', true, 'Cpu3', 1000000, null, 'online', 2, '{"dice":10}');
reset role;
do $$ declare s public.player_stats; begin
  select * into s from public.player_stats where user_id='aaaaaaaa-0000-0000-0000-000000000003';
  assert s.xp = 30, 'XP palsu harus diabaikan (server beri +30), dapat '||s.xp;
  assert s.points = 0 and s.week_points = 0, 'CPU tidak boleh dapat poin';
  assert s.plays = 1 and s.wins = 1, 'CPU tetap dihitung main/menang';
  assert (select mode from public.player_match_history where user_id=s.user_id) = 'cpu', 'mode ditentukan server, bukan klien';
end $$;

-- 2. Cepat beruntun (<45 dtk) diabaikan
set role authenticated;
insert into out select 'fast', public.submit_match_result('cpu-2', true, 'Cpu3', 1000000, null, null, 2, null);
reset role;
do $$ begin
  assert (select v->>'ignored' from out where k='fast') = 'too_fast';
  assert (select xp from public.player_stats where user_id='aaaaaaaa-0000-0000-0000-000000000003') = 30;
end $$;

-- 3. Online, room belum selesai -> ditolak (klien boleh coba lagi), statistik tidak berubah
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
set role authenticated;
insert into out select 'notfin', public.submit_match_result('r-1', true, 'P1', 5, 'bbbbbbbb-0000-0000-0000-000000000002', 'online', 2, null);
reset role;
do $$ begin
  assert (select v->>'reason' from out where k='notfin') = 'room_not_finished';
  assert not exists (select 1 from public.player_stats where user_id='aaaaaaaa-0000-0000-0000-000000000001'), 'tidak boleh ada statistik';
end $$;

-- 3b. Online tetapi room TAK terverifikasi (tanpa log event server): XP kecil seperti CPU, 0 poin leaderboard, XP klien diabaikan
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000004',false);
set role authenticated;
insert into out select 'unverified', public.submit_match_result('u-1', true, 'P4', 1000000, 'bbbbbbbb-0000-0000-0000-000000000003', 'online', 2, null);
reset role;
do $$ declare s public.player_stats; begin
  select * into s from public.player_stats where user_id='aaaaaaaa-0000-0000-0000-000000000004';
  assert s.xp = 30 and s.points = 0 and s.week_points = 0, 'room tak terverifikasi harus 30 XP/0 poin, dapat '||s.xp||'/'||s.points;
end $$;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);

-- 4. Room TERVERIFIKASI: pemenang sebenarnya (user 1) mengaku KALAH (p_won=false) -> server tetap catat menang: +120 XP, +100 poin
set role authenticated;
insert into out select 'win', public.submit_match_result('r-2', false, 'P1', 0, 'bbbbbbbb-0000-0000-0000-000000000001', 'online', 2, null);
reset role;
do $$ declare s public.player_stats; begin
  select * into s from public.player_stats where user_id='aaaaaaaa-0000-0000-0000-000000000001';
  assert (select (v->>'won')::boolean from out where k='win') is true;
  assert s.xp = 120 and s.points = 100 and s.wins = 1, 'pemenang online: '||s.xp||'/'||s.points||'/'||s.wins;
end $$;

-- 5. Kirim ulang dengan match_id lain dalam 3 menit -> tidak ganda (45 dtk dilewati dulu agar yang diuji dedupe room)
update public.player_stats set last_match_at = now() - interval '2 minutes' where user_id='aaaaaaaa-0000-0000-0000-000000000001';
set role authenticated;
insert into out select 'dup', public.submit_match_result('r-3', true, 'P1', 0, 'bbbbbbbb-0000-0000-0000-000000000001', 'online', 2, null);
reset role;
do $$ begin
  assert (select (v->>'duplicate')::boolean from out where k='dup') is true;
  assert (select points from public.player_stats where user_id='aaaaaaaa-0000-0000-0000-000000000001') = 100, 'poin tidak boleh ganda';
end $$;

-- 6. Yang kalah (user 2) mengaku MENANG -> server catat kalah: +40 XP, +10 poin, wins tetap 0
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000002',false);
set role authenticated;
insert into out select 'lose', public.submit_match_result('r-4', true, 'P2', 1000000, 'bbbbbbbb-0000-0000-0000-000000000001', 'online', 2, null);
reset role;
do $$ declare s public.player_stats; begin
  select * into s from public.player_stats where user_id='aaaaaaaa-0000-0000-0000-000000000002';
  assert s.xp = 40 and s.points = 10 and s.wins = 0 and s.plays = 1, 'yang kalah: '||s.xp||'/'||s.points||'/'||s.wins;
end $$;

-- 7. Bukan anggota room -> ditolak
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000003',false);
update public.player_stats set last_match_at = now() - interval '2 minutes' where user_id='aaaaaaaa-0000-0000-0000-000000000003';
set role authenticated;
do $$ begin
  begin
    perform public.submit_match_result('r-5', true, 'P3', 0, 'bbbbbbbb-0000-0000-0000-000000000001', 'online', 2, null);
    assert false, 'seharusnya ditolak';
  exception when others then assert sqlerrm like '%ROOM_ACCESS_DENIED%', 'error salah: '||sqlerrm; end;
end $$;
reset role;

-- 8. Leaderboard: user 3 (hanya CPU, 0 poin) tidak tampil; user 1 dan 2 tampil
set role authenticated;
do $$ declare n int; begin
  select count(*) into n from public.get_leaderboard('global', 50);
  assert n = 2, 'leaderboard harus 2 baris, dapat '||n;
  assert not exists (select 1 from public.get_leaderboard('global', 50) where uid = 'aaaaaaaa-0000-0000-0000-000000000003'), 'pemain CPU-saja tidak boleh tampil';
end $$;
reset role;

-- 9. Tanpa login ditolak
select set_config('request.jwt.claim.sub','',false);
set role authenticated;
do $$ begin
  begin perform public.submit_match_result('x', true, 'N', 0, null, null, null, null); assert false;
  exception when others then assert sqlerrm like '%AUTH_REQUIRED%', sqlerrm; end;
end $$;
reset role;

-- 10. anon tidak boleh memanggil
set role anon;
do $$ begin
  begin perform public.submit_match_result('x', true, 'N', 0, null, null, null, null); assert false, 'anon lolos';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
\echo 'SEMUA SKENARIO LULUS (11)'
