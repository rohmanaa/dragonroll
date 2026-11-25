#!/usr/bin/env python3
"""Pembuat ikon aset Tambang (ore, batang, permata, kayu): pixel-art bergaya blok, latar transparan.
Keluaran: tambang-world/images/ore/*.webp (128x128). Deterministik (seed tetap): jalankan ulang = hasil sama.
Pakai: python3 tools/gen-tambang-ore.py   (butuh Pillow + numpy)"""
import os, random
import numpy as np
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'tambang-world', 'images', 'ore')
S = 128

def hexc(h): h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
def mul(c, k): return tuple(max(0, min(255, int(v * k))) for v in c)

# ---------- mesin kotak isometrik: tiap sisi = tekstur kecil yang dipetakan (tanpa antialias => tampak piksel) ----------
def face(img, O, U, V, tex, shade):
    """Isi jajar-genjang (O + a*U + b*V, a,b in [0,1)) dengan tekstur HxWx3."""
    h, w = tex.shape[:2]
    M = np.array([[U[0], V[0]], [U[1], V[1]]], float); Mi = np.linalg.inv(M)
    xs = [O[0], O[0] + U[0], O[0] + V[0], O[0] + U[0] + V[0]]; ys = [O[1], O[1] + U[1], O[1] + V[1], O[1] + U[1] + V[1]]
    x0, x1, y0, y1 = int(min(xs)) - 1, int(max(xs)) + 2, int(min(ys)) - 1, int(max(ys)) + 2
    for y in range(max(0, y0), min(S, y1)):
        for x in range(max(0, x0), min(S, x1)):
            a, b = Mi @ np.array([x + 0.5 - O[0], y + 0.5 - O[1]])
            if 0 <= a < 1 and 0 <= b < 1:
                c = tex[int(b * h), int(a * w)]
                img.putpixel((x, y), tuple(int(v * shade) for v in c) + (255,))

def box(img, a, b, h, tops, lefts, rights, cx=64, ytop=None):
    """Kotak iso: panjang sumbu kanan-bawah=a, kiri-bawah=b, tinggi=h. tex = array warna per sisi."""
    ytop = ytop if ytop is not None else (S - (a + b) / 2 - h) / 2
    ox = cx - (a - b) / 2   # titik atas sisi puncak disesuaikan agar kotak berpusat
    top = (cx, ytop)
    face(img, top, (a, a / 2), (-b, b / 2), tops, 1.0)                                   # puncak
    face(img, (top[0] - b, top[1] + b / 2), (b, b / 2), (0, h), lefts, 0.78)             # kiri
    face(img, (top[0] - b + b, top[1] + b / 2 + b / 2), (a, -a / 2), (0, h), rights, 0.58)  # kanan

# ---------- tekstur ----------
def noise_tex(n, pal, seed):
    r = random.Random(seed); t = np.zeros((n, n, 3), np.uint8)
    for y in range(n):
        for x in range(n): t[y, x] = pal[r.randrange(len(pal))]
    return t

STONE = [hexc(x) for x in ('#7d7d7d', '#8c8c8c', '#707070', '#989898', '#838383')]
def ore_tex(main, light, dark, seed, n=16, blobs=6, base=STONE):
    r = random.Random(seed); t = noise_tex(n, base, seed + 1)
    for _ in range(blobs):
        cx, cy = r.randrange(1, n - 2), r.randrange(1, n - 2); pts = {(cx, cy)}
        for _ in range(r.randrange(3, 7)):
            px, py = r.choice(list(pts)); pts.add((max(0, min(n - 1, px + r.choice((-1, 0, 1)))), max(0, min(n - 1, py + r.choice((-1, 0, 1))))))
        for (x, y) in pts:
            t[y, x] = main if r.random() < .6 else (light if r.random() < .5 else dark)
        x, y = min(pts, key=lambda p: (p[1], p[0])); t[y, x] = light
    return t

def log_top(n=16):
    t = np.zeros((n, n, 3), np.uint8); ring = [hexc('#b9925a'), hexc('#a07b45'), hexc('#c9a46b'), hexc('#8d6a38')]
    for y in range(n):
        for x in range(n):
            d = max(abs(x - 7.5), abs(y - 7.5))
            t[y, x] = hexc('#6b4a26') if d > 6.6 else ring[int(d) % 2 if d < 6.6 else 0]
    return t
def log_side(n=16):
    r = random.Random(7); t = np.zeros((n, n, 3), np.uint8); bark = [hexc('#6e4d27'), hexc('#7d5a31'), hexc('#5d4020'), hexc('#84603a')]
    for x in range(n):
        col = bark[r.randrange(len(bark))]
        for y in range(n): t[y, x] = col if r.random() > .25 else bark[r.randrange(len(bark))]
    return t

def save(img, name):
    os.makedirs(OUT, exist_ok=True); img.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=92, method=6); print('ok', name)

def cube(name, tex_top, tex_side, tex_side2=None):
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0)); a = b = 52
    box(img, a, b, 60, tex_top, tex_side, tex_side2 if tex_side2 is not None else tex_side, ytop=8); save(img, name)

# ---------- bentuk vektor piksel (batang & permata): gambar 32x32 lalu perbesar NEAREST ----------
def px(name, draw_fn):
    im = Image.new('RGBA', (32, 32), (0, 0, 0, 0)); d = ImageDraw.Draw(im); draw_fn(d); save(im.resize((S, S), Image.NEAREST), name)

def ingot(base):
    c = hexc(base)
    def f(d):
        d.polygon([(5, 16), (10, 9), (27, 9), (24, 16)], fill=mul(c, 1.25))          # puncak
        d.polygon([(5, 16), (24, 16), (24, 23), (5, 23)], fill=c)                      # depan
        d.polygon([(24, 16), (27, 9), (27, 16), (24, 23)], fill=mul(c, .68))           # sisi kanan
        d.line([(6, 17), (23, 17)], fill=mul(c, 1.5)); d.line([(11, 10), (26, 10)], fill=mul(c, 1.55))
        d.line([(5, 23), (24, 23)], fill=mul(c, .55)); d.line([(24, 23), (27, 16)], fill=mul(c, .5))
    return f

def gem_diamond(d):
    L, M, D, W = hexc('#9ff4ff'), hexc('#4fd6ea'), hexc('#2aa0b8'), hexc('#e6fdff')
    d.polygon([(9, 6), (23, 6), (29, 13), (16, 29), (3, 13)], fill=M)
    d.polygon([(9, 6), (23, 6), (20, 13), (12, 13)], fill=L)
    d.polygon([(3, 13), (12, 13), (16, 29)], fill=mul(M, .88)); d.polygon([(29, 13), (20, 13), (16, 29)], fill=D)
    d.polygon([(12, 13), (20, 13), (16, 29)], fill=hexc('#35bcd2'))
    d.line([(9, 6), (3, 13), (16, 29), (29, 13), (23, 6), (9, 6)], fill=hexc('#17707f')); d.point([(12, 8), (13, 8), (11, 9)], fill=W)

def gem_lapis(d):
    M, L, D = hexc('#2f4fd6'), hexc('#6f8bff'), hexc('#1a2f8c')
    d.polygon([(7, 8), (22, 5), (28, 14), (24, 26), (9, 27), (3, 17)], fill=M)
    d.polygon([(7, 8), (22, 5), (20, 12), (10, 14)], fill=L); d.polygon([(24, 26), (28, 14), (20, 12), (16, 22)], fill=D)
    d.polygon([(3, 17), (10, 14), (16, 22), (9, 27)], fill=mul(M, .85))
    d.line([(7, 8), (22, 5), (28, 14), (24, 26), (9, 27), (3, 17), (7, 8)], fill=hexc('#0f1c5c'))
    for p in [(13, 18), (19, 17), (15, 10), (21, 22)]: d.point([p], fill=hexc('#ffe27a'))

def gem_amethyst(d):
    M, L, D = hexc('#a45cf0'), hexc('#d3a2ff'), hexc('#6a2fb0')
    d.polygon([(16, 2), (24, 9), (24, 24), (16, 30), (8, 24), (8, 9)], fill=M)
    d.polygon([(16, 2), (24, 9), (16, 13), (8, 9)], fill=L)
    d.polygon([(16, 13), (24, 9), (24, 24), (16, 30)], fill=D); d.polygon([(8, 9), (16, 13), (16, 30), (8, 24)], fill=mul(M, .92))
    d.line([(16, 2), (24, 9), (24, 24), (16, 30), (8, 24), (8, 9), (16, 2)], fill=hexc('#3c1766')); d.line([(16, 13), (16, 30)], fill=hexc('#4b2085'))
    d.point([(14, 6), (15, 6), (13, 7)], fill=hexc('#f3e4ff'))

if __name__ == '__main__':
    # ore (kotak iso: puncak lebih terang, sisi memakai tekstur ore sendiri agar bintik terlihat di semua sisi)
    ores = {  # id: (utama, terang, gelap)
        'copper':   ('#e0804a', '#ffb27a', '#a8501f'), 'iron': ('#e2c2a8', '#fff0e2', '#a98a70'), 'coal': ('#2e2e36', '#55555f', '#16161a'),
        'lapis':    ('#3a5fe0', '#7f9dff', '#1f3aa6'), 'gold': ('#ffd24d', '#fff3a0', '#c9971a'), 'amethyst': ('#b06cff', '#e0b8ff', '#7a3dc2'),
        'diamond':  ('#6fe8ff', '#d6fcff', '#2fb4cc')}
    for i, (k, (m, l, dk)) in enumerate(ores.items()):
        m, l, dk = hexc(m), hexc(l), hexc(dk)
        cube('tambang-ore-' + k, ore_tex(m, l, dk, 100 + i, blobs=7), ore_tex(m, l, dk, 200 + i, blobs=8), ore_tex(m, l, dk, 300 + i, blobs=8))
    cube('tambang-kayu', log_top(), log_side(), log_side())
    px('tambang-batang-copper', ingot('#d9793f')); px('tambang-batang-iron', ingot('#c4c9d4')); px('tambang-batang-gold', ingot('#ffcf3d'))
    px('tambang-permata-diamond', gem_diamond); px('tambang-permata-lapis', gem_lapis); px('tambang-permata-amethyst', gem_amethyst)
