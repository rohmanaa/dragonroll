-- ============================================================================
-- TAMBANG (Dragon Roll Mining World) — skema + RPC server, Supabase / Postgres.
-- Terapkan SETELAH 202611110001_wallet_b1.sql (memakai public._wallet_apply).
-- Idempoten: aman dijalankan ulang (create if not exists / create or replace).
--
-- Prinsip (sama dengan dompet B1):
--   * Klien TIDAK pernah mengirim nominal/jumlah barang. Semua angka dihitung di server.
--   * Tabel tidak bisa diakses langsung (RLS aktif + revoke); klien hanya lewat RPC (authenticated).
--   * Setiap perubahan Koin/Emerald lewat public._wallet_apply -> tercatat di wallet_ledger, anti-dobel.
--   * Angka ekonomi = salinan tambang-data.js (mode lokal). Ubah di public._tb_cfg() SAJA bila mau menyeimbangkan.
-- ============================================================================

-- ============ 1. Konfigurasi ekonomi (satu tempat) ============
-- Array bergaya JSON; indeks = level / nomor tambang (indeks 0 = placeholder).
create or replace function public._tb_cfg() returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'start_coins', 250,            -- hadiah awal sekali (mirip pratinjau lokal 1250 = 1000 dompet + 250). 0 untuk mematikan
    'start_gems',  12,
    'base',    jsonb_build_array(0,0.8,1.2,2,3.2,4.8,7.2),            -- ore/jam dasar per tambang
    'unlock',  jsonb_build_array(0,500,2000,6000,15000,40000,100000),   -- biaya buka tambang (Koin)
    'smult',   jsonb_build_array(0,1,1.25,1.5,1.75,2),                  -- pengali level kecepatan
    'cap',     jsonb_build_array(0,15,20,25,30,40),                     -- kapasitas peti tambang per level
    'upc_speed', jsonb_build_array(0,0,400,1000,2500,6000),
    'upc_cap',   jsonb_build_array(0,0,300,800,2000,5000),
    'upf',     jsonb_build_array(0,1,1.5,2,2.5,3,3.5),                  -- pengali biaya per nomor tambang
    'bcost',   jsonb_build_array(0,150,200,300,450,650,900),            -- biaya boost (Koin)
    'mgr',     jsonb_build_array(0,1,2,3,5,8),                          -- biaya Manager (Emerald)
    'boost_mult', 2, 'boost_secs', 14400, 'boost_daily', 4,
    'work_secs', 1800, 'rest_secs', 600, 'rest_mgr_secs', 300,          -- kerja 30 mnt, istirahat 10 mnt (5 mnt dgn Manager)
    'mix', jsonb_build_object(
      '1', jsonb_build_object('copper',1),
      '2', jsonb_build_object('coal',0.5,'iron',0.5),
      '3', jsonb_build_object('lapis',0.5,'amethyst',0.5),
      '4', jsonb_build_object('gold',0.6,'lapis',0.4),
      '5', jsonb_build_object('diamond',0.4,'gold',0.3,'amethyst',0.3)),
    'gems', jsonb_build_array('lapis','amethyst','diamond'),            -- permata: tidak dilebur, langsung jadi barang
    'lift_cap',     jsonb_build_array(0,20,35,60,100,160),
    'lift_cap_cost',jsonb_build_array(0,0,800,2200,6000,15000),
    'lift_spd',     jsonb_build_array(0,1,1.4,1.9),
    'lift_spd_cost',jsonb_build_array(0,0,1500,5000),
    'sweep_secs', 15,
    'g_cap',      jsonb_build_array(0,60,120,250,500,1000),             -- kapasitas Gudang
    'g_cap_cost', jsonb_build_array(0,0,600,1800,5000,14000),
    'g_off',      jsonb_build_array(0,2,3),                             -- jam akumulasi offline
    'g_off_cost', jsonb_build_array(0,0,3000),
    'keep_wood', 10, 'keep_coal', 5,                                    -- cadangan bahan bakar: tidak ikut diklaim
    'forest_max', 3, 'forest_hire', jsonb_build_array(0,600,1500,4000), 'chop_secs', 12, 'wood_per_tree', 4,
    'furn_max', 3, 'furn_cost', jsonb_build_array(0,0,3000,9000), 'smelt_secs', 6,
    'fuel_wood', 2, 'fuel_coal', 4,
    'recipes', jsonb_build_object(                                      -- ore -> batangan : bahan bakar per batang
      'copper', jsonb_build_object('fuel',1), 'iron', jsonb_build_object('fuel',1), 'gold', jsonb_build_object('fuel',2)),
    'drop', jsonb_build_object(                                         -- gacha tiap ore tiba di Gudang
      'coin_p',0.06,'coin_max',5,'gem_p',0.015,'gem_max',2,'power_p',0.008,'power_max',1),
    'powers', jsonb_build_array('sword','feather','tnt','totem','potion_odd','potion_even','grass','diamond_sword',
      'netherite_sword','wooden_shield','golden_apple','fire_charge','ice_crystal','blaze_core','trident','dragon_crystal','nether_star'),
    'sell', jsonb_build_object(
      'goods', jsonb_build_object('copper',20,'iron',30,'lapis',80,'gold',120,'amethyst',150,'diamond',400),
      'ore',   jsonb_build_object('copper',5,'iron',7,'lapis',20,'gold',30,'amethyst',25,'diamond',60,'coal',3),
      'wood',  jsonb_build_object('wood',1))
  );
$$;

-- ============ 2. Tabel ============
create table if not exists public.tambang_player (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  t0          timestamptz not null default now(),       -- patokan siklus kerja/istirahat global (penebang & tukang bakar)
  lift_cap    smallint not null default 1 check (lift_cap between 1 and 5),
  lift_spd    smallint not null default 1 check (lift_spd between 1 and 3),
  g_cap       smallint not null default 1 check (g_cap between 1 and 5),
  g_off       smallint not null default 1 check (g_off between 1 and 2),
  furn        smallint not null default 0 check (furn between 0 and 3),
  forest_workers smallint not null default 0 check (forest_workers between 0 and 3),
  store       jsonb not null default '{"ore":{},"goods":{},"wood":0}',   -- isi Gudang
  bag         jsonb not null default '{"ore":{},"goods":{},"wood":0}',   -- Inventori pemain
  transit     jsonb,                                    -- muatan lift yang sedang jalan {mine,ores,n}
  sweep_n     bigint not null default 0,                -- penghitung perjalanan lift (kunci anti-dobel)
  sell_n      bigint not null default 0,
  swi         smallint not null default 0,              -- tambang berikut yang disapu lift
  last_sweep  timestamptz not null default now(),
  last_work   timestamptz not null default now(),       -- terakhir penebang/tukang bakar diselesaikan
  drop_day    date not null default current_date,
  drop_coin   smallint not null default 0,
  drop_gem    smallint not null default 0,
  drop_power  smallint not null default 0,
  powers      jsonb not null default '{}',
  claim_total bigint not null default 0,                -- statistik saja; TIDAK ada batas harian
  seen        timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.tambang_mine (
  user_id     uuid not null references auth.users(id) on delete cascade,
  slot        smallint not null check (slot between 1 and 5),
  speed_lv    smallint not null default 1 check (speed_lv between 1 and 5),
  cap_lv      smallint not null default 1 check (cap_lv between 1 and 5),
  mgr         boolean  not null default false,
  stock       numeric  not null default 0 check (stock >= 0),
  at          timestamptz not null default now(),       -- stock berlaku pada waktu ini
  t0          timestamptz not null default now(),       -- patokan siklus kerja/istirahat
  boost_until timestamptz,
  boost_day   date,
  boost_n     smallint not null default 0,
  primary key (user_id, slot)
);

create table if not exists public.tambang_event (       -- jejak audit ringan (bukan sumber kebenaran saldo)
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (char_length(kind) between 1 and 30),
  detail     jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists tambang_event_user_idx on public.tambang_event (user_id, id desc);

alter table public.tambang_player enable row level security;
alter table public.tambang_mine   enable row level security;
alter table public.tambang_event  enable row level security;
revoke all on public.tambang_player, public.tambang_mine, public.tambang_event from anon, authenticated;

-- ============ 3. Fungsi internal (TIDAK bisa dipanggil klien) ============
create or replace function public._tb_day() returns date
language sql stable as $$ select (now() at time zone 'Asia/Jakarta')::date $$;

-- ambil elemen array cfg (indeks 0-based) sebagai numeric
create or replace function public._tb_n(p_key text, p_i int) returns numeric
language sql immutable as $$ select (public._tb_cfg() -> p_key ->> p_i)::numeric $$;

create or replace function public._tb_bag_total(b jsonb) returns bigint
language sql immutable as $$
  select coalesce((select sum(v::bigint) from jsonb_each_text(b->'ore')   as x(k,v)),0)
       + coalesce((select sum(v::bigint) from jsonb_each_text(b->'goods') as x(k,v)),0)
       + coalesce((b->>'wood')::bigint,0)
$$;

-- tambah/kurangi 1 item di tas: grp 'ore'|'goods'; item 'wood' lewat grp 'wood'
create or replace function public._tb_bag_add(b jsonb, p_grp text, p_item text, p_n bigint) returns jsonb
language plpgsql immutable as $$
declare cur bigint;
begin
  if p_grp = 'wood' then
    return jsonb_set(b, '{wood}', to_jsonb(coalesce((b->>'wood')::bigint,0) + p_n));
  end if;
  cur := coalesce((b->p_grp->>p_item)::bigint, 0);
  return jsonb_set(b, array[p_grp, p_item], to_jsonb(cur + p_n), true);
end $$;

create or replace function public._tb_bag_get(b jsonb, p_grp text, p_item text) returns bigint
language sql immutable as $$
  select case when p_grp = 'wood' then coalesce((b->>'wood')::bigint,0)
              else coalesce((b->p_grp->>p_item)::bigint,0) end
$$;

-- detik KERJA antara a dan b untuk siklus (t0, W kerja, C total)
create or replace function public._tb_worked_to(p_t0 timestamptz, p_x timestamptz, w numeric, c numeric) returns numeric
language sql immutable as $$
  select floor(d / c) * w + least(w, d - floor(d / c) * c)
  from (select greatest(0, extract(epoch from (p_x - p_t0))) as d) q
$$;

create or replace function public._tb_worked(p_t0 timestamptz, p_a timestamptz, p_b timestamptz, p_mgr boolean) returns numeric
language sql immutable as $$
  with k as (select (public._tb_cfg()->>'work_secs')::numeric w,
                    (public._tb_cfg()->>'work_secs')::numeric + (case when p_mgr then (public._tb_cfg()->>'rest_mgr_secs')::numeric
                                                                     else (public._tb_cfg()->>'rest_secs')::numeric end) c)
  select greatest(0, public._tb_worked_to(p_t0, p_b, k.w, k.c) - public._tb_worked_to(p_t0, p_a, k.w, k.c)) from k
$$;

-- stok tambang pada waktu p_now (dibatasi kapasitas), termasuk bonus boost
create or replace function public._tb_stock(m public.tambang_mine, p_now timestamptz) returns numeric
language plpgsql stable as $$
declare
  cfg jsonb := public._tb_cfg();
  rate numeric := (cfg->'base'->>m.slot)::numeric * (cfg->'smult'->>m.speed_lv)::numeric;
  cap  numeric := (cfg->'cap'->>m.cap_lv)::numeric;
  w numeric; wb numeric := 0;
begin
  w := public._tb_worked(m.t0, m.at, p_now, m.mgr);
  if m.boost_until is not null and m.boost_until > m.at then
    wb := public._tb_worked(m.t0, m.at, least(m.boost_until, p_now), m.mgr);
  end if;
  return least(cap, m.stock + rate * (w + wb * ((cfg->>'boost_mult')::numeric - 1)) / 3600.0);
end $$;

-- bagi n ore menurut bobot (sisa terbesar) -> jsonb {ore: jumlah}
create or replace function public._tb_alloc(p_n int, p_mix jsonb) returns jsonb
language plpgsql immutable as $$
declare
  out jsonb := '{}'; k text; x numeric; f int; used int := 0; rem record; j int := 0; cnt int;
begin
  for k, x in select key, value::numeric * p_n from jsonb_each_text(p_mix) loop
    f := floor(x); out := out || jsonb_build_object(k, f); used := used + f;
  end loop;
  cnt := (select count(*) from jsonb_object_keys(p_mix));
  while used < p_n loop
    select key into k from (
      select key, (value::numeric * p_n) - floor(value::numeric * p_n) as fr
      from jsonb_each_text(p_mix) order by fr desc, key offset (j % cnt) limit 1) s;
    out := jsonb_set(out, array[k], to_jsonb((out->>k)::int + 1));
    used := used + 1; j := j + 1;
  end loop;
  return out;
end $$;

create or replace function public._tb_ensure(p_user uuid) returns public.tambang_player
language plpgsql security definer set search_path = public as $$
declare p public.tambang_player; cfg jsonb := public._tb_cfg(); sc bigint := (cfg->>'start_coins')::bigint; sg bigint := (cfg->>'start_gems')::bigint;
begin
  if p_user is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.tambang_player(user_id) values (p_user) on conflict (user_id) do nothing;
  select * into p from public.tambang_player where user_id = p_user for update;   -- kunci: tidak ada balapan antar-RPC
  perform public._wallet_ensure(p_user);                                  -- saldo awal dompet standar (1000 Koin)
  if sc > 0 or sg > 0 then perform public._wallet_apply(p_user, sc, sg, 'tb_start', 'start'); end if;   -- idempoten (ledger unik)
  return p;
end $$;

create or replace function public._tb_log(p_user uuid, p_kind text, p_detail jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.tambang_event(user_id, kind, detail) values (p_user, p_kind, coalesce(p_detail,'{}'));
$$;

revoke all on function public._tb_cfg(), public._tb_day(), public._tb_n(text,int), public._tb_bag_total(jsonb),
  public._tb_bag_add(jsonb,text,text,bigint), public._tb_bag_get(jsonb,text,text),
  public._tb_worked_to(timestamptz,timestamptz,numeric,numeric), public._tb_worked(timestamptz,timestamptz,timestamptz,boolean),
  public._tb_stock(public.tambang_mine,timestamptz), public._tb_alloc(int,jsonb),
  public._tb_ensure(uuid), public._tb_log(uuid,text,jsonb) from public, anon, authenticated;

-- JSON keadaan lengkap untuk klien
create or replace function public._tb_state(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p public.tambang_player; cfg jsonb := public._tb_cfg(); w public.player_wallet; ms jsonb; today date := public._tb_day();
begin
  select * into p from public.tambang_player where user_id = p_user;
  select * into w from public.player_wallet where user_id = p_user;
  select coalesce(jsonb_agg(jsonb_build_object(
      'slot', m.slot, 'speed_lv', m.speed_lv, 'cap_lv', m.cap_lv, 'mgr', m.mgr,
      'stock', public._tb_stock(m, now()), 'cap', (cfg->'cap'->>m.cap_lv)::numeric,
      'boost_left_secs', greatest(0, ceil(extract(epoch from (coalesce(m.boost_until, now()) - now())))),
      'boost_left_today', (cfg->>'boost_daily')::int - (case when m.boost_day = today then m.boost_n else 0 end),
      't0', m.t0) order by m.slot), '[]')
    into ms from public.tambang_mine m where m.user_id = p_user;
  return jsonb_build_object('ok', true, 'now', now(),
    'coins', coalesce(w.coins,0), 'gems', coalesce(w.gems,0), 'mines', ms,
    'lift', jsonb_build_object('cap_lv', p.lift_cap, 'spd_lv', p.lift_spd,
      'cap', (cfg->'lift_cap'->>p.lift_cap)::int, 'spd', (cfg->'lift_spd'->>p.lift_spd)::numeric,
      'transit', p.transit),
    'gudang', jsonb_build_object('cap_lv', p.g_cap, 'cap', (cfg->'g_cap'->>p.g_cap)::int, 'used', public._tb_bag_total(p.store),
      'off_lv', p.g_off, 'off_h', (cfg->'g_off'->>p.g_off)::int),
    'store', p.store, 'bag', p.bag, 'furn', p.furn, 'forest_workers', p.forest_workers,
    'drops', jsonb_build_object('day', p.drop_day, 'coin', case when p.drop_day = today then p.drop_coin else 0 end,
      'gem', case when p.drop_day = today then p.drop_gem else 0 end, 'power', case when p.drop_day = today then p.drop_power else 0 end),
    'powers', p.powers, 't0', p.t0);
end $$;
revoke all on function public._tb_state(uuid) from public, anon, authenticated;

-- ============ 4. RPC untuk klien (authenticated) ============
-- Semua RPC: {ok:true,...,state} atau {ok:false, reason:'...'}  (reason sama dengan mode lokal)

create or replace function public.tambang_get() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.tambang_player;
begin
  p := public._tb_ensure(uid);
  update public.tambang_player set seen = now() where user_id = uid;
  return public._tb_state(uid);
end $$;

create or replace function public.tambang_unlock(p_slot int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.tambang_player; cost bigint;
begin
  p := public._tb_ensure(uid);
  if p_slot not between 1 and 5 then return jsonb_build_object('ok', false, 'reason', 'tambang-tidak-ada'); end if;
  if exists (select 1 from public.tambang_mine where user_id = uid and slot = p_slot) then return jsonb_build_object('ok', false, 'reason', 'sudah-dibuka'); end if;
  if p_slot > 1 and not exists (select 1 from public.tambang_mine where user_id = uid and slot = p_slot - 1) then
    return jsonb_build_object('ok', false, 'reason', 'buka-berurutan'); end if;
  cost := public._tb_n('unlock', p_slot);
  begin
    perform public._wallet_apply(uid, -cost, 0, 'tb_unlock', 'm' || p_slot);
  exception when others then
    if sqlerrm = 'INSUFFICIENT_COINS' then return jsonb_build_object('ok', false, 'reason', 'saldo-kurang'); end if; raise;
  end;
  insert into public.tambang_mine(user_id, slot) values (uid, p_slot);
  perform public._tb_log(uid, 'unlock', jsonb_build_object('slot', p_slot, 'cost', cost));
  return public._tb_state(uid);
end $$;

-- kind: 'speed' | 'cap'
create or replace function public.tambang_upgrade(p_slot int, p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.tambang_player; m public.tambang_mine; lv int; cost bigint; st numeric;
begin
  p := public._tb_ensure(uid);
  if p_kind not in ('speed','cap') then return jsonb_build_object('ok', false, 'reason', 'jenis-salah'); end if;
  select * into m from public.tambang_mine where user_id = uid and slot = p_slot for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'terkunci'); end if;
  lv := case when p_kind = 'speed' then m.speed_lv else m.cap_lv end;
  if lv >= 5 then return jsonb_build_object('ok', false, 'reason', 'level-maks'); end if;
  cost := round(public._tb_n('upc_' || p_kind, lv + 1) * public._tb_n('upf', p_slot));
  begin
    perform public._wallet_apply(uid, -cost, 0, 'tb_up_' || p_kind, p_slot || '-' || (lv + 1));
  exception when others then
    if sqlerrm = 'INSUFFICIENT_COINS' then return jsonb_build_object('ok', false, 'reason', 'saldo-kurang'); end if; raise;
  end;
  st := public._tb_stock(m, now());                      -- kunci stok sebelum laju berubah
  update public.tambang_mine set stock = st, at = now(),
    speed_lv = speed_lv + (case when p_kind = 'speed' then 1 else 0 end),
    cap_lv   = cap_lv   + (case when p_kind = 'cap'   then 1 else 0 end)
  where user_id = uid and slot = p_slot;
  return public._tb_state(uid);
end $$;

create or replace function public.tambang_manager(p_slot int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.tambang_player; m public.tambang_mine; cost bigint; st numeric;
begin
  p := public._tb_ensure(uid);
  select * into m from public.tambang_mine where user_id = uid and slot = p_slot for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'terkunci'); end if;
  if m.mgr then return jsonb_build_object('ok', false, 'reason', 'sudah-dibuka'); end if;
  cost := public._tb_n('mgr', p_slot);
  begin
    perform public._wallet_apply(uid, 0, -cost, 'tb_mgr', 'm' || p_slot);
  exception when others then
    if sqlerrm = 'INSUFFICIENT_GEMS' then return jsonb_build_object('ok', false, 'reason', 'emerald-kurang'); end if; raise;
  end;
  st := public._tb_stock(m, now());
  update public.tambang_mine set stock = st, at = now(), t0 = now(), mgr = true where user_id = uid and slot = p_slot;
  return public._tb_state(uid);
end $$;

create or replace function public.tambang_boost(p_slot int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.tambang_player; m public.tambang_mine; cfg jsonb := public._tb_cfg(); today date := public._tb_day(); n int; cost bigint; st numeric;
begin
  p := public._tb_ensure(uid);
  select * into m from public.tambang_mine where user_id = uid and slot = p_slot for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'terkunci'); end if;
  if not m.mgr then return jsonb_build_object('ok', false, 'reason', 'perlu-manager'); end if;
  if m.boost_until is not null and m.boost_until > now() then return jsonb_build_object('ok', false, 'reason', 'boost-aktif'); end if;
  n := case when m.boost_day = today then m.boost_n else 0 end;
  if n >= (cfg->>'boost_daily')::int then return jsonb_build_object('ok', false, 'reason', 'batas-harian'); end if;
  cost := public._tb_n('bcost', p_slot);
  begin
    perform public._wallet_apply(uid, -cost, 0, 'tb_boost', p_slot || '-' || (extract(epoch from clock_timestamp()) * 1000000)::bigint);
  exception when others then
    if sqlerrm = 'INSUFFICIENT_COINS' then return jsonb_build_object('ok', false, 'reason', 'saldo-kurang'); end if; raise;
  end;
  st := public._tb_stock(m, now());
  update public.tambang_mine set stock = st, at = now(),
    boost_until = now() + make_interval(secs => (cfg->>'boost_secs')::int), boost_day = today, boost_n = n + 1
  where user_id = uid and slot = p_slot;
  return public._tb_state(uid);
end $$;

-- kind: 'cap' | 'spd'
create or replace function public.tambang_lift_upgrade(p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.tambang_player; lv int; cost bigint;
begin
  p := public._tb_ensure(uid);
  if p_kind = 'cap' then
    if p.lift_cap >= 5 then return jsonb_build_object('ok', false, 'reason', 'level-maks'); end if;
    lv := p.lift_cap + 1; cost := public._tb_n('lift_cap_cost', lv);
  elsif p_kind = 'spd' then
    if p.lift_spd >= 3 then return jsonb_build_object('ok', false, 'reason', 'level-maks'); end if;
    lv := p.lift_spd + 1; cost := public._tb_n('lift_spd_cost', lv);
  else return jsonb_build_object('ok', false, 'reason', 'jenis-salah'); end if;
  begin
    perform public._wallet_apply(uid, -cost, 0, 'tb_lift_' || p_kind, lv::text);
  exception when others then
    if sqlerrm = 'INSUFFICIENT_COINS' then return jsonb_build_object('ok', false, 'reason', 'saldo-kurang'); end if; raise;
  end;
  if p_kind = 'cap' then update public.tambang_player set lift_cap = lv, updated_at = now() where user_id = uid;
  else update public.tambang_player set lift_spd = lv, updated_at = now() where user_id = uid; end if;
  return public._tb_state(uid);
end $$;

-- kind: 'cap' (kapasitas peti Gudang) | 'off' (jam akumulasi offline). TIDAK ada batas klaim harian.
create or replace function public.tambang_gudang_upgrade(p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.tambang_player; lv int; cost bigint;
begin
  p := public._tb_ensure(uid);
  if p_kind = 'cap' then
    if p.g_cap >= 5 then return jsonb_build_object('ok', false, 'reason', 'level-maks'); end if;
    lv := p.g_cap + 1; cost := public._tb_n('g_cap_cost', lv);
  elsif p_kind = 'off' then
    if p.g_off >= 2 then return jsonb_build_object('ok', false, 'reason', 'level-maks'); end if;
    lv := p.g_off + 1; cost := public._tb_n('g_off_cost', lv);
  else return jsonb_build_object('ok', false, 'reason', 'jenis-salah'); end if;
  begin
    perform public._wallet_apply(uid, -cost, 0, 'tb_g_' || p_kind, lv::text);
  exception when others then
    if sqlerrm = 'INSUFFICIENT_COINS' then return jsonb_build_object('ok', false, 'reason', 'saldo-kurang'); end if; raise;
  end;
  if p_kind = 'cap' then update public.tambang_player set g_cap = lv, updated_at = now() where user_id = uid;
  else update public.tambang_player set g_off = lv, updated_at = now() where user_id = uid; end if;
  return public._tb_state(uid);
end $$;

-- Furnace / penebang: beli sekali per level (kind 'furn' | 'forest')
create or replace function public.tambang_hire(p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.tambang_player; cfg jsonb := public._tb_cfg(); lv int; cost bigint;
begin
  p := public._tb_ensure(uid);
  if p_kind = 'furn' then
    if p.furn >= (cfg->>'furn_max')::int then return jsonb_build_object('ok', false, 'reason', 'level-maks'); end if;
    lv := p.furn + 1; cost := public._tb_n('furn_cost', lv);
  elsif p_kind = 'forest' then
    if p.forest_workers >= (cfg->>'forest_max')::int then return jsonb_build_object('ok', false, 'reason', 'level-maks'); end if;
    lv := p.forest_workers + 1; cost := public._tb_n('forest_hire', lv);
  else return jsonb_build_object('ok', false, 'reason', 'jenis-salah'); end if;
  begin
    perform public._wallet_apply(uid, -cost, 0, 'tb_hire_' || p_kind, lv::text);
  exception when others then
    if sqlerrm = 'INSUFFICIENT_COINS' then return jsonb_build_object('ok', false, 'reason', 'saldo-kurang'); end if; raise;
  end;
  if p_kind = 'furn' then update public.tambang_player set furn = lv, last_work = case when furn = 0 then now() else last_work end, updated_at = now() where user_id = uid;
  else update public.tambang_player set forest_workers = lv, last_work = case when forest_workers = 0 then now() else last_work end, updated_at = now() where user_id = uid; end if;
  return public._tb_state(uid);
end $$;

-- Satu perjalanan lift: tambang -> Gudang (+ gacha). Klien memanggil ~tiap 15 dtk dan sekali saat online lagi
-- (kejar offline dibatasi g_off jam). Server menolak bila terlalu cepat (rate-limit), jadi spam tidak menambah hasil.
create or replace function public.tambang_sweep() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); p public.tambang_player; cfg jsonb := public._tb_cfg(); now_ts timestamptz := now();
  trips int; offmax int; done int := 0; free bigint; ids int[]; i int; k int; j int; m public.tambang_mine; have int; n int; got jsonb;
  mix jsonb; item text; q int; dc int; dg int; coin_got bigint := 0; gem_got bigint := 0; powers_got text[] := '{}'; today date := public._tb_day();
  pw text; c bigint; total_ore int := 0; spd numeric; interval_s numeric; gcapv int; v_store jsonb; pws jsonb; err text; last_sw timestamptz;
begin
  p := public._tb_ensure(uid);
  spd := (cfg->'lift_spd'->>p.lift_spd)::numeric;                         -- lift lebih cepat -> interval lebih pendek
  interval_s := greatest(3, (cfg->>'sweep_secs')::numeric / spd);
  offmax := (cfg->'g_off'->>p.g_off)::int * 3600;
  trips := least(floor(extract(epoch from (now_ts - p.last_sweep)) / interval_s)::int,
                 floor(offmax / interval_s)::int, 2000);
  if trips < 1 then return public._tb_state(uid); end if;                 -- belum waktunya
  v_store := p.store; pws := p.powers; gcapv := (cfg->'g_cap'->>p.g_cap)::int;
  if p.drop_day <> today then p.drop_day := today; p.drop_coin := 0; p.drop_gem := 0; p.drop_power := 0; end if;
  select array_agg(slot order by slot) into ids from public.tambang_mine where user_id = uid;
  if ids is null then update public.tambang_player set last_sweep = now_ts where user_id = uid; return public._tb_state(uid); end if;

  while done < trips loop
    free := gcapv - public._tb_bag_total(v_store);
    exit when free < 1;
    -- pilih tambang berstok berikutnya (round-robin mulai p.swi)
    n := 0; i := null;
    for j in 0 .. array_length(ids,1) - 1 loop
      k := ids[((coalesce((select array_position(ids, x) from unnest(ids) x where x >= p.swi order by x limit 1), 1) - 1 + j) % array_length(ids,1)) + 1];
      select * into m from public.tambang_mine where user_id = uid and slot = k for update;
      have := floor(public._tb_stock(m, now_ts))::int;
      if have >= 1 then i := k; n := least(have, (cfg->'lift_cap'->>p.lift_cap)::int, free::int); exit; end if;
    end loop;
    exit when i is null;
    update public.tambang_mine set stock = public._tb_stock(m, now_ts) - n, at = now_ts where user_id = uid and slot = i;
    got := public._tb_alloc(n, cfg->'mix'->(i::text));
    for item, q in select key, value::int from jsonb_each_text(got) loop
      v_store := public._tb_bag_add(v_store, case when cfg->'gems' ? item then 'goods' else 'ore' end, item, q);
    end loop;
    total_ore := total_ore + n; p.swi := i + 1; p.sweep_n := p.sweep_n + 1; done := done + 1;
    -- gacha: peluang kecil per ore, dibatasi per hari (Asia/Jakarta)
    dc := 0; dg := 0;
    for k in 1 .. n loop
      if p.drop_coin < (cfg->'drop'->>'coin_max')::int and random() < (cfg->'drop'->>'coin_p')::numeric then
        c := round((40 + random() * 60) * (1 + i * 0.6)); coin_got := coin_got + c; p.drop_coin := p.drop_coin + 1; end if;
      if p.drop_gem < (cfg->'drop'->>'gem_max')::int and random() < (cfg->'drop'->>'gem_p')::numeric then
        gem_got := gem_got + 1 + (case when random() < 0.3 then 1 else 0 end); p.drop_gem := p.drop_gem + 1; end if;
      if p.drop_power < (cfg->'drop'->>'power_max')::int and random() < (cfg->'drop'->>'power_p')::numeric then
        pw := cfg->'powers'->>floor(random() * jsonb_array_length(cfg->'powers'))::int;
        powers_got := powers_got || pw; p.drop_power := p.drop_power + 1;
        pws := jsonb_set(pws, array[pw], to_jsonb(coalesce((pws->>pw)::int, 0) + 1), true); end if;
    end loop;
  end loop;

  if coin_got > 0 or gem_got > 0 then
    perform public._wallet_apply(uid, coin_got, gem_got, 'tb_drop', 's' || p.sweep_n);   -- ref unik per perjalanan
  end if;
  update public.tambang_player set store = v_store, powers = pws, swi = p.swi, sweep_n = p.sweep_n,
    drop_day = p.drop_day, drop_coin = p.drop_coin, drop_gem = p.drop_gem, drop_power = p.drop_power,
    last_sweep = case when done < trips then now_ts else p.last_sweep + make_interval(secs => done * interval_s) end,
    updated_at = now_ts
  where user_id = uid;
  return public._tb_state(uid) || jsonb_build_object('swept', jsonb_build_object('trips', done, 'ore', total_ore,
    'drop_coin', coin_got, 'drop_gem', gem_got, 'drop_power', to_jsonb(powers_got)));
end $$;

-- Penebang + tukang bakar (hitungan waktu, termasuk offline). Kerja 30 mnt / istirahat 10 mnt (rasio kerja 0.75 dipakai sbg hampiran).
create or replace function public.tambang_work() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); p public.tambang_player; cfg jsonb := public._tb_cfg(); now_ts timestamptz := now();
  duty numeric := (cfg->>'work_secs')::numeric / ((cfg->>'work_secs')::numeric + (cfg->>'rest_secs')::numeric);
  el numeric; offmax numeric; chops int; smelts int; v_store jsonb; free bigint; w int := 0; sm int := 0; rid text; fuel int; need int; uw int; uc int; cnt int;
begin
  p := public._tb_ensure(uid);
  offmax := (cfg->'g_off'->>p.g_off)::int * 3600;
  el := least(extract(epoch from (now_ts - p.last_work)), offmax) * duty;
  v_store := p.store;
  if p.forest_workers > 0 then
    chops := floor(el / (cfg->>'chop_secs')::numeric)::int * p.forest_workers;
    free := (cfg->'g_cap'->>p.g_cap)::int - public._tb_bag_total(v_store);
    w := least(chops * (cfg->>'wood_per_tree')::int, greatest(0, free))::int;
    if w > 0 then v_store := public._tb_bag_add(v_store, 'wood', 'wood', w); end if;
  end if;
  if p.furn > 0 then
    smelts := least(floor(el / (cfg->>'smelt_secs')::numeric)::int * p.furn, 5000);
    while smelts > 0 loop
      cnt := 0;
      for rid in select key from jsonb_each(cfg->'recipes') order by key loop
        fuel := (cfg->'recipes'->rid->>'fuel')::int;
        continue when public._tb_bag_get(v_store,'ore',rid) < 1;
        continue when public._tb_bag_get(v_store,'wood','wood') * (cfg->>'fuel_wood')::int + public._tb_bag_get(v_store,'ore','coal') * (cfg->>'fuel_coal')::int < fuel;
        need := fuel;
        uw := least(public._tb_bag_get(v_store,'wood','wood'), ceil(need::numeric / (cfg->>'fuel_wood')::int))::int;
        need := need - least(need, uw * (cfg->>'fuel_wood')::int);
        v_store := public._tb_bag_add(v_store,'wood','wood', -uw);
        if need > 0 then uc := ceil(need::numeric / (cfg->>'fuel_coal')::int)::int; v_store := public._tb_bag_add(v_store,'ore','coal', -uc); end if;
        v_store := public._tb_bag_add(v_store,'ore', rid, -1);
        v_store := public._tb_bag_add(v_store,'goods', rid, 1);
        sm := sm + 1; smelts := smelts - 1; cnt := cnt + 1;
        exit when smelts <= 0;
      end loop;
      exit when cnt = 0;
    end loop;
  end if;
  update public.tambang_player set store = v_store, last_work = now_ts, updated_at = now_ts where user_id = uid;
  return public._tb_state(uid) || jsonb_build_object('worked', jsonb_build_object('wood', w, 'smelted', sm));
end $$;

-- KLAIM: Gudang -> Inventori. Tanpa batas harian; cadangan bahan bakar (10 kayu + 5 batu bara) tetap tinggal di Gudang.
create or replace function public.tambang_claim() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.tambang_player; cfg jsonb := public._tb_cfg(); s jsonb; b jsonb; k text; q bigint; moved bigint := 0; keep bigint;
begin
  p := public._tb_ensure(uid); s := p.store; b := p.bag;
  if public._tb_bag_total(s) < 1 then return jsonb_build_object('ok', false, 'reason', 'gudang-kosong'); end if;
  for k, q in select key, value::bigint from jsonb_each_text(s->'goods') loop
    if q > 0 then b := public._tb_bag_add(b,'goods',k,q); s := public._tb_bag_add(s,'goods',k,-q); moved := moved + q; end if;
  end loop;
  for k, q in select key, value::bigint from jsonb_each_text(s->'ore') loop
    keep := case when k = 'coal' then (cfg->>'keep_coal')::bigint else 0 end;
    if q - keep > 0 then b := public._tb_bag_add(b,'ore',k,q-keep); s := public._tb_bag_add(s,'ore',k,-(q-keep)); moved := moved + (q-keep); end if;
  end loop;
  q := coalesce((s->>'wood')::bigint,0) - (cfg->>'keep_wood')::bigint;
  if q > 0 then b := public._tb_bag_add(b,'wood','wood',q); s := public._tb_bag_add(s,'wood','wood',-q); moved := moved + q; end if;
  if moved < 1 then return jsonb_build_object('ok', false, 'reason', 'hanya-cadangan'); end if;
  update public.tambang_player set store = s, bag = b, claim_total = claim_total + moved, updated_at = now() where user_id = uid;
  return public._tb_state(uid) || jsonb_build_object('moved', moved);
end $$;

-- JUAL dari Inventori -> Koin. p_grp 'goods'|'ore'|'wood'; p_qty null = semua. Harga dari _tb_cfg().
create or replace function public.tambang_sell(p_grp text, p_item text, p_qty int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.tambang_player; cfg jsonb := public._tb_cfg(); price numeric; have bigint; q bigint; c bigint;
begin
  p := public._tb_ensure(uid);
  price := (cfg->'sell'->p_grp->>p_item)::numeric;
  if price is null then return jsonb_build_object('ok', false, 'reason', 'barang-tidak-ada'); end if;
  have := public._tb_bag_get(p.bag, p_grp, p_item);
  q := least(coalesce(p_qty, have), have);
  if q < 1 then return jsonb_build_object('ok', false, 'reason', 'inventori-kosong'); end if;
  c := (price * q)::bigint;
  update public.tambang_player set bag = public._tb_bag_add(bag, p_grp, p_item, -q), sell_n = sell_n + 1, updated_at = now() where user_id = uid returning sell_n into p.sell_n;
  perform public._wallet_apply(uid, c, 0, 'tb_sell', p.sell_n::text);
  return public._tb_state(uid) || jsonb_build_object('sold', q, 'coins', c);
end $$;

create or replace function public.tambang_sell_all() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.tambang_player; cfg jsonb := public._tb_cfg(); grp text; item text; price numeric; have bigint; total bigint := 0; n bigint := 0; b jsonb;
begin
  p := public._tb_ensure(uid); b := p.bag;
  for grp in select jsonb_object_keys(cfg->'sell') loop
    for item, price in select key, value::numeric from jsonb_each_text(cfg->'sell'->grp) loop
      have := public._tb_bag_get(b, grp, item);
      if have > 0 then total := total + (price * have)::bigint; n := n + have; b := public._tb_bag_add(b, grp, item, -have); end if;
    end loop;
  end loop;
  if n < 1 then return jsonb_build_object('ok', false, 'reason', 'inventori-kosong'); end if;
  update public.tambang_player set bag = b, sell_n = sell_n + 1, updated_at = now() where user_id = uid returning sell_n into p.sell_n;
  perform public._wallet_apply(uid, total, 0, 'tb_sell', p.sell_n::text);
  return public._tb_state(uid) || jsonb_build_object('sold', n, 'coins', total);
end $$;

-- ============ 5. Hak akses: hanya pengguna login ============
revoke all on function public.tambang_get(), public.tambang_unlock(int), public.tambang_upgrade(int,text), public.tambang_manager(int),
  public.tambang_boost(int), public.tambang_lift_upgrade(text), public.tambang_gudang_upgrade(text), public.tambang_hire(text),
  public.tambang_sweep(), public.tambang_work(), public.tambang_claim(), public.tambang_sell(text,text,int), public.tambang_sell_all()
  from public, anon;
grant execute on function public.tambang_get(), public.tambang_unlock(int), public.tambang_upgrade(int,text), public.tambang_manager(int),
  public.tambang_boost(int), public.tambang_lift_upgrade(text), public.tambang_gudang_upgrade(text), public.tambang_hire(text),
  public.tambang_sweep(), public.tambang_work(), public.tambang_claim(), public.tambang_sell(text,text,int), public.tambang_sell_all()
  to authenticated;
