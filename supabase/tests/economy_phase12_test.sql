-- Tes migrasi 202611270001 (login 7 hari, Mystery Box, first join) dan 202611270002 (8 misi, achievement). Jalankan sebagai superuser di DB UJI yang SUDAH memuat semua migrasi (psql -v ON_ERROR_STOP=1). Semua di dalam transaksi + rollback.
\set ON_ERROR_STOP 1
begin;
insert into auth.users(id, created_at) values ('aaaaaaaa-0000-0000-0000-000000000001', now()), ('aaaaaaaa-0000-0000-0000-000000000002', '2026-01-01');
create temp table out(k text, v jsonb); grant all on out to authenticated;
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
insert into out select 'd1', public.claim_daily_reward();
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
insert into out select 'ml', public.mail_list();
insert into out select 'q0', public.quest_get();
reset role;
do $$ begin
 assert (select coins from public.player_wallet where user_id='aaaaaaaa-0000-0000-0000-000000000001')=1300, 'H1 300 koin';
 assert (select (v->>'ok')::boolean from out where k='d1'), 'd1 ok';
 assert exists(select 1 from public.player_mail where user_id='aaaaaaaa-0000-0000-0000-000000000001' and dedupe_key='first-join' and reward_coins=500 and reward_gems=20), 'first-join akun baru';
 assert jsonb_array_length((select v->'quests' from out where k='q0'))=8, '8 misi';
end $$;
-- hari 3 -> box
update public.player_daily_reward set claimed=2, last_claim_date=public._wib_today()-1 where user_id='aaaaaaaa-0000-0000-0000-000000000001';
update public.wallet_ledger set ref_key=(public._wib_today()-1)::text where reason='daily' and user_id='aaaaaaaa-0000-0000-0000-000000000001';
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
insert into out select 'd3', public.claim_daily_reward();
insert into out select 'box', public.open_mystery_box();
insert into out select 'box2', public.open_mystery_box();
reset role;
do $$ begin
 assert (select v->>'type' from out where k='d3')='box', 'H3 box';
 assert (select (v->>'ok')::boolean from out where k='box'), 'box terbuka';
 assert (select v->>'reason' from out where k='box2')='tidak-ada-box', 'box habis';
end $$;
-- misi turunan: naikkan counter -> progres naik, klaim, bonus
insert into public.player_stats(user_id) values ('aaaaaaaa-0000-0000-0000-000000000001') on conflict do nothing;
update public.player_stats set dice_rolls=dice_rolls+30, ladders=ladders+5, dragon_hits=dragon_hits+3, chests=chests+3, skills_used=skills_used+3 where user_id='aaaaaaaa-0000-0000-0000-000000000001';
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
select public.quest_track('login'); select public.quest_track('win'); select public.quest_track('win'); select public.quest_track('win');
insert into out select 'qa', public.quest_claim_all();
insert into out select 'qb', public.quest_claim_bonus();
insert into out select 'qb2', public.quest_claim_bonus();
insert into out select 'prof', public.get_my_profile();
reset role;
do $$ begin
 assert (select (v->>'count')::int from out where k='qa')=8, 'semua 8 diklaim';
 assert (select (v->>'coins')::int from out where k='qa')=1180, 'total 1180';
 assert (select v->>'gems' from out where k='qb')='3', 'bonus 3 gem';
 assert (select v->>'reason' from out where k='qb2')='sudah-klaim', 'bonus sekali';
 assert (select (v->'counters'->>'quests_done')::int from out where k='prof')=8, 'quests_done 8';
end $$;
-- akun lama tidak dapat first-join
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000002',false);
select public.mail_list();
reset role;
do $$ begin assert not exists(select 1 from public.player_mail where user_id='aaaaaaaa-0000-0000-0000-000000000002' and dedupe_key='first-join'), 'akun lama tanpa first-join'; end $$;
-- achievement klaim: 8 quests_done belum cukup (papan 10) ; naga 3 hit belum cukup (10)
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
insert into out select 'ac', public.claim_achievement('papan');
reset role;
do $$ begin assert (select v->>'reason' from out where k='ac')='nothing_to_claim', 'papan belum 10'; end $$;
select 'OK semua';
rollback;
