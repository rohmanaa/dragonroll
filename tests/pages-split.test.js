/* Halaman root (selain gameplay.html) tidak boleh menyimpan CSS/JS besar inline: pecah ke assets/css/pages & assets/js/pages
   (python3 tools/extract-inline.py). Inline kecil (<300 karakter, mis. bootstrap UT.App.init) dan importmap boleh. */
const assert = require("assert"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."); let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok - " + name); };
const pages = fs.readdirSync(root).filter(f => f.endsWith(".html") && f !== "gameplay.html");
t("tidak ada <style>/<script> inline >= 300 karakter (kecuali importmap)", () => {
  pages.forEach(f => {
    const h = fs.readFileSync(path.join(root, f), "utf8");
    for (const m of h.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) assert.ok(m[1].trim().length < 300, f + ": <style> inline " + m[1].trim().length);
    for (const m of h.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) if (!/src=|importmap/.test(m[1])) assert.ok(m[2].trim().length < 300, f + ": <script> inline " + m[2].trim().length);
  });
});
t("semua src/href ke assets/{js,css}/pages ada, dan url() CSS halaman menunjuk file yang ada", () => {
  pages.forEach(f => {
    const h = fs.readFileSync(path.join(root, f), "utf8");
    [...h.matchAll(/(?:src|href)="(assets\/(?:js|css)\/pages\/[^"]+)"/g)].forEach(m => assert.ok(fs.existsSync(path.join(root, m[1])), f + " -> " + m[1]));
  });
  fs.readdirSync(path.join(root, "assets/css/pages")).forEach(c => {
    const css = fs.readFileSync(path.join(root, "assets/css/pages", c), "utf8");
    [...css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].forEach(m => {
      if (/^(data:|https?:|\/\/|#)/.test(m[1])) return;
      assert.ok(fs.existsSync(path.join(root, "assets/css/pages", m[1].split(/[?#]/)[0])), c + " url(" + m[1] + ")");
    });
  });
});
t("import() dinamis di JS halaman memakai path relatif ke assets/js/pages (../../../assets/...)", () => {
  fs.readdirSync(path.join(root, "assets/js/pages")).forEach(f => {
    const js = fs.readFileSync(path.join(root, "assets/js/pages", f), "utf8");
    [...js.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].forEach(m => assert.ok(fs.existsSync(path.join(root, "assets/js/pages", m[1])), f + " import(" + m[1] + ")"));
  });
});
console.log(n + " tes lulus");
