/* Manifest pet.celestial_kitsune — dibuat dari ItemCatalog (data existing; tidak ada data baru). Paritas dijaga tests/pet-registry-parity.test.js.
   tier/role/accent/colors = field katalog existing. assets.image = gambar kartu pet-page.js di data/inventory/pet/<gameKey>/<gameKey>.png.
   Visual 3D (data/inventory/pet/_shared/js/pet-viewer.js) tidak diduplikasi di sini. assets.sfx = sumber path 3 SFX Pet, urutan = slot 0,1,2 yang diacak PetViewer (playPetSound). */
(function (g, m) {
  if (typeof module === 'object' && module.exports) module.exports = m;
  else ((g.UT = g.UT || {}).ItemManifests = g.UT.ItemManifests || []).push(m);
})(typeof window !== 'undefined' ? window : this, {
    id: "pet.celestial_kitsune",
    kind: "pet",
    gameKey: "celestial_kitsune",
    name: "Celestial Kitsune",
    rarity: "divine",
    tier: 7,
    role: "Pengubah Takdir",
    price: null,
    gems: 6000,
    starter: false,
    desc: "Rubah sembilan ekor melayang di atas lingkaran sihir. Ekornya besar, berbulu tebal, mengembang seperti kipas dan berujung bintang.",
    visual: {"accent":"#ffe08a","colors":["#fdfbf4","#ffcf4a","#6ae8ff"]},
    assets: { image: "assets/images/ui/pet/celestial-kitsune.webp", sfx: ["assets/audio/sfx/pet/celestial-kitsune-bell.mp3", "data/inventory/pet/items/celestial_kitsune/sfx/celestial-kitsune-cry.mp3", "assets/audio/sfx/pet/celestial-kitsune-shine.mp3"] }
});
