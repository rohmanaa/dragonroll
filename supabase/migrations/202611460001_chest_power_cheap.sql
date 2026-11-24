-- Power dari chest dibatasi menurut jenis chest: Kayu hanya Power murah (harga <= 100 koin: Ramuan Ganjil/Genap, Bulu, Perisai Kayu, Rumput),
-- Perak sampai harga <= 200 koin (ditambah Pedang, Fire Charge, TNT, Totem, Apel Emas), Emas & Diamond semua Power (bobot ~ 1/harga seperti sebelumnya).
-- Peluang Power tidak berubah (5% / 12% / 20% / 35%). Mendefinisi ulang _chest_roll dari 202611400001; batas harga ada di v_pmax.

create or replace function public._chest_roll(p_kind text) returns jsonb
language plpgsql volatile as $$
declare v_c int; v_g int := 0; v_x int; v_pc numeric; v_pw text; v_pmax int;
begin
  if p_kind = 'wood' then
    v_c := 50 + floor(random() * 51)::int;  v_x := 10; v_pc := 0.05; v_pmax := 100;
  elsif p_kind = 'silver' then
    v_c := 150 + floor(random() * 101)::int; v_x := 25; v_pc := 0.12; v_pmax := 200;
    if random() < 0.10 then v_g := 1; end if;
  elsif p_kind = 'gold' then
    v_c := 350 + floor(random() * 151)::int; v_x := 60; v_g := 1; v_pc := 0.20;
  elsif p_kind = 'diamond' then
    v_c := 1000 + floor(random() * 401)::int; v_x := 200; v_g := 3; v_pc := 0.35;
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
revoke all on function public._chest_roll(text) from public, anon, authenticated;
