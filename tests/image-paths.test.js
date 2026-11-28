const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const file = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(file) : [file];
});
const localAsset = (source, target) => {
  if (/^(?:data:|https?:|\/\/|#)/i.test(target)) return;
  const file = path.resolve(path.dirname(source), target.split(/[?#]/, 1)[0]);
  assert.ok(fs.existsSync(file), `${path.relative(root, source)} -> ${target}`);
};

const staleUiDirs = /(?:^|\/)(?:bendera-bahasa|glyph-putih|ikon-gem-medali|ikon-item|ikon-navigasi|ikon-pengaturan|karakter-monster|misi|new-icon|paket-chest|paket-gold|tombol-dan-kontrol)\//;
for (const file of walk(path.join(root, 'assets', 'js', 'pages')).filter(file => file.endsWith('.js'))) {
  assert.ok(!staleUiDirs.test(fs.readFileSync(file, 'utf8')), `${path.relative(root, file)} references a retired image folder`);
}

const modePage = fs.readFileSync(path.join(root, 'assets', 'js', 'pages', 'mode.js'), 'utf8');
assert.ok(modePage.includes("'ut-c-p'") && modePage.includes("'ut-gl'") === false && modePage.includes('opt ut-gl'), 'quick-start buttons use the HUD glossy purple button (ut-gl ut-c-p), no image frame');

for (const file of walk(path.join(root, 'src', 'styles')).concat(walk(path.join(root, 'data', 'inventory'))).filter(file => file.endsWith('.css'))) {
  const css = fs.readFileSync(file, 'utf8');
  for (const match of css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)) localAsset(file, match[2].trim());
}

for (const file of walk(path.join(root, 'data', 'inventory')).filter(file => file.endsWith('.js'))) {
  const source = fs.readFileSync(file, 'utf8');
  const imports = /(?:\bfrom\s*|\bimport\s*\()\s*['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(imports)) {
    if (match[1].startsWith('.') || match[1].startsWith('/')) localAsset(file, match[1]);
  }
}

console.log('ok - active image folders, CSS URLs, and inventory imports resolve');
