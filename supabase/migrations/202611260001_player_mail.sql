-- Mail (kotak masuk) otoritatif server. Surat HANYA dibuat server/admin; klien hanya membaca, menandai dibaca, mengklaim, menghapus.
-- Hadiah (coin/gem) masuk ke dompet lewat _wallet_apply (idempoten per surat) -> tidak bisa diklaim dua kali.
-- Pengiriman: select public._mail_send(<user_id>, 'reward'|'system', judul, isi, coin, gem, dedupe_key, kedaluwarsa)  -- lewat SQL Editor / RPC lain di server.
-- Kirim ke semua pemain: select public._mail_send_all(judul, isi, coin, gem, dedupe_key, kedaluwarsa)  (dedupe_key wajib -> aman dijalankan ulang).
-- Idempoten (create ... if not exists / create or replace).

create table if not exists public.player_mail (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('reward', 'system')),
  title        text not null check (char_length(title) between 1 and 80),
  body         text not null check (char_length(body)  between 1 and 500),
  reward_coins bigint not null default 0 check (reward_coins between 0 and 1000000),
  reward_gems  bigint not null default 0 check (reward_gems  between 0 and 10000),
  dedupe_key   text check (dedupe_key is null or char_length(dedupe_key) between 1 and 80),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz,
  read_at      timestamptz,
  claimed_at   timestamptz,
  deleted_at   timestamptz,   -- hapus = tandai (bukan buang baris): dedupe_key tetap tercatat, surat sambutan tidak muncul lagi
  check ((kind = 'reward') = (reward_coins > 0 or reward_gems > 0)),
  check (claimed_at is null or kind = 'reward')
);
create unique index if not exists player_mail_dedupe_uq on public.player_mail (user_id, dedupe_key) where dedupe_key is not null;
create index if not exists player_mail_user_idx on public.player_mail (user_id, created_at desc) where deleted_at is null;
alter table public.player_mail enable row level security;
revoke all on public.player_mail from anon, authenticated;   -- semua akses lewat RPC

-- ============ Fungsi internal (TIDAK bisa dipanggil klien) ============
-- Kirim satu surat. Return id surat, atau NULL bila dedupe_key itu sudah pernah dipakai untuk pemain ini.
-- Pemangkasan: surat sudah dibaca & selesai (sistem, atau hadiah sudah diklaim) di luar 99 terbaru ditandai terhapus. Surat belum dibaca / hadiah tertunda tidak pernah dipangkas.
create or replace function public._mail_send(
  p_user uuid, p_kind text, p_title text, p_body text,
  p_coins bigint default 0, p_gems bigint default 0, p_dedupe text default null, p_expires timestamptz default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_user is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.player_mail set deleted_at = now()
   where id in (
     select id from public.player_mail
      where user_id = p_user and deleted_at is null and read_at is not null and (kind = 'system' or claimed_at is not null)
      order by created_at desc offset 99);
  insert into public.player_mail(user_id, kind, title, body, reward_coins, reward_gems, dedupe_key, expires_at)
  values (p_user, p_kind, p_title, p_body, coalesce(p_coins, 0), coalesce(p_gems, 0), p_dedupe, p_expires)
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public._mail_send(uuid, text, text, text, bigint, bigint, text, timestamptz) from public, anon, authenticated;

-- Kirim ke semua akun yang punya dompet. dedupe_key WAJIB. Return jumlah surat baru. (Tidak memangkas kotak masuk.)
create or replace function public._mail_send_all(
  p_title text, p_body text, p_coins bigint default 0, p_gems bigint default 0, p_dedupe text default null, p_expires timestamptz default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if p_dedupe is null then raise exception 'DEDUPE_REQUIRED'; end if;
  insert into public.player_mail(user_id, kind, title, body, reward_coins, reward_gems, dedupe_key, expires_at)
  select w.user_id, case when coalesce(p_coins, 0) > 0 or coalesce(p_gems, 0) > 0 then 'reward' else 'system' end,
         p_title, p_body, coalesce(p_coins, 0), coalesce(p_gems, 0), p_dedupe, p_expires
    from public.player_wallet w
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function public._mail_send_all(text, text, bigint, bigint, text, timestamptz) from public, anon, authenticated;

-- ============ RPC untuk klien (hanya authenticated) ============
-- Ringkas untuk titik merah Mail di lobby.
create or replace function public.mail_summary() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  return (select jsonb_build_object('ok', true,
            'unread',  count(*) filter (where read_at is null),
            'pending', count(*) filter (where kind = 'reward' and claimed_at is null))
            from public.player_mail
           where user_id = v_uid and deleted_at is null and (expires_at is null or expires_at > now()));
end;
$$;
revoke all on function public.mail_summary() from public, anon;
grant execute on function public.mail_summary() to authenticated;

-- Daftar surat (terbaru di atas). Surat sambutan dibuat sekali per akun saat kotak masuk pertama dibuka.
create or replace function public.mail_list(p_limit int default 50) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_lim int := least(greatest(coalesce(p_limit, 50), 1), 100); v_mails jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public._mail_send(v_uid, 'system', 'Selamat datang di Dragon Roll',
    'Lempar dadu, kalahkan lawan, dan kumpulkan koleksi karakter. Selamat bersenang-senang!', 0, 0, 'welcome', null);
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'kind', kind, 'title', title, 'body', body,
           'coins', reward_coins, 'gems', reward_gems,
           'at', created_at, 'expires_at', expires_at,
           'read', read_at is not null, 'claimed', claimed_at is not null) order by created_at desc, id), '[]'::jsonb)
    into v_mails
    from (select * from public.player_mail
           where user_id = v_uid and deleted_at is null and (expires_at is null or expires_at > now())
           order by created_at desc, id limit v_lim) t;
  return jsonb_build_object('ok', true, 'mails', v_mails,
    'unread',  (select count(*) from public.player_mail where user_id = v_uid and deleted_at is null and (expires_at is null or expires_at > now()) and read_at is null),
    'pending', (select count(*) from public.player_mail where user_id = v_uid and deleted_at is null and (expires_at is null or expires_at > now()) and kind = 'reward' and claimed_at is null));
end;
$$;
revoke all on function public.mail_list(int) from public, anon;
grant execute on function public.mail_list(int) to authenticated;

create or replace function public.mail_read(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_n int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.player_mail set read_at = coalesce(read_at, now())
   where id = p_id and user_id = v_uid and deleted_at is null and (expires_at is null or expires_at > now());
  get diagnostics v_n = row_count;
  if v_n = 0 then return jsonb_build_object('ok', false, 'reason', 'tidak-ada'); end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.mail_read(uuid) from public, anon;
grant execute on function public.mail_read(uuid) to authenticated;

create or replace function public.mail_read_all() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_n int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.player_mail set read_at = now()
   where user_id = v_uid and deleted_at is null and read_at is null and (expires_at is null or expires_at > now());
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'count', v_n);
end;
$$;
revoke all on function public.mail_read_all() from public, anon;
grant execute on function public.mail_read_all() to authenticated;

-- Klaim satu hadiah. Kunci idempoten dompet = id surat ('mail', <id>): klaim ganda mustahil walau dipanggil bersamaan.
create or replace function public.mail_claim(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_m public.player_mail; v_res jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;          -- serialisasi klaim per akun
  select * into v_m from public.player_mail where id = p_id and user_id = v_uid and deleted_at is null for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'tidak-ada'); end if;
  if v_m.kind <> 'reward' then return jsonb_build_object('ok', false, 'reason', 'tanpa-hadiah'); end if;
  if v_m.claimed_at is not null then return jsonb_build_object('ok', false, 'reason', 'sudah-diklaim'); end if;
  if v_m.expires_at is not null and v_m.expires_at <= now() then return jsonb_build_object('ok', false, 'reason', 'kedaluwarsa'); end if;
  v_res := public._wallet_apply(v_uid, v_m.reward_coins, v_m.reward_gems, 'mail', v_m.id::text);
  update public.player_mail set claimed_at = now(), read_at = coalesce(read_at, now()) where id = v_m.id;
  return jsonb_build_object('ok', true, 'coins', (v_res ->> 'coins')::bigint, 'gems', (v_res ->> 'gems')::bigint,
                            'reward', jsonb_build_object('coins', v_m.reward_coins, 'gems', v_m.reward_gems));
end;
$$;
revoke all on function public.mail_claim(uuid) from public, anon;
grant execute on function public.mail_claim(uuid) to authenticated;

-- Klaim semua hadiah tertunda (maks. 100 surat sekali panggil, tertua dulu).
create or replace function public.mail_claim_all() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_m public.player_mail; v_n int := 0; v_c bigint := 0; v_g bigint := 0; v_w public.player_wallet;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public._wallet_ensure(v_uid);
  perform 1 from public.player_wallet where user_id = v_uid for update;
  for v_m in
    select * from public.player_mail
     where user_id = v_uid and deleted_at is null and kind = 'reward' and claimed_at is null and (expires_at is null or expires_at > now())
     order by created_at, id limit 100 for update
  loop
    perform public._wallet_apply(v_uid, v_m.reward_coins, v_m.reward_gems, 'mail', v_m.id::text);
    update public.player_mail set claimed_at = now(), read_at = coalesce(read_at, now()) where id = v_m.id;
    v_n := v_n + 1; v_c := v_c + v_m.reward_coins; v_g := v_g + v_m.reward_gems;
  end loop;
  if v_n = 0 then return jsonb_build_object('ok', false, 'reason', 'tidak-ada-hadiah'); end if;
  select * into v_w from public.player_wallet where user_id = v_uid;
  return jsonb_build_object('ok', true, 'count', v_n, 'coins', v_w.coins, 'gems', v_w.gems,
                            'reward', jsonb_build_object('coins', v_c, 'gems', v_g));
end;
$$;
revoke all on function public.mail_claim_all() from public, anon;
grant execute on function public.mail_claim_all() to authenticated;

-- Hapus surat (ditandai). Surat dengan hadiah yang belum diklaim TIDAK bisa dihapus: hadiah tidak hilang tanpa sengaja.
create or replace function public.mail_delete(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_m public.player_mail;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_m from public.player_mail where id = p_id and user_id = v_uid and deleted_at is null for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'tidak-ada'); end if;
  if v_m.kind = 'reward' and v_m.claimed_at is null and (v_m.expires_at is null or v_m.expires_at > now()) then
    return jsonb_build_object('ok', false, 'reason', 'hadiah-belum-diklaim');
  end if;
  update public.player_mail set deleted_at = now(), read_at = coalesce(read_at, now()) where id = v_m.id;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.mail_delete(uuid) from public, anon;
grant execute on function public.mail_delete(uuid) to authenticated;
