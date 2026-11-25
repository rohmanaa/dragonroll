-- Lanjutan aturan ekonomi 26 Nov 2026 (lihat docs/planing/sisa-audit.md):
--   1. Hadiah boss lawan CPU dimatikan. Klaimnya tidak bisa diverifikasi server (token bebas) dan
--      melewati aturan "CPU hanya koin, maks 5 hasil/hari" (3 x 100 koin/hari tanpa main).
--      Hadiah boss online (claim_boss_reward) tidak berubah.
--   2. Peti tidak lagi memberi XP (XP hanya dari match online). Kunci 'xp' tetap ada di hasil (bernilai 0)
--      supaya klien lama tidak rusak; klien menyembunyikan hadiah bernilai nol.

create or replace function public.claim_cpu_boss_reward(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  return jsonb_build_object('ok', false, 'reason', 'nonaktif');
end;
$$;
revoke all on function public.claim_cpu_boss_reward(text) from public, anon;
grant execute on function public.claim_cpu_boss_reward(text) to authenticated;

create or replace function public._chest_roll(p_kind text)
returns jsonb language plpgsql as $$
declare v_c int; v_g int := 0; v_x int := 0; v_pc numeric; v_pw text; v_pmax int;
begin
  if p_kind = 'wood' then
    v_c := 50 + floor(random() * 51)::int;  v_pc := 0.05; v_pmax := 100;
  elsif p_kind = 'silver' then
    v_c := 150 + floor(random() * 101)::int; v_pc := 0.12; v_pmax := 200;
    if random() < 0.10 then v_g := 1; end if;
  elsif p_kind = 'gold' then
    v_c := 350 + floor(random() * 151)::int; v_g := 1; v_pc := 0.20;
  elsif p_kind = 'diamond' then
    v_c := 1000 + floor(random() * 401)::int; v_g := 3; v_pc := 0.35;
  else
    raise exception 'BAD_CHEST_KIND';
  end if;
  if random() < v_pc then   -- undian berbobot 1/harga (perlombaan eksponensial: kunci = -ln(u) * harga, terkecil menang)
    select id into v_pw from public.item_catalog
     where kind = 'powerup' and price_coins is not null and (v_pmax is null or price_coins <= v_pmax)
     order by (-ln(1 - random())) * price_coins limit 1;
  end if;
  return jsonb_build_object('coins', v_c, 'gems', v_g, 'xp', v_x, 'power', v_pw);
end;
$$;
