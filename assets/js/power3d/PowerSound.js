/**
 * PowerSound.js — suara Power sintetis (WebAudio, tanpa file audio). 17 Power x 4 fase: spawn · activate · hit · disappear.
 * Dipakai: PowerRenderer (pratinjau halaman Power, otomatis lewat callback animator) dan gameplay (audio.js sfx.power -> UT.PowerSound.play(key)).
 * Key = gameKey Power (sword, grass, potion_odd, ...) ATAU id model 3D (iron_sword, ender_pearl, potion_red, ...).
 * Kontrol: setEnabled(bool) · setVolume(0..1) · ensure([ctx]) (buat/resume AudioContext; boleh meminjam ctx milik gameplay/js/audio.js).
 * Semua kegagalan audio ditelan (try/catch): suara tidak pernah menghentikan game.
 */
let ctx = null, enabled = true, volume = 1;

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
function tone(f, d, type = 'sine', vol = 0.08, when = 0, to = 0) {
  if (!live()) return;
  try {
    const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * volume), t + Math.min(0.02, d * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + d + 0.03);
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
const chime = (base, when = 0, vol = 0.05, notes = [1, 1.25, 1.5, 2]) => notes.forEach((m, i) => tone(base * m, 0.35, 'sine', vol, when + i * 0.07));

/** Resep per keluarga suara. Tiap keluarga: { spawn, activate, hit, disappear } (fungsi tanpa argumen). */
const FAMILY = {
  sword: { // tebasan logam
    activate: () => { hiss(0.2, 0.1, 0, 'highpass', 2500, 9000); tone(700, 0.16, 'sawtooth', 0.035, 0, 260); },
    hit: () => { hiss(0.1, 0.12, 0, 'highpass', 5000); tone(1800, 0.09, 'triangle', 0.05, 0, 3200); tone(240, 0.12, 'square', 0.04, 0, 90); },
  },
  diamond: { // tebasan kristal + denting
    activate: () => { hiss(0.2, 0.09, 0, 'highpass', 3000, 10000); tone(1000, 0.18, 'sawtooth', 0.03, 0, 320); },
    hit: () => { hiss(0.1, 0.1, 0, 'highpass', 6000); chime(1200, 0, 0.04, [1, 1.5, 2]); tone(260, 0.14, 'square', 0.04, 0, 100); },
  },
  netherite: { // tebasan berat + gemuruh
    activate: () => { hiss(0.28, 0.12, 0, 'bandpass', 700, 3000); tone(220, 0.3, 'sawtooth', 0.06, 0, 70); },
    hit: () => { hiss(0.22, 0.16, 0, 'lowpass', 1800, 200); tone(110, 0.3, 'square', 0.09, 0, 40); tone(900, 0.1, 'triangle', 0.04, 0, 300); },
  },
  shield: { // angkat perisai kayu
    activate: () => { hiss(0.12, 0.08, 0, 'bandpass', 900, 500); tone(300, 0.16, 'triangle', 0.06, 0.02, 180); tone(180, 0.2, 'square', 0.04, 0.1, 120); },
    hit: () => { tone(160, 0.14, 'square', 0.08, 0, 70); hiss(0.08, 0.1, 0, 'lowpass', 1200); },
  },
  tnt: { // sumbu + ledakan
    activate: () => { for (let i = 0; i < 7; i++) hiss(0.04, 0.05, i * 0.07, 'highpass', 4500 + i * 300); tone(520, 0.45, 'sine', 0.025, 0, 900); },
    hit: () => { hiss(0.5, 0.22, 0, 'lowpass', 2400, 120); tone(90, 0.5, 'sawtooth', 0.12, 0, 28); tone(60, 0.6, 'sine', 0.12, 0, 24); },
  },
  feather: { // hembus ringan
    activate: () => { hiss(0.35, 0.05, 0, 'bandpass', 1800, 4200); tone(900, 0.3, 'sine', 0.03, 0.04, 1500); },
    hit: () => { hiss(0.2, 0.05, 0, 'highpass', 5500); chime(1500, 0.02, 0.025, [1, 1.33]); },
  },
  apple: { // dentingan emas
    activate: () => { chime(660, 0, 0.06, [1, 1.25, 1.5, 2]); },
    hit: () => { chime(990, 0, 0.05, [1, 1.5, 2, 2.5]); },
  },
  totem: { // paduan suara naik + pop
    activate: () => { [392, 494, 587, 784].forEach((f, i) => tone(f, 0.5, 'triangle', 0.05, i * 0.09)); },
    hit: () => { tone(1568, 0.5, 'sine', 0.06); tone(2093, 0.45, 'sine', 0.04, 0.06); hiss(0.18, 0.05, 0, 'highpass', 6000); },
  },
  ender: { // warp
    activate: () => { tone(1400, 0.3, 'sawtooth', 0.04, 0, 180); tone(300, 0.35, 'sine', 0.05, 0.05, 1200); },
    hit: () => { tone(120, 0.3, 'sine', 0.1, 0, 800); hiss(0.2, 0.06, 0.02, 'bandpass', 3000, 700); },
  },
  fire: { // bola api
    activate: () => { hiss(0.4, 0.1, 0, 'bandpass', 400, 1800); tone(180, 0.35, 'sawtooth', 0.04, 0, 420); },
    hit: () => { hiss(0.3, 0.16, 0, 'lowpass', 2000, 300); tone(140, 0.3, 'sawtooth', 0.08, 0, 45); },
  },
  ice: { // kristal beku
    activate: () => { chime(1400, 0, 0.04, [1, 1.2, 1.5, 1.8]); hiss(0.25, 0.04, 0, 'highpass', 7000); },
    hit: () => { hiss(0.14, 0.14, 0, 'highpass', 6500); tone(2400, 0.1, 'square', 0.04, 0, 900); tone(1900, 0.12, 'triangle', 0.04, 0.04, 700); },
  },
  blaze: { // bara berdenyut
    activate: () => { hiss(0.45, 0.09, 0, 'bandpass', 500, 2400); tone(140, 0.5, 'sawtooth', 0.05, 0, 260); },
    hit: () => { hiss(0.4, 0.18, 0, 'lowpass', 2600, 160); tone(80, 0.45, 'sawtooth', 0.11, 0, 32); tone(330, 0.2, 'square', 0.04, 0.02, 110); },
  },
  trident: { // petir + tombak
    activate: () => { hiss(0.14, 0.1, 0, 'highpass', 4500, 9500); tone(1300, 0.14, 'sawtooth', 0.04, 0, 200); },
    hit: () => { hiss(0.28, 0.16, 0, 'highpass', 2000, 8000); tone(2200, 0.08, 'square', 0.06, 0, 400); tone(100, 0.35, 'sine', 0.1, 0.03, 40); },
  },
  dragon: { // dengung kosmik + raungan
    activate: () => { tone(110, 0.7, 'sawtooth', 0.06, 0, 220); tone(660, 0.6, 'sine', 0.03, 0.1, 1320); },
    hit: () => { tone(70, 0.7, 'sawtooth', 0.12, 0, 30); chime(880, 0.05, 0.04, [1, 1.5, 2]); hiss(0.3, 0.07, 0, 'bandpass', 1500, 400); },
  },
  potion: { // gelembung + tenggak
    activate: () => { for (let i = 0; i < 5; i++) tone(380 + i * 110, 0.09, 'sine', 0.05, i * 0.06, 700 + i * 150); },
    hit: () => { chime(880, 0, 0.05, [1, 1.33, 1.68]); hiss(0.15, 0.04, 0, 'highpass', 5000); },
  },
  star: { // akor naik megah
    activate: () => { [262, 330, 392, 523, 659].forEach((f, i) => tone(f, 0.6, 'sine', 0.05, i * 0.08)); },
    hit: () => { chime(1047, 0, 0.06, [1, 1.25, 1.5, 2, 2.5]); tone(65, 0.7, 'sine', 0.1, 0, 32); hiss(0.4, 0.08, 0, 'highpass', 3000, 9000); },
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
  potion_red: 'potion', potion_blue: 'potion', potion_odd: 'potion', potion_even: 'potion',
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
   * play(key, { phase: 'spawn'|'activate'|'hit'|'disappear'|'use', tier, volume, ctx })
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
      if (ph === 'spawn') COMMON.spawn(o.tier || 1);
      else if (ph === 'disappear') COMMON.disappear();
      else if (ph === 'activate') fam.activate();
      else if (ph === 'hit') fam.hit();
      else { fam.activate(); setTimeout(() => { try { fam.hit(); } catch (e) { /* abaikan */ } }, 350); }
    } catch (e) { return false; }
    return true;
  },
};
