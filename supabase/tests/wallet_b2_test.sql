-- Tes migrasi 202611110002_wallet_b2_server.sql. Jalankan sebagai superuser di DB UJI (bukan produksi)
-- yang SUDAH memuat semua migrasi sampai 202611110002 (butuh game_rooms, achievement_defs, is_game_room_member).
-- Semua assertion memakai `assert`; kegagalan menghentikan skrip (psql -v ON_ERROR_STOP=1).
\set ON_ERROR_STOP 1
begin;
insert into auth.users(id) values
  ('aaaaaaaa-0000-0000-0000-000000000001'), ('aaaaaaaa-0000-0000-0000-000000000002'), ('aaaaaaaa-0000-0000-0000-000000000003');
create temp table out(k text, v jsonb);
grant all on out to authenticated;
-- harga diambil dari katalog server (harga sengaja dinaikkan di migrasi ekonomi), bukan di-hardcode
insert into out select 'p_rumput', to_jsonb(price_coins) from public.item_catalog where id='dice.rumput';
insert into out select 'p_emas',   to_jsonb(price_coins) from public.item_catalog where id='dice.emas';
insert into out select 'p_tnt',    to_jsonb(price_coins) from public.item_catalog where id='dice.tnt';
select public._wallet_ensure('aaaaaaaa-0000-0000-0000-000000000001');   -- saldo awal 1000

-- ===== BELI =====
insert into out select 'starter_id', to_jsonb(id) from public.item_catalog where starter limit 1;
insert into out select 'powerup_id', to_jsonb(id) from public.item_catalog where kind='powerup' limit 1;
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
insert into out select 'buy1', public.buy_item('dice.rumput');          -- harga dari katalog
insert into out select 'buy1again', public.buy_item('dice.rumput');     -- sudah dimiliki
insert into out select 'starter', public.buy_item((select v #>> '{}' from out where k='starter_id')); -- starter tidak dijual
reset role;
do $$ begin
  assert (select v->>'ok' from out where k='buy1') = 'true', 'beli sah harus ok';
  assert (select (v->>'coins')::int from out where k='buy1') = 1000 - (select (v#>>'{}')::int from out where k='p_rumput'), 'saldo harus 1000 - harga dice.rumput';
  assert (select v->>'reason' from out where k='buy1again') = 'sudah-dimiliki', 'beli ulang non-stackable ditolak';
  assert (select coins from public.player_wallet where user_id='aaaaaaaa-0000-0000-0000-000000000001') = 1000 - (select (v#>>'{}')::int from out where k='p_rumput'), 'beli ulang tidak boleh memotong saldo';
  assert (select qty from public.player_inventory where user_id='aaaaaaaa-0000-0000-0000-000000000001' and item_id='dice.rumput') = 1;
  assert (select v->>'reason' from out where k='starter') = 'tidak-tersedia', 'item starter tidak dijual';
end $$;

set role authenticated;
insert into out select 'unknown', public.buy_item('dice.tidak-ada');
insert into out select 'powerup', public.buy_item((select v #>> '{}' from out where k='powerup_id')); -- power-up: ditolak buy_item
reset role;
do $$ begin
  assert (select v->>'reason' from out where k='unknown') = 'tidak-tersedia';
  assert (select v->>'reason' from out where k='powerup') = 'tidak-tersedia', 'power-up tidak dijual lewat buy_item (dibeli per jumlah via buy_powerup, lihat powerup_stock_test)';
end $$;

-- saldo kurang: saldo disetel tepat = harga dice.emas -> sisa 0, lalu dice.tnt ditolak dengan kurang = harga tnt
update public.player_wallet set coins = (select (v#>>'{}')::bigint from out where k='p_emas') where user_id='aaaaaaaa-0000-0000-0000-000000000001';
set role authenticated;
insert into out select 'gold', public.buy_item('dice.emas');
insert into out select 'short', public.buy_item('dice.tnt');
reset role;
do $$ begin
  assert (select v->>'ok' from out where k='gold') = 'true' and (select (v->>'coins')::int from out where k='gold') = 0, 'saldo habis tepat 0';
  assert (select v->>'reason' from out where k='short') = 'saldo-kurang';
  assert (select (v->>'kurang')::int from out where k='short') = (select (v#>>'{}')::int from out where k='p_tnt'), 'kurang harus = harga dice.tnt';
  assert not exists (select 1 from public.player_inventory where user_id='aaaaaaaa-0000-0000-0000-000000000001' and item_id='dice.tnt'), 'item tidak boleh masuk saat gagal';
  assert (select coins from public.player_wallet where user_id='aaaaaaaa-0000-0000-0000-000000000001') = 0;
end $$;

-- klien tidak bisa menyentuh tabel baru, dan tidak bisa mengubah harga
set role authenticated;
do $$ begin
  begin perform 1 from public.player_inventory; assert false, 'select inventory harus ditolak'; exception when insufficient_privilege then null; end;
  begin update public.item_catalog set price_coins = 1; assert false, 'ubah harga harus ditolak'; exception when insufficient_privilege then null; end;
  begin insert into public.player_inventory(user_id,item_id) values ('aaaaaaaa-0000-0000-0000-000000000001','dice.tnt'); assert false, 'insert inventory harus ditolak'; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ===== HADIAH BOSS =====
insert into public.game_rooms(id, code, host_id, status, players, game_state, revision) values
 ('bbbbbbbb-0000-0000-0000-000000000001','BOSS0001','aaaaaaaa-0000-0000-0000-000000000001','finished',
  '[{"id":"aaaaaaaa-0000-0000-0000-000000000001"},{"id":"aaaaaaaa-0000-0000-0000-000000000002"}]',
  '{"snapshot":{"gameOver":true,"winnerIndex":1,"players":[{"networkId":"aaaaaaaa-0000-0000-0000-000000000001"},{"networkId":"aaaaaaaa-0000-0000-0000-000000000002"}]}}', 5),
 ('bbbbbbbb-0000-0000-0000-000000000002','BOSS0002','aaaaaaaa-0000-0000-0000-000000000001','playing',
  '[{"id":"aaaaaaaa-0000-0000-0000-000000000001"},{"id":"aaaaaaaa-0000-0000-0000-000000000002"}]', '{"snapshot":{"gameOver":false}}', 2);
-- claim_boss_reward kini mensyaratkan room TERVERIFIKASI (_room_is_verified): >= 16 event roll, >= 2 pemain, rentang >= 90 detik
insert into public.game_events(room_id, seq, player_id, type, created_at)
select 'bbbbbbbb-0000-0000-0000-000000000001', g,
       case when g % 2 = 0 then 'aaaaaaaa-0000-0000-0000-000000000001'::uuid else 'aaaaaaaa-0000-0000-0000-000000000002'::uuid end,
       'roll', now() - interval '10 minutes' + make_interval(secs => g * 10)
from generate_series(1, 20) g;

set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000002',false);
insert into out select 'w1', public.claim_boss_reward('bbbbbbbb-0000-0000-0000-000000000001');   -- user 2 = pemenang
insert into out select 'w1again', public.claim_boss_reward('bbbbbbbb-0000-0000-0000-000000000001');
insert into out select 'notfin', public.claim_boss_reward('bbbbbbbb-0000-0000-0000-000000000002');
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
insert into out select 'loser', public.claim_boss_reward('bbbbbbbb-0000-0000-0000-000000000001'); -- user 1 = host tapi KALAH
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000003',false);
do $$ begin begin perform public.claim_boss_reward('bbbbbbbb-0000-0000-0000-000000000001'); assert false, 'non-member harus ditolak';
  exception when others then assert sqlerrm = 'ROOM_ACCESS_DENIED', 'dapat '||sqlerrm; end; end $$;
reset role;
do $$ begin
  assert (select v->>'ok' from out where k='w1') = 'true' and (select (v->>'coins')::int from out where k='w1') = 1500, 'pemenang: 1000 + 500';
  assert (select (v->>'gems')::int from out where k='w1') = 2, 'hadiah boss = 2 gems (c_gems di claim_boss_reward)';
  assert (select v->>'duplicate' from out where k='w1again') = 'true', 'klaim ulang room yang sama = duplikat';
  assert (select coins from public.player_wallet where user_id='aaaaaaaa-0000-0000-0000-000000000002') = 1500, 'tidak dobel';
  assert (select v->>'reason' from out where k='notfin') = 'room_not_finished';
  assert (select v->>'reason' from out where k='loser') = 'not_winner', 'host yang kalah tidak dapat hadiah';
  assert (select coins from public.player_wallet where user_id='aaaaaaaa-0000-0000-0000-000000000001') = 0, 'saldo host tidak berubah';
end $$;

-- batas harian: user 3 menang di 10 room berbeda -> ke-11 ditolak
insert into public.game_rooms(id, code, host_id, status, players, game_state, revision)
select ('cccccccc-0000-0000-0000-0000000000' || lpad(g::text, 2, '0'))::uuid, 'CAP' || lpad(g::text, 5, '0'),
       'aaaaaaaa-0000-0000-0000-000000000003', 'finished',
       '[{"id":"aaaaaaaa-0000-0000-0000-000000000003"}]',
       '{"snapshot":{"gameOver":true,"winnerIndex":0,"players":[{"networkId":"aaaaaaaa-0000-0000-0000-000000000003"}]}}', 1
from generate_series(1, 11) g;
insert into public.game_events(room_id, seq, player_id, type, created_at)
select ('cccccccc-0000-0000-0000-0000000000' || lpad(r::text, 2, '0'))::uuid, g,
       case when g % 2 = 0 then 'aaaaaaaa-0000-0000-0000-000000000003'::uuid else 'aaaaaaaa-0000-0000-0000-000000000001'::uuid end,
       'roll', now() - interval '10 minutes' + make_interval(secs => g * 10)
from generate_series(1, 11) r, generate_series(1, 20) g;
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000003',false);
do $$ declare r jsonb; i int; begin
  for i in 1..10 loop
    r := public.claim_boss_reward(('cccccccc-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid);
    assert (r->>'ok')::boolean, 'klaim '||i||' harus ok';
  end loop;
  r := public.claim_boss_reward('cccccccc-0000-0000-0000-000000000011');
  assert r->>'reason' = 'daily_cap', 'klaim ke-11 harus kena batas harian, dapat '||r::text;
end $$;
reset role;
do $$ begin assert (select coins from public.player_wallet where user_id='aaaaaaaa-0000-0000-0000-000000000003') = 1000 + 10*500; end $$;

-- ===== ACHIEVEMENT -> dompet server =====
-- Progres achievement dihitung SERVER dari player_stats (nilai klien diabaikan), jadi statistik ditanam dulu sebagai superuser.
-- Ambang & hadiah dibaca dari achievement_defs ('aktif' = stat plays), bukan di-hardcode.
insert into out select 'ach', jsonb_build_object('t1', tiers[1], 't2', tiers[2], 'c1', reward_coins[1], 'c2', reward_coins[2], 'g1', reward_gems[1], 'g2', reward_gems[2])
  from public.achievement_defs where id = 'aktif';
insert into public.player_stats(user_id) values ('aaaaaaaa-0000-0000-0000-000000000001') on conflict (user_id) do nothing;
update public.player_stats set plays = (select (v->>'t1')::int from out where k='ach') where user_id='aaaaaaaa-0000-0000-0000-000000000001';
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
insert into out select 'a1', public.claim_achievement('aktif');          -- bintang 1
insert into out select 'a1again', public.claim_achievement('aktif');
reset role;
update public.player_stats set plays = (select (v->>'t2')::int from out where k='ach') where user_id='aaaaaaaa-0000-0000-0000-000000000001';
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
insert into out select 'a2', public.claim_achievement('aktif');          -- bintang 2
reset role;
do $$ begin
  assert (select (v->>'coins')::int from out where k='a1') = (select (v->>'c1')::int from out where k='ach')
     and (select (v->>'wallet_coins')::int from out where k='a1') = (select (v->>'c1')::int from out where k='ach'), 'saldo 0 + hadiah bintang 1: ' || (select v::text from out where k='a1');
  assert (select v->>'reason' from out where k='a1again') = 'nothing_to_claim';
  assert (select (v->>'wallet_coins')::int from out where k='a2') = (select (v->>'c1')::int + (v->>'c2')::int from out where k='ach'), 'hadiah bintang 1 + bintang 2: ' || (select v::text from out where k='a2');
  assert (select gems from public.player_wallet where user_id='aaaaaaaa-0000-0000-0000-000000000001') = (select (v->>'g1')::int + (v->>'g2')::int from out where k='ach'), 'gems = g1 + g2';
  assert (select count(*) from public.wallet_ledger where user_id='aaaaaaaa-0000-0000-0000-000000000001' and reason='achievement') = 2, 'dua baris ledger achievement';
end $$;

-- ===== ISOLASI inventory =====
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000002',false);
insert into out select 'inv2', public.inventory_get();
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
insert into out select 'inv1', public.inventory_get();
reset role;
do $$ begin
  assert jsonb_array_length((select v from out where k='inv2')) = 0, 'inventory akun 2 kosong';
  assert jsonb_array_length((select v from out where k='inv1')) = 2, 'akun 1 punya 2 item (rumput + emas)';
end $$;

select 'WALLET B2 OK' as hasil;
rollback;
