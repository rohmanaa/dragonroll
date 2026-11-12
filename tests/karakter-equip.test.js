/* Kolom slot "sedang dipakai" di karakter.html. Jalankan: node tests/karakter-equip.test.js
   Mengunci aturan: hanya kategori yang BISA dilepas (punya opsi 'none') + aksesori; gender/kulit/mata/rambut/tubuh dan
   Baju & Celana dasar (tanpa opsi 'none') tidak masuk slot. */
const assert = require("assert"), fs = require("fs"), path = require("path");
const rd = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const html = rd("karakter.html"), css = rd("assets/ng/css/kredit.css");
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok - " + name); };
const regBlock = name => { const i = html.indexOf("const " + name + "=["); assert.ok(i > 0, name); const j = html.indexOf("\n];", i); return html.slice(i, j); };

t("slot equipment berada di kedua sisi karakter tanpa tombol aksi di panel", () => {
  assert.ok(/<div id="eqL" aria-label="Perlengkapan sisi kiri"><\/div>/.test(html));
  assert.ok(/<div id="eqR" aria-label="Perlengkapan sisi kanan"><\/div>/.test(html));
  assert.ok(!/id="buy"/.test(html), "aksi pembelian/pemakaian tidak diletakkan di panel");
  assert.ok(/fmtPrice\(ci\.price\)/.test(html));
  assert.ok(/const KOIN='assets\/ng\/komponen\/hud\/ikon-koin-emas\.webp'/.test(html));
  assert.ok(html.includes("badgeHtml:lock&&canSell(ci)?'<img class=\"coin\" src=\"'+KOIN+'\" alt=\"\"><span>'+fmtPrice(ci.price)+'</span>':null"), "status beli menampilkan ikon koin dan harga ringkas");
  assert.ok(/on\?'Dipakai':'Dimiliki'/.test(html));
  assert.ok(/startPreview\(ci,part\);confirmBuy\(ci\)/.test(html), "Beli pada kartu membuka pembelian item");
  assert.ok(/stage\('i'\+c\.key\+it\.id,it\.n,\{\[c\.key\]:\{id:it\.id\}\}\);commitDraft\(\)/.test(html), "Dimiliki pada kartu menerapkan item");
  assert.ok(/e\.stopPropagation\(\);o\.buttonFn\(\)/.test(html), "aksi kartu tidak menjalankan klik preview parent");
});
t("kontrol pose dan lompat tidak ditampilkan", () => {
  assert.ok(!/<div id="sbs"/.test(html));
  assert.ok(!/const MODES=/.test(html));
});
t("tombol Acak dan Toko berada di dalam panel kiri bawah", () => {
  const info = html.indexOf('<section id="info">'),close = html.indexOf('</section>', info);
  assert.ok(info > html.indexOf('<section id="left">') && info < html.indexOf('<section id="right">'));
  assert.ok(/<div id="panelActions"><button class="bt" id="rnd">🎲 Acak<\/button><button class="bt" id="shp">🛒 Toko<\/button><\/div>/.test(html.slice(info, close)));
  assert.ok(/\$\('#rnd'\)\.addEventListener/.test(html) && /\$\('#shp'\)\.addEventListener/.test(html));
});
t("card info berada di kiri bawah dengan area aksesori tambahan dan tanpa tombol pembelian", () => {
  const info = html.indexOf('<section id="info">'),right = html.indexOf('<section id="right">'),extra = html.indexOf('<div id="extraAcc"');
  assert.ok(info < right && extra > info);
  assert.ok(!/id="buy"/.test(html.slice(info, html.indexOf('</section>', info))));
  assert.ok(/body\.kr #info\{[^}]*left:70px;top:760px;width:820px;height:240px/.test(css));
});
t("EQK hanya berisi kategori yang punya opsi 'none' (bisa dilepas)", () => {
  const m = html.match(/const EQK=\[([^\]]*)\]/); assert.ok(m);
  const keys = m[1].split(",").map(s => s.trim().replace(/'/g, ""));
  assert.deepStrictEqual(keys, ["helm", "chest", "shoulder", "cape", "weapon", "boots"]);
  const reg = { helm: "HELMS", chest: "CHESTS", shoulder: "SHOULDERS", cape: "CAPES", weapon: "WEAPONS", boots: "BOOTS" };
  keys.forEach(k => assert.ok(/id:'none'/.test(regBlock(reg[k])), k + " harus punya 'none'"));
});
t("Baju & Celana dasar tidak punya 'none' -> memang tidak boleh masuk slot", () => {
  ["TOPS", "LEGS"].forEach(r => assert.ok(!/id:'none'/.test(regBlock(r)), r + " tidak punya none"));
  const m = html.match(/const EQK=\[([^\]]*)\]/)[1];
  ["top", "legs", "gender", "skin", "eyes", "hair", "body"].forEach(k => assert.ok(!m.includes("'" + k + "'"), k + " tidak boleh di EQK"));
});
t("slot membaca tampilan TERSIMPAN (B()), bukan pratinjau/draft", () => {
  assert.ok(/function eqItems\(\)\{\s*const c=B\(\)/.test(html));
});
t("Lepas lewat apply() -> listeners -> syncToPD (jalur simpan yang sama dengan ganti item)", () => {
  const i = html.indexOf("function unequip(it)"); const seg = html.slice(i, i + 400);
  assert.ok(/apply\(\{accessories:cfg\.accessories\.filter/.test(seg) && /apply\(\{\[it\.k\]:\{id:'none'\}\}\)/.test(seg));
});
t("empat slot outfit di kiri dan empat slot equipment/aksesori di kanan memakai placeholder ikon", () => {
  assert.ok(/E\.main\.slice\(0,4\)\.forEach\(it=>el\.appendChild\(eqSlot\(it\)\)\)/.test(html));
  assert.ok(/const right=E\.main\.slice\(4\)/.test(html));
  assert.ok(/const right=E\.main\.slice\(4\)\.concat\(E\.acc\.slice\(0,2\)\)/.test(html));
  assert.ok(/while\(right\.length<4\)right\.push\(\{empty:true,k:'acc',cat:'Aksesori',ico:'🎒',acc:true\}\)/.test(html));
  assert.ok(/E\.acc\.slice\(2\)\.forEach\(it=>extra\.appendChild\(eqSlot\(it,true\)\)\)/.test(html));
  assert.ok(/info\.classList\.toggle\('hasextras',E\.acc\.length>2\)/.test(html));
  assert.ok(/function eqSlot\(it,compact\)/.test(html) && /compact\?' compact':''/.test(html));
  assert.ok(/d\.innerHTML='<div class="th"><span class="em">'\+it\.ico/.test(html));
  assert.ok(/#eqL,#eqR\{[^}]*top:140px[^}]*grid-template-rows:repeat\(4,124px\)[^}]*gap:26px/.test(css));
  assert.ok(/\.eq\{[^}]*width:124px;height:124px/.test(css));
  assert.ok(/#eqL\{left:64px\}/.test(css) && /#eqR\{left:772px\}/.test(css));
  assert.ok(/\.card \.bt\{[^}]*display:flex;[^}]*width:100%;height:56px/.test(css), "aksi kartu berukuran cukup dan ikon-harga sejajar");
  assert.ok(/\.eq\.empty \.th \.em\{[^}]*filter:grayscale\(1\) brightness\(0\) invert\(1\)/.test(css));
});
t("tab memakai garis bawah NewGUI dan tetap mengelompokkan semua kategori editor", () => {
  const m = html.match(/const GROUPS=\[([\s\S]*?)\n\];/); assert.ok(m);
  const names = [...m[1].matchAll(/name:'([^']+)'/g)].map(x => x[1]);
  assert.deepStrictEqual(names, ["Gender", "Penampilan", "Outfit", "Aksesori", "Set"]);
  const keys = [...m[1].matchAll(/keys:\[([^\]]*)\]/g)].map(x => x[1].replace(/'/g, "").split(","));
  assert.deepStrictEqual(keys, [["gender"], ["skin", "eyes", "hair", "body"], ["top", "legs", "helm", "boots"], ["accessories"], ["preset"]]);
  const hidden = [...html.match(/const slotTabs=\{([^}]*)\}/)[1].matchAll(/(\w+):'Outfit'/g)].map(x => x[1]);
  const all = keys.flat().concat(hidden).sort(), cats = [...regBlock("CATS").matchAll(/key:'(\w+)'/g)].map(x => x[1]).sort();
  assert.deepStrictEqual(all, cats, "kategori yang tidak ditampilkan langsung tetap dapat diakses dari slot equip");
  assert.ok(/<nav id="tabs"/.test(html) && /<nav id="subs"/.test(html));
  assert.ok(/id="tabs" aria-label="Kategori"/.test(html));
  assert.ok(/garis-bawah-tab-emas\.webp/.test(html));
  assert.ok(/#tabs\{[^}]*grid-template-columns:repeat\(5,1fr\)/.test(css));
  assert.ok(/subsEl\.style\.display=G\.keys\.length>1\?'':'none'/.test(html), "Gender, Aksesori, dan Set tidak memiliki subkategori");
  assert.ok(!/id="bh"|id="bht"/.test(html) && !/#bh|#bht/.test(css), "judul kategori tambahan tidak ditampilkan");
  assert.ok(/<button class="bt" id="ofm" style="display:none">✏️ Kelola<\/button>/.test(html), "aksi Kelola outfit tetap tersedia");
  assert.ok(/#ofm\{[^}]*top:232px/.test(css), "Kelola outfit tidak lagi bergantung pada header");
  assert.ok(/#gwrap\{[^}]*top:318px[^}]*height:600px/.test(css), "grid memakai ruang tanpa header tambahan");
});
t("klik slot: kosong -> buka tab kategori; terisi -> buka kategorinya untuk melepas dari kartu", () => {
  assert.ok(/function goCat\(k,keepSel\)\{[^}]*if\(!keepSel\)eqSel=null/.test(html));
  assert.ok(/if\(it\.empty\)\{goCat\(it\.acc\?'accessories':it\.k\);return;\}/.test(html));
  assert.ok(/eqSel=it;goCat\(it\.acc\?'accessories':it\.k,true\)/.test(html));
  assert.ok(/Tekan Dipakai pada kartunya untuk melepas/.test(html), "panel mengarahkan ke kartu yang memuat aksi lepas");
  assert.ok(/if\(on\)\{const equipped=eqItems\(\)\.main\.find\(a=>a\.k===c\.key&&a\.id===it\.id\);if\(equipped\)unequip\(equipped\);return;\}/.test(html));
  assert.ok(/renderEq\(\);\s*updateInfo\(\);\s*\}/.test(html), "renderEq dipanggil di akhir renderOpts");
});
t("aset slot ada", () => {
  ["slot-ungu", "slot-terpilih"].forEach(a => assert.ok(fs.existsSync(path.join(__dirname, "../assets/ng/komponen/slot-equipment", a + ".webp")), a));
  assert.ok(fs.existsSync(path.join(__dirname, "../assets/ng/komponen/tombol-dan-kontrol/tombol-merah-polos.webp")));
});
t("skrip inline valid secara sintaks", () => { [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach(m => new Function(m[1])); });
console.log(n + " tes lulus");
