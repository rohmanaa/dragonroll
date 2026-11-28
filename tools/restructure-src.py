#!/usr/bin/env python3
"""Pindahkan KODE ke struktur ala Vue (src/) dan perbarui referensinya. Media tidak dipindah di fase ini.
Pemakaian:
  python3 tools/restructure-src.py <fase> [--apply]      fase: styles | components | js | tambang | gameplay
Tanpa --apply hanya simulasi (daftar perubahan). Rencana: docs/planing-ui/struktur-vite.md."""
import os, re, sys, subprocess, posixpath, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DIRS = {  # fase -> [(awalan lama, awalan baru)]  (selalu berakhiran /)
    "styles":     [("assets/css/", "src/styles/")],
    "components": [("src/components/", "src/components/")],
    "js": [("src/views/", "src/views/"), ("src/core/", "src/core/"), ("src/services/", "src/services/"),
           ("src/data/", "src/data/"), ("src/multiplayer/", "src/multiplayer/"),
           ("src/renderers/", "src/renderers/"), ("src/systems/", "src/systems/"),
           ("src/vendor/", "src/vendor/")],
    "tambang":  [("src/tambang/js/", "src/tambang/js/"), ("src/tambang/css/", "src/tambang/css/")],
    "gameplay": [("src/gameplay/js/", "src/src/gameplay/js/"), ("src/gameplay/css/", "src/src/gameplay/css/")],
}
FILES = {  # fase -> {berkas lama: berkas baru}
    "js": dict(
        [("assets/js/%s.js" % n, "src/boot/%s.js" % n) for n in ("boot-guard", "pwa", "preloader", "landscape", "mob-view", "frame-guard")] +
        [("assets/js/%s.js" % n, "src/stores/%s.js" % n) for n in ("player-data", "item-catalog", "inventory-bridge")] +
        [("assets/js/%s.js" % n, "src/services/%s.js" % n) for n in ("auth", "game-integration", "hearts-gate")] +
        [("assets/js/%s.js" % n, "src/multiplayer/%s.js" % n) for n in ("room-flow", "room-modal-bridge")] +
        [("assets/js/%s.js" % n, "src/fx/%s.js" % n) for n in ("splash-fx", "podium-fx", "floating-island")]),
}
TEXT_EXT = (".html", ".css", ".js", ".mjs", ".json", ".py", ".webmanifest", ".sh", ".yml")
SKIP_PREFIX = ("supabase/", "referensi/", "old/", "release/", "dist/", "node_modules/", "docs/", "doc/")
SKIP_FILES = {"mapping.json", "frozen.txt", "rename-skipped.txt", "package-lock.json", "assets/preload-manifest.json",
              "assets/media-hash.json", "tools/restructure-assets.py", "tools/rename-stage1.py", "tools/rename-stage2.py", "tools/rename-stage2a.py", "tools/rename-stage1-map.json", "tools/rename-stage2-map.json", "tools/rename-stage2a-map.json", "tools/rename-stage3-map.json", "tools/restructure-src.py", "tools/check-links.py"}

def sh(*a):
    return subprocess.run(a, cwd=ROOT, capture_output=True, text=True)

def tracked():
    return [p for p in sh("git", "ls-files").stdout.split("\n") if p and os.path.exists(os.path.join(ROOT, p))]

def build_map(phase, files):
    m = {}
    for old, new in DIRS.get(phase, []):
        for f in files:
            if f.startswith(old):
                m[f] = new + f[len(old):]
    for old, new in FILES.get(phase, {}).items():
        if old in files:
            m[old] = new
    return m

def map_target(t, moves, dir_pairs):
    if t in moves:
        return moves[t]
    for old, new in dir_pairs:
        if t.startswith(old):
            return new + t[len(old):]
    return t

URL_RE = re.compile(r"""url\(\s*(['"]?)([^'")\s]+)\1\s*\)""", re.I)
CSS_IMPORT_RE = re.compile(r"""(@import\s+)(['"])([^'"]+)\2""", re.I)
HTML_RE = re.compile(r"""(\b(?:src|href|poster)\s*=\s*)(['"])([^'"]*)\2""", re.I)
IMP_RE = re.compile(r"""((?:\bimport\s*\(?\s*|\bfrom\s+))(['"])(\.{1,2}/[^'"]+)\2""")

def is_abs(v):
    return (not v or v.startswith(("http:", "https:", "data:", "mailto:", "blob:", "#", "javascript:", "//", "/"))
            or "${" in v or "{{" in v)

def fix_rel(value, old_file, new_file, moves, dir_pairs, all_old, force_rel):
    """Hitung ulang nilai relatif terhadap berkas. Hanya diubah bila sasaran ada (di pohon lama) dan berubah."""
    if is_abs(value):
        return value
    if not force_rel and not value.startswith(("./", "../")):
        return value
    core = re.split(r"[?#]", value)[0]
    tail = value[len(core):]
    target = posixpath.normpath(posixpath.join(posixpath.dirname(old_file), core))
    if target not in all_old:
        return value
    new_target = map_target(target, moves, dir_pairs)
    new_rel = posixpath.relpath(new_target, posixpath.dirname(new_file) or ".")
    if value.startswith("./") and not new_rel.startswith("../"):
        new_rel = "./" + new_rel
    return new_rel + tail

def rewrite_text(text, old_file, new_file, moves, dir_pairs, all_old):
    ext = old_file.rsplit(".", 1)[-1].lower()
    n = [0]
    def bump(a, b):
        if a != b: n[0] += 1
        return b
    if ext in ("css", "html"):
        text = URL_RE.sub(lambda m: "url(%s%s%s)" % (m.group(1), bump(m.group(2), fix_rel(m.group(2), old_file, new_file, moves, dir_pairs, all_old, True)), m.group(1)), text)
    if ext == "css":
        text = CSS_IMPORT_RE.sub(lambda m: "%s%s%s%s" % (m.group(1), m.group(2), bump(m.group(3), fix_rel(m.group(3), old_file, new_file, moves, dir_pairs, all_old, True)), m.group(2)), text)
    if ext == "html":
        text = HTML_RE.sub(lambda m: "%s%s%s%s" % (m.group(1), m.group(2), bump(m.group(3), fix_rel(m.group(3), old_file, new_file, moves, dir_pairs, all_old, True)), m.group(2)), text)
    if ext in ("js", "mjs"):
        text = IMP_RE.sub(lambda m: "%s%s%s%s" % (m.group(1), m.group(2), bump(m.group(3), fix_rel(m.group(3), old_file, new_file, moves, dir_pairs, all_old, False)), m.group(2)), text)
    return text, n[0]

def prefix_pass(text, pairs):
    """Awalan berbasis akar halaman ('src/core/x.js', './assets/...') di string mana pun, juga di daftar segmen path.join."""
    n = 0
    for old, new in sorted(pairs, key=lambda p: -len(p[0])):
        pat = re.compile(r"(?<![\w\-])((?:\./)?)" + re.escape(old))
        text, c = pat.subn(lambda m: m.group(1) + new, text); n += c
        if old.endswith("/"):   # nama folder tanpa garis miring penutup, mis. path.join(root, "assets/components", name)
            text, c = re.compile(r"(?<![\w\-/.])" + re.escape(old[:-1]) + r"(?=['\"`])").subn(lambda m: new[:-1], text); n += c
        eo, en = old.replace("/", "\\/"), new.replace("/", "\\/")   # bentuk di dalam regex literal: assets\/css\/
        text, c = re.compile(r"(?<![\w\-])" + re.escape(eo)).subn(lambda m: en, text); n += c
        segs_old = old.strip("/").split("/"); segs_new = new.strip("/").split("/")
        if len(segs_old) > 1 and old.endswith("/"):
            spat = re.compile(r"""['"]""" + r"""['"]\s*,\s*['"]""".join(re.escape(x) for x in segs_old) + r"""['"]""")
            rep = "'" + "', '".join(segs_new) + "'"
            text, c = spat.subn(lambda m: rep, text); n += c
    return text, n

def main():
    if len(sys.argv) < 2 or sys.argv[1] not in DIRS:
        print(__doc__); sys.exit(2)
    phase = sys.argv[1]; apply = "--apply" in sys.argv
    files = tracked(); all_old = set(files)
    moves = build_map(phase, all_old)
    dir_pairs = DIRS.get(phase, [])
    pairs = list(dir_pairs) + [(o, n) for o, n in FILES.get(phase, {}).items()]
    print("fase %s: %d berkas dipindah" % (phase, len(moves)))
    new_of = lambda f: moves.get(f, f)
    changed = {}; total_rel = 0; total_pre = 0
    for f in files:
        if not f.endswith(TEXT_EXT) or f.startswith(SKIP_PREFIX) or f in SKIP_FILES:
            continue
        try:
            text = open(os.path.join(ROOT, f), encoding="utf-8").read()
        except Exception:
            continue
        t1, a = rewrite_text(text, f, new_of(f), moves, dir_pairs, all_old)
        t2, b = prefix_pass(t1, pairs)
        if t2 != text or f in moves:
            changed[f] = t2
        total_rel += a; total_pre += b
    print("berkas teks diubah: %d (relatif: %d, awalan: %d)" % (len(changed), total_rel, total_pre))
    if not apply:
        for f in sorted(changed)[:40]: print("  ubah", f, "->", new_of(f) if f in moves else "")
        return
    for old, new in sorted(moves.items()):
        os.makedirs(os.path.join(ROOT, posixpath.dirname(new)), exist_ok=True)
        r = sh("git", "mv", old, new)
        if r.returncode: print("GAGAL git mv", old, r.stderr.strip()); sys.exit(1)
    for f, text in changed.items():
        with open(os.path.join(ROOT, new_of(f)), "w", encoding="utf-8", newline="") as h:
            h.write(text)
    print("selesai. Jalankan: python3 tools/gen-preload-manifest.py ; python3 tools/check-links.py ; node tests/*.test.js")

if __name__ == "__main__":
    main()




