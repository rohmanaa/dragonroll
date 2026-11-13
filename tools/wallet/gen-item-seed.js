/* Sinkronkan katalog SERVER dengan katalog klien (assets/js/item-catalog.js = satu-satunya sumber harga & gender).
   Blok yang dijaga:
     1. harga/starter/stackable  -> migrasi B2   (202611110002_wallet_b2_server.sql)
     2. gender item gear         -> migrasi outfit (202611130001_player_outfits.sql)
     3. harga tier dadu/frame/aura -> migrasi fase 3 (202611280001_economy_phase3_gems.sql)
     4. item pet (koin/emerald)  -> migrasi pet (202611290001_pet_catalog.sql)
   Pakai:  node tools/wallet/gen-item-seed.js --write   -> tulis ulang kedua blok seed
           node tools/wallet/gen-item-seed.js --check   -> exit 1 bila ada migrasi yang tidak sama dengan katalog (untuk CI)
   Setelah mengubah harga/gender di item-catalog.js: jalankan --write, lalu terapkan ULANG migrasinya (aman diulang: upsert/update). */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CAT = path.join(ROOT, 'assets', 'js', 'item-catalog.js');
const MIGDIR = path.join(ROOT, 'supabase', 'migrations');

const w = {}; new Function('window', fs.readFileSync(CAT, 'utf8'))(w);
const items = w.ItemCatalog.items.slice().sort((a, b) => a.id < b.id ? -1 : 1);
const q = s => "'" + String(s).replace(/'/g, "''") + "'";

const priceRows = items.map(i => '  (' + [q(i.id), q(i.kind), i.price > 0 ? i.price : 'null', i.starter ? 'true' : 'false', i.stackable ? 'true' : 'false'].join(', ') + ')');
const gearItems = items.filter(i => i.kind === 'gear');
const genderRows = gearItems.map(i => '  (' + q(i.id) + ', ' + (i.g ? q(i.g) : 'null') + ')');

const tierItems = items.filter(i => ['dice', 'frame', 'aura'].indexOf(i.kind) >= 0 && !i.starter && (i.price > 0 || i.gems > 0));
const tierRows = tierItems.map(i => '  (' + [q(i.id), i.price > 0 ? i.price : 'null', i.gems > 0 ? i.gems : 'null'].join(', ') + ')');

const petItems = items.filter(i => i.kind === 'pet');
const petRows = petItems.map(i => '  (' + [q(i.id), q(i.kind), i.price > 0 ? i.price : 'null', i.gems > 0 ? i.gems : 'null', i.starter ? 'true' : 'false', i.stackable ? 'true' : 'false'].join(', ') + ')');

const BLOCKS = [
  { file: '202611290001_pet_catalog.sql', begin: '-- BEGIN PET SEED (dibuat oleh tools/wallet/gen-item-seed.js; jangan edit tangan)', end: '-- END PET SEED',
    body: 'insert into public.item_catalog(id, kind, price_coins, price_gems, starter, stackable) values\n' + petRows.join(',\n') +
      '\non conflict (id) do update set kind = excluded.kind, price_coins = excluded.price_coins, price_gems = excluded.price_gems, starter = excluded.starter, stackable = excluded.stackable;' },
  { file: '202611280001_economy_phase3_gems.sql', begin: '-- BEGIN TIER PRICE SEED (dibuat oleh tools/wallet/gen-item-seed.js; jangan edit tangan)', end: '-- END TIER PRICE SEED',
    body: 'update public.item_catalog c set price_coins = v.c, price_gems = v.g\nfrom (values\n' + tierRows.join(',\n') + '\n) as v(id, c, g)\nwhere c.id = v.id;' },
  { file: '202611110002_wallet_b2_server.sql', begin: '-- BEGIN CATALOG SEED (dibuat oleh game/tools/wallet/gen-item-seed.js; jangan edit tangan)', end: '-- END CATALOG SEED',
    body: 'insert into public.item_catalog(id, kind, price_coins, starter, stackable) values\n' + priceRows.join(',\n') +
      '\non conflict (id) do update set kind = excluded.kind, price_coins = excluded.price_coins, starter = excluded.starter, stackable = excluded.stackable;' },
  { file: '202611130001_player_outfits.sql', begin: '-- BEGIN GEAR GENDER SEED (dibuat oleh tools/wallet/gen-item-seed.js; jangan edit tangan)', end: '-- END GEAR GENDER SEED',
    body: 'update public.item_catalog c set gender = v.g\nfrom (values\n' + genderRows.join(',\n') + '\n) as v(id, g)\nwhere c.id = v.id;' }
];

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const write = process.argv.includes('--write'), check = process.argv.includes('--check');
let stale = false;
BLOCKS.forEach(b => {
  const file = path.join(MIGDIR, b.file), sql = fs.readFileSync(file, 'utf8');
  const re = new RegExp(esc(b.begin) + '[\\s\\S]*?' + esc(b.end));
  if (!re.test(sql)) { console.error('blok seed tidak ditemukan di ' + b.file); process.exit(2); }
  const block = b.begin + '\n' + b.body + '\n' + b.end;
  if (write) { fs.writeFileSync(file, sql.replace(re, () => block)); console.log('seed ditulis: ' + b.file); }
  else if (check) { if (sql.match(re)[0] !== block) { console.error('SEED USANG: ' + b.file + ' (jalankan node tools/wallet/gen-item-seed.js --write)'); stale = true; } }
  else console.log(block);
});
if (check) { if (stale) process.exit(1); console.log('seed sinkron (' + items.length + ' item, ' + gearItems.length + ' gear)'); }
