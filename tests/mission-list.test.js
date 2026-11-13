const assert = require("assert");
const fs = require("fs");
const PG = require("./_page");
const path = require("path");

const read = file => PG.readFileSync(path.join(__dirname, "..", file), "utf8");
const html = read("hadiah-misi.html");
const css = read("assets/ng/css/mission.css");

assert.ok(!/\.qlist[^}]*height:430px/.test(html), "tinggi list tidak lagi dibatasi 430px");
assert.ok(/\.qlist\{[^}]*top:243px[^}]*bottom:106px[^}]*overflow-y:auto/.test(css), "list mengisi area sampai tepat di atas footer dan tetap scrollable");
assert.ok(/const sc=\(\$\('#alist'\)\|\|\{\}\)\.scrollTop\|\|0, qsc=\(\$\('#qlist'\)\|\|\{\}\)\.scrollTop\|\|0/.test(html), "render menyimpan posisi scroll misi dan pencapaian");
assert.ok(/const ql=\$\('#qlist'\);if\(ql\)ql\.scrollTop=qsc/.test(html), "render mengembalikan posisi scroll misi");
for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Function(match[1]);

console.log("5 tes lulus");
