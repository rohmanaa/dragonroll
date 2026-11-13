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
const headers = ["karakter.html", "frame.html", "dadu.html", "powerup.html", "shop.html", "friendship.html", "hadiah-misi.html", "tambang.html", "profile.html"];
const pageCss = read("assets/ng/css/page.css");
const frameCss = read("assets/ng/css/frame.css");
const powerCss = read("assets/ng/css/powerup.css");
let n = 0;
const test = (name, fn) => { fn(); n++; console.log("ok - " + name); };

test("harga ringkas pada kartu konsisten untuk semua halaman", () => {
  for (const [name, html] of Object.entries(pages)) {
    const match = html.match(/const fmtPrice=(n=>[^;]+);/);
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

test("tombol beli menampilkan ikon koin dan harga saja", () => {
  assert.ok(pages.karakter.includes("'<img class=\"coin\" src=\"'+KOIN+'\" alt=\"\"><span>'+fmtPrice(ci.price)+'</span>'"));
  assert.ok(!/Beli <img class="coin"/.test(pages.karakter));
  assert.ok(/data-action="buy"><img src="\$\{KOIN\}" alt="">\$\{fmtPrice\(x\.price\)\}/.test(pages.frame));
  assert.ok(/data-action="buy"><img src="\$\{KOIN\}" alt="">\$\{fmtPrice\(x\.price\)\}/.test(pages.dadu));
  assert.ok(/data-action="buy" aria-label="Beli '\+fmtPrice\(i\.price\)\+' koin">'\+COIN\+fmtPrice\(i\.price\)/.test(pages.powerup));
  assert.ok(/data-buy="1">\$\{PCOIN\}\$\{fmtPrice\(p\.price\)\}/.test(pages.room));
});

test("status Dimiliki memakai warna biru-abu dan status lain tetap di bawah item", () => {
  assert.ok(/\.fslot \.pr\.owned\{background-image:url\(\.\.\/komponen\/tombol-dan-kontrol\/tombol-abu-polos\.webp\)/.test(frameCss));
  assert.ok(/\.fslot \.pr\.owned\{background-image:url\(\.\.\/komponen\/tombol-dan-kontrol\/tombol-abu-polos\.webp\)/.test(powerCss));
  assert.ok(/\.card \.bt\.owned\{background-image:url\(\.\.\/komponen\/tombol-dan-kontrol\/tombol-abu-polos\.webp\)/.test(read("assets/ng/css/kredit.css")));
  assert.ok(/on\?'DIPAKAI':'DIMILIKI'/.test(pages.frame));
  assert.ok(/on\?'DIPASANG':'DIMILIKI'/.test(pages.dadu));
  assert.ok(/class="pr \$\{on\?'used':'owned'\}".*DIPAKAI/.test(pages.efek));
  assert.ok(!/class="tag">DIPAKAI/.test(pages.efek), "status efek bukan lagi badge di atas");
  assert.ok(!/id="use"/.test(pages.efek) && !pages.efek.includes("$('#use')"), "aksi efek ada pada kartu, bukan panel");
});

test("tombol Home hilang dan saldo rata kanan pada halaman yang diminta", () => {
  headers.forEach(file => assert.ok(!/id="home"/.test(read(file)), file + " tidak lagi menampilkan tombol Home"));
  assert.ok(/#cur-em\{left:auto!important;right:340px\}/.test(pageCss));
  assert.ok(/#cur-co\{left:auto!important;right:26px\}/.test(pageCss));
});

test("Power-up hanya menunjukkan stok dan tombol beli; status pasang tetap di Room", () => {
  assert.ok(/STOK ×'\+k/.test(pages.powerup));
  assert.ok(/data-action="buy" aria-label="Beli '\+fmtPrice\(i\.price\)\+' koin"/.test(pages.powerup));
  assert.ok(!/roomPowers|DIPASANG|installed/.test(pages.powerup));
  assert.ok(/data-buy="1"/.test(pages.room) && /nav\('powerup\.html'\)/.test(pages.room));
  assert.ok(/class="pstate installed">DIPASANG/.test(pages.room));
});

console.log(n + " tes lulus");
