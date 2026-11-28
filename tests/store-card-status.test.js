const assert = require("assert");
const fs = require("fs");
const PG = require("./_page");
const path = require("path");

const read = file => PG.readFileSync(path.join(__dirname, "..", file), "utf8");
const pages = {
  karakter: read("karakter.html"),
  frame: read("frame.html"),
  dadu: read("dadu.html"),
  powerup: read("powerup.html"),
  efek: read("efek.html"),
  room: read("room.html")
};
const scripts = {
  frame: read("frame.html"),
  dadu: read("data/inventory/dice/_shared/js/dadu.js"),
  room: read("src/views/room.js"),
  powerup: read("data/inventory/power/_shared/js/powerup.js")
};
const headers = ["karakter.html", "frame.html", "dadu.html", "powerup.html", "shop.html", "friendship.html", "hadiah-misi.html", "tambang.html", "profile.html"];
const pageCss = read("src/styles/page.css");
const frameCss = read("data/inventory/frame/_shared/css/frame.css");
const powerCss = read("data/inventory/power/_shared/css/powerup.css");
const powerPageCss = read("data/inventory/power/_shared/css/powerup-page.css");
const powerScript = read("data/inventory/power/_shared/js/powerup.js");
const petCss = read("data/inventory/pet/_shared/css/pet-page.css");
const petScript = read("data/inventory/pet/_shared/js/pet-page.js");
let n = 0;
const test = (name, fn) => { fn(); n++; console.log("ok - " + name); };

test("harga ringkas pada kartu konsisten untuk semua halaman", () => {
  for (const [name, html] of Object.entries(pages)) {
    const src = scripts[name] || html;
    const match = src.match(/const fmtPrice=(n=>[^;]+);/);
    assert.ok(match, name + " memiliki formatter harga");
    const formatter = new Function("fmt", "return (" + match[1] + ")")(
      value => Number(value).toLocaleString("id-ID")
    );
    assert.strictEqual(formatter(999), "999", name + " menjaga harga di bawah 1.000");
    assert.strictEqual(formatter(1000), "1k", name + " meringkas 1.000");
    assert.strictEqual(formatter(2000), "2k", name + " meringkas 2.000");
    assert.strictEqual(formatter(100000), "100k", name + " meringkas 100.000");
  }
});

test("tombol beli menampilkan ikon mata uang yang sesuai dan harga saja", () => {
  assert.ok(pages.karakter.includes("label:'BELI '+fmtPrice(ci.price)+' COIN'"), "karakter: harga item ada pada tombol aksi kanan bawah");
  assert.ok(pages.karakter.includes("label:'BELI SET '+fmtPrice(st.total)+' COIN'"), "karakter: harga set ada pada tombol aksi kanan bawah");
  assert.ok(!/Beli <img class="coin"/.test(pages.karakter));
  const currencyPrice = 'data-action="buy"><img src="${x.gems>0?GEM:KOIN}" alt="">${fmtPrice(x.gems>0?x.gems:x.price)}';
  assert.ok(scripts.frame.includes("sp.textContent='BELI '+fmtPrice(f.gems>0?f.gems:f.price)"), 'frame: harga beli ada di tombol aksi #act');
  assert.ok(!scripts.frame.includes(currencyPrice), 'frame: kartu slot tidak lagi memuat badge harga');
  assert.ok(scripts.dadu.includes("fmtPrice(gems?x.gems:x.price)") && scripts.dadu.includes("'BELI '+fmtPrice(f.gems>0?f.gems:f.price)"), 'dadu: harga ada di kaki kartu (d-ft) dan di tombol aksi BELI');
  assert.ok(!scripts.dadu.includes(currencyPrice), 'dadu: kartu slot tidak lagi memuat badge harga');
  /* power (inventaris): sejak 23 Nov 2026 hanya menampilkan item yang DIMILIKI -> tidak ada tombol BELI di halaman ini; pembelian lewat Toko/Room */
  assert.ok(powerPageCss.includes('#act span img{position:static;'), 'power: ikon Coin ditata di dalam tombol aksi');
  assert.ok(/data-buy="1">\$\{PCOIN\}\$\{fmtPrice\(p\.price\)\}/.test(scripts.room));
});

test("tombol Pet rata kanan dan ikon Coin memakai path WebP langsung", () => {
  /* pet: sejak redesain grid kartu (.pc-pr) tombol #use kanan-bawah tidak ada lagi -> tidak diuji */
  assert.ok(petScript.includes('<b>${format(gems ? cost.gems : cost.coins)}</b><img src="${gems ? IC_GEM : IC_COIN}" alt="">') && /IC_COIN\s*=\s*'assets\/images\//.test(petScript), "pet: ikon harga (IC_COIN/IC_GEM) memakai path aset langsung");
  assert.ok(!petScript.includes("ITEM_ROOT + icon"), "pet: path ikon tidak menggandakan root aset");
});

test("status Dimiliki memakai warna biru-abu dan status lain tetap di bawah item", () => {
  assert.ok(/\.fslot \.pr\.owned\{background-image:url\(\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/assets\/images\/buttons\/tombol-abu-polos\.webp\)/.test(frameCss));
  assert.ok(/\.fslot \.pr\.owned\{background-image:url\(\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/assets\/images\/buttons\/tombol-abu-polos\.webp\)/.test(powerCss));
  assert.ok(/const BG=\{own:'own',owned:'owned',def:'',lock:'no'\}/.test(read("data/inventory/character/_shared/js/karakter.js")), "karakter: status kartu memakai BG (own/owned/def/lock)");
  assert.ok(/const st=on\?'st-used':m\?'st-own':'st-lock'/.test(scripts.frame), 'frame: status warna slot (hijau/ungu/abu)');
  assert.ok(/const st=slotState\(x\),sell=canSell\(x\)/.test(scripts.dadu) && scripts.dadu.includes('d-ft') && scripts.dadu.includes("'DIPAKAI'") && scripts.dadu.includes("'DIMILIKI'") && scripts.dadu.includes("'TIDAK DIJUAL'"), 'dadu: status kartu (DIPAKAI / DIMILIKI / harga / TIDAK DIJUAL) di kaki kartu');
  const efekJs = read("data/inventory/aura/_shared/js/efek.js");
  assert.ok(/const m=isOwned\(x\),on=isUsed\(x\),sell=canSell\(x\)/.test(efekJs), "efek: status kartu dihitung per item");
  assert.ok(!/id="act"/.test(pages.efek) && efekJs.includes('>LEPAS</button>') && efekJs.includes('>GUNAKAN</button>'), "efek: bar aksi di kartu (LEPAS/GUNAKAN/harga) seperti Pet");
  assert.ok(!/class="tag">DIPAKAI/.test(pages.efek), "status efek bukan lagi badge di atas");
  assert.ok(!/id="use"/.test(pages.efek) && !pages.efek.includes("$('#use')"), "aksi efek ada pada kartu, bukan panel");
});

test("tombol Home hilang dan saldo rata kanan pada halaman yang diminta", () => {
  headers.forEach(file => assert.ok(!/id="home"/.test(read(file)), file + " tidak lagi menampilkan tombol Home"));
  assert.ok(/#cur-em\{left:auto!important;right:340px\}/.test(pageCss));
  assert.ok(/#cur-co\{left:auto!important;right:26px\}/.test(pageCss));
});

test("Power-up hanya menunjukkan stok dan tombol beli; status pasang tetap di Room", () => {
  assert.ok(/class="chip-n">'\+k\+'<\/span>/.test(scripts.powerup), 'power: chip jumlah kepemilikan di kanan atas');
  assert.ok(/st-own|st-lock/.test(scripts.powerup), 'power: status warna slot (ungu/abu)');
  assert.ok(!/roomPowers|DIPASANG|installed/.test(scripts.powerup));
  assert.ok(/data-buy="1"/.test(scripts.room) && /power:\['powerup\.html','Power-up'\]/.test(scripts.room));
  assert.ok(/class="pstate installed">DIPASANG/.test(scripts.room));
});

console.log(n + " tes lulus");


