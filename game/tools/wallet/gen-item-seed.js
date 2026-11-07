/* Sinkronkan katalog harga SERVER dengan katalog klien (assets/js/item-catalog.js = satu-satunya sumber harga).
   Pakai:  node game/tools/wallet/gen-item-seed.js --write   -> tulis ulang blok seed di migrasi B2
           node game/tools/wallet/gen-item-seed.js --check   -> exit 1 bila migrasi tidak sama dengan katalog (untuk CI)
   Setelah mengubah harga di item-catalog.js: jalankan --write, lalu terapkan ULANG migrasi (aman diulang: upsert). */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..');
const CAT = path.join(ROOT, 'game', 'assets', 'js', 'item-catalog.js');
const MIG = path.join(ROOT, 'supabase', 'migrations', '202611110002_wallet_b2_server.sql');
const BEGIN = '-- BEGIN CATALOG SEED (dibuat oleh game/tools/wallet/gen-item-seed.js; jangan edit tangan)';
const END = '-- END CATALOG SEED';

const w = {}; new Function('window', fs.readFileSync(CAT, 'utf8'))(w);
const items = w.ItemCatalog.items.slice().sort((a, b) => a.id < b.id ? -1 : 1);
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
const rows = items.map(i => '  (' + [q(i.id), q(i.kind), i.price > 0 ? i.price : 'null', i.starter ? 'true' : 'false', i.stackable ? 'true' : 'false'].join(', ') + ')');
const block = BEGIN + '\ninsert into public.item_catalog(id, kind, price_coins, starter, stackable) values\n' + rows.join(',\n') +
  '\non conflict (id) do update set kind = excluded.kind, price_coins = excluded.price_coins, starter = excluded.starter, stackable = excluded.stackable;\n' + END;

const sql = fs.readFileSync(MIG, 'utf8');
const re = new RegExp(BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + END);
if (!re.test(sql)) { console.error('blok seed tidak ditemukan di migrasi'); process.exit(2); }
if (process.argv.includes('--write')) { fs.writeFileSync(MIG, sql.replace(re, () => block)); console.log('seed ditulis: ' + items.length + ' item'); }
else if (process.argv.includes('--check')) {
  if (sql.match(re)[0] !== block) { console.error('SEED USANG: jalankan node game/tools/wallet/gen-item-seed.js --write'); process.exit(1); }
  console.log('seed sinkron (' + items.length + ' item)');
} else console.log(block);
