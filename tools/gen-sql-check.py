#!/usr/bin/env python3
"""Membuat supabase/snapshot/02_check_applied.sql: SQL pemeriksa "apakah semua migrasi sudah masuk ke database ini?".
Dibuat dari supabase/migrations/*.sql: tabel, kolom, dan FUNGSI (isi fungsi dibandingkan lewat md5 terhadap versi terakhir di migrasi),
ditambah jumlah baris minimum tabel katalog. Hasilnya hanya menampilkan yang BELUM masuk; kalau semua beres muncul satu baris 'OK'.
Pakai:  python3 tools/gen-sql-check.py   (lalu tempel hasilnya di SQL Editor). OUT=... untuk jalur lain; COUNTS=item_catalog=183,... untuk jumlah baris."""
import glob, hashlib, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.environ.get('OUT') or os.path.join(ROOT, 'supabase/snapshot/02_check_applied.sql')

def arity(args):
    depth = 0; n = 0; seen = False
    for ch in args:
        if ch in '([': depth += 1
        elif ch in ')]': depth -= 1
        elif ch == ',' and depth == 0: n += 1
        if not ch.isspace(): seen = True
    return n + 1 if seen else 0

funcs = {}; tables = {}; cols = {}
FN = re.compile(r'create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?(\w+)"?\s*\(', re.I)
DF = re.compile(r'drop\s+function\s+(?:if\s+exists\s+)?(?:public\.)?"?(\w+)"?\s*(\()?', re.I)
for f in sorted(glob.glob(os.path.join(ROOT, 'supabase/migrations/*.sql'))):
    s = open(f, encoding='utf-8').read()
    ev = []   # (posisi, jenis, ...) diproses urut posisi di file: drop lalu create ulang di file yang sama tetap dianggap ada
    pos = 0; body_spans = []
    while True:
        m = FN.search(s, pos)
        if not m: break
        i = m.end(); depth = 1
        while i < len(s) and depth:
            depth += (s[i] == '(') - (s[i] == ')'); i += 1
        args = s[m.end():i - 1]
        d = re.compile(r'\$(\w*)\$').search(s, i)
        if not d: pos = i; continue
        tag = d.group(0); end = s.find(tag, d.end())
        if end < 0: pos = i; continue
        ev.append((m.start(), 'create', (m.group(1).lower(), arity(args)), hashlib.md5(s[d.end():end].encode('utf-8')).hexdigest()))
        body_spans.append((d.end(), end)); pos = end + len(tag)
    inbody = lambda x: any(a <= x < b for a, b in body_spans)
    for m in DF.finditer(s):
        if inbody(m.start()): continue   # 'drop function' di dalam badan fungsi (SQL dinamis) bukan perintah migrasi
        name = m.group(1).lower(); n = None
        if m.group(2):
            j = m.end(); depth = 1
            while j < len(s) and depth:
                depth += (s[j] == '(') - (s[j] == ')'); j += 1
            n = arity(s[m.end():j - 1])
        ev.append((m.start(), 'drop', name, n))
    for e in sorted(ev, key=lambda x: x[0]):
        if e[1] == 'create': funcs[e[2]] = e[3]
        else:
            for k in [k for k in funcs if k[0] == e[2] and (e[3] is None or k[1] == e[3])]: funcs.pop(k)
    for m in re.finditer(r'create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?\s*\(', s, re.I):
        if not inbody(m.start()): tables[m.group(1).lower()] = True
    for m in re.finditer(r'alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?"?(\w+)"?\s+([^;]*);', s, re.I | re.S):
        if inbody(m.start()): continue
        for c in re.finditer(r'add\s+column\s+(?:if\s+not\s+exists\s+)?"?(\w+)"?', m.group(2), re.I):
            cols[(m.group(1).lower(), c.group(1).lower())] = True
        for c in re.finditer(r'drop\s+column\s+(?:if\s+exists\s+)?"?(\w+)"?', m.group(2), re.I):
            cols.pop((m.group(1).lower(), c.group(1).lower()), None)
    for m in re.finditer(r'drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?(\w+)"?', s, re.I):
        if inbody(m.start()): continue
        tables.pop(m.group(1).lower(), None)
        for k in [k for k in cols if k[0] == m.group(1).lower()]: cols.pop(k)

counts = {}
# batas bawah isi katalog pada skema terbaru (naikkan bila katalog bertambah; lebih rendah dari isi sebenarnya = aman)
DEFAULT_COUNTS = 'item_catalog=184,achievement_defs=18,pvp_unlocks=21'
for kv in (os.environ.get('COUNTS') or DEFAULT_COUNTS).split(','):
    if '=' in kv: k, v = kv.split('='); counts[k] = int(v)

def q(x): return "'" + x.replace("'", "''") + "'"
fn_rows = ",\n  ".join("(%s, %s)" % (q(n), q(h)) for (n, a), h in sorted(funcs.items()))
tb_rows = ",\n  ".join("(%s)" % q(t) for t in sorted(tables))
col_rows = ",\n  ".join("(%s, %s)" % (q(t), q(c)) for (t, c) in sorted(cols))
cnt_rows = ",\n  ".join("(%s, %d)" % (q(t), n) for t, n in sorted(counts.items())) or "('-', 0)"
names = sorted(os.path.basename(f) for f in glob.glob(os.path.join(ROOT, 'supabase/migrations/*.sql')))
sql = f"""-- ============================================================================
-- DRAGON ROLL / Ular Tangga Blok — CEK: apakah semua migrasi sudah masuk ke database ini?
-- Dibuat otomatis oleh tools/gen-sql-check.py dari supabase/migrations/*.sql — JANGAN diedit manual.
-- Cara pakai: tempel seluruh isi file ini di Supabase SQL Editor lalu Run. HANYA MEMBACA, tidak mengubah apa pun.
--   Hasil 1 baris 'OK'  = semua tabel, kolom, fungsi (isinya sama persis dengan versi terbaru), dan katalog sudah lengkap.
--   Hasil berisi daftar = itu yang BELUM masuk / masih versi lama. Perbaiki dengan menjalankan 01_update_to_latest.sql.
-- Cakupan: {len(names)} migrasi ({names[0][:12]} s/d {names[-1][:12]}); {len(funcs)} fungsi, {len(tables)} tabel, {len(cols)} kolom tambahan.
-- ============================================================================
with fn(name, md5) as (values
  {fn_rows}
), tb(name) as (values
  {tb_rows}
), col(tbl, col) as (values
  {col_rows}
), cnt(tbl, min_rows) as (values
  {cnt_rows}
), cnt_now as (
  select cnt.tbl, cnt.min_rows,
         case when to_regclass('public.' || cnt.tbl) is null then -1
              else (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.' || quote_ident(cnt.tbl), false, true, '')))[1]::text::int end as now_rows
    from cnt where cnt.tbl <> '-'
), problems as (
  select 'fungsi' as jenis, fn.name as nama, 'belum ada / isinya masih versi lama' as ket
    from fn where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                               where n.nspname = 'public' and p.proname = fn.name and md5(p.prosrc) = fn.md5)
  union all select 'tabel', tb.name, 'tidak ada' from tb where to_regclass('public.' || tb.name) is null
  union all select 'kolom', col.tbl || '.' || col.col, 'tidak ada'
    from col where not exists (select 1 from information_schema.columns c
                                where c.table_schema = 'public' and c.table_name = col.tbl and c.column_name = col.col)
  union all select 'data', cn.tbl, 'isi katalog kurang: ada ' || cn.now_rows || ', seharusnya minimal ' || cn.min_rows
    from cnt_now cn where cn.now_rows < cn.min_rows
)
select jenis, nama, ket from problems
union all
select 'OK', 'Semua cek lulus', 'database sudah versi terbaru ({len(funcs)} fungsi, {len(tables)} tabel, {len(cols)} kolom diperiksa)'
 where not exists (select 1 from problems)
order by 1, 2;
"""
open(OUT, 'w', encoding='utf-8').write(sql)
print('OK: %s (%d byte; %d fungsi, %d tabel, %d kolom)' % (OUT, len(sql.encode('utf-8')), len(funcs), len(tables), len(cols)))
