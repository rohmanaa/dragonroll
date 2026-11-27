-- Tes migrasi 202611520001: hadiah boss CPU nonaktif, peti tanpa XP. Jalankan di DB KOSONG/UJI (psql -v ON_ERROR_STOP=1).
\set ON_ERROR_STOP 1
begin;
insert into auth.users(id) values ('cccccccc-0000-0000-0000-000000000001');
select public._wallet_ensure('cccccccc-0000-0000-0000-000000000001');
select public._wallet_apply('cccccccc-0000-0000-0000-000000000001', 0, 100, 'test', 'seed');
create temp table out(k text, v jsonb);
grant all on out to authenticated;
select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000001',false);
set role authenticated;
insert into out select 'boss', public.claim_cpu_boss_reward('token-12345678');
insert into out select 'buy', public.chest_buy('diamond');
reset role;
do $$ declare s public.player_stats; begin
  assert (select v->>'reason' from out where k='boss') = 'nonaktif', 'boss CPU harus nonaktif';
  assert not exists (select 1 from public.wallet_ledger where user_id='cccccccc-0000-0000-0000-000000000001' and reason='boss_cpu'), 'tidak boleh ada ledger boss_cpu';
  assert (select (v->>'ok')::boolean from out where k='buy') is true, 'beli diamond berhasil';
  assert (select (v->>'xp')::int from out where k='buy') = 0, 'peti tanpa XP';
  select * into s from public.player_stats where user_id='cccccccc-0000-0000-0000-000000000001';
  assert s.xp = 0 and s.chests = 1, 'XP tetap 0, peti tercatat: '||s.xp||'/'||s.chests;
end $$;
rollback;
\echo 'SEMUA SKENARIO LULUS'
