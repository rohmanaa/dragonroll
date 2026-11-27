#!/bin/sh
# Menggabungkan SEMUA migrasi menjadi SATU file SQL yang AMAN dijalankan di proyek Supabase yang SUDAH berjalan (susulan "ke versi terbaru"):
# semua migrasi idempotent (create ... if not exists / create or replace / on conflict), jadi menjalankan ulang yang sudah pernah dijalankan tidak
# merusak data pemain; yang belum pernah dijalankan ikut terpasang. Satu-satunya perkecualian ditangani di bagian awal file (lihat PRA).
# Pakai:  sh tools/build-update-sql.sh   ->  supabase/snapshot/01_update_to_latest.sql
# File hasil BUKAN migrasi: jangan taruh di supabase/migrations/ (CI menerapkan isi folder itu ke produksi).
set -e
cd "$(dirname "$0")/.."
OUT=${OUT:-supabase/snapshot/01_update_to_latest.sql}
mkdir -p "$(dirname "$OUT")"
{
  echo "-- ============================================================================"
  echo "-- DRAGON ROLL / Ular Tangga Blok — UPDATE KE VERSI TERBARU (satu file, aman dijalankan ulang)"
  echo "-- Dibuat otomatis oleh tools/build-update-sql.sh dari supabase/migrations/*.sql — JANGAN diedit manual."
  echo "-- Untuk proyek Supabase yang SUDAH berjalan: tempel seluruh isi file ini di SQL Editor lalu Run (sekali). Boleh diulang kapan saja."
  echo "-- Tidak mengubah data pemain: hanya tabel/fungsi/katalog/definisi yang disamakan ke versi terbaru."
  echo "-- Isi: $(ls supabase/migrations/*.sql | wc -l) migrasi, urut: $(ls supabase/migrations/*.sql | head -1 | xargs basename | cut -c1-12) s/d $(ls supabase/migrations/*.sql | tail -1 | xargs basename | cut -c1-12)"
  echo "-- ============================================================================"
  echo ""
  echo "-- PRA: seed harga di tiga migrasi lama (frame/dice/aura) menulis price_coins untuk item yang belakangan dipindah ke harga gem."
  echo "-- Saat diputar ulang di database yang sudah punya harga gem, aturan 'satu mata uang' menolaknya. Aturan dilepas dulu dan dipasang"
  echo "-- kembali oleh migrasi 202611280001_economy_phase3_gems (yang sekaligus menulis ulang harga akhirnya)."
  echo "do \$pra\$ begin"
  echo "  if to_regclass('public.item_catalog') is not null then"
  echo "    alter table public.item_catalog drop constraint if exists item_catalog_one_currency;"
  echo "  end if;"
  echo "end \$pra\$;"
  for f in $(ls supabase/migrations/*.sql | sort); do
    case "$f" in
      *202611280001_economy_phase3_gems.sql)
        echo ""
        echo "-- PRA-2: seed lama (di atas) bisa meninggalkan item bergem dengan price_coins terisi; rapikan sebelum aturan 'satu mata uang' dipasang."
        echo "-- (Harga akhir ditulis ulang oleh seed tier di migrasi berikut ini.)"
        echo "do \$pra2\$ begin"
        echo "  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'item_catalog' and column_name = 'price_gems') then"
        echo "    update public.item_catalog set price_coins = null where price_gems is not null and price_coins is not null;"
        echo "  end if;"
        echo "end \$pra2\$;"
        ;;
    esac
    echo ""
    echo "-- ---------------------------------------------------------------------------"
    echo "-- >>> $(basename "$f")"
    echo "-- ---------------------------------------------------------------------------"
    cat "$f"
    echo ""
  done
} > "$OUT"
echo "OK: $OUT ($(wc -c < "$OUT") byte)"
