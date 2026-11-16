/* Jalankan dari akar repo: node tools/character-data/build.js
   Geometri diekstrak dari gameplay/js/main.js; metadata rig hidup di generator agar ikut regenerasi. */
const fs = require('fs');
const path = require('path');
const raw = require('./extract.js');
const ROOT = path.join(__dirname, '..', '..');
const TARGET = path.join(ROOT, 'data', 'character-page', 'js', 'character-data.js');
const CHARACTER_KEYS = ['steve', 'alex', 'creeper', 'zombie', 'skeleton', 'ender'];

function merge(boxes) {
  const out = [];
  for (let i = 0; i < boxes.length;) {
    const box = boxes[i];
    if (box[3] === 0.1 && box[4] === 0.1 && box[5] === 0.1 && i + 26 < boxes.length &&
        boxes.slice(i, i + 27).every(candidate => candidate[3] === 0.1 && candidate[6] === box[6])) {
      const ys = boxes.slice(i, i + 27).map(candidate => candidate[1]);
      const cy = Math.round(((Math.min(...ys) + Math.max(...ys)) / 2) * 1000) / 1000;
      out.push([0, cy, 0, 0.3, 0.3, 0.3, box[6], 0, 3]);
      i += 27;
    } else {
      out.push(box);
      i++;
    }
  }
  return out;
}

const data = {};
for (const group of ['players', 'mobs', 'wild']) {
  data[group] = {};
  for (const key in raw[group]) data[group][key] = merge(raw[group][key]);
}
const DATA = { player: data.players, mob: data.mobs, wild: data.wild };

const HUMANOID_PARTS = {
  head: { boxIndices: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], pivot: [0, 0.49, 0] },
  torso: { boxIndices: [8], pivot: [0, 0.5, 0] },
  rightArm: { boxIndices: [2, 3], pivot: [-0.15, 0.505, 0] },
  leftArm: { boxIndices: [6, 7], pivot: [0.15, 0.505, 0] },
  rightLeg: { boxIndices: [0, 1], pivot: [-0.07, 0.22, 0] },
  leftLeg: { boxIndices: [4, 5], pivot: [0.07, 0.22, 0] }
};
const HUMANOID_ANCHORS = {
  head: [0, 0.83, 0], torso: [0, 0.36, 0], back: [0, 0.36, -0.09],
  rightHand: [-0.2, 0.27, 0], leftHand: [0.2, 0.27, 0],
  rightFoot: [-0.07, 0.025, 0.012], leftFoot: [0.07, 0.025, 0.012]
};
const HUMANOID_ATTACHMENTS = Object.keys(HUMANOID_ANCHORS);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function humanoidRig(baseModelKey) {
  return {
    baseModelKey: baseModelKey,
    type: 'humanoid',
    parts: clone(HUMANOID_PARTS),
    anchors: clone(HUMANOID_ANCHORS),
    capabilities: {
      locomotion: { gait: 'biped', articulatedLegs: true, verticalOffset: true },
      actionRig: { articulatedArms: true, handAnchors: true, twoHandedPoses: true }
    },
    gearConstraints: { availableAnchors: HUMANOID_ATTACHMENTS.slice() }
  };
}

function creeperRig() {
  return {
    baseModelKey: 'creeper',
    type: 'creeper',
    parts: {
      head: { boxIndices: [7, 8, 9, 10, 11, 12, 13], pivot: [0, 0.49, 0] },
      torso: { boxIndices: [4, 5, 6], pivot: [0, 0.565, 0] },
      frontRightLeg: { boxIndices: [1], pivot: [-0.09, 0.18, 0.08] },
      rearRightLeg: { boxIndices: [0], pivot: [-0.09, 0.18, -0.08] },
      frontLeftLeg: { boxIndices: [3], pivot: [0.09, 0.18, 0.08] },
      rearLeftLeg: { boxIndices: [2], pivot: [0.09, 0.18, -0.08] }
    },
    anchors: {
      head: [0, 0.79, 0], torso: [0, 0.38, 0], back: [0, 0.38, -0.1],
      frontRightFoot: [-0.09, 0.02, 0.08], rearRightFoot: [-0.09, 0.02, -0.08],
      frontLeftFoot: [0.09, 0.02, 0.08], rearLeftFoot: [0.09, 0.02, -0.08]
    },
    capabilities: {
      locomotion: { gait: 'four-leg-hop', articulatedLegs: true, verticalOffset: true },
      actionRig: { articulatedArms: false, handAnchors: false, twoHandedPoses: false }
    },
    gearConstraints: { availableAnchors: ['head', 'torso', 'back', 'frontRightFoot', 'rearRightFoot', 'frontLeftFoot', 'rearLeftFoot'] }
  };
}

function enderRig() {
  return {
    baseModelKey: 'ender',
    type: 'ender',
    parts: {
      head: { boxIndices: [5, 6, 7, 8, 9], pivot: [0, 0.82, 0] },
      torso: { boxIndices: [4], pivot: [0, 0.8, 0] },
      rightArm: { boxIndices: [1], pivot: [-0.1, 0.88, 0] },
      leftArm: { boxIndices: [3], pivot: [0.1, 0.88, 0] },
      rightLeg: { boxIndices: [0], pivot: [-0.04, 0.5, 0] },
      leftLeg: { boxIndices: [2], pivot: [0.04, 0.5, 0] }
    },
    anchors: {
      head: [0, 1.12, 0], torso: [0, 0.65, 0], back: [0, 0.65, -0.05],
      rightHand: [-0.1, 0.32, 0], leftHand: [0.1, 0.32, 0],
      rightFoot: [-0.04, 0.02, 0], leftFoot: [0.04, 0.02, 0]
    },
    capabilities: {
      locomotion: { gait: 'long-biped', articulatedLegs: true, verticalOffset: true },
      actionRig: { articulatedArms: true, handAnchors: true, twoHandedPoses: true }
    },
    gearConstraints: { availableAnchors: ['head', 'torso', 'back', 'rightHand', 'leftHand', 'rightFoot', 'leftFoot'] }
  };
}

const META = {
  player: {
    steve: { name: 'Steve', hex: '#2F80FF', css: '#2a78d6', rig: humanoidRig('steve') },
    alex: { name: 'Alex', hex: '#FF8A1A', css: '#d9791c', rig: humanoidRig('alex') },
    creeper: { name: 'Creeper', hex: '#4DB84A', css: '#3f9f2a', rig: creeperRig() },
    ender: { name: 'Enderman', hex: '#A855F7', css: '#3a2a52', rig: enderRig() },
    zombie: { name: 'Zombie', hex: '#2DB5A6', css: '#2b8f87', rig: humanoidRig('zombie') },
    skeleton: { name: 'Skeleton', hex: '#D0D0D0', css: '#6f7378', rig: humanoidRig('skeleton') },
    villager: { name: 'Villager', hex: '#C9A24A', css: '#a8832f' }
  },
  mob: {
    creeper: { name: 'Creeper', hex: '#3E8E3A', css: '#3f9f2a' },
    ender: { name: 'Enderman', hex: '#3A1F5C', css: '#3a2a52' },
    skeleton: { name: 'Skeleton', hex: '#B8B8B8', css: '#6f7378' },
    zombie: { name: 'Zombie', hex: '#4F8F3F', css: '#2b8f87' },
    warden: { name: 'Warden', hex: '#0E3A44', css: '#1f7f7a' },
    villager: { name: 'Villager', hex: '#C9A24A', css: '#a8832f' },
    blaze: { name: 'Blaze', hex: '#E0561A', css: '#e0561a' }
  },
  wild: {
    golem: { name: 'Iron Golem', hex: '#C9C9C2', css: '#9a9a92' },
    spider: { name: 'Spider', hex: '#2A2024', css: '#3a2e32' },
    zombie: { name: 'Zombie', hex: '#5E9E4A', css: '#2b8f87' },
    skeleton: { name: 'Skeleton', hex: '#DADADA', css: '#6f7378' },
    creeper: { name: 'Creeper', hex: '#4DB84A', css: '#3f9f2a' }
  }
};
const SEATS = [
  { name: 'Merah', hex: '#E5484D', css: '#e5484d' },
  { name: 'Biru', hex: '#3B7DDD', css: '#3b7ddd' },
  { name: 'Kuning', hex: '#F2B632', css: '#f2b632' },
  { name: 'Hijau', hex: '#3FB36B', css: '#3fb36b' }
];

function validateRigMetadata(data, meta) {
  const rigKeys = Object.keys(meta.player).filter(key => meta.player[key].rig).sort();
  if (JSON.stringify(rigKeys) !== JSON.stringify(CHARACTER_KEYS.slice().sort())) {
    throw new Error('Metadata rig harus tersedia tepat untuk enam karakter katalog');
  }
  if (meta.player.villager.rig) throw new Error('Villager tidak boleh menjadi rig item Character');

  CHARACTER_KEYS.forEach(key => {
    const model = data.player[key], rig = meta.player[key].rig;
    if (!model || rig.baseModelKey !== key) throw new Error('baseModelKey tidak cocok: ' + key);
    if (!rig.parts || !Object.keys(rig.parts).length) throw new Error('Bagian rig kosong: ' + key);
    const seen = new Set();
    Object.keys(rig.parts).forEach(partName => {
      const part = rig.parts[partName];
      if (!Array.isArray(part.boxIndices) || !part.boxIndices.length) throw new Error('boxIndices kosong: ' + key + '/' + partName);
      if (!Array.isArray(part.pivot) || part.pivot.length !== 3 || !part.pivot.every(Number.isFinite)) {
        throw new Error('Pivot tidak valid: ' + key + '/' + partName);
      }
      part.boxIndices.forEach(index => {
        if (!Number.isInteger(index) || index < 0 || index >= model.length) throw new Error('Index box tidak valid: ' + key + '/' + partName);
        if (seen.has(index)) throw new Error('Index box duplikat: ' + key + '/' + index);
        seen.add(index);
      });
    });
    if (seen.size !== model.length) throw new Error('Rig tidak memetakan seluruh box: ' + key);
    ['head', 'torso', 'back'].forEach(anchor => {
      const point = rig.anchors && rig.anchors[anchor];
      if (!Array.isArray(point) || point.length !== 3 || !point.every(Number.isFinite)) throw new Error('Anchor tidak valid: ' + key + '/' + anchor);
    });
    if (!rig.capabilities || !rig.capabilities.locomotion || !rig.capabilities.locomotion.gait ||
        !rig.capabilities.actionRig || typeof rig.capabilities.actionRig.handAnchors !== 'boolean') {
      throw new Error('Capability rig tidak lengkap: ' + key);
    }
    if (!rig.gearConstraints || !Array.isArray(rig.gearConstraints.availableAnchors) ||
        rig.gearConstraints.availableAnchors.some(anchor => !Object.prototype.hasOwnProperty.call(rig.anchors, anchor))) {
      throw new Error('Anchor perlengkapan tidak valid: ' + key);
    }
  });
  return true;
}

function fmt(o) {
  let text = '{\n';
  for (const group in o) {
    text += '  ' + group + ': {\n';
    for (const key in o[group]) {
      text += '    ' + key + ': [' + o[group][key].map(box =>
        '[' + box.slice(0, 6).join(',') + ',"' + box[6] + '",' + box[7] + ',' + box[8] + ']').join(',') + '],\n';
    }
    text += '  },\n';
  }
  return text + '}';
}

function generate() {
  validateRigMetadata(DATA, META);
  return fs.readFileSync(path.join(__dirname, 'template.js'), 'utf8')
    .replace('/*DATA*/', () => fmt(DATA))
    .replace('/*META*/', () => JSON.stringify(META))
    .replace('/*SEATS*/', () => JSON.stringify(SEATS));
}

function build(checkOnly) {
  const output = generate();
  if (checkOnly) {
    if (fs.readFileSync(TARGET, 'utf8') !== output) throw new Error('data/character-page/js/character-data.js tidak sama dengan hasil generator');
    return { bytes: Buffer.byteLength(output), checked: true };
  }
  fs.writeFileSync(TARGET, output, 'utf8');
  return { bytes: Buffer.byteLength(output), checked: false };
}

if (require.main === module) {
  try {
    const result = build(process.argv.includes('--check'));
    console.log('data/character-page/js/character-data.js', result.bytes, 'bytes', result.checked ? '(parity ok)' : '(generated)');
  } catch (error) {
    console.error('CharacterData build failed:', error.message);
    process.exitCode = 1;
  }
}

module.exports = { build, generate, validateRigMetadata };
