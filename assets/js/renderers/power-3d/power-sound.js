/**
 * PowerSound.js — suara Power sintetis (WebAudio, tanpa file audio). Fase umum: spawn · activate · hit · disappear; Feather juga punya finish.
 * Dipakai: PowerRenderer (pratinjau halaman Power, otomatis lewat callback animator) dan gameplay (audio.js sfx.power -> UT.PowerSound.play(key)).
 * Key = gameKey Power (sword, grass, potion_odd, ...) ATAU id model 3D (iron_sword, ender_pearl, potion_red, ...).
 * Kontrol: setEnabled(bool) · setVolume(0..1) · ensure([ctx]) (buat/resume AudioContext; boleh meminjam ctx milik gameplay/js/audio.js).
 * Semua kegagalan audio ditelan (try/catch): suara tidak pernah menghentikan game.
 */
let ctx = null, enabled = true, volume = 1, pitchScale = 1;

function ensure(ext) {
  try {
    if (ext) ctx = ext;
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) { /* tanpa audio */ }
  return ctx;
}
const live = () => enabled && volume > 0 && ctx && ctx.state !== 'closed';

/** nada: f awal (Hz), d durasi (dtk), tipe osilator, vol, when (tunda dtk), to (f akhir; sweep eksponensial) */
function tone(f, d, type = 'sine', vol = 0.08, when = 0, to = 0, reverb = false) {
  if (!live()) return;
  try {
    const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f * pitchScale, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to * pitchScale, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * volume), t + Math.min(0.02, d * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(ctx.destination);
    if (reverb) {
      const delay = ctx.createDelay(0.12), wet = ctx.createGain(), feedback = ctx.createGain();
      delay.delayTime.value = 0.055; wet.gain.value = 0.16; feedback.gain.value = 0.1;
      g.connect(delay); delay.connect(wet); wet.connect(ctx.destination); delay.connect(feedback); feedback.connect(delay);
    }
    o.start(t); o.stop(t + d + 0.03);
  } catch (e) { /* abaikan */ }
}
/** desis: d durasi, vol, when, jenis filter ('highpass'|'lowpass'|'bandpass'), freq awal, to (freq akhir) */
function hiss(d, vol = 0.08, when = 0, kind = 'highpass', freq = 2500, to = 0) {
  if (!live()) return;
  try {
    const n = Math.max(1, Math.floor(ctx.sampleRate * d)), buf = ctx.createBuffer(1, n, ctx.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const t = ctx.currentTime + when, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf; f.type = kind; f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.value = vol * volume;
    src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(t);
  } catch (e) { /* abaikan */ }
}
const chime = (base, when = 0, vol = 0.05, notes = [1, 1.25, 1.5, 2], duration = 0.35) => notes.forEach((m, i) => tone(base * m, duration, 'sine', vol, when + i * 0.07));

/** Resep per keluarga suara. Tiap keluarga: { spawn, activate, hit, disappear } (fungsi tanpa argumen). */
const FAMILY = {
  sword: { // tebasan logam
    activate: () => { hiss(0.2, 0.1, 0, 'highpass', 2500, 9000); tone(700, 0.16, 'sawtooth', 0.035, 0, 260); },
    hit: () => { hiss(0.1, 0.12, 0, 'highpass', 5000); tone(1800, 0.09, 'triangle', 0.05, 0, 3200); tone(240, 0.12, 'square', 0.04, 0, 90); },
  },
  diamond: { // tebasan kristal premium
    activate: () => { hiss(0.2, 0.09, 0, 'highpass', 3000, 10000); tone(1000, 0.18, 'sawtooth', 0.03, 0, 320); },
    swing: () => { hiss(0.3, 0.1, 0, 'bandpass', 900, 7800); tone(950, 0.24, 'sawtooth', 0.04, 0, 3200); },
    hit: () => { hiss(0.14, 0.12, 0, 'highpass', 6000); chime(1200, 0, 0.04, [1, 1.5, 2]); tone(180, 0.22, 'triangle', 0.07, 0, 110); },
    finish: () => { tone(1760, 0.3, 'sine', 0.045, 0, 2200, true); tone(2640, 0.22, 'sine', 0.025, 0.06, 3100, true); },
  },
  netherite: { // tebasan berat + gemuruh
    activate: () => { hiss(0.28, 0.12, 0, 'bandpass', 700, 3000); tone(220, 0.3, 'sawtooth', 0.06, 0, 70); },
    hit: () => { hiss(0.65, 0.16, 0, 'lowpass', 1800, 200); tone(110, 0.65, 'square', 0.09, 0, 40); tone(900, 0.24, 'triangle', 0.04, 0, 300); },
  },
  shield: { // angkat perisai kayu
    activate: () => { hiss(0.12, 0.08, 0, 'bandpass', 900, 500); tone(300, 0.16, 'triangle', 0.06, 0.02, 180); tone(180, 0.2, 'square', 0.04, 0.1, 120); },
    hit: () => { tone(160, 0.22, 'square', 0.08, 0, 70); tone(290, 0.12, 'triangle', 0.04, 0, 180); hiss(0.12, 0.08, 0, 'lowpass', 1000); },
    finish: () => { tone(420, 0.3, 'triangle', 0.04, 0, 300, true); tone(260, 0.22, 'sine', 0.025, 0.08, 210, true); },
  },
  tnt: { // sumbu + ledakan
    activate: () => { hiss(0.48, 0.08, 0, 'bandpass', 900, 5200); tone(320, 0.42, 'sine', 0.025, 0, 520); },
    hit: () => { hiss(1.05, 0.2, 0, 'lowpass', 2400, 100); tone(70, 1.3, 'sawtooth', 0.12, 0, 28, true); tone(45, 1.35, 'sine', 0.12, 0, 22, true); },
  },
  feather: { // hembus ringan
    activate: () => { tone(1400, 0.2, 'sine', 0.04, 0, 1100); },
    hit: () => { hiss(0.5, 0.05, 0, 'bandpass', 1300, 6500); tone(700, 0.5, 'sine', 0.035, 0, 1300); },
    finish: () => { tone(1800, 0.3, 'sine', 0.035, 0, 2400, true); tone(2600, 0.2, 'sine', 0.02, 0.05, 3200, true); },
  },
  apple: { // chime emas, gigitan renyah, dan energi penyembuhan
    activate: () => { chime(1320, 0, 0.045, [1, 1.25, 1.5], 0.16); },
    consume: () => { hiss(0.08, 0.07, 0, 'bandpass', 900, 3500); tone(320, 0.18, 'triangle', 0.045, 0, 180); tone(1400, 0.08, 'sine', 0.02, 0.08, 700); },
    healing: () => { tone(330, 0.7, 'sine', 0.045, 0, 660, true); tone(495, 0.62, 'triangle', 0.03, 0.08, 990, true); },
    hit: () => { chime(990, 0, 0.05, [1, 1.5, 2, 2.5]); },
    finish: () => { tone(1568, 0.24, 'sine', 0.035, 0, 2352, true); tone(2093, 0.2, 'sine', 0.025, 0.07, 3139, true); },
  },
  totem: { // paduan suara naik + pop
    activate: () => { [392, 494, 587].forEach((f, i) => tone(f, 0.22, 'triangle', 0.05, i * 0.04, 0, true)); },
    hit: () => { tone(1568, 0.5, 'sine', 0.06, 0, 0, true); tone(2093, 0.45, 'sine', 0.04, 0.06, 0, true); hiss(0.18, 0.05, 0, 'highpass', 6000); },
    finish: () => { tone(880, 0.5, 'sine', 0.045, 0, 1320, true); tone(1320, 0.5, 'sine', 0.025, 0.08, 1760, true); },
  },
  ender: { // warp
    activate: () => { tone(1400, 0.3, 'sawtooth', 0.04, 0, 180); tone(300, 0.35, 'sine', 0.05, 0.05, 1200); },
    hit: () => { tone(120, 0.3, 'sine', 0.1, 0, 800); hiss(0.2, 0.06, 0.02, 'bandpass', 3000, 700); },
  },
  fire: { // ignition, charge, proyektil cepat, dan semburan api
    activate: () => { hiss(0.12, 0.08, 0, 'highpass', 2200, 5200); tone(260, 0.16, 'sawtooth', 0.045, 0, 500); },
    charge: () => { hiss(0.36, 0.09, 0, 'bandpass', 500, 2400); tone(180, 0.4, 'sawtooth', 0.06, 0, 520); },
    launch: () => { hiss(0.3, 0.11, 0, 'bandpass', 900, 6500); tone(420, 0.32, 'sawtooth', 0.055, 0, 1700); },
    embers: () => { hiss(0.14, 0.08, 0, 'highpass', 4200, 7800); },
    hit: () => { hiss(0.45, 0.12, 0, 'lowpass', 2200, 420); tone(180, 0.48, 'sawtooth', 0.065, 0, 95); tone(520, 0.12, 'triangle', 0.04, 0, 190); },
  },
  ice: { // kristal beku
    activate: () => { chime(1600, 0, 0.04, [1, 1.3, 1.6], 0.15); hiss(0.1, 0.025, 0, 'highpass', 7000); },
    charge: () => { tone(520, 0.4, 'sine', 0.04, 0, 1800, true); hiss(0.32, 0.04, 0, 'highpass', 2500, 8000); },
    release: () => { hiss(0.25, 0.1, 0, 'highpass', 3500, 10000); tone(2600, 0.32, 'square', 0.05, 0, 1300); },
    crack: () => { hiss(0.18, 0.08, 0, 'highpass', 4000, 10000); tone(3000, 0.04, 'square', 0.035, 0, 1500); tone(1800, 0.13, 'triangle', 0.025, 0.03, 800); },
    hit: () => { hiss(0.55, 0.14, 0, 'highpass', 6000); tone(2600, 0.5, 'square', 0.04, 0, 1000); tone(1900, 0.56, 'triangle', 0.05, 0.04, 700); },
  },
  blaze: { // magma berdetak, eruption berat, dan resonansi bara
    activate: () => { hiss(0.18, 0.1, 0, 'bandpass', 500, 2200); tone(120, 0.28, 'sawtooth', 0.06, 0, 260); },
    charge: () => { hiss(0.5, 0.12, 0, 'lowpass', 650, 1400); tone(72, 0.6, 'sawtooth', 0.09, 0, 115, true); },
    pulse: () => { tone(88, 0.18, 'sine', 0.07, 0, 132, true); tone(92, 0.18, 'sine', 0.06, 0.24, 145, true); },
    embers: () => { hiss(0.22, 0.08, 0, 'highpass', 4200, 7800); },
    release: () => { hiss(0.42, 0.14, 0, 'bandpass', 500, 4200); tone(125, 0.48, 'sawtooth', 0.1, 0, 58); },
    finish: () => { tone(110, 0.5, 'sine', 0.07, 0, 220, true); tone(220, 0.46, 'triangle', 0.045, 0.06, 440, true); hiss(0.3, 0.045, 0.08, 'highpass', 3000, 6800); },
    hit: () => { hiss(0.42, 0.14, 0, 'bandpass', 500, 4200); tone(125, 0.48, 'sawtooth', 0.1, 0, 58); },
  },
  trident: { // petir + tombak
    activate: () => { hiss(0.24, 0.1, 0, 'highpass', 4500, 9500); tone(1300, 0.24, 'sawtooth', 0.04, 0, 200); },
    hit: () => { hiss(0.28, 0.16, 0, 'highpass', 2000, 8000); tone(2200, 0.08, 'square', 0.06, 0, 400); tone(100, 0.35, 'sine', 0.1, 0.03, 40); },
  },
  dragon: { // dengung kosmik + raungan
    activate: () => { tone(110, 0.34, 'sawtooth', 0.06, 0, 220); tone(660, 0.32, 'sine', 0.03, 0.1, 1320); },
    hit: () => { tone(70, 1.1, 'sawtooth', 0.12, 0, 30); chime(880, 0.05, 0.04, [1, 1.5, 2]); hiss(0.9, 0.07, 0, 'bandpass', 1500, 400); },
  },
  potion: { // gelembung + tenggak
    activate: () => { tone(1500, 0.2, 'sine', 0.05, 0, 520); hiss(0.08, 0.025, 0, 'highpass', 4200, 1800); },
    drink: () => { for (let i = 0; i < 4; i++) tone(320 + i * 65, 0.1, 'sine', 0.035, i * 0.09, 620 + i * 70); hiss(0.22, 0.035, 0, 'lowpass', 1100, 420); },
    hit: () => { chime(880, 0, 0.05, [1, 1.33, 1.68]); hiss(0.15, 0.04, 0, 'highpass', 5000); },
    finish: () => { tone(1250, 0.6, 'sine', 0.045, 0, 430, true); tone(900, 0.45, 'sine', 0.025, 0.08, 300, true); },
  },
  star: { // akor naik megah
    activate: () => { [262, 330, 392, 523, 659].forEach((f, i) => tone(f, 0.22, 'sine', 0.05, i * 0.06)); },
    hit: () => { chime(1047, 0, 0.06, [1, 1.25, 1.5, 2, 2.5]); tone(65, 1.1, 'sine', 0.1, 0, 32); hiss(0.9, 0.08, 0, 'highpass', 3000, 9000); },
  },
  potionEven: { // ramuan beruntung bernada cerah dan naik
    activate: () => { tone(1550, 0.2, 'sine', 0.05, 0, 680); hiss(0.08, 0.025, 0, 'highpass', 4600, 2200); },
    drink: () => { for (let i = 0; i < 4; i++) tone(400 + i * 70, 0.1, 'sine', 0.035, i * 0.09, 720 + i * 80); },
    hit: () => { tone(520, 0.3, 'sine', 0.06, 0, 260); tone(180, 0.24, 'triangle', 0.04, 0.1, 90); hiss(0.16, 0.04, 0.12, 'lowpass', 1600, 500); },
    finish: () => { [880, 1100, 1320, 1760].forEach((f, i) => tone(f, 0.45, 'sine', 0.04, i * 0.05, f * 1.08, true)); },
  },
};
const COMMON = { // spawn & disappear umum (naik tipis / turun tipis)
  spawn: (tier) => { chime(520 + tier * 60, 0, 0.025, [1, 1.5]); hiss(0.18, 0.02, 0, 'highpass', 6000); },
  disappear: () => { tone(700, 0.28, 'sine', 0.035, 0, 180); hiss(0.18, 0.03, 0, 'lowpass', 3000, 300); },
};
const VOICE = {
  iron_sword: 'sword', sword: 'sword', diamond_sword: 'diamond', netherite_sword: 'netherite', wooden_shield: 'shield', tnt: 'tnt', feather: 'feather',
  golden_apple: 'apple', totem: 'totem', ender_pearl: 'ender', grass: 'ender', fire_charge: 'fire', ice_crystal: 'ice', blaze_core: 'blaze',
  trident: 'trident', dragon_crystal: 'dragon', nether_star: 'star',
  potion_red: 'potion', potion_blue: 'potionEven', potion_odd: 'potion', potion_even: 'potionEven',
};
/* nama efek khusus gameplay -> id Power */
const ALIAS = { totem_block: 'totem', shield_block: 'wooden_shield' };

export const PowerSound = {
  ensure,
  setEnabled(v) { enabled = !!v; },
  setVolume(v) { volume = Math.max(0, Math.min(1, +v || 0)); },
  get enabled() { return enabled; },
  get volume() { return volume; },
  has: (key) => !!VOICE[ALIAS[key] || key],
  /**
   * play(key, { phase: 'spawn'|'activate'|'swing'|'drink'|'hit'|'finish'|'disappear'|'use', tier, volume, ctx })
   * 'use' = activate lalu hit (~0,35 dtk kemudian) — dipakai gameplay saat Power dipakai.
   */
  play(key, o = {}) {
    const id = ALIAS[key] || key, fam = FAMILY[VOICE[id]];
    if (!fam) return false;
    if (o.ctx) ensure(o.ctx); else ensure();
    if (o.volume != null) volume = Math.max(0, Math.min(1, +o.volume));
    if (!live()) return false;
    try {
      const ph = o.phase || 'use';
      const pitchBase = id === 'wooden_shield' ? 0.95 : id === 'blaze_core' ? 0.9 : id === 'diamond_sword' || id === 'golden_apple' ? 1.05 : id === 'feather' || id === 'potion_even' || id === 'ice_crystal' ? 1.1 : 1;
      pitchScale = pitchBase * (0.98 + Math.random() * 0.04);
      if (ph === 'spawn') COMMON.spawn(o.tier || 1);
      else if (ph === 'disappear') COMMON.disappear();
      else if (ph === 'activate') fam.activate();
      else if (ph === 'consume' && fam.consume) fam.consume();
      else if (ph === 'healing' && fam.healing) fam.healing();
      else if (ph === 'charge' && fam.charge) fam.charge();
      else if (ph === 'launch' && fam.launch) fam.launch();
      else if (ph === 'embers' && fam.embers) fam.embers();
      else if (ph === 'pulse' && fam.pulse) fam.pulse();
      else if (ph === 'release' && fam.release) fam.release();
      else if (ph === 'crack' && fam.crack) fam.crack();
      else if (ph === 'swing' && fam.swing) fam.swing();
      else if (ph === 'drink' && fam.drink) fam.drink();
      else if (ph === 'hit') fam.hit();
      else if (ph === 'finish' && fam.finish) fam.finish();
      else {
        fam.activate();
        const usePitch = pitchScale;
        setTimeout(() => { try { pitchScale = usePitch; fam.hit(); } catch (e) { /* abaikan */ } }, 350);
      }
    } catch (e) { return false; }
    return true;
  },
};
