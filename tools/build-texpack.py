#!/usr/bin/env python3
"""Bangun atlas tekstur "texpack" (grayscale, hanya detail; warna tetap dari palet game/CSS).
Sumber : referensi/gameplay/*.jpg (lembar 3x2 tile pixel-art berlabel)
Keluar : gameplay/assets/maps/world/texpack.webp (8x8 tile @64px, lossless) + texpack.json (nama -> layer)
Urutan NAMES = id layer. JANGAN ubah urutan yang sudah ada (tambah di akhir) agar pemetaan di main.js (TEX_PACK_MAP) tetap benar.
Jalankan: python3 tools/build-texpack.py   (lalu python3 tools/gen-preload-manifest.py setelah git add)"""
import json, sys, numpy as np
from PIL import Image
SRC='referensi/gameplay/'; OUT='gameplay/assets/maps/world/'; T=64; COLS=8
SHEETS=[
 ('Create_soil_and_sand_textures_eadf06fd.jpg',['red_sand','soul_sand','soul_soil','podzol','mycelium','muddy_roots']),
 ('Membuat_tekstur_Nether_voxel_09ce36f0.jpg',['netherrack','nether_bricks','magma','basalt','crimson_nylium','warped_nylium']),
 ('Create_missing_voxel_textures_9dfbe9c6.jpg',['solid_stone','bark','meadow','rock_blue','bark_light','meadow_teal']),
 ('Create_voxel_texture_pack_materials_1b5dfc88.jpg',['stone_bricks','planks_oak','log_top',None,None,'sand']),
 ('Creating_decorative_stone_textures_10ff6b62.jpg',['polished_granite','polished_diorite','polished_andesite','polished_deepslate','mossy_stone_bricks','cracked_stone_bricks']),
 ('Creating_mineral_texture_designs_1992b80b.jpg',['nether_quartz_ore','ancient_debris','nether_gold_ore','amethyst','calcite','tuff']),
 ('Membuat_enam_tekstur_material_batu_8851564c.jpg',['granite','diorite','andesite','deepslate','blackstone','bricks']),
 ('Membuat_tekstur_bijih_mineral_5a88c412.jpg',['coal_ore','gold_ore','diamond_ore','emerald_ore','lapis_ore','redstone_ore']),
 ('Membuat_tekstur_material_es_dingin_153770ab.jpg',['ice','packed_ice','blue_ice','snow_block','frosted_stone','frozen_dirt']),
 ('Creating_wooden_plank_textures_495572b4.jpg',['planks_birch','planks_spruce','planks_jungle','planks_acacia','planks_dark_oak','planks_bamboo']),
 ('texture.jpg',['leaves','stone','grass',None,None,None]),   # baris 2 teks: dirt, grass_block (kolom 3 kosong) -> dipetakan khusus di bawah
]
def find_tiles(im):
    """Semua lembar AI memakai tata letak yang sama (3 kolom x 2 baris, terukur pada 1200x896); skala mengikuti ukuran gambar."""
    w,h=im.size; sx,sy=w/1200.0,h/896.0
    xs=[(60,390),(436,766),(812,1140)]; ys=[(106,434),(524,852)]
    return [[(int(x0*sx),int(y0*sy),int(x1*sx),int(y1*sy)) for (x0,x1) in xs] for (y0,y1) in ys]
def norm_tile(crop):
    g=np.asarray(crop.convert('L').resize((T,T),Image.BOX)).astype(float)
    m,s=g.mean(),g.std(); k=min(42.0/max(s,6.0),2.5)
    return np.clip(128+(g-m)*k,0,255).astype(np.uint8)
names=[];tiles=[]
for fn,nm in SHEETS:
    im=Image.open(SRC+fn); boxes=find_tiles(im); flat=[b for r in boxes for b in r]
    if fn=='texture.jpg': nm=['leaves','stone','grass','dirt','grass_block']
    for n,b in zip(nm,flat):
        if not n: continue
        x0,y0,x1,y1=b; ins=int((x1-x0)*0.05)
        tiles.append(norm_tile(im.crop((x0+ins,y0+ins,x1-ins,y1-ins)))); names.append(n)
assert len(tiles)<=COLS*COLS, len(tiles)
atlas=np.full((COLS*T,COLS*T),128,np.uint8)
for i,t in enumerate(tiles): r,c=divmod(i,COLS); atlas[r*T:(r+1)*T,c*T:(c+1)*T]=t
Image.fromarray(atlas).convert('RGB').save(OUT+'texpack.webp','WEBP',lossless=True,method=6)
json.dump({'size':T,'cols':COLS,'names':names},open(OUT+'texpack.json','w'),indent=1)
print(len(names),'tile ->',OUT+'texpack.webp'); print(names)
