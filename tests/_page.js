/* Pembaca halaman untuk tes: CSS/JS halaman sudah dipecah ke assets/css/pages & assets/js/pages (tools/extract-inline.py).
   readFileSync() di sini mengembalikan HTML dengan blok itu disatukan kembali di posisi aslinya, supaya tes statis
   yang membaca teks halaman (urutan skrip, regex isi skrip) tetap bekerja. File selain .html diteruskan apa adanya. */
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const rd = p => fs.readFileSync(path.join(root, p), "utf8");
function inline(html) {
  html = html.replace(/<script([^>]*?)\ssrc="(assets\/js\/pages\/[^"]+)"([^>]*)><\/script>/g, (m, a, src, b) => "<script" + a + b + ">" + rd(src) + "</script>");
  html = html.replace(/<link rel="stylesheet"( id="[^"]+")? href="(assets\/css\/pages\/[^"]+)">/g, (m, id, href) => "<style" + (id || "") + ">" + rd(href) + "</style>");
  return html;
}
function readFileSync(file, enc) {
  const r = fs.readFileSync(file, enc);
  return (typeof r === "string" && /\.html$/.test(String(file))) ? inline(r) : r;
}
module.exports = { inline, readFileSync };
