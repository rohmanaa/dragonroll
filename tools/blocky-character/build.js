/* Jalankan dari akar repo: node tools/blocky-character/build.js
   template.js adalah source kanonis; asset runtime dihasilkan verbatim setelah validasi kontrak. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const SOURCE = path.join(__dirname, 'template.js');
const TARGET = path.join(ROOT, 'src', 'renderers', 'blocky-character.js');
const ACTIONS = ['spinball', 'toss', 'dribble', 'throw', 'mine', 'attack', 'bow', 'block', 'sad', 'cheer', 'wave', 'flip', 'backflip', 'spin', 'roll'];
const API = [
  'createBaseRig:function',
  'poses:POSE_LIST', 'root:root', 'hand:hand', 'tick:tick', 'jump:jump', 'setMode:setMode', 'act:doAct', 'setTool:setTool',
  'bow:bowG', 'arrow:arrowG', 'bowReleaseAt:function', 'setBowAim:function', 'get strikes(){', 'loadFromPlayer:',
  'loadFromData:', 'loadPreset:', 'presetCount:', 'apply:apply', 'acting', 'config', 'airborne', 'height:function'
];

function validateSource(source) {
  if (typeof source !== 'string' || source.indexOf('/* BLOCKY-CHARACTER-SOURCE:v1') !== 0) {
    throw new Error('Marker source kanonis BlockyCharacter tidak ditemukan');
  }
  if (!source.includes('UT.BlockyCharacter={') || !source.includes('create:function(THREE,opts){')) {
    throw new Error('Factory UT.BlockyCharacter.create tidak ditemukan');
  }
  const actionMatch = source.match(/const ACT_DUR\s*=\s*\{([^}]+)\}/);
  if (!actionMatch) throw new Error('Daftar ACT_DUR tidak ditemukan');
  const availableActions = new Set(Array.from(actionMatch[1].matchAll(/(?:^|,)\s*([a-z][a-z0-9]*):/g), match => match[1]));
  const missingActions = ACTIONS.filter(action => !availableActions.has(action));
  if (missingActions.length) throw new Error('Action BlockyCharacter hilang: ' + missingActions.join(', '));
  const missingApi = API.filter(api => !source.includes(api));
  if (missingApi.length) throw new Error('API BlockyCharacter hilang: ' + missingApi.join(', '));
  if (/\bdocument\.getElementById\b/.test(source)) throw new Error('UI DOM lookup tidak boleh masuk ke renderer reusable');
  return true;
}

function build(checkOnly) {
  const source = fs.readFileSync(SOURCE, 'utf8');
  validateSource(source);
  if (checkOnly) {
    const generated = fs.readFileSync(TARGET, 'utf8');
    if (generated !== source) throw new Error('src/renderers/blocky-character.js tidak sama dengan template kanonis');
    return { bytes: Buffer.byteLength(source), checked: true };
  }
  fs.writeFileSync(TARGET, source, 'utf8');
  return { bytes: Buffer.byteLength(source), checked: false };
}

if (require.main === module) {
  try {
    const result = build(process.argv.includes('--check'));
    console.log('src/renderers/blocky-character.js', result.bytes, 'bytes', result.checked ? '(parity ok)' : '(generated)');
  } catch (error) {
    console.error('BlockyCharacter build failed:', error.message);
    process.exitCode = 1;
  }
}

module.exports = { build, validateSource };

