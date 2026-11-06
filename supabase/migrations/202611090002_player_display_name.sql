-- Nama tampilan di leaderboard/profil ditentukan SERVER, bukan nama kiriman klien.
-- Terapkan SETELAH 202611090001_player_progress.sql.
--
-- Akun game dibuat dengan email internal <username-huruf-kecil>@dragonroll-game.com (lihat assets/js/auth.js).
-- Email itu unik dan tidak bisa diubah pemain (tidak ada konfirmasi email), jadi dipakai sebagai sumber nama:
--   * akun terdaftar : nama = username dari akun (huruf besar/kecil dari metadata dipakai hanya bila cocok dengan email)
--   * pemain anonim  : nama dari klien, dibersihkan (karakter kontrol dibuang, spasi dirapikan, maks 24, kosong -> 'Player')
-- Efek: nama orang lain tidak bisa ditiru lewat parameter p_name di submit_match_result.

create or replace function public.player_stats_enforce_name()
returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare
  v_email text;
  v_local text;
  v_meta  text;
  v_name  text;
begin
  select u.email, nullif(btrim(coalesce(u.raw_user_meta_data ->> 'username', '')), '')
    into v_email, v_meta
  from auth.users u where u.id = new.user_id;

  if v_email is not null and lower(v_email) like '%@dragonroll-game.com' then
    v_local := split_part(v_email, '@', 1);
    v_name  := case when v_meta is not null and lower(v_meta) = lower(v_local) then v_meta else v_local end;
  else
    v_name := regexp_replace(coalesce(new.name, ''), '[[:cntrl:]]+', '', 'g');
    v_name := btrim(regexp_replace(v_name, '\s+', ' ', 'g'));
  end if;

  new.name := left(coalesce(nullif(v_name, ''), 'Player'), 24);
  return new;
end;
$$;

drop trigger if exists player_stats_enforce_name on public.player_stats;
create trigger player_stats_enforce_name
  before insert or update of name on public.player_stats
  for each row execute function public.player_stats_enforce_name();

-- Rapikan baris yang sudah ada (memicu trigger di atas).
update public.player_stats set name = name;
