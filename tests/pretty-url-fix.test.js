/* Tes URL pretty: verifikasi <base href="/"> sebagai elemen pertama di <head>
   dan tidak ada JS yang menyusun URL aset dari location.pathname.
   Jalan di Node 20 (CommonJS). */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }

(async () => {
  // Tes 1: play.html memiliki <base href="/"> sebagai elemen pertama di <head>
  await t('play.html: <base href="/"> adalah elemen pertama di <head>', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'play.html'), 'utf-8');
    const headMatch = html.match(/<head>([\s\S]*?)<\/head>/i);
    assert.ok(headMatch, '<head> tag tidak ditemukan');
    const headContent = headMatch[1].trim();
    // Cari elemen pertama yang bukan whitespace/komentar
    const firstTagMatch = headContent.match(/^(\s*<!--[\s\S]*?-->\s*)*(<[a-z][^>]*>)/i);
    assert.ok(firstTagMatch, 'Tidak ada tag di dalam <head>');
    const firstTag = firstTagMatch[2];
    assert.ok(/<base\s+href\s*=\s*["']\/["']/i.test(firstTag),
      'Elemen pertama di <head> harus <base href="/">, ditemukan: ' + firstTag);
  });

  // Tes 2: profile.html memiliki <base href="/"> sebagai elemen pertama di <head>
  await t('profile.html: <base href="/"> adalah elemen pertama di <head>', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'profile.html'), 'utf-8');
    const headMatch = html.match(/<head>([\s\S]*?)<\/head>/i);
    assert.ok(headMatch, '<head> tag tidak ditemukan');
    const headContent = headMatch[1].trim();
    const firstTagMatch = headContent.match(/^(\s*<!--[\s\S]*?-->\s*)*(<[a-z][^>]*>)/i);
    assert.ok(firstTagMatch, 'Tidak ada tag di dalam <head>');
    const firstTag = firstTagMatch[2];
    assert.ok(/<base\s+href\s*=\s*["']\/["']/i.test(firstTag),
      'Elemen pertama di <head> harus <base href="/">, ditemukan: ' + firstTag);
  });

  // Tes 3: splash.html memiliki <base href="/"> sebagai elemen pertama di <head>
  await t('splash.html: <base href="/"> adalah elemen pertama di <head>', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'splash.html'), 'utf-8');
    const headMatch = html.match(/<head>([\s\S]*?)<\/head>/i);
    assert.ok(headMatch, '<head> tag tidak ditemukan');
    const headContent = headMatch[1].trim();
    const firstTagMatch = headContent.match(/^(\s*<!--[\s\S]*?-->\s*)*(<[a-z][^>]*>)/i);
    assert.ok(firstTagMatch, 'Tidak ada tag di dalam <head>');
    const firstTag = firstTagMatch[2];
    assert.ok(/<base\s+href\s*=\s*["']\/["']/i.test(firstTag),
      'Elemen pertama di <head> harus <base href="/">, ditemukan: ' + firstTag);
  });

  // Tes 4: Verifikasi tidak ada JS yang menggunakan location.pathname untuk membangun URL aset
  // Cek file JS utama yang kemungkinan membangun URL dari pathname
  const jsFilesToCheck = [
    'assets/js/core/spa-host.js',
    'assets/js/core/account-hub.js',
    'assets/js/core/pretty-url.js',
    'assets/js/pages/play.js',
    'assets/js/pwa.js',
    'assets/js/frame-guard.js',
    'assets/js/boot-guard.js',
    'assets/js/inventory-bridge.js',
    'assets/js/core/hub-redirect.js',
    'assets/js/game-integration.js',
    'assets/js/pages/room.js'
  ];

  await t('Tidak ada konstruksi URL aset dari location.pathname di file JS kritis', () => {
    const forbiddenPatterns = [
      /location\.pathname\s*\+\s*['"]assets/,
      /location\.pathname\s*\+\s*['"]\//,
      /location\.href\s*\+\s*['"]assets/,
      /new URL\(['"]assets/,
      /new URL\(src,\s*location\.href\)/
    ];
    // Pattern yang DIPERBOLEHKAN (menggunakan document.baseURI atau location.origin)
    const allowedPatterns = [
      /document\.baseURI/,
      /location\.origin\s*\+\s*['"]\//,
      /G\.document\.baseURI/,
      /G\.location\.origin/
    ];

    for (const file of jsFilesToCheck) {
      const fullPath = path.join(__dirname, '..', file);
      if (!fs.existsSync(fullPath)) continue;
      const content = fs.readFileSync(fullPath, 'utf-8');
      
      for (const pattern of forbiddenPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          // Cek apakah match ini berada di area yang diizinkan (menggunakan baseURI/origin)
          const matchIndex = content.indexOf(matches[0]);
          const context = content.substring(Math.max(0, matchIndex - 100), matchIndex + 100);
          const isAllowed = allowedPatterns.some(p => p.test(context));
          if (!isAllowed) {
            throw new Error(`File ${file} membangun URL dari location.pathname: ${matches[0]}\nKonteks: ${context}`);
          }
        }
      }
    }
  });

  // Tes 5: spa-host.js menggunakan document.baseURI atau location.origin
  await t('spa-host.js: pushHistory menggunakan document.baseURI/location.origin', () => {
    const content = fs.readFileSync(path.join(__dirname, '..', 'assets/js/core/spa-host.js'), 'utf-8');
    assert.ok(/G\.document\.baseURI/.test(content) || /G\.location\.origin/.test(content),
      'spa-host.js harus menggunakan G.document.baseURI atau G.location.origin');
    assert.ok(!/(G\.location\.pathname\s*\|\|\s*['"]play\.html['"])/.test(content),
      'spa-host.js tidak boleh menggunakan G.location.pathname sebagai fallback');
  });

  // Tes 6: account-hub.js menggunakan document.baseURI atau location.origin
  await t('account-hub.js: syncUrl menggunakan document.baseURI/location.origin', () => {
    const content = fs.readFileSync(path.join(__dirname, '..', 'assets/js/core/account-hub.js'), 'utf-8');
    assert.ok(/G\.document\.baseURI/.test(content) || /G\.location\.origin/.test(content),
      'account-hub.js harus menggunakan G.document.baseURI atau G.location.origin');
    assert.ok(!/(G\.location\.pathname\s*\|\|\s*['"]play\.html['"])/.test(content),
      'account-hub.js tidak boleh menggunakan G.location.pathname sebagai fallback');
  });

  // Tes 7: pwa.js mendaftarkan SW dengan /sw.js absolut
  await t('pwa.js: service worker didaftarkan dengan /sw.js absolut', () => {
    const content = fs.readFileSync(path.join(__dirname, '..', 'assets/js/pwa.js'), 'utf-8');
    assert.ok(/navigator\.serviceWorker\.register.*sw\.js/.test(content),
      'pwa.js harus mendaftarkan /sw.js absolut');
    assert.ok(/scope.*\//.test(content),
      'pwa.js harus mendaftarkan SW dengan scope "/"');
  });

  // Tes 8: sw.js menormalkan path pretty URL
  await t('sw.js: menormalkan path pretty URL sebelum cache matching', () => {
    const content = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf-8');
    assert.ok(/normPath/.test(content) || /pathname\.replace\(.*pretty.*URL/.test(content),
      'sw.js harus menormalkan path pretty URL');
  });

  // Tes 9: vercel.json memiliki rewrite rules yang benar
  await t('vercel.json: rewrite rules untuk pretty URL benar', () => {
    const content = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf-8'));
    assert.ok(content.rewrites && Array.isArray(content.rewrites), 'vercel.json harus memiliki array rewrites');
    // Rule pertama: strip prefix
    const stripRule = content.rewrites.find(r => r.source && r.source.includes(':rest'));
    assert.ok(stripRule, 'Harus ada rule untuk strip prefix pretty URL');
    assert.ok(stripRule.destination === '/:rest', 'Rule strip harus menuju /:rest');
    // Rule kedua: page rewrite dengan trailing slash opsional
    const pageRule = content.rewrites.find(r => r.source && r.source.includes(':page') && r.source.includes(':id') && !r.source.includes(':rest'));
    assert.ok(pageRule, 'Harus ada rule untuk page rewrite');
    assert.ok(pageRule.source.endsWith('{/}?'), 'Rule page harus menerima trailing slash opsional (sintaks path-to-regexp {/}?; "/?" tidak valid dan menggagalkan deploy Vercel)');
  });

  console.log(n + ' tes lulus');
})().catch(e => { console.error(e); process.exit(1); });