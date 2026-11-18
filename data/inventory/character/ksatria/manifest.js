(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
  /* ── ID & kind ──────────────────────────────────────────── */
  id: 'skin.ksatria',
  canonicalId: 'character.ksatria',
  kind: 'skin',
  gameKey: 'ksatria',

  /* ── Metadata ───────────────────────────────────────────── */
  name: 'Ksatria Mahkota',
  group: 'PVP',
  rarity: 'legendary',
  price: null,   /* tidak dijual — diperoleh via PVP */
  gems: null,
  starter: false,

  /* ── Lock condition (cek di client via PlayerData) ──────── */
  locked: true,
  lockKey: 'pvp_wins',          /* kunci di PlayerData */
  lockThreshold: 10,            /* nilai minimal untuk membuka */
  lockReason: 'Menangkan 10 PVP Clash untuk membuka Ksatria Mahkota!',

  /* ── Deskripsi ──────────────────────────────────────────── */
  desc: 'Ksatria perkasa dengan mahkota emas dan jubah pertempuran merah. Hanya pemenang sejati PVP Clash yang bisa menggunakannya.',

  /* ── Visual renderer ────────────────────────────────────── */
  visual: { renderer: 'pvp-knight', palette: 'rival', baseModelKey: 'ksatria' },

  /* ── Assets ─────────────────────────────────────────────── */
  assets: {}
});
