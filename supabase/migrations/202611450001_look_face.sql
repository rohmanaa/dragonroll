-- Wajah (bentuk wajah) dipisah dari mata di builder karakter: look kini boleh membawa face:{id}.
-- Hanya mengubah _appearance_normalize (basis: versi 202611350001_pvp_knight_gear.sql) agar face ikut tersimpan di server
-- dan terbaca pemain lain (room_appearance_get); sebelumnya kunci tak dikenal dibuang saat simpan. Aman diulang (create or replace).
-- Tanpa migrasi ini: klien tetap jalan, tapi pilihan wajah hanya tersimpan lokal dan kembali ke 'classic' saat sinkron dari server.

create or replace function public._appearance_normalize(p_user uuid, p_look jsonb, p_equipped jsonb, p_dye jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c_id constant text := '^[a-z0-9_]{1,24}$';
  v_look jsonb := null; v_part text; v_o jsonb; v_h numeric := 1; v_b numeric := 1; v_body jsonb;
  v_eq jsonb := '{}'::jsonb; v_gd jsonb := '{}'::jsonb; r record; v_slot text;
begin
  if p_look is not null and jsonb_typeof(p_look) <> 'null' then
    if jsonb_typeof(p_look) <> 'object' then return public._bad('data-tidak-valid'); end if;
    if jsonb_typeof(p_look -> 'gender') is distinct from 'string' or (p_look ->> 'gender') not in ('m', 'f') then return public._bad('data-tidak-valid'); end if;
    if jsonb_typeof(p_look -> 'skin') is distinct from 'string' or (p_look ->> 'skin') !~ '^s[1-5]$' then return public._bad('data-tidak-valid'); end if;
    v_look := jsonb_build_object('gender', p_look ->> 'gender', 'skin', p_look ->> 'skin');
    foreach v_part in array array['eyes', 'hair'] loop
      v_o := p_look -> v_part;
      if jsonb_typeof(v_o) is distinct from 'object' or jsonb_typeof(v_o -> 'id') is distinct from 'string' or jsonb_typeof(v_o -> 'dye') is distinct from 'string'
         or (v_o ->> 'id') !~ c_id or (v_o ->> 'dye') !~ c_id then return public._bad('data-tidak-valid'); end if;
      -- wajah/rambut yang ada di katalog (mis. set PVP) hanya boleh dipakai bila dimiliki; yang tidak ada di katalog = dasar penampilan (gratis)
      if exists (select 1 from public.item_catalog c where c.id = 'gear.' || v_part || '.' || (v_o ->> 'id') and c.kind = 'gear')
         and not public._owns_item(p_user, 'gear.' || v_part || '.' || (v_o ->> 'id')) then
        return public._bad('belum-dimiliki', 'gear.' || v_part || '.' || (v_o ->> 'id'));
      end if;
      v_look := v_look || jsonb_build_object(v_part, jsonb_build_object('id', v_o ->> 'id', 'dye', v_o ->> 'dye'));
    end loop;
    v_body := p_look -> 'body';
    if v_body is not null and jsonb_typeof(v_body) = 'object' then
      if jsonb_typeof(v_body -> 'height') = 'number' and (v_body ->> 'height')::numeric > 0 then v_h := (v_body ->> 'height')::numeric; end if;
      if jsonb_typeof(v_body -> 'build')  = 'number' and (v_body ->> 'build')::numeric  > 0 then v_b := (v_body ->> 'build')::numeric; end if;
    end if;
    v_look := v_look || jsonb_build_object('body', jsonb_build_object('height', least(1.1, greatest(0.9, v_h)), 'build', least(1.15, greatest(0.9, v_b))));
    -- wajah (bentuk wajah, terpisah dari mata): OPSIONAL & kosmetik gratis. Tidak ada / bentuk salah = dibuang (klien memakai 'classic'),
    -- BUKAN menolak seluruh look, supaya data lama dan klien lama tetap valid.
    v_o := p_look -> 'face';
    if jsonb_typeof(v_o) = 'object' and jsonb_typeof(v_o -> 'id') = 'string' and (v_o ->> 'id') ~ c_id then
      v_look := v_look || jsonb_build_object('face', jsonb_build_object('id', v_o ->> 'id'));
    end if;
  end if;

  if p_equipped is not null and jsonb_typeof(p_equipped) <> 'null' then
    if jsonb_typeof(p_equipped) <> 'object' then return public._bad('data-tidak-valid'); end if;
    if (select count(*) from jsonb_object_keys(p_equipped)) > 60 then return public._bad('data-tidak-valid'); end if;
    for r in select key, value from jsonb_each(p_equipped) loop
      if jsonb_typeof(r.value) <> 'string' then return public._bad('data-tidak-valid'); end if;
      v_slot := public._item_equip_slot(r.value #>> '{}');
      if v_slot is null or v_slot <> r.key then return public._bad('slot-tidak-cocok', r.value #>> '{}'); end if;
      if not public._owns_item(p_user, r.value #>> '{}') then return public._bad('belum-dimiliki', r.value #>> '{}'); end if;
      v_eq := v_eq || jsonb_build_object(r.key, r.value);
    end loop;
  end if;

  if p_dye is not null and jsonb_typeof(p_dye) <> 'null' then
    if jsonb_typeof(p_dye) <> 'object' then return public._bad('data-tidak-valid'); end if;
    if (select count(*) from jsonb_object_keys(p_dye)) > 120 then return public._bad('data-tidak-valid'); end if;
    for r in select key, value from jsonb_each(p_dye) loop
      if jsonb_typeof(r.value) <> 'string' or (r.value #>> '{}') !~ c_id then return public._bad('data-tidak-valid'); end if;
      if not exists (select 1 from public.item_catalog c where c.id = r.key and c.kind = 'gear') then return public._bad('item-tidak-dikenal', left(r.key, 60)); end if;
      if not public._owns_item(p_user, r.key) then return public._bad('belum-dimiliki', r.key); end if;
      v_gd := v_gd || jsonb_build_object(r.key, r.value);
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'look', v_look, 'equipped', v_eq, 'gear_dye', v_gd);
end;
$$;
revoke all on function public._appearance_normalize(uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
