/* Tidak boleh ada CDN eksternal untuk font/skrip: semua lokal (offline-ready). Jalankan: node tests/no-cdn.test.js */
const assert = require("assert"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."); let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok - " + name); };
const htmls = fs.readdirSync(root).filter(f => f.endsWith(".html"));
t("halaman tidak memuat Google Fonts (fonts.googleapis/gstatic)", () => {
  htmls.forEach(f => assert.ok(!/fonts\.(googleapis|gstatic)\.com/.test(fs.readFileSync(path.join(root, f), "utf8")), f));
});
t("semua halaman yang memakai font lokal memuat src/styles/fonts.css", () => {
  ["splash.html", "play.html", "lobby.html", "karakter.html"].forEach(f => {
    const html = fs.readFileSync(path.join(root, f), "utf8");
    assert.ok(/assets\/js\/core\/page-shell\.js/.test(html) && /PageShell\.renderBase/.test(html), f);
  });
  assert.ok(/src\/styles\/fonts\.css/.test(fs.readFileSync(path.join(root, "assets/js/core/page-shell.js"), "utf8")));
  assert.ok(/src\/styles\/fonts\.css/.test(fs.readFileSync(path.join(root, "gameplay.html"), "utf8")), "gameplay.html");
});
t("fonts.css merujuk file woff2 yang ada", () => {
  const css = fs.readFileSync(path.join(root, "src/styles/fonts.css"), "utf8");
  const files = [...css.matchAll(/url\(\.\.\/\.\.\/assets\/fonts\/([^)]+)\)/g)].map(m => m[1]); assert.ok(files.length >= 8);
  files.forEach(f => assert.ok(fs.existsSync(path.join(root, "assets/fonts", f)), f));
});
t("client multiplayer memakai supabase-js lokal, bukan esm.sh", () => {
  const js = fs.readFileSync(path.join(root, "assets/js/multiplayer/client.js"), "utf8");
  assert.ok(!/esm\.sh/.test(js) && /\.\.\/vendor\/supabase-js-[\d.]+\.mjs/.test(js));
  assert.ok(fs.existsSync(path.join(root, "assets/js/vendor/supabase-js-2.119.0.mjs")));
});
console.log(n + " tes lulus");
