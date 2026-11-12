/* Kolom slot "sedang dipakai" di karakter.html. Jalankan: node tests/karakter-equip.test.js
   Mengunci aturan: hanya kategori yang BISA dilepas (punya opsi 'none') + aksesori; gender/kulit/mata/rambut/tubuh dan
   Baju & Celana dasar (tanpa opsi 'none') tidak masuk slot. */
const assert = require("assert"), fs = require("fs"), path = require("path");
const rd = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const html = rd("karakter.html"), css = rd("assets/ng/css/kredit.css");
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok - " + name); };
const regBlock = name => { const i = html.indexOf("const " + name + "=["); assert.ok(i > 0, name); const j = html.indexOf("\n];", i); return html.slice(i, j); };

t("kolom slot ada di kiri karakter dan memakai tombol #buy yang sudah ada (tidak ada tombol baru)", () => {
  assert.ok(html.indexOf('<div id="eqs"') > html.indexOf('<div id="sbs"'));
  assert.strictEqual((html.match(/id="buy"/g) || []).length, 1, "satu tombol #buy saja");
  assert.ok(/b\.textContent='Lepas'/.test(html));
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
t("6 slot outfit TETAP (kosong tetap tampil) + slot kecil aksesori di samping (#eqa)", () => {
  assert.ok(/<div id="eqa"/.test(html));
  assert.ok(/E\.main\.forEach\(it=>el\.appendChild\(eqSlot\(it,false\)\)\)/.test(html), "main selalu 6 (EQK)");
  assert.ok(/Math\.max\(6,E\.acc\.length\+1\)/.test(html), "aksesori min 6 + 1 slot '+'");
  assert.ok(/#eqs\{[^}]*grid-template-rows:repeat\(6,98px\)/.test(css));
  assert.ok(/#eqa\{[^}]*grid-auto-flow:column/.test(css) && /\.eq\.sm\{width:64px/.test(css));
});
t("tab kanan dikelompokkan: Gender | Penampilan | Outfit | Aksesori | Set (+ sub-tab)", () => {
  const m = html.match(/const GROUPS=\[([\s\S]*?)\n\];/); assert.ok(m);
  const names = [...m[1].matchAll(/name:'([^']+)'/g)].map(x => x[1]);
  assert.deepStrictEqual(names, ["Gender", "Penampilan", "Outfit", "Aksesori", "Set"]);
  const keys = [...m[1].matchAll(/keys:\[([^\]]*)\]/g)].map(x => x[1].replace(/'/g, "").split(","));
  const all = keys.flat().sort(), cats = [...regBlock("CATS").matchAll(/key:'(\w+)'/g)].map(x => x[1]).sort();
  assert.deepStrictEqual(all, cats, "semua kategori masuk tepat satu grup");
  assert.ok(/<nav id="subs"/.test(html));
});
t("klik slot: kosong -> buka tab kategori; terisi -> pilih (Lepas) + buka tab; pindah tab membatalkan pilihan", () => {
  assert.ok(/function goCat\(k,keepSel\)\{[^}]*if\(!keepSel\)eqSel=null/.test(html));
  assert.ok(/if\(it\.empty\)\{goCat\(small\?'accessories':it\.k\);return;\}/.test(html));
  assert.ok(/eqSel=it;goCat\(it\.acc\?'accessories':it\.k,true\)/.test(html));
  assert.ok(/if\(pv\)eqSel=null;/.test(html));
  assert.ok(/renderEq\(\);\s*updateInfo\(\);\s*\}/.test(html), "renderEq dipanggil di akhir renderOpts");
});
t("aset slot ada", () => {
  ["slot-ungu", "slot-terpilih"].forEach(a => assert.ok(fs.existsSync(path.join(__dirname, "../assets/ng/komponen/slot-equipment", a + ".webp")), a));
  assert.ok(fs.existsSync(path.join(__dirname, "../assets/ng/komponen/tombol-dan-kontrol/tombol-merah-polos.webp")));
});
t("skrip inline valid secara sintaks", () => { [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach(m => new Function(m[1])); });
console.log(n + " tes lulus");
