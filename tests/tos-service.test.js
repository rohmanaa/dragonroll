/* Persetujuan TOS/Privasi: versi klien = versi server, akun login lewat RPC, tamu lewat localStorage, Sign up wajib centang. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { create, FALLBACK_CURRENT } = require('../src/services/tos-service.js');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let n = 0;
async function t(name, fn) { await fn(); n++; console.log('ok -', name); }
function mem() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; }

(async () => {
  await t('FALLBACK_CURRENT sama dengan _tos_current_version() di migrasi server', () => {
    const sql = rd('supabase/migrations/202611420001_tos_acceptance.sql');
    const m = /_tos_current_version\(\) returns int language sql immutable as \$\$ select (\d+) \$\$/.exec(sql);
    assert.ok(m, 'fungsi versi tidak ditemukan'); assert.strictEqual(+m[1], FALLBACK_CURRENT);
  });
  await t('tamu: needs sampai Confirm, lalu tersimpan lokal', async () => {
    const s = mem(), tos = create({ G: { PlayerData: { serverMode: () => false } }, storage: s });
    assert.strictEqual((await tos.status()).needs, true);
    assert.strictEqual(await tos.accept(), true);
    const st = await tos.status(); assert.strictEqual(st.needs, false); assert.strictEqual(st.source, 'local');
  });
  await t('akun login: status & accept lewat RPC tos_status/tos_accept; versi server menentukan needs', async () => {
    const calls = []; let accepted = null;
    const client = { rpc: async (name) => { calls.push(name);
      if (name === 'tos_status') return { data: { ok: true, current: 2, accepted, needs: accepted == null || accepted < 2 } };
      accepted = 2; return { data: { ok: true, current: 2, accepted: 2, needs: false } }; } };
    const tos = create({ G: { PlayerData: { serverMode: () => true } }, storage: mem(), getClient: async () => client });
    assert.strictEqual((await tos.status()).needs, true);
    assert.strictEqual(await tos.accept(), true);
    assert.strictEqual((await tos.status()).needs, false);
    assert.deepStrictEqual(calls, ['tos_status', 'tos_accept', 'tos_status']);
  });
  await t('akun login: server tak terjangkau -> status null (tidak memunculkan modal), accept false', async () => {
    const tos = create({ G: { PlayerData: { serverMode: () => true } }, storage: mem(), getClient: async () => { throw new Error('offline'); } });
    assert.strictEqual(await tos.status(), null); assert.strictEqual(await tos.accept(), false);
  });
  await t('Sign up: wajib centang TOS+Privasi, lalu UT.Tos.accept() setelah akun jadi', () => {
    const h = rd('splash.html'), js = rd('src/views/splash.js');
    assert.ok(/id="su-tos"/.test(h) && /tos\.html#privasi/.test(h) && h.indexOf('tos-service.js') > 0 && h.indexOf('tos-service.js') < h.indexOf('pages/splash.js'));
    assert.ok(/su-tos"\)\.checked/.test(js) && /UT\.Tos\.accept\(\)/.test(js));
    assert.ok(js.indexOf('su-tos").checked') < js.indexOf('UT.Auth.signUp'), 'cek centang sebelum membuat akun');
  });
  await t('migrasi: RPC hanya untuk authenticated, tabel tertutup untuk klien', () => {
    const sql = rd('supabase/migrations/202611420001_tos_acceptance.sql');
    assert.ok(/revoke all on public\.player_tos from public, anon, authenticated/.test(sql));
    assert.ok(/grant execute on function public\.tos_accept\(int\) to authenticated/.test(sql) && /grant execute on function public\.tos_status\(\) to authenticated/.test(sql));
  });
  console.log(n + ' tes lulus');
})().catch(e => { console.error(e); process.exit(1); });



