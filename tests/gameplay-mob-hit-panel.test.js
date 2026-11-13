const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

class ClassList {
  constructor() { this.values = new Set(); }
  add(...names) { names.forEach((name) => this.values.add(name)); }
  remove(...names) { names.forEach((name) => this.values.delete(name)); }
  toggle(name, force) {
    if (force === undefined) force = !this.values.has(name);
    if (force) this.values.add(name);
    else this.values.delete(name);
    return force;
  }
  contains(name) { return this.values.has(name); }
}

const ids = ['puCard', 'pcEmoji', 'pcWho', 'pcName', 'pcDesc'];
const elements = Object.fromEntries(ids.map((id) => [id, { classList: new ClassList(), textContent: '', hidden: true }]));
const window = { UT: { Gameplay: { Config: { PUN: {} } } } };
const context = {
  window,
  document: { getElementById: (id) => elements[id] },
  setTimeout: () => 1,
  clearTimeout: () => {},
};

vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../gameplay/js/feedback.js'), 'utf8'), context);
const feedback = window.UT.GameplayFeedback;

feedback.showAttackCard('Blaze', 'Villager CPU', 'hit', 'Blaze menghantam Villager CPU.', { silent: true });
assert.ok(elements.puCard.classList.contains('mob-hit'), 'mob hit card should use the transparent style');
assert.ok(elements.puCard.hidden === false);

feedback.showAttackCard('Player', 'Mob', 'sword', 'Serangan biasa.', { silent: true });
assert.ok(!elements.puCard.classList.contains('mob-hit'), 'other attack cards should keep their panel');

feedback.showAttackCard('Player', 'Mob', 'power', 'Power kena.', { powerHit: true, silent: true });
assert.ok(elements.puCard.classList.contains('power-hit'), 'power hit card should keep its existing transparent style');
assert.ok(!elements.puCard.classList.contains('mob-hit'));

const css = fs.readFileSync(path.join(__dirname, '../gameplay/css/hud-mockup.css'), 'utf8');
assert.match(css, /html body #puCard\.pucard\.mob-hit\s*\{[^}]*background:\s*none\s*!important;[^}]*box-shadow:\s*none\s*!important;/s);
console.log('ok - mob hit notification appears without its panel background');
