/* tambang-world: sistem snap/lock — namespace global: window.TambangMW */
(function () {
const MW = window.TambangMW = window.TambangMW || {};
/* ============ 09 SNAP: slot, deteksi terdekat, kunci posisi, tabrakan ============ */
MW.Snap = {
  slots: [],
  ALLOW: { chest: ['chest'], worker: ['worker'], mining: ['worker'], cartRail: ['cart'], decor: ['decor'], mineral: ['mineral'], grabber: ['worker'] },
  /* bangun slot dari definisi layer; posisi dunia disimpan agar tidak dihitung ulang */
  build: function (layers, parent) {
    const grp = new THREE.Group(); grp.name = 'SnapPoints'; parent.add(grp); this.group = grp;
    const mk = new THREE.MeshBasicMaterial({ color: 0x66e0ff, transparent: true, opacity: 0.0, depthTest: false });
    layers.forEach(L => {
      L.slotDefs.forEach((d, n) => {
        const floorY = L.index === 0 ? MW.GROUND : MW.FLOOR;
        const slot = {
          id: 'L' + (L.index + 1) + '-' + d.type + '-' + n, layer: L.index, type: d.type, allow: this.ALLOW[d.type],
          x: d.x, y: MW.worldY(L.index, floorY), z: d.type === 'cartRail' ? 0 : (d.type === 'chest' ? 0.25 : d.type === 'decor' ? -0.2 : d.type === 'mineral' ? 0.15 : 0.2),
          occupied: false, object: null, def: d, host: L.group.userData.sub, track: d.track || null
        };
        if (d.type === 'mining' || d.type === 'grabber') slot.z = 0.1;
        if (d.z !== undefined) slot.z = d.z;
        const m = new THREE.Mesh(MW.unitBox, mk.clone());
        m.scale.set(d.type === 'cartRail' ? 2.0 : 1.1, 0.16, 0.2); m.position.set(slot.x, slot.y + 0.06, 1.2); m.renderOrder = 20;
        m.visible = false; grp.add(m); slot.marker = m;
        this.slots.push(slot);
      });
    });
  },
  showMarkers: function (on, type) {
    this.slots.forEach(s => {
      const ok = on && (!type || s.allow.indexOf(type) >= 0);
      s.marker.visible = !!ok;
      s.marker.material.color.set(s.occupied ? 0xff6a6a : 0x66e0ff);
      s.marker.material.opacity = ok ? 0.55 : 0;
    });
  },
  nearest: function (kind, wx, wy, maxD) {
    let best = null, bd = maxD || 3.2;
    this.slots.forEach(s => {
      if (s.allow.indexOf(kind) < 0) return;
      const dx = s.x - wx, dy = s.y - wy, d = Math.hypot(dx, dy * 0.6);
      if (d < bd) { bd = d; best = s; }
    });
    return best;
  },
  /* 1 deteksi terdekat -> 2 cek tersedia -> 3 sesuaikan koordinat -> 4 kunci -> 5 cek tabrakan */
  place: function (obj, kind, wx, wy) {
    const slot = this.nearest(kind, wx, wy);
    if (!slot) return { ok: false, reason: 'Tidak ada slot ' + kind + ' di dekat sini' };
    if (slot.occupied && slot.object !== obj) return { ok: false, reason: 'Slot sudah terisi', slot: slot };
    if (!this.fits(slot, obj)) return { ok: false, reason: 'Posisi menembus dinding', slot: slot };
    this.release(obj);
    slot.occupied = true; slot.object = obj; obj.userData.slot = slot;
    slot.host.attach_(obj, slot);
    return { ok: true, slot: slot };
  },
  release: function (obj) {
    const s = obj.userData.slot; if (s) { s.occupied = false; s.object = null; obj.userData.slot = null; }
  },
  /* pastikan jejak objek berada pada sel kosong dan tidak bertumpuk dengan objek lain di lantai yang sama */
  fits: function (slot, obj) {
    const L = MW.world.layers[slot.layer], half = slot.type === 'cartRail' ? 1.0 : 0.6;
    const floorCell = slot.layer === 0 ? MW.GROUND : MW.FLOOR;
    for (let x = Math.floor(slot.x - half); x <= Math.floor(slot.x + half); x++) {
      if (MW.isSolid(L.grid, x, floorCell)) return false;           // badan objek harus di ruang kosong
      if (MW.isSolid(L.grid, x, floorCell - 1) === false && slot.layer !== 0) return false; // harus ada lantai di bawahnya
    }
    for (const o of this.slots) {
      if (o === slot || !o.occupied || o.layer !== slot.layer) continue;
      if (Math.abs(o.x - slot.x) < (slot.type === 'cartRail' || o.type === 'cartRail' ? 0.8 : 0.9) && o.type !== 'decor' && slot.type !== 'decor' && o.type !== 'mineral' && slot.type !== 'mineral' && o.allow[0] === slot.allow[0]) return false;
    }
    return true;
  },
  /* audit: semua slot terisi tidak boleh menembus dinding */
  audit: function () {
    let bad = [];
    this.slots.forEach(s => { if (s.occupied && !this.fits(s, s.object)) bad.push(s.id); });
    return bad;
  }
};
})();
