-- Tes migrasi 202611350001_pvp_knight_gear.sql. Jalankan sebagai superuser di DB UJI (bukan produksi) yang SUDAH memuat migrasi
-- sampai 202611350001 (psql -v ON_ERROR_STOP=1). Semua assertion memakai `assert`; kegagalan menghentikan skrip.
-- BELUM PERNAH DIJALANKAN (tidak ada Postgres di lingkungan penulisan) — jalankan sebelum dipakai di produksi.
\set ON_ERROR_STOP 1
begin;
insert into auth.users(id) values ('bbbbbbbb-0000-0000-0000-000000000001'), ('bbbbbbbb-0000-0000-0000-000000000002');
create temp table out(k text, v jsonb);
grant all on out to authenticated, anon;

-- katalog & aturan: 20 item, tidak dijual, bukan starter; mahkota=10, rival=20
do $$ begin
  assert (select count(*) from public.item_catalog where id ~ '^gear\.(eyes|hair|top|legs|boots|helm|chest|shoulder|cape|weapon)\.(mahkota|rival)$') = 20, '20 item katalog';
  assert (select count(*) from public.item_catalog where id ~ '\.(mahkota|rival)$' and kind='gear' and price_coins is null and not starter) = 20, 'tidak dijual';
  assert (select count(*) from public.pvp_unlocks where item_id like '%.mahkota' and min_wins = 10) = 10, 'mahkota 10 menang';
  assert (select count(*) from public.pvp_unlocks where item_id like '%.rival' and min_wins = 20) = 10, 'rival 20 menang';
end $$;

-- anon & tanpa login ditolak
set role anon;
do $$ begin
  begin perform public.claim_pvp_unlocks(array['gear.helm.mahkota']); assert false, 'anon harus ditolak';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  begin perform public.claim_pvp_unlocks(array['gear.helm.mahkota']); assert false, 'tanpa uid harus ditolak';
  exception when others then assert sqlerrm = 'AUTH_REQUIRED', 'dapat ' || sqlerrm; end;
end $$;
reset role;

-- 0 kemenangan: tidak ada yang terbuka, semua masuk 'locked'
set role authenticated; select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000001', false);
insert into out select 'c0', public.claim_pvp_unlocks(array['gear.helm.mahkota', 'gear.eyes.mahkota']);
reset role;
do $$ begin
  assert (select v->>'ok' from out where k='c0') = 'true';
  assert (select jsonb_array_length(v->'granted') from out where k='c0') = 0, 'belum cukup: tidak ada yang diberi';
  assert (select jsonb_array_length(v->'locked') from out where k='c0') = 2, 'dua item terkunci';
  assert not exists (select 1 from public.player_inventory where user_id='bbbbbbbb-0000-0000-0000-000000000001' and item_id like 'gear.%.mahkota'), 'inventori kosong';
end $$;

-- id di luar pvp_unlocks (item toko biasa / null) ditolak seluruhnya
set role authenticated; select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000001', false);
insert into out select 'bad1', public.claim_pvp_unlocks(array['gear.helm.mahkota', 'gear.helm.crown']);
insert into out select 'bad2', public.claim_pvp_unlocks(array[]::text[]);
reset role;
do $$ begin
  assert (select v->>'reason' from out where k='bad1') = 'tidak-tersedia';
  assert (select v->>'reason' from out where k='bad2') = 'tidak-tersedia';
end $$;

-- wajah terkunci tidak bisa disimpan lewat appearance_save sebelum dimiliki
set role authenticated; select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000001', false);
insert into out select 'save0', public.appearance_save(
  '{"gender":"m","skin":"s2","eyes":{"id":"mahkota","dye":"blue"},"hair":{"id":"short","dye":"brown"}}'::jsonb, '{}'::jsonb, '{}'::jsonb);
reset role;
do $$ begin
  assert (select v->>'ok' from out where k='save0') = 'false', 'wajah terkunci ditolak';
  assert (select v->>'reason' from out where k='save0') = 'belum-dimiliki';
end $$;

-- 10 kemenangan: set Mahkota terbuka, Rival masih terkunci
update public.player_stats set pvp_wins = 10 where user_id = 'bbbbbbbb-0000-0000-0000-000000000001';
set role authenticated; select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000001', false);
insert into out select 'c10', public.claim_pvp_unlocks(array(select id from public.item_catalog where id ~ '\.(mahkota|rival)$'));
reset role;
do $$ begin
  assert (select jsonb_array_length(v->'granted') from out where k='c10') = 10, '10 item mahkota diberi';
  assert (select jsonb_array_length(v->'locked') from out where k='c10') = 10, '10 item rival tetap terkunci';
  assert (select (v->'locked'->0->>'min_wins')::int from out where k='c10') = 20;
end $$;

-- klaim ulang idempoten: tidak dobel
set role authenticated; select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000001', false);
insert into out select 'c10b', public.claim_pvp_unlocks(array(select id from public.item_catalog where id ~ '\.mahkota$'));
reset role;
do $$ begin
  assert (select jsonb_array_length(v->'granted') from out where k='c10b') = 0 and (select jsonb_array_length(v->'already') from out where k='c10b') = 10;
  assert (select count(*) from public.player_inventory where user_id='bbbbbbbb-0000-0000-0000-000000000001' and item_id like 'gear.%.mahkota') = 10;
end $$;

-- setelah dimiliki: tampilan set Mahkota (wajah + rambut + perlengkapan) bisa disimpan; Rival tetap ditolak
set role authenticated; select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000001', false);
insert into out select 'save1', public.appearance_save(
  '{"gender":"m","skin":"s2","eyes":{"id":"mahkota","dye":"blue"},"hair":{"id":"mahkota","dye":"silver"}}'::jsonb,
  '{"g.helm":"gear.helm.mahkota","g.cape":"gear.cape.mahkota","g.weapon":"gear.weapon.mahkota"}'::jsonb, '{}'::jsonb);
insert into out select 'save2', public.appearance_save(
  '{"gender":"m","skin":"s2","eyes":{"id":"rival","dye":"red"},"hair":{"id":"short","dye":"brown"}}'::jsonb, '{}'::jsonb, '{}'::jsonb);
reset role;
do $$ begin
  assert (select v->>'ok' from out where k='save1') = 'true', 'set milik sendiri bisa dipakai: ' || (select v::text from out where k='save1');
  assert (select v->>'ok' from out where k='save2') = 'false' and (select v->>'reason' from out where k='save2') = 'belum-dimiliki', 'wajah rival belum dimiliki';
end $$;

-- pemain lain tidak ikut terbuka
do $$ begin
  assert not exists (select 1 from public.player_inventory where user_id='bbbbbbbb-0000-0000-0000-000000000002' and item_id like 'gear.%.mahkota');
end $$;
rollback;
