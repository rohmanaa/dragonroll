-- Tes migrasi 202611130001_player_outfits.sql. Jalankan sebagai superuser di DB UJI (bukan produksi)
-- yang SUDAH memuat semua migrasi sampai 202611130001 (butuh item_catalog/player_inventory B2, game_rooms, is_game_room_member).
-- Semua assertion memakai `assert`; kegagalan menghentikan skrip (psql -v ON_ERROR_STOP=1).
\set ON_ERROR_STOP 1
begin;
insert into auth.users(id) values
  ('aaaaaaaa-0000-0000-0000-000000000001'), ('aaaaaaaa-0000-0000-0000-000000000002'), ('aaaaaaaa-0000-0000-0000-000000000003');
create temp table out(k text, v jsonb);
grant all on out to authenticated;
create temp table tpl(k text, v jsonb);
grant all on tpl to authenticated;
insert into tpl values
 ('m', '{"gender":"m","top":{"id":"tee","dye":"blue"},"legs":{"id":"pants","dye":"navy"},"boots":{"id":"shoes","dye":"brown"},"helm":{"id":"none"},"chest":{"id":"none"},"shoulder":{"id":"none"},"cape":{"id":"none"},"weapon":{"id":"none"},"accessories":[]}'),
 ('f', '{"gender":"f","top":{"id":"blouse","dye":"white"},"legs":{"id":"skirt","dye":"navy"},"boots":{"id":"mary","dye":"black"},"helm":{"id":"none"},"chest":{"id":"none"},"shoulder":{"id":"none"},"cape":{"id":"none"},"weapon":{"id":"none"},"accessories":[]}');

-- ===== 0. Gender item dari seed =====
do $$ begin
  assert (select gender from public.item_catalog where id='gear.top.dress') = 'f', 'dress = perempuan';
  assert (select gender from public.item_catalog where id='gear.top.coat') = 'm', 'coat = laki-laki';
  assert (select gender from public.item_catalog where id='gear.top.tee') is null, 'tee = semua gender';
  assert (select gender from public.item_catalog where kind <> 'gear' and gender is not null limit 1) is null, 'non-gear tanpa gender';
end $$;

-- ===== 1. Wajib login =====
set role authenticated; select set_config('request.jwt.claim.sub','',false);
do $$ declare ok boolean := false; begin
  begin perform public.outfit_list(); exception when others then ok := sqlerrm = 'AUTH_REQUIRED'; end;
  assert ok, 'outfit_list tanpa login harus AUTH_REQUIRED';
  ok := false;
  begin perform public.outfit_save('X', '{}'::jsonb); exception when others then ok := sqlerrm = 'AUTH_REQUIRED'; end;
  assert ok, 'outfit_save tanpa login harus AUTH_REQUIRED';
  ok := false;
  begin perform public.appearance_save(null, null, null); exception when others then ok := sqlerrm = 'AUTH_REQUIRED'; end;
  assert ok, 'appearance_save tanpa login harus AUTH_REQUIRED';
end $$;
reset role;

-- ===== 2. Simpan outfit: starter tanpa inventory, slot terisi berurutan =====
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
insert into out select 'list0', public.outfit_list();
insert into out select 's0', public.outfit_save('Harian', (select v from tpl where k='m'));
insert into out select 's1', public.outfit_save('Kedua', (select v from tpl where k='m') || '{"top":{"id":"tee"}}');
reset role;
do $$ begin
  assert (select v from out where k='list0') = '[]'::jsonb, 'awalnya kosong';
  assert (select v->>'ok' from out where k='s0') = 'true' and (select (v->>'slot')::int from out where k='s0') = 0, 'slot pertama = 0';
  assert (select (v->>'slot')::int from out where k='s1') = 1, 'slot kedua = 1';
  assert (select v->'data'->'top'->>'dye' from out where k='s0') = 'blue', 'warna tersimpan';
  assert (select v->'data'->'top' from out where k='s1') = '{"id":"tee"}'::jsonb, 'tanpa warna = tanpa kunci dye';
  assert (select count(*) from public.player_outfits where user_id='aaaaaaaa-0000-0000-0000-000000000001') = 2;
end $$;

-- ===== 3. Item belum dimiliki ditolak, tidak menulis apa pun =====
set role authenticated;
insert into out select 'crown', public.outfit_save('Raja', (select v from tpl where k='m') || '{"helm":{"id":"crown","dye":"gold"}}');
reset role;
do $$ begin
  assert (select v->>'reason' from out where k='crown') = 'belum-dimiliki', 'crown belum dimiliki';
  assert (select v->>'item' from out where k='crown') = 'gear.helm.crown';
  assert (select count(*) from public.player_outfits where user_id='aaaaaaaa-0000-0000-0000-000000000001') = 2, 'tidak boleh menulis saat ditolak';
end $$;
insert into public.player_inventory(user_id, item_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001','gear.helm.crown'), ('aaaaaaaa-0000-0000-0000-000000000001','gear.acc.belt'),
  ('aaaaaaaa-0000-0000-0000-000000000001','gear.top.dress'), ('aaaaaaaa-0000-0000-0000-000000000001','gear.acc.pack');
set role authenticated;
insert into out select 'crown2', public.outfit_save('Raja', (select v from tpl where k='m') || '{"helm":{"id":"crown","dye":"gold"}}');
reset role;
do $$ begin
  assert (select v->>'ok' from out where k='crown2') = 'true', 'setelah dimiliki harus bisa disimpan';
  assert (select (v->>'slot')::int from out where k='crown2') = 2;
end $$;

-- ===== 4. Gender, item tidak dikenal, bagian kosong, format =====
set role authenticated;
insert into out select 'gender', public.outfit_save('X', (select v from tpl where k='m') || '{"top":{"id":"dress"}}');   -- dimiliki tapi item perempuan
insert into out select 'unknown', public.outfit_save('X', (select v from tpl where k='m') || '{"top":{"id":"zzz"}}');
insert into out select 'badid', public.outfit_save('X', (select v from tpl where k='m') || '{"top":{"id":"../x"}}');
insert into out select 'baddye', public.outfit_save('X', (select v from tpl where k='m') || '{"top":{"id":"tee","dye":"<script>"}}');
insert into out select 'dyenum', public.outfit_save('X', (select v from tpl where k='m') || '{"top":{"id":"tee","dye":5}}');
insert into out select 'badgender', public.outfit_save('X', (select v from tpl where k='m') || '{"gender":"x"}');
insert into out select 'nogender', public.outfit_save('X', (select v from tpl where k='m') - 'gender');
insert into out select 'array', public.outfit_save('X', '[1,2]'::jsonb);
insert into out select 'nulldata', public.outfit_save('X', null);
insert into out select 'badpart', public.outfit_save('X', (select v from tpl where k='m') || '{"top":"tee"}');
insert into out select 'nonebad', public.outfit_save('X', (select v from tpl where k='m') || '{"legs":{"id":"none"}}');   -- legs.none tidak ada di katalog tapi 'none' = kosong -> sah
insert into out select 'missingparts', public.outfit_save('Sedikit', '{"gender":"m"}'::jsonb);                          -- bagian hilang = kosong
reset role;
do $$ begin
  assert (select v->>'reason' from out where k='gender') = 'gender-tidak-cocok';
  assert (select v->>'reason' from out where k='unknown') = 'item-tidak-dikenal';
  assert (select v->>'reason' from out where k='badid') = 'data-tidak-valid';
  assert (select v->>'reason' from out where k='baddye') = 'data-tidak-valid', 'format warna';
  assert (select v->>'reason' from out where k='dyenum') = 'data-tidak-valid';
  assert (select v->>'reason' from out where k='badgender') = 'data-tidak-valid';
  assert (select v->>'reason' from out where k='nogender') = 'data-tidak-valid';
  assert (select v->>'reason' from out where k='array') = 'data-tidak-valid';
  assert (select v->>'reason' from out where k='nulldata') = 'data-tidak-valid';
  assert (select v->>'reason' from out where k='badpart') = 'data-tidak-valid';
  assert (select v->>'ok' from out where k='nonebad') = 'true', 'none = bagian kosong';
  assert (select v->'data'->'legs' from out where k='nonebad') = '{"id":"none"}'::jsonb;
  assert (select v->>'ok' from out where k='missingparts') = 'true', 'bagian hilang dianggap kosong';
  assert (select v->'data'->'helm' from out where k='missingparts') = '{"id":"none"}'::jsonb;
  assert (select v->'data'->'accessories' from out where k='missingparts') = '[]'::jsonb;
end $$;
delete from public.player_outfits where user_id='aaaaaaaa-0000-0000-0000-000000000001' and slot in (3, 4);   -- bersihkan 'nonebad' & 'missingparts'
do $$ begin assert (select count(*) from public.player_outfits where user_id='aaaaaaaa-0000-0000-0000-000000000001') = 3; end $$;

-- ===== 5. Aksesori: duplikat/none dibuang, tak dimiliki ditolak, maks 12 =====
set role authenticated;
insert into out select 'acc1', public.outfit_save('Aksesori', (select v from tpl where k='m') || '{"accessories":[{"id":"belt","dye":"brown"},{"id":"belt","dye":"red"},{"id":"none"},{"id":"pack"}]}');
insert into out select 'acc2', public.outfit_save('Aksesori', (select v from tpl where k='m') || '{"accessories":[{"id":"scarf"}]}');
insert into out select 'acc3', public.outfit_save('Aksesori', (select v from tpl where k='m') || '{"accessories":[{"id":"bow"}]}');
insert into out select 'acc4', public.outfit_save('Aksesori', (select v from tpl where k='m') || ('{"accessories":' || (select jsonb_agg(jsonb_build_object('id','belt')) from generate_series(1,13))::text || '}')::jsonb);
insert into out select 'acc5', public.outfit_save('Aksesori', (select v from tpl where k='m') || '{"accessories":{"id":"belt"}}');
reset role;
do $$ begin
  assert (select v->>'ok' from out where k='acc1') = 'true';
  assert (select jsonb_array_length(v->'data'->'accessories') from out where k='acc1') = 2, 'duplikat & none dibuang';
  assert (select v->'data'->'accessories'->0->>'dye' from out where k='acc1') = 'brown', 'duplikat: yang pertama dipakai';
  assert (select v->>'reason' from out where k='acc2') = 'belum-dimiliki', 'scarf belum dimiliki';
  assert (select v->>'reason' from out where k='acc3') = 'gender-tidak-cocok', 'bow = perempuan';
  assert (select v->>'reason' from out where k='acc4') = 'data-tidak-valid', 'lebih dari 12 aksesori';
  assert (select v->>'reason' from out where k='acc5') = 'data-tidak-valid', 'aksesori bukan array';
end $$;
delete from public.player_outfits where user_id='aaaaaaaa-0000-0000-0000-000000000001' and slot = 3;

-- ===== 6. Nama =====
set role authenticated;
insert into out select 'n_empty', public.outfit_save('   ', (select v from tpl where k='m'));
insert into out select 'n_null', public.outfit_save(null, (select v from tpl where k='m'));
insert into out select 'n_tag', public.outfit_save(E'<b>Hai</b>\n\t dunia ' || repeat('x', 40), (select v from tpl where k='m'));
reset role;
do $$ begin
  assert (select v->>'reason' from out where k='n_empty') = 'nama-kosong';
  assert (select v->>'reason' from out where k='n_null') = 'nama-kosong';
  assert (select v->>'ok' from out where k='n_tag') = 'true';
  assert char_length((select v->>'name' from out where k='n_tag')) <= 16, 'nama maks 16';
  assert (select v->>'name' from out where k='n_tag') !~ '[<>[:cntrl:]]', 'tag & kontrol dibuang';
  assert (select v->>'name' from out where k='n_tag') like 'bHai%', 'sisa teks tetap';
end $$;

-- ===== 7. Batas 5 slot + pemakaian ulang slot kosong =====
do $$ begin assert (select count(*) from public.player_outfits where user_id='aaaaaaaa-0000-0000-0000-000000000001') = 4, 'saat ini 4 outfit (slot 0,1,2,3)'; end $$;
set role authenticated;
insert into out select 'fill5', public.outfit_save('Kelima', (select v from tpl where k='m'));
insert into out select 'fill6', public.outfit_save('Keenam', (select v from tpl where k='m'));
insert into out select 'del2', public.outfit_delete(2);
insert into out select 'reuse', public.outfit_save('Pengganti', (select v from tpl where k='m'));
insert into out select 'list5', public.outfit_list();
reset role;
do $$ begin
  assert (select (v->>'slot')::int from out where k='fill5') = 4, 'slot kosong pertama (3 terisi oleh n_tag) -> 4';
  assert (select v->>'reason' from out where k='fill6') = 'slot-penuh', 'slot ke-6 ditolak';
  assert (select v->>'ok' from out where k='del2') = 'true';
  assert (select (v->>'slot')::int from out where k='reuse') = 2, 'slot yang dihapus dipakai ulang';
  assert (select jsonb_array_length(v) from out where k='list5') = 5;
  assert (select jsonb_agg((e->>'slot')::int) from out, jsonb_array_elements(v) e where k='list5') = '[0,1,2,3,4]'::jsonb, 'urut slot';
  assert (select count(*) from public.player_outfits where user_id='aaaaaaaa-0000-0000-0000-000000000001') = 5, 'tidak pernah lebih dari 5';
end $$;

-- ===== 8. Ganti nama, hapus, isolasi antar pemain =====
set role authenticated;
insert into out select 'ren', public.outfit_rename(0, '  Nama Baru  ');
insert into out select 'ren_empty', public.outfit_rename(0, '<>');
insert into out select 'ren_none', public.outfit_rename(9, 'X');
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000002',false);
insert into out select 'u2_list', public.outfit_list();
insert into out select 'u2_ren', public.outfit_rename(0, 'Curian');
insert into out select 'u2_del', public.outfit_delete(0);
insert into out select 'u2_save', public.outfit_save('Milik U2', (select v from tpl where k='f'));
reset role;
do $$ begin
  assert (select v->>'name' from out where k='ren') = 'Nama Baru', 'nama dirapikan';
  assert (select v->>'reason' from out where k='ren_empty') = 'nama-kosong';
  assert (select v->>'reason' from out where k='ren_none') = 'tidak-ada';
  assert (select v from out where k='u2_list') = '[]'::jsonb, 'pemain lain tidak melihat outfit orang lain';
  assert (select v->>'reason' from out where k='u2_ren') = 'tidak-ada', 'tidak bisa ganti nama outfit orang lain';
  assert (select v->>'reason' from out where k='u2_del') = 'tidak-ada', 'tidak bisa hapus outfit orang lain';
  assert (select name from public.player_outfits where user_id='aaaaaaaa-0000-0000-0000-000000000001' and slot=0) = 'Nama Baru', 'milik u1 utuh';
  assert (select (v->>'slot')::int from out where k='u2_save') = 0, 'slot u2 terpisah dari u1';
  assert (select v->>'ok' from out where k='u2_save') = 'true';
end $$;

-- ===== 9. Klien tidak bisa menyentuh tabel; anon tidak bisa memanggil RPC; fungsi internal tertutup =====
set role authenticated;
do $$ begin
  begin perform 1 from public.player_outfits; assert false, 'select outfits harus ditolak'; exception when insufficient_privilege then null; end;
  begin insert into public.player_outfits(user_id,slot,name,data) values ('aaaaaaaa-0000-0000-0000-000000000002',4,'Hack','{}'); assert false, 'insert outfits harus ditolak'; exception when insufficient_privilege then null; end;
  begin update public.player_outfits set name = 'Hack'; assert false, 'update outfits harus ditolak'; exception when insufficient_privilege then null; end;
  begin delete from public.player_outfits; assert false, 'delete outfits harus ditolak'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.player_appearance; assert false, 'select appearance harus ditolak'; exception when insufficient_privilege then null; end;
  begin insert into public.player_appearance(user_id) values ('aaaaaaaa-0000-0000-0000-000000000002'); assert false, 'insert appearance harus ditolak'; exception when insufficient_privilege then null; end;
  begin update public.item_catalog set gender = 'm'; assert false, 'ubah gender katalog harus ditolak'; exception when insufficient_privilege then null; end;
  begin perform public._outfit_normalize('aaaaaaaa-0000-0000-0000-000000000002', '{}'); assert false, 'fungsi internal harus tertutup'; exception when insufficient_privilege then null; end;
  begin perform public._owns_item('aaaaaaaa-0000-0000-0000-000000000002', 'gear.top.tee'); assert false, '_owns_item harus tertutup'; exception when insufficient_privilege then null; end;
  begin perform public._appearance_normalize('aaaaaaaa-0000-0000-0000-000000000002', null, null, null); assert false, 'fungsi internal harus tertutup'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set role anon;
do $$ begin
  begin perform public.outfit_list(); assert false, 'anon outfit_list harus ditolak'; exception when insufficient_privilege then null; end;
  begin perform public.appearance_get(); assert false, 'anon appearance_get harus ditolak'; exception when insufficient_privilege then null; end;
  begin perform public.room_appearance_get('bbbbbbbb-0000-0000-0000-000000000001'); assert false, 'anon room_appearance_get harus ditolak'; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ===== 10. Tampilan aktif =====
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
insert into out select 'ap_get0', public.appearance_get();
insert into out select 'ap1', public.appearance_save(
  '{"gender":"m","skin":"s2","eyes":{"id":"round","dye":"blue"},"hair":{"id":"short","dye":"brown"},"body":{"height":2,"build":0.1}}',
  '{"skin":"skin.steve","dice":"dice.klasik","theme":"theme.minecraft","frame":"frame.default","g.top":"gear.top.tee","g.helm":"gear.helm.crown","g.acc.belt":"gear.acc.belt"}',
  '{"gear.top.tee":"red","gear.helm.crown":"gold"}');
insert into out select 'ap_get1', public.appearance_get();
reset role;
do $$ begin
  assert (select v->>'found' from out where k='ap_get0') = 'false', 'belum ada tampilan';
  assert (select v->>'ok' from out where k='ap1') = 'true', 'tampilan sah tersimpan: ' || (select v::text from out where k='ap1');
  assert (select v->>'found' from out where k='ap_get1') = 'true';
  assert (select (v->'look'->'body'->>'height')::numeric from out where k='ap_get1') = 1.1, 'tinggi dibatasi 1.1';
  assert (select (v->'look'->'body'->>'build')::numeric from out where k='ap_get1') = 0.9, 'badan dibatasi 0.9';
  assert (select v->'equipped'->>'g.helm' from out where k='ap_get1') = 'gear.helm.crown';
  assert (select v->'gear_dye'->>'gear.top.tee' from out where k='ap_get1') = 'red';
end $$;

-- tampilan yang ditolak tidak mengubah data lama (tidak ada simpan setengah)
set role authenticated;
insert into out select 'ap_unowned', public.appearance_save(null, '{"g.helm":"gear.helm.knight"}', '{}');
insert into out select 'ap_slot', public.appearance_save(null, '{"g.top":"gear.helm.crown"}', '{}');
insert into out select 'ap_slot2', public.appearance_save(null, '{"skin":"dice.klasik"}', '{}');
insert into out select 'ap_powerup', public.appearance_save(null, '{"g.top":"tnt"}', '{}');
insert into out select 'ap_unknown', public.appearance_save(null, '{"g.top":"gear.top.zzz"}', '{}');
insert into out select 'ap_eqtype', public.appearance_save(null, '{"g.top":5}', '{}');
insert into out select 'ap_eqarr', public.appearance_save(null, '[1]', '{}');
insert into out select 'ap_baddye', public.appearance_save(null, '{}', '{"gear.top.tee":"<x>"}');
insert into out select 'ap_dyenongear', public.appearance_save(null, '{}', '{"skin.steve":"red"}');
insert into out select 'ap_dyeunowned', public.appearance_save(null, '{}', '{"gear.helm.knight":"red"}');
insert into out select 'ap_looksk', public.appearance_save('{"gender":"m","skin":"s9","eyes":{"id":"round","dye":"blue"},"hair":{"id":"short","dye":"brown"}}', '{}', '{}');
insert into out select 'ap_lookgender', public.appearance_save('{"gender":"q","skin":"s1","eyes":{"id":"round","dye":"blue"},"hair":{"id":"short","dye":"brown"}}', '{}', '{}');
insert into out select 'ap_lookeyes', public.appearance_save('{"gender":"m","skin":"s1","eyes":{"id":"Round!","dye":"blue"},"hair":{"id":"short","dye":"brown"}}', '{}', '{}');
insert into out select 'ap_lookarr', public.appearance_save('[1]', '{}', '{}');
insert into out select 'ap_big', public.appearance_save(null, (select jsonb_object_agg('k' || i, 'gear.top.tee') from generate_series(1, 70) i), '{}');
insert into out select 'ap_get2', public.appearance_get();
reset role;
do $$ begin
  assert (select v->>'reason' from out where k='ap_unowned') = 'belum-dimiliki';
  assert (select v->>'reason' from out where k='ap_slot') = 'slot-tidak-cocok', 'item bukan untuk slot itu';
  assert (select v->>'reason' from out where k='ap_slot2') = 'slot-tidak-cocok';
  assert (select v->>'reason' from out where k='ap_powerup') = 'slot-tidak-cocok', 'power-up tidak bisa di-equip';
  assert (select v->>'reason' from out where k='ap_unknown') = 'slot-tidak-cocok', 'item tak dikenal';
  assert (select v->>'reason' from out where k='ap_eqtype') = 'data-tidak-valid';
  assert (select v->>'reason' from out where k='ap_eqarr') = 'data-tidak-valid';
  assert (select v->>'reason' from out where k='ap_baddye') = 'data-tidak-valid';
  assert (select v->>'reason' from out where k='ap_dyenongear') = 'item-tidak-dikenal', 'warna hanya untuk gear';
  assert (select v->>'reason' from out where k='ap_dyeunowned') = 'belum-dimiliki';
  assert (select v->>'reason' from out where k='ap_looksk') = 'data-tidak-valid', 'kulit di luar s1..s5';
  assert (select v->>'reason' from out where k='ap_lookgender') = 'data-tidak-valid';
  assert (select v->>'reason' from out where k='ap_lookeyes') = 'data-tidak-valid';
  assert (select v->>'reason' from out where k='ap_lookarr') = 'data-tidak-valid';
  assert (select v->>'reason' from out where k='ap_big') = 'data-tidak-valid', 'terlalu banyak slot';
  assert (select v->'equipped' from out where k='ap_get2') = (select v->'equipped' from out where k='ap_get1'), 'data lama utuh setelah semua penolakan';
  assert (select v->'look' from out where k='ap_get2') = (select v->'look' from out where k='ap_get1');
end $$;

-- look null diizinkan (belum pernah diatur); tampilan kosong sah
set role authenticated;
insert into out select 'ap_null', public.appearance_save(null, null, null);
insert into out select 'ap_get3', public.appearance_get();
reset role;
do $$ begin
  assert (select v->>'ok' from out where k='ap_null') = 'true';
  assert (select v->'look' from out where k='ap_get3') = 'null'::jsonb, 'look null';
  assert (select v->'equipped' from out where k='ap_get3') = '{}'::jsonb;
end $$;
-- pulihkan tampilan u1 untuk tes room
set role authenticated;
insert into out select 'ap1b', public.appearance_save(
  '{"gender":"m","skin":"s3","eyes":{"id":"round","dye":"blue"},"hair":{"id":"short","dye":"brown"},"body":{"height":1,"build":1}}',
  '{"g.top":"gear.top.tee","g.helm":"gear.helm.crown"}', '{"gear.helm.crown":"gold"}');
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000002',false);
insert into out select 'ap2', public.appearance_save('{"gender":"f","skin":"s1","eyes":{"id":"lash","dye":"blue"},"hair":{"id":"bob","dye":"brown"}}', '{"skin":"skin.alex"}', '{}');
reset role;
do $$ begin assert (select v->>'ok' from out where k='ap1b') = 'true' and (select v->>'ok' from out where k='ap2') = 'true'; end $$;

-- ===== 11. Tampilan aktif anggota room (hanya untuk anggota) =====
insert into public.game_rooms(id, code, host_id, status, players) values
 ('bbbbbbbb-0000-0000-0000-000000000001','OUTF0001','aaaaaaaa-0000-0000-0000-000000000001','waiting',
  '[{"id":"aaaaaaaa-0000-0000-0000-000000000001"},{"id":"aaaaaaaa-0000-0000-0000-000000000002"}]'),
 ('bbbbbbbb-0000-0000-0000-000000000002','OUTF0002','aaaaaaaa-0000-0000-0000-000000000003','waiting',
  '[{"id":"aaaaaaaa-0000-0000-0000-000000000003"},{"id":"bukan-uuid"}]');
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
insert into out select 'room_u1', public.room_appearance_get('bbbbbbbb-0000-0000-0000-000000000001');
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000003',false);
do $$ declare ok boolean := false; begin
  begin perform public.room_appearance_get('bbbbbbbb-0000-0000-0000-000000000001'); exception when others then ok := sqlerrm = 'NOT_ROOM_MEMBER'; end;
  assert ok, 'bukan anggota room harus NOT_ROOM_MEMBER';
end $$;
insert into out select 'room_u3', public.room_appearance_get('bbbbbbbb-0000-0000-0000-000000000002');   -- u3 anggota, tanpa data; id non-uuid diabaikan
reset role;
do $$ begin
  assert (select jsonb_array_length(v) from out where k='room_u1') = 2, 'u1 melihat tampilan u1 dan u2';
  assert (select count(*) from out, jsonb_array_elements(v) e where k='room_u1' and e->>'user_id' = 'aaaaaaaa-0000-0000-0000-000000000002' and e->'equipped'->>'skin' = 'skin.alex') = 1, 'tampilan u2 terlihat';
  assert (select count(*) from out, jsonb_array_elements(v) e where k='room_u1' and e->>'user_id' = 'aaaaaaaa-0000-0000-0000-000000000003') = 0, 'non-anggota tidak ikut';
  assert (select v from out where k='room_u3') = '[]'::jsonb, 'anggota tanpa data -> kosong';
end $$;

-- ===== 12. Hapus akun membersihkan data =====
delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000002';
do $$ begin
  assert not exists (select 1 from public.player_outfits where user_id='aaaaaaaa-0000-0000-0000-000000000002');
  assert not exists (select 1 from public.player_appearance where user_id='aaaaaaaa-0000-0000-0000-000000000002');
end $$;
rollback;
