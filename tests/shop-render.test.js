const assert = require("assert");
const fs = require("fs");
const path = require("path");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const html = read("shop.html");
const script = read("assets/js/shop-page.js");

assert.ok(/<script src="assets\/js\/shop-page\.js"><\/script>/.test(html), "halaman memuat renderer Toko");
assert.ok(!/id="home"/.test(html), "halaman tidak menampilkan tombol Home duplikat");
assert.ok(!/\$\('#home'\)\.addEventListener/.test(script), "renderer tidak gagal pada elemen Home yang tidak tersedia");
assert.ok(/render\(\);\s*renderCurrency\(\);/.test(script), "renderer mengisi ulang isi toko saat inisialisasi");

console.log("4 tes lulus");
