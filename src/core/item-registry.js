/* Item Registry (Stage 2 — fondasi Hybrid Modular Architecture).
   Registri item berbasis manifest: daftar kategori, validasi manifest, penolakan duplikat, pencarian by-ID, fallback.
   - TIDAK bergantung pada DOM, localStorage, PlayerData, atau ItemCatalog. Skrip klasik ES5, dapat dimuat di browser
     (window.UT.ItemRegistry) maupun Node (module.exports) untuk tes — pola sama dengan appearance-service.js.
   - ItemCatalog mengadopsi kategori yang sudah dimuat dari Registry dan tetap mempertahankan jalur fallback legacy.
     Kesesuaian kedua jalur dijaga oleh tes paritas per kategori.
   - Tiga lapis pemeriksaan yang SENGAJA dipisah (satu lapis lulus tidak berarti lapis berikutnya lulus):
       1. validateManifest(m, category)  : struktur & isi manifest
       2. validateAssetPaths(m, category): FORMAT path aset (bukan keberadaan file, bukan keberhasilan memuat)
       3. pemuatan aset sebenarnya        : di luar modul ini (Stage berikutnya, di browser)
   API: create() · shared() · validateManifest · validateAssetPaths · RARITIES
   Instance: registerCategory · registerItem · getItem · getItemOrFallback · getCategory · getAll · has · categories ·
             rejected · checkCompleteness */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.UT = root.UT || {}; root.UT.ItemRegistry = api; }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'divine'];   /* sama dengan RARITY di item-catalog.js */
  var DEFAULT_ASSET_EXT = ['png', 'webp', 'jpg', 'jpeg', 'svg', 'mp3', 'ogg', 'wav', 'css', 'js'];
  var KEY_RE = /^[a-z0-9_]+$/;
  var CAT_KEY_RE = /^[a-z0-9_]+$/;
  var NAME_MAX = 60;

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function nonEmptyStr(v) { return typeof v === 'string' && v.trim().length > 0; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function deepFreeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.keys(o).forEach(function (k) { deepFreeze(o[k]); });
      Object.freeze(o);
    }
    return o;
  }
  function same(a, b) { try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; } }

  /* Path aset yang valid secara FORMAT: relatif, tanpa skema/URL, tanpa '..', '//', backslash, spasi, atau awalan '/'. */
  function assetPathProblem(p, exts) {
    if (typeof p !== 'string' || !p) return 'bukan string / kosong';
    if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(p) || p.indexOf('//') === 0) return 'memakai skema/URL';
    if (p.charAt(0) === '/') return 'path absolut';
    if (p.indexOf('\\') >= 0) return 'mengandung backslash';
    if (/\s/.test(p)) return 'mengandung spasi';
    if (p.indexOf('..') >= 0) return "mengandung '..'";
    if (p.indexOf('//') >= 0) return "mengandung '//'";
    var m = /\.([A-Za-z0-9]+)$/.exec(p);
    if (!m) return 'tanpa ekstensi';
    if (exts.indexOf(m[1].toLowerCase()) < 0) return 'ekstensi .' + m[1] + ' tidak diizinkan';
    if (!/^[A-Za-z0-9_\-]+(\/[A-Za-z0-9_\-.]+)*$/.test(p.slice(0, -m[0].length))) return 'karakter tidak valid';
    return '';
  }

  function collectPaths(v, out, at) {   /* semua string di dalam `assets` (objek/array bersarang) dianggap path */
    if (typeof v === 'string') out.push({ at: at, path: v });
    else if (Array.isArray(v)) v.forEach(function (x, i) { collectPaths(x, out, at + '[' + i + ']'); });
    else if (isObj(v)) Object.keys(v).forEach(function (k) { collectPaths(v[k], out, at ? at + '.' + k : k); });
    else out.push({ at: at, path: v });
  }

  /* Lapis 2 — FORMAT path aset. Mengembalikan { ok, errors:[...] }. Tidak menyentuh jaringan/disk. */
  function validateAssetPaths(m, category) {
    var errors = [], exts = (category && category.assetExtensions) || DEFAULT_ASSET_EXT;
    if (!isObj(m) || !isObj(m.assets)) return { ok: false, errors: ['assets: wajib objek'] };
    var list = []; collectPaths(m.assets, list, '');
    list.forEach(function (e) {
      var why = assetPathProblem(e.path, exts);
      if (why) errors.push('assets.' + e.at + ': ' + why);
    });
    return { ok: errors.length === 0, errors: errors };
  }

  /* Lapis 1 — struktur manifest. `category` (opsional) = deskriptor kategori; tanpa itu hanya pemeriksaan bentuk umum.
     Mengembalikan { ok, errors:[...] }. Tidak melempar untuk input apa pun. */
  function validateManifest(m, category) {
    var errors = [];
    if (!isObj(m)) return { ok: false, errors: ['manifest harus objek'] };
    if (!nonEmptyStr(m.id)) errors.push('id: wajib string tidak kosong');
    else if (m.id !== m.id.trim()) errors.push('id: tidak boleh diawali/diakhiri spasi');
    else {
      var dot = m.id.indexOf('.');
      if (dot <= 0 || !KEY_RE.test(m.id.slice(0, dot)) || !KEY_RE.test(m.id.slice(dot + 1))) errors.push("id: format harus '<kind>.<kunci>' (a-z 0-9 _)");
      else if (m.kind && m.id.slice(0, dot) !== m.kind) errors.push("id: awalan '" + m.id.slice(0, dot) + "' tidak sama dengan kind '" + m.kind + "'");
      if (has(m, 'gameKey') && dot > 0 && m.gameKey !== m.id.slice(dot + 1)) errors.push('gameKey: harus sama dengan bagian kunci id');
    }
    if (!nonEmptyStr(m.kind)) errors.push('kind: wajib string tidak kosong');
    else if (category && m.kind !== category.kind) errors.push("kind: '" + m.kind + "' tidak sesuai kategori '" + category.key + "' (" + category.kind + ')');
    if (!nonEmptyStr(m.name)) errors.push('name: wajib string tidak kosong');
    else if (m.name.length > NAME_MAX) errors.push('name: terlalu panjang (>' + NAME_MAX + ')');
    var rar = (category && category.rarities) || RARITIES;
    if (!nonEmptyStr(m.rarity) || rar.indexOf(m.rarity) < 0) errors.push('rarity: harus salah satu dari ' + rar.join('/'));
    if (has(m, 'price') && !(m.price === null || (typeof m.price === 'number' && isFinite(m.price) && m.price >= 0 && Math.floor(m.price) === m.price))) errors.push('price: harus null atau bilangan bulat >= 0');
    if (has(m, 'gems') && !(m.gems === null || (typeof m.gems === 'number' && isFinite(m.gems) && m.gems >= 0 && Math.floor(m.gems) === m.gems))) errors.push('gems: harus null atau bilangan bulat >= 0');
    if (has(m, 'starter') && typeof m.starter !== 'boolean') errors.push('starter: harus boolean');
    if (!isObj(m.visual)) errors.push('visual: wajib objek');
    if (!isObj(m.assets)) errors.push('assets: wajib objek');
    return { ok: errors.length === 0, errors: errors };
  }

  function create() {
    var cats = {}, catOrder = [], kindToCat = {}, items = {}, order = [], rej = [];

    function reject(id, reason, errors) { rej.push({ id: id == null ? null : String(id), reason: reason, errors: errors || [] }); return { ok: false, reason: reason, errors: errors || [] }; }

    function registerCategory(c) {
      var errors = [];
      if (!isObj(c)) return reject(null, 'invalid-category', ['kategori harus objek']);
      if (!nonEmptyStr(c.key) || !CAT_KEY_RE.test(c.key)) errors.push('key: wajib a-z 0-9 _');
      if (!nonEmptyStr(c.kind) || !CAT_KEY_RE.test(c.kind)) errors.push('kind: wajib a-z 0-9 _');
      if (c.label != null && typeof c.label !== 'string') errors.push('label: harus string');
      if (c.fallbackId != null && !nonEmptyStr(c.fallbackId)) errors.push('fallbackId: harus string tidak kosong');
      if (c.rarities != null && (!Array.isArray(c.rarities) || !c.rarities.length)) errors.push('rarities: harus array tidak kosong');
      if (c.assetExtensions != null && (!Array.isArray(c.assetExtensions) || !c.assetExtensions.length)) errors.push('assetExtensions: harus array tidak kosong');
      if (errors.length) return reject(c.key, 'invalid-category', errors);
      if (has(cats, c.key)) return reject(c.key, 'duplicate-category', ['kategori sudah terdaftar: ' + c.key]);
      if (has(kindToCat, c.kind)) return reject(c.key, 'duplicate-kind', ["kind '" + c.kind + "' sudah dipakai kategori '" + kindToCat[c.kind] + "'"]);
      cats[c.key] = deepFreeze(clone({ key: c.key, kind: c.kind, label: c.label || c.key, fallbackId: c.fallbackId || null,
        rarities: c.rarities || null, assetExtensions: c.assetExtensions || null, assets: isObj(c.assets) ? c.assets : {} }));
      kindToCat[c.kind] = c.key; catOrder.push(c.key);
      return { ok: true, category: cats[c.key] };
    }

    function registerItem(m) {
      if (!isObj(m)) return reject(null, 'invalid-manifest', ['manifest harus objek']);
      var id = m.id, ck = has(kindToCat, m.kind) ? kindToCat[m.kind] : null;
      if (!ck) return reject(id, 'unknown-category', ["tidak ada kategori untuk kind '" + m.kind + "' (registerCategory dulu)"]);
      var cat = cats[ck], v = validateManifest(m, cat);
      if (!v.ok) return reject(id, 'invalid-manifest', v.errors);
      var a = validateAssetPaths(m, cat);
      if (!a.ok) return reject(id, 'invalid-asset-path', a.errors);
      if (has(items, id)) {
        return same(items[id], m) ? reject(id, 'duplicate-registration', ['manifest identik sudah terdaftar: ' + id])
                                  : reject(id, 'duplicate-id', ['ID sudah dipakai manifest lain: ' + id]);
      }
      items[id] = deepFreeze(clone(m)); order.push(id);
      return { ok: true, item: items[id] };
    }

    /* Ketat: null bila tidak ada. */
    function getItem(id) { return (typeof id === 'string' && has(items, id)) ? items[id] : null; }
    /* Dengan fallback: ID tidak ada/ditolak -> item fallbackId kategori (kategori dicari dari awalan id). Null bila tak ada fallback. */
    function getItemOrFallback(id) {
      var it = getItem(id); if (it) return it;
      var dot = typeof id === 'string' ? id.indexOf('.') : -1, ck = dot > 0 && has(kindToCat, id.slice(0, dot)) ? kindToCat[id.slice(0, dot)] : null;
      var fb = ck && cats[ck].fallbackId;
      return fb ? getItem(fb) : null;
    }
    function itemsOf(ck) { return order.filter(function (id) { return items[id].kind === cats[ck].kind; }).map(function (id) { return items[id]; }); }
    function getCategory(key) {
      if (typeof key !== 'string' || !has(cats, key)) return null;
      var c = cats[key], list = itemsOf(key);
      return { key: c.key, kind: c.kind, label: c.label, fallbackId: c.fallbackId, assets: c.assets, count: list.length, items: list };
    }
    function getAll(kind) { return order.filter(function (id) { return !kind || items[id].kind === kind; }).map(function (id) { return items[id]; }); }
    function categories() { return catOrder.slice(); }

    /* Kelengkapan: bandingkan ID terdaftar dengan daftar ID yang DIHARAPKAN, dan laporkan field anjuran yang kosong. */
    function checkCompleteness(ck, expectedIds, recommended) {
      var list = has(cats, ck) ? itemsOf(ck) : [], got = list.map(function (i) { return i.id; }), exp = Array.isArray(expectedIds) ? expectedIds : [];
      var rec = recommended || ['desc', 'price', 'gems', 'starter'];
      return {
        missing: exp.filter(function (id) { return got.indexOf(id) < 0; }),
        extra: got.filter(function (id) { return exp.length && exp.indexOf(id) < 0; }),
        incomplete: list.map(function (i) { return { id: i.id, missing: rec.filter(function (f) { return !has(i, f) || i[f] === undefined; }) }; })
                        .filter(function (r) { return r.missing.length; })
      };
    }

    return { registerCategory: registerCategory, registerItem: registerItem, getItem: getItem, getItemOrFallback: getItemOrFallback,
             getCategory: getCategory, getAll: getAll, has: function (id) { return getItem(id) !== null; }, categories: categories,
             rejected: function () { return rej.slice(); }, checkCompleteness: checkCompleteness };
  }

  var _shared = null;
  return { create: create, shared: function () { return _shared || (_shared = create()); },
           validateManifest: validateManifest, validateAssetPaths: validateAssetPaths, RARITIES: RARITIES.slice() };
});
