/* Kompatibilitas Fase 3: halaman entri (splash, gameplay, powerup, play, tos, index, tambang) kini memuat satu
   <script type="module" src="src/boot/*-boot.js">. Daftar skrip lamanya ada sebagai `import` di berkas boot itu.
   Shim ini menambahkan <script src> setara (urutan sama) ke HTML yang dibaca tes, agar tes urutan/keberadaan skrip
   tetap bermakna. Pakai: require('./_boot-compat.js') di baris awal tes. */
const fs = require('fs'), path = require('path');
const orig = fs.readFileSync, root = path.join(__dirname, '..');
fs.readFileSync = function (p, ...rest) {
  const r = orig.call(fs, p, ...rest);
  if (typeof r !== 'string' || !String(p).endsWith('.html')) return r;
  const m = r.match(/<script type="module" src="(src\/boot\/[\w-]+-boot\.js)"/);
  if (!m) return r;
  let boot; try { boot = orig.call(fs, path.join(root, m[1]), 'utf8'); } catch (e) { return r; }
  const tags = [...boot.matchAll(/^import '([^']+)';/gm)]
    .map(x => path.posix.normalize(path.posix.join('src/boot', x[1])))
    .filter(u => !r.includes('src="' + u + '"'))   /* modul yang sudah ada sebagai tag tidak diduplikasi */
    .map(u => '<script src="' + u + '"></script>').join('\n');
  return r + '\n<!-- boot-compat -->\n' + tags + '\n';
};
