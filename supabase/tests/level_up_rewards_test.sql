-- Tes migrasi 202611300001 (hadiah naik level). Jalankan sebagai superuser di DB UJI yang SUDAH memuat semua migrasi.
\set ON_ERROR_STOP 1
begin;
insert into auth.users(id, created_at) values
  ('bbbbbbbb-0000-0000-0000-000000000001', now()), ('bbbbbbbb-0000-0000-0000-000000000002', now()),
  ('bbbbbbbb-0000-0000-0000-000000000003', now()), ('bbbbbbbb-0000-0000-0000-000000000004', now());
insert into public.player_stats(user_id, level) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 3), ('bbbbbbbb-0000-0000-0000-000000000002', 6), ('bbbbbbbb-0000-0000-0000-000000000004', 5);
-- U2 = pemain lama yang sudah ditandai level 5 (tidak dibayar mundur); U4: baris ledger level 4 sudah ada (klaim ulang tidak boleh ganda)
insert into public.player_level_reward(user_id, last_level) values ('bbbbbbbb-0000-0000-0000-000000000002', 5);
select public._wallet_ensure('bbbbbbbb-0000-0000-0000-000000000004');
select public._wallet_apply('bbbbbbbb-0000-0000-0000-000000000004', 300, 0, 'level_up', '4');
create temp table out(k text, v jsonb); grant all on out to authenticated, anon;

-- rumus murni
do $$ begin
  assert (select coins from public._level_reward(2)) = 200 and (select gems from public._level_reward(2)) = 0, 'L2';
  assert (select coins from public._level_reward(5)) = 350 and (select gems from public._level_reward(5)) = 10, 'L5';
  assert (select coins from public._level_reward(10)) = 1200 and (select gems from public._level_reward(10)) = 25, 'L10 x2 koin, 25 gems';
  assert (select coins from public._level_reward(15)) = 850 and (select gems from public._level_reward(15)) = 10, 'L15';
  assert (select coins from public._level_reward(20)) = 2200 and (select gems from public._level_reward(20)) = 25, 'L20';
end $$;

set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000001',false);
insert into out select 'a1', public.claim_level_rewards();     -- level 1 -> 3: bayar L2 + L3
insert into out select 'a2', public.claim_level_rewards();     -- klaim ulang: tidak ada hadiah
reset role;
do $$ begin
  assert (select jsonb_array_length(v->'levels') from out where k='a1') = 2, 'a1: 2 level (L2, L3)';
  assert (select (v->>'reward_coins')::int from out where k='a1') = 450 and (select (v->>'reward_gems')::int from out where k='a1') = 0, 'a1: 200+250 koin';
  assert (select (v->>'wallet_coins')::int from out where k='a1') = 1450, 'a1: dompet 1000 awal + 450';
  assert (select (v->>'reward_coins')::int from out where k='a2') = 0 and jsonb_array_length((select v->'levels' from out where k='a2')) = 0, 'a2: idempoten';
  assert (select coins from public.player_wallet where user_id='bbbbbbbb-0000-0000-0000-000000000001') = 1450, 'a2: saldo tidak berubah';
  assert (select count(*) from public.wallet_ledger where user_id='bbbbbbbb-0000-0000-0000-000000000001' and reason='level_up') = 2, 'ledger 2 baris';
end $$;

-- lompat jauh L3 -> L10: L4..L10 dibayar, gems dari L5 + L10
update public.player_stats set level = 10 where user_id = 'bbbbbbbb-0000-0000-0000-000000000001';
set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000001',false);
insert into out select 'b1', public.claim_level_rewards();
reset role;
do $$ begin
  assert (select jsonb_array_length(v->'levels') from out where k='b1') = 7, 'b1: 7 level';
  assert (select (v->>'reward_coins')::int from out where k='b1') = 3750, 'b1: 300+350+400+450+500+550+1200';
  assert (select (v->>'reward_gems')::int from out where k='b1') = 35, 'b1: 10 (L5) + 25 (L10)';
  assert (select coins from public.player_wallet where user_id='bbbbbbbb-0000-0000-0000-000000000001') = 5200, 'b1: saldo koin';
  assert (select gems from public.player_wallet where user_id='bbbbbbbb-0000-0000-0000-000000000001') = 35, 'b1: saldo gems';
  assert (select last_level from public.player_level_reward where user_id='bbbbbbbb-0000-0000-0000-000000000001') = 10, 'penanda level 10';
end $$;

-- pemain lama (penanda 5) naik ke 6: hanya L6 yang dibayar
set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000002',false);
insert into out select 'c1', public.claim_level_rewards();
reset role;
do $$ begin
  assert (select jsonb_array_length(v->'levels') from out where k='c1') = 1 and (select (v->>'reward_coins')::int from out where k='c1') = 400, 'c1: hanya L6 = 400';
end $$;

-- tanpa baris player_stats: tidak ada hadiah, tidak ada error, tidak membuat dompet
set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000003',false);
insert into out select 'd1', public.claim_level_rewards();
reset role;
do $$ begin
  assert (select (v->>'ok')::boolean from out where k='d1') and (select (v->>'reward_coins')::int from out where k='d1') = 0, 'd1: tanpa stats -> 0';
  assert not exists (select 1 from public.player_wallet where user_id='bbbbbbbb-0000-0000-0000-000000000003'), 'd1: tidak membuat dompet';
end $$;

-- ledger sudah punya L4 (U4 level 5, penanda default 1): L2,L3,L5 dibayar, L4 dilewati sebagai duplikat -> tidak dobel
set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000004',false);
insert into out select 'e1', public.claim_level_rewards();
reset role;
do $$ begin
  assert (select (v->>'reward_coins')::int from out where k='e1') = 200 + 250 + 350, 'e1: L2+L3+L5, L4 tidak dobel';
  assert (select count(*) from public.wallet_ledger where user_id='bbbbbbbb-0000-0000-0000-000000000004' and reason='level_up' and ref_key='4') = 1, 'e1: L4 satu baris';
  assert (select gems from public.player_wallet where user_id='bbbbbbbb-0000-0000-0000-000000000004') = 10, 'e1: 10 gems L5';
end $$;

-- hak akses: anon tidak boleh memanggil; klien tidak boleh memanggil fungsi internal; klien tidak bisa menulis tabel penanda
do $$ declare v boolean := false; begin
  set local role anon;
  begin perform public.claim_level_rewards(); exception when insufficient_privilege then v := true; end;
  reset role; assert v, 'anon ditolak';
  v := false; set local role authenticated;
  begin perform public._level_reward(5); exception when insufficient_privilege then v := true; end;
  reset role; assert v, '_level_reward tertutup';
  v := false; set local role authenticated;
  begin update public.player_level_reward set last_level = 999; exception when insufficient_privilege then v := true; end;
  reset role; assert v, 'tabel penanda tertutup';
end $$;
-- belum login
do $$ declare v boolean := false; begin
  set local role authenticated; perform set_config('request.jwt.claim.sub','',false);
  begin perform public.claim_level_rewards(); exception when others then v := (sqlerrm = 'AUTH_REQUIRED'); end;
  reset role; assert v, 'tanpa login -> AUTH_REQUIRED';
end $$;
rollback;
select 'level_up_rewards_test OK';
