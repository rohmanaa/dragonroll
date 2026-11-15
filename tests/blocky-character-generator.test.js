/* Validasi source kanonis dan parity generator BlockyCharacter tanpa browser. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const sourcePath = path.join(ROOT, 'tools', 'blocky-character', 'template.js');
const targetPath = path.join(ROOT, 'assets', 'js', 'renderers', 'blocky-character.js');
const buildPath = path.join(ROOT, 'tools', 'blocky-character', 'build.js');
const build = require(buildPath);
const source = fs.readFileSync(sourcePath, 'utf8');

assert.strictEqual(build.validateSource(source), true);
assert.throws(() => build.validateSource(source.replace('/* BLOCKY-CHARACTER-SOURCE:v1', '/* missing marker')), /Marker source kanonis/);
assert.throws(() => build.validateSource(source.replace('spinball:3.0,', '')), /Action BlockyCharacter hilang: spinball/);
console.log('ok - source marker, API, dan seluruh action wajib tervalidasi');

if (process.argv.includes('--source-only')) process.exit(0);

const check = spawnSync(process.execPath, [buildPath, '--check'], { cwd: ROOT, encoding: 'utf8' });
assert.strictEqual(check.status, 0, check.stdout + check.stderr);
assert.strictEqual(fs.readFileSync(targetPath, 'utf8'), source);
console.log('ok - generator deterministik dan asset sama persis dengan template');
