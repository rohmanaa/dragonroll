#!/usr/bin/env python3
"""Buat assets/preload-manifest.json: daftar file (path relatif ke folder game/) + ukuran byte.
Dipakai preloader (assets/js/preloader.js) agar bar loading dihitung dari byte yang benar-benar diunduh.
Jalankan lagi tiap menambah/mengganti aset (musik, gambar, sfx):  python3 tools/gen-preload-manifest.py"""
import os, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INC_DIRS = ['assets', 'data', 'gameplay', 'hud', 'promosi']
EXT = {'.png', '.webp', '.jpg', '.jpeg', '.gif', '.svg', '.mp3', '.ogg', '.wav', '.js', '.css', '.woff', '.woff2', '.webm'}
SKIP_PARTS = {'old', 'doc', 'referensi', 'node_modules'}
out = {}
for d in INC_DIRS:
    for dp, dn, fn in os.walk(os.path.join(ROOT, d)):
        dn[:] = [x for x in dn if x not in SKIP_PARTS]
        for f in fn:
            if os.path.splitext(f)[1].lower() in EXT:
                full = os.path.join(dp, f)
                out[os.path.relpath(full, ROOT).replace(os.sep, '/')] = os.path.getsize(full)
out.pop('assets/preload-manifest.json', None)
with open(os.path.join(ROOT, 'assets', 'preload-manifest.json'), 'w') as fh:
    json.dump(dict(sorted(out.items())), fh, separators=(',', ':'))
print(len(out), 'file,', round(sum(out.values()) / 1048576, 2), 'MB')
