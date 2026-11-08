#!/bin/sh
# Menggabungkan SEMUA migrasi (urut nama file) menjadi satu file SQL untuk menyiapkan proyek Supabase BARU/kosong.
# Pakai:  sh tools/build-schema-snapshot.sh   ->  supabase/snapshot/00_full_schema.sql
# File hasil BUKAN migrasi: jangan taruh di supabase/migrations/ (CI akan mencoba menerapkannya ke produksi yang sudah punya semua tabel).
set -e
cd "$(dirname "$0")/.."
OUT=${OUT:-supabase/snapshot/00_full_schema.sql}
mkdir -p "$(dirname "$OUT")"
{
  echo "-- ============================================================================"
  echo "-- DRAGON ROLL / Ular Tangga Blok — SKEMA LENGKAP SUPABASE (gabungan semua migrasi)"
  echo "-- Dibuat otomatis oleh tools/build-schema-snapshot.sh dari supabase/migrations/*.sql — JANGAN diedit manual."
  echo "-- Untuk proyek Supabase BARU/KOSONG: tempel seluruh isi file ini di SQL Editor lalu Run (sekali)."
  echo "-- Syarat dashboard: Authentication > Providers > Email aktif dan \"Confirm email\" DIMATIKAN."
  echo "-- JANGAN dijalankan di proyek yang sudah memakai migrasi (tabel sudah ada) dan JANGAN ditaruh di supabase/migrations/."
  echo "-- Isi: $(ls supabase/migrations/*.sql | wc -l) migrasi, urut: $(ls supabase/migrations/*.sql | head -1 | xargs basename | cut -c1-12) s/d $(ls supabase/migrations/*.sql | tail -1 | xargs basename | cut -c1-12)"
  echo "-- ============================================================================"
  for f in $(ls supabase/migrations/*.sql | sort); do
    echo ""
    echo "-- ---------------------------------------------------------------------------"
    echo "-- >>> $(basename "$f")"
    echo "-- ---------------------------------------------------------------------------"
    cat "$f"
    echo ""
  done
} > "$OUT"
echo "OK: $OUT ($(wc -c < "$OUT") byte)"
