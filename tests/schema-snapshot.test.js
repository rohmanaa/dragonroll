/* Memastikan supabase/snapshot/00_full_schema.sql selalu sama dengan gabungan terbaru supabase/migrations/*.sql.
   Gagal = ada migrasi baru/berubah: jalankan  sh tools/build-schema-snapshot.sh  lalu commit hasilnya. */
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const root = path.join(__dirname, '..');
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'snap-')), 'full.sql');
cp.execFileSync('sh', ['tools/build-schema-snapshot.sh'], { cwd: root, env: Object.assign({}, process.env, { OUT: tmp }), stdio: 'pipe' });
const fresh = fs.readFileSync(tmp, 'utf8'), committed = fs.readFileSync(path.join(root, 'supabase/snapshot/00_full_schema.sql'), 'utf8');
assert.strictEqual(fresh, committed, 'snapshot kedaluwarsa: jalankan "sh tools/build-schema-snapshot.sh" lalu commit');
const names = fs.readdirSync(path.join(root, 'supabase/migrations')).filter(f => f.endsWith('.sql'));
names.forEach(n => assert.ok(committed.indexOf('-- >>> ' + n) >= 0, 'migrasi tidak ada di snapshot: ' + n));
console.log('ok - snapshot sinkron dengan ' + names.length + ' migrasi');
console.log('1 tes lulus');
