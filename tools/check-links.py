#!/usr/bin/env python3
"""Periksa referensi path yang mati (HTML src/href, CSS url/@import, JS import + string path berawalan akar repo).
Pemakaian: python3 tools/check-links.py [--out berkas.txt]   (kode keluar 1 bila ada referensi mati)
Dipakai sebagai penjaga saat memindahkan folder (lihat docs/planing-ui/struktur-vite.md)."""
import os, re, sys, subprocess, posixpath
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_PREFIX = ("supabase/", "referensi/", "old/", "release/", "dist/", "docs/", "doc/", "tests/")
SKIP_FILES = ("tools/restructure-assets.py", "mapping.json", "frozen.txt", "tools/rename-stage1-map.json", "tools/rename-stage2-map.json", "tools/rename-stage2a-map.json", "tools/rename-stage3-map.json", "rename-skipped.txt", "package-lock.json")
EXTS = r"(?:html|css|js|mjs|json|webmanifest|webp|png|jpg|jpeg|svg|ico|mp3|ogg|wav|woff2?|ttf|glb|gltf|bin|txt)"
ROOTS = ("assets", "data", "src", "public", "gameplay", "tambang-world", "electron")
URL_RE = re.compile(r"""url\(\s*['"]?([^'")\s]+)['"]?\s*\)""", re.I)
IMPORT_CSS_RE = re.compile(r"""@import\s+['"]([^'"]+)['"]""", re.I)
HTML_RE = re.compile(r"""(?:src|href|poster)\s*=\s*['"]([^'"#?]+)""", re.I)
IMP_RE = re.compile(r"""(?:\bimport\s*\(?\s*|\bfrom\s+)['"](\.{1,2}/[^'"]+)['"]""")
LIT_RE = re.compile(r"""['"`]((?:%s)/[\w@\-./]+\.%s)['"`]""" % ("|".join(ROOTS), EXTS))

def tracked():
    out = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True).stdout.split("\n")
    return [p for p in out if p and os.path.exists(os.path.join(ROOT, p))]

def exists(p):
    return os.path.exists(os.path.join(ROOT, p))

def skip_value(v):
    return (not v or v.startswith(("http:", "https:", "data:", "mailto:", "blob:", "#", "javascript:", "//", "/"))
            or "${" in v or "{{" in v or v.endswith("/"))

def check(files):
    dead = set()
    for rel in files:
        if rel.startswith(SKIP_PREFIX) or rel in SKIP_FILES:
            continue
        ext = rel.rsplit(".", 1)[-1].lower()
        if ext not in ("html", "css", "js", "mjs", "webmanifest", "json"):
            continue
        try:
            text = open(os.path.join(ROOT, rel), encoding="utf-8").read()
        except Exception:
            continue
        base = posixpath.dirname(rel)
        cands = []  # (value, file-relative?)
        if ext == "css":
            cands += [(m, True) for m in URL_RE.findall(text) + IMPORT_CSS_RE.findall(text)]
        elif ext == "html":
            cands += [(m, True) for m in HTML_RE.findall(text) + URL_RE.findall(text)]
            cands += [(m, False) for m in LIT_RE.findall(text)]
        elif ext in ("js", "mjs"):
            cands += [(m, True) for m in IMP_RE.findall(text)]
            cands += [(m, False) for m in LIT_RE.findall(text)]
        else:
            cands += [(m, False) for m in LIT_RE.findall(text)]
        for v, filerel in cands:
            v = v.split("?")[0].split("#")[0]
            if skip_value(v):
                continue
            if filerel or v.startswith("./") or v.startswith("../"):
                target = posixpath.normpath(posixpath.join(base, v))
            else:
                target = v
            if not exists(target):
                dead.add("%s -> %s" % (rel, target))
    return sorted(dead)

if __name__ == "__main__":
    dead = check(tracked())
    out = None
    if "--out" in sys.argv:
        out = sys.argv[sys.argv.index("--out") + 1]
    text = "\n".join(dead) + ("\n" if dead else "")
    if out:
        open(out, "w", encoding="utf-8").write(text)
    print("referensi mati: %d" % len(dead))
    if not out:
        print(text, end="")
    sys.exit(1 if dead else 0)
