/* tests/ui-component-consistency.test.js
   Memastikan konsistensi interaction states (focus-visible, hover restrictions, active, disabled)
   pada komponen UI bersama (Button, Tabs, Modal, Cards) selaras dengan Tahap 5. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const buttonCss = fs.readFileSync(path.join(root, 'src/components/button/button.css'), 'utf8');
const tabsCss = fs.readFileSync(path.join(root, 'src/components/tabs/tabs.css'), 'utf8');
const modalCss = fs.readFileSync(path.join(root, 'src/components/modal/modal-kit.css'), 'utf8');
const cardCss = fs.readFileSync(path.join(root, 'src/components/card/card.css'), 'utf8');
const statCardCss = fs.readFileSync(path.join(root, 'src/components/stat-card/stat-card.css'), 'utf8');
const cardPanelNewCss = fs.readFileSync(path.join(root, 'src/components/card-panel-new/card-panel-new.css'), 'utf8');
const swJs = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

let n = 0;
function test(name, fn) {
  fn();
  n++;
  console.log('ok - ' + name);
}

// 1. Button component consistency
test('button.css: .ut-btn memiliki focus-visible dan disabled state', () => {
  assert.ok(buttonCss.includes('.ut-btn:focus-visible'), '.ut-btn:focus-visible harus ada');
  assert.ok(buttonCss.includes('.ut-btn:disabled'), '.ut-btn:disabled harus ada');
  assert.ok(buttonCss.includes('@media (hover: hover)'), '.ut-btn hover harus dibatasi hover device');
});

test('button.css: .ut-gl memiliki focus-visible untuk aksesibilitas keyboard', () => {
  assert.ok(buttonCss.includes('.ut-gl:focus-visible'), '.ut-gl:focus-visible harus ada');
  assert.ok(/outline:\s*\.18em solid #fff/.test(buttonCss), 'outline focus-visible putih seragam');
  assert.ok(/outline-offset:\s*\.12em/.test(buttonCss), 'outline-offset seragam');
});

test('button.css: .ut-gl mempertahankan identitas warna, active, dan disabled/off', () => {
  assert.ok(buttonCss.includes('.ut-gl.ut-c-y'), 'varian warna kuning dipertahankan');
  assert.ok(buttonCss.includes('.ut-gl.ut-c-g'), 'varian warna hijau dipertahankan');
  assert.ok(buttonCss.includes('.ut-gl.ut-c-r'), 'varian warna merah dipertahankan');
  assert.ok(buttonCss.includes('.ut-gl:not(:disabled):active'), 'state active dipertahankan');
  assert.ok(buttonCss.includes('.ut-gl:disabled, .ut-gl.off'), 'state disabled dan off dipertahankan');
});

// 2. Tabs component consistency
test('tabs.css: hover dibungkus dalam @media (hover: hover)', () => {
  const hoverMatches = tabsCss.match(/@media \(hover:\s*hover\)/g) || [];
  assert.ok(hoverMatches.length >= 2, 'hover tabs dan underline harus dibungkus @media (hover: hover)');
});

test('tabs.css: .ut-tabv dan .ut-tab memiliki focus-visible', () => {
  assert.ok(tabsCss.includes('.ut-tabv:focus-visible, .ut-tab:focus-visible'), 'focus-visible tab atas harus ada');
});

test('tabs.css: .ut-seg-i segmented tab memiliki focus-visible', () => {
  assert.ok(tabsCss.includes('.ut-seg-i:focus-visible'), 'focus-visible segmented tab harus ada');
});

test('tabs.css: .ut-ul-i underline tab memiliki focus-visible', () => {
  assert.ok(tabsCss.includes('.ut-ul-i:focus-visible'), 'focus-visible underline tab harus ada');
});

test('tabs.css: mempertahankan state active dan selected (.on / aria-selected)', () => {
  assert.ok(tabsCss.includes('.ut-tabv:active, .ut-tab:active'), 'tab active state dipertahankan');
  assert.ok(tabsCss.includes('.ut-seg-i:active'), 'segmented active state dipertahankan');
  assert.ok(tabsCss.includes('.ut-tabv.on, .ut-tab.on, .ut-tab[aria-selected="true"]'), 'tab on/selected dipertahankan');
  assert.ok(tabsCss.includes('.ut-seg-i.on'), 'segmented on dipertahankan');
  assert.ok(tabsCss.includes('.ut-ul-i.on'), 'underline on dipertahankan');
});

// 3. Modal kit
test('modal-kit.css: tombol tutup .ut-mk > .ut-mk-x menggunakan tata letak dan class pendukung', () => {
  assert.ok(modalCss.includes('.ut-mk > .ut-mk-x'), 'selector tombol tutup modal');
  assert.ok(modalCss.includes('.ut-mk'), 'panel modal .ut-mk');
  assert.ok(modalCss.includes('.ut-mk > .ut-mk-t'), 'judul modal .ut-mk-t');
});

// 4. Cards
test('card/panel containers tetap utuh', () => {
  assert.ok(cardCss.includes('.ut-card'), 'komponen .ut-card');
  assert.ok(statCardCss.includes('.ut-sc'), 'komponen .ut-sc');
  assert.ok(cardPanelNewCss.includes('.card-panel-new'), 'komponen .card-panel-new');
});

// 5. Service Worker version bumped
test('sw.js: versi service worker diperbarui ke ut-pwa-v612', () => {
  assert.ok(swJs.includes("const VERSION = 'ut-pwa-v612';"), 'SW VERSION harus v612');
});

console.log(`${n} UI component consistency tests passed.`);

