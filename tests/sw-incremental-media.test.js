/* Update SW harus inkremental: media di cache permanen + media-hash.json selalu sinkron dengan isi repo. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const code = sw.replace(/\/\*[\s\S]*?\*\//g, '');
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }

t('SW: media memakai cache permanen yang tidak ikut dibuang saat VERSION naik', () => {
  assert.ok(/MEDIA_CACHE\s*=\s*'ut-media'/.test(code));
  assert.ok(/caches\.open\(MEDIA_CACHE\)/.test(code), 'jalur media membuka MEDIA_CACHE');
  assert.ok(/k !== VERSION && k !== MEDIA_CACHE/.test(code), 'activate tidak menghapus MEDIA_CACHE');
  assert.ok(/syncMedia\(\)/.test(code), 'activate menyinkronkan media lewat hash');
});
t('assets/media-hash.json sinkron dengan id blob git (jalankan tools/gen-preload-manifest.py bila gagal)', () => {
  const MEDIA = /\.(png|webp|jpe?g|gif|svg|mp3|ogg|wav|woff2?)$/i, INC = ['assets', 'data', 'gameplay', 'hud', 'promosi'], SKIP = ['old', 'doc', 'referensi', 'node_modules'];
  const want = {};
  execFileSync('git', ['ls-files', '--stage', '-z'], { cwd: root, maxBuffer: 1 << 28 }).toString('utf8').split('\0').forEach(rec => {
    if (!rec) return;
    const [meta, p] = rec.split('\t'); const [, id, stage] = meta.split(' ');
    if (stage !== '0' || !INC.some(d => p.startsWith(d + '/')) || p.split('/').some(x => SKIP.includes(x)) || !MEDIA.test(p)) return;
    want[p] = id.slice(0, 12);
  });
  const have = JSON.parse(fs.readFileSync(path.join(root, 'assets/media-hash.json'), 'utf8'));
  const diff = Object.keys(want).filter(k => have[k] !== want[k]).concat(Object.keys(have).filter(k => !(k in want)));
  assert.deepStrictEqual(diff, [], 'media-hash.json basi: ' + diff.slice(0, 5).join(', '));
});
console.log(n + ' tes lulus');
