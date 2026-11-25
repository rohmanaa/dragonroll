/* Memastikan supabase/snapshot/00_full_schema.sql (proyek BARU) dan 01_update_to_latest.sql (proyek yang SUDAH berjalan) selalu sama dengan
   gabungan terbaru supabase/migrations/*.sql. Gagal = ada migrasi baru/berubah: jalankan  sh tools/build-schema-snapshot.sh  dan
   sh tools/build-update-sql.sh  dan  python3 tools/gen-sql-check.py  lalu commit hasilnya. */
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const root = path.join(__dirname, '..');
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'snap-')), 'full.sql');
cp.execFileSync('sh', ['tools/build-schema-snapshot.sh'], { cwd: root, env: Object.assign({}, process.env, { OUT: tmp }), stdio: 'pipe' });
const fresh = fs.readFileSync(tmp, 'utf8'), committed = fs.readFileSync(path.join(root, 'supabase/snapshot/00_full_schema.sql'), 'utf8');
assert.strictEqual(fresh, committed, 'snapshot kedaluwarsa: jalankan "sh tools/build-schema-snapshot.sh" lalu commit');
const names = fs.readdirSync(path.join(root, 'supabase/migrations')).filter(f => f.endsWith('.sql'));
names.forEach(n => assert.ok(committed.indexOf('-- >>> ' + n) >= 0, 'migrasi tidak ada di snapshot: ' + n));
console.log('ok - snapshot sinkron dengan ' + names.length + ' migrasi');
const tmp2 = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'upd-')), 'update.sql');
cp.execFileSync('sh', ['tools/build-update-sql.sh'], { cwd: root, env: Object.assign({}, process.env, { OUT: tmp2 }), stdio: 'pipe' });
const upd = fs.readFileSync(tmp2, 'utf8');
assert.strictEqual(upd, fs.readFileSync(path.join(root, 'supabase/snapshot/01_update_to_latest.sql'), 'utf8'), 'update-sql kedaluwarsa: jalankan "sh tools/build-update-sql.sh" lalu commit');
names.forEach(n => assert.ok(upd.indexOf('-- >>> ' + n) >= 0, 'migrasi tidak ada di update-sql: ' + n));
console.log('ok - update-sql sinkron dengan ' + names.length + ' migrasi');
const tmp3 = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'chk-')), 'check.sql');
cp.execFileSync('python3', ['tools/gen-sql-check.py'], { cwd: root, env: Object.assign({}, process.env, { OUT: tmp3 }), stdio: 'pipe' });
assert.strictEqual(fs.readFileSync(tmp3, 'utf8'), fs.readFileSync(path.join(root, 'supabase/snapshot/02_check_applied.sql'), 'utf8'), 'check-sql kedaluwarsa: jalankan \"python3 tools/gen-sql-check.py\" lalu commit');
console.log('ok - check-sql sinkron dengan migrasi');
console.log('3 tes lulus');
