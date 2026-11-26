const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const components = ["button", "tabs", "badge", "card", "currency", "modal", "toast", "plus-button", "resource-bar"];

for (const name of components) {
  const src = `https://example.test/assets/components/${name}/${name}.js?test=1`;
  const links = [];
  const doc = {
    currentScript: { src },
    head: { appendChild: link => links.push(link) },
    getElementById: () => null,
    createElement: () => ({})
  };
  const Hud = { has: () => false, register: () => true };
  const window = { UT: { Hud }, console: { error() {} } };
  const code = fs.readFileSync(path.join(root, "assets/components", name, `${name}.js`), "utf8");

  vm.runInNewContext(code, { window, document: doc });
  assert.strictEqual(links.length, 1, `${name} loads one stylesheet`);
  assert.strictEqual(links[0].href, `https://example.test/assets/components/${name}/${name}.css`);
}

console.log("ok - each reusable component loads its adjacent stylesheet");
