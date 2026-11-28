/* Layar muat khusus gameplay: timer NAIK (bukan hitung mundur), "Mempersiapkan" -> "Siap?", pill hanya wifi + ms (tanpa LTE/baterai), pedang dari aset repo. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const GL = require('../src/views/gameplay-loading.js');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let n = 0;
async function t(name, fn) { await fn(); n++; console.log('ok -', name); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

function fakeDoc() {
  const els = {};
  ['gl', 'gl-m', 'gl-s', 'gl-ms', 'gl-wifi', 'gl-txt', 'gl-dust'].forEach(id => {
    const cls = new Set();
    els[id] = { textContent: '', children: [], style: {}, appendChild(c) { this.children.push(c); },
      classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c), toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)) } };
  });
  return { hidden: false, getElementById: id => els[id], createElement: () => ({ style: {} }), els };
}

(async () => {
  await t('fmt: detik -> mm:ss, menit dibatasi 99, nilai aneh aman', () => {
    assert.deepStrictEqual(GL.fmt(0), { m: '00', s: '00' });
    assert.deepStrictEqual(GL.fmt(7.9), { m: '00', s: '07' });
    assert.deepStrictEqual(GL.fmt(125), { m: '02', s: '05' });
    assert.deepStrictEqual(GL.fmt(99999), { m: '99', s: '39' });
    assert.deepStrictEqual(GL.fmt(-3), { m: '00', s: '00' });
    assert.deepStrictEqual(GL.fmt(NaN), { m: '00', s: '00' });
  });
  await t('timer menghitung NAIK dari 00:00 sejak start, dan berhenti saat stop', async () => {
    let clock = 1000; const doc = fakeDoc();
    const g = GL.create({ document: doc, now: () => clock, fetch: async () => ({}) });
    g.start(); assert.strictEqual(doc.els['gl-m'].textContent + ':' + doc.els['gl-s'].textContent, '00:00');
    clock += 65000; await sleep(300);
    assert.strictEqual(doc.els['gl-m'].textContent + ':' + doc.els['gl-s'].textContent, '01:05', 'bertambah, bukan berkurang');
    clock += 5000; await sleep(300);
    assert.strictEqual(doc.els['gl-s'].textContent, '10');
    g.stop(); assert.strictEqual(g.isRunning(), false); clock += 9000; await sleep(300);
    assert.strictEqual(doc.els['gl-s'].textContent, '10', 'berhenti setelah stop');
    g.start(); assert.strictEqual(doc.els['gl-s'].textContent, '00', 'tampil lagi = mulai dari 00:00'); g.stop();
  });
  await t('teks: "Mempersiapkan" saat memuat, "Siap?" saat ready (kelas rdy), kembali saat start lagi', () => {
    const doc = fakeDoc(), g = GL.create({ document: doc, now: () => 0, fetch: async () => ({}) });
    g.start(); assert.strictEqual(doc.els['gl-txt'].textContent, 'Mempersiapkan');
    g.ready(); assert.strictEqual(doc.els['gl-txt'].textContent, 'Siap?'); assert.ok(doc.els.gl.classList.contains('rdy'));
    g.stop(); g.start(); assert.strictEqual(doc.els['gl-txt'].textContent, 'Mempersiapkan'); assert.ok(!doc.els.gl.classList.contains('rdy')); g.stop();
  });
  await t('ping: "NN ms" dari HEAD no-store + X-UT-Fresh; gagal = "â€” ms" dan ikon wifi redup', async () => {
    let clock = 0, fail = false; const calls = [], doc = fakeDoc();
    const g = GL.create({ document: doc, now: () => clock, fetch: (u, init) => { calls.push({ u, init }); clock += 42; return fail ? Promise.reject(new Error('x')) : Promise.resolve({ ok: true }); } });
    g.start(); await sleep(20);
    assert.strictEqual(doc.els['gl-ms'].textContent, '42 ms'); assert.ok(!doc.els['gl-wifi'].classList.contains('off'));
    assert.strictEqual(calls[0].init.method, 'HEAD'); assert.strictEqual(calls[0].init.cache, 'no-store'); assert.strictEqual(calls[0].init.headers['X-UT-Fresh'], '1');
    g.stop(); fail = true; g.start(); await sleep(20);
    assert.strictEqual(doc.els['gl-ms'].textContent, 'â€” ms'); assert.ok(doc.els['gl-wifi'].classList.contains('off')); g.stop();
  });
  await t('play.html: pill hanya wifi + ms (tanpa LTE/baterai), pedang aset repo yang ada, teks tidak "Pull"', () => {
    const h = rd('play.html'), gl = h.slice(h.indexOf('id="gl"'));
    assert.ok(/id="gl-wifi"/.test(gl) && /id="gl-ms"/.test(gl));
    assert.ok(!/LTE|baterai|battery|%/i.test(gl), 'tanpa LTE/baterai');
    assert.ok(!/Pull|wake up/i.test(gl));
    const m = /class="gl-sword" src="([^"]+)"/.exec(h); assert.ok(m && fs.existsSync(path.join(__dirname, '..', m[1])), 'aset pedang harus ada: ' + (m && m[1]));
    assert.ok(h.indexOf('gameplay-loading.js') > 0 && h.indexOf('gameplay-loading.js') < h.indexOf('pages/play.js'));
    assert.ok(/gameplay-loading\.css/.test(h));
  });
  await t('play.js: layar khusus hanya untuk tujuan gameplay (ut:nav-heavy / gameplay.html); "Siap?" sebelum layar dibuka', () => {
    const js = rd('src/views/play.js');
    assert.ok(/name === 'gameplay\.html' && shown\) setGp\(true\)/.test(js));
    assert.ok((js.match(/if \((toGp|heavy)\) setGp\(true\)/g) || []).length === 2, 'kedua jalur peluncuran (iframe & SPA)');
    assert.ok(/GL\.ready\(\)/.test(js) && /GL\.stop\(\)/.test(js));
    const css = rd('src/styles/pages/gameplay-loading.css'); assert.ok(/#ov\.gp \.ld\{display:none/.test(css), 'ring berputar umum disembunyikan di mode gameplay');
  });
  console.log(n + ' tes lulus');
})().catch(e => { console.error(e); process.exit(1); });

