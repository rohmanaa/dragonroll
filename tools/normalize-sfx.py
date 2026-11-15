#!/usr/bin/env python3
"""Seragamkan kekerasan SEMUA SFX (assets/sfx/**, assets/new sound/**, data/inventory/pet/*/sfx/**) supaya slider "Efek suara" bermakna:
tidak ada lagi suara yang jauh lebih keras/pelan dari yang lain.

Sumber asli disimpan di referensi/sfx-asli/ (tidak ikut diunduh). Skrip SELALU membaca dari sana lalu menulis ke lokasi runtime
masing-masing (assets/ atau folder Pet), jadi aman dijalankan berulang (tidak menumpuk penguatan). Musik tidak disentuh.

Metode: ukur RMS jendela terkeras 200 md (cocok untuk suara pendek; LUFS tak akurat < 0,4 dtk), beri gain statis supaya
mencapai TARGET, lalu limiter -2 dBFS (sisa ruang untuk overshoot encoder mp3). Gain dibatasi MAX_BOOST dan anggaran puncak PEAK_BUDGET (persentil 99,9 amplitudo; suara perkusif tipis
tidak dipaksa jadi gepeng: dibiarkan sedikit lebih pelan). Suara panjang (>= LONG_S dtk) diturunkan LONG_OFFSET dB karena
terasa lebih keras bila berlangsung lama. Atur OFFSETS untuk koreksi per file setelah didengarkan.

  python3 tools/normalize-sfx.py          # tabel rencana saja (tidak menulis)
  python3 tools/normalize-sfx.py --apply  # tulis file ke lokasi runtime (lalu: python3 tools/gen-preload-manifest.py)"""
import os, sys, glob, math, shutil, subprocess, json
import numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'referensi', 'sfx-asli')
TARGET = -12.0        # dBFS RMS jendela terkeras 200 md
LONG_S, LONG_OFFSET = 5.0, -3.0
MAX_BOOST = 20.0
PEAK_BUDGET = 3.0     # puncak sebelum limiter boleh sampai +3 dBFS (limiter menarik ke -1)
OFFSETS = {}          # contoh: {'sfx/ui/button-click.mp3': -2}  (dB, relatif path di bawah assets/)
DIRS = ['sfx', 'new sound']
PET_DIR = os.path.join(ROOT, 'data', 'inventory', 'pet')

def rels():
    out = []
    for d in DIRS:
        base = os.path.join(ROOT, 'assets', d)
        for dp, _, fn in os.walk(base):
            for f in fn:
                if f.lower().endswith(('.mp3', '.ogg')):
                    rel = os.path.relpath(os.path.join(dp, f), os.path.join(ROOT, 'assets')).replace(os.sep, '/')
                    out.append((rel, 'assets/' + rel, rel))
    for dp, _, fn in os.walk(PET_DIR):
        if os.path.basename(dp) != 'sfx':
            continue
        for f in fn:
            if f.lower().endswith(('.mp3', '.ogg')):
                rel = os.path.relpath(os.path.join(dp, f), ROOT).replace(os.sep, '/')
                out.append((rel, rel, 'sfx/pet/' + f))
    return sorted(out)

def measure(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', '44100', '-f', 'f32le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.float32)
    w = min(len(x), int(0.2 * 44100)); h = int(0.02 * 44100); best = -120.0
    for i in range(0, max(1, len(x) - w + 1), h):
        seg = x[i:i + w]; best = max(best, 20 * math.log10(math.sqrt(float(np.mean(seg * seg))) + 1e-9))
    pk = float(np.percentile(np.abs(x), 99.9))   # puncak 'kokoh': abaikan lonjakan 1-2 sampel (limiter yang menanganinya)
    return best, 20 * math.log10(pk + 1e-9), len(x) / 44100

def probe(path):
    j = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=channels,sample_rate', '-of', 'json', path], capture_output=True, text=True).stdout)['streams'][0]
    return int(j['channels']), int(j['sample_rate'])

def main():
    apply = '--apply' in sys.argv
    rows = []
    for rel, target_rel, source_rel in rels():
        src = os.path.join(SRC, *source_rel.split('/'))
        dst = os.path.join(ROOT, *target_rel.split('/'))
        if not os.path.exists(src):
            os.makedirs(os.path.dirname(src), exist_ok=True)
            shutil.copy2(dst, src)   # simpan asli sekali
        loud, peak, dur = measure(src)
        want = TARGET + (LONG_OFFSET if dur >= LONG_S else 0) + OFFSETS.get(rel, 0)
        gain = want - loud; note = ''
        if gain > MAX_BOOST: gain = MAX_BOOST; note = 'batas boost'
        if peak + gain > PEAK_BUDGET: gain = PEAK_BUDGET - peak; note = (note + ' perkusif: lebih pelan dari target').strip()
        rows.append((rel, loud, peak, dur, gain, loud + gain, note))
        if apply:
            ch, sr = probe(src)
            af = 'volume=%.2fdB,alimiter=limit=0.794:attack=5:release=60:level=0' % gain
            enc = ['-c:a', 'libmp3lame', '-b:a', '128k' if ch > 1 else '96k', '-joint_stereo', '1'] if rel.endswith('.mp3') else ['-c:a', 'libvorbis', '-q:a', '3']
            tmp = dst + '.tmp' + os.path.splitext(dst)[1]
            subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-map_metadata', '-1', '-af', af, '-ar', str(sr)] + enc + [tmp], check=True)
            os.replace(tmp, dst)
    print('%-46s %7s %7s %6s %7s %7s' % ('file', 'sebelum', 'puncak', 'dtk', 'gain', 'sesudah'))
    for r in rows: print('%-46s %7.1f %7.1f %6.1f %+7.1f %7.1f  %s' % (r[0][:46], r[1], r[2], r[3], r[4], r[5], r[6]))
    sb = [r[1] for r in rows]; sa = [r[5] for r in rows]
    print('\nrentang kekerasan: sebelum %.1f..%.1f dB (selisih %.0f dB) | sesudah %.1f..%.1f dB (selisih %.0f dB)' % (min(sb), max(sb), max(sb) - min(sb), min(sa), max(sa), max(sa) - min(sa)))
    print('DITULIS' if apply else 'DRY-RUN (tambah --apply untuk menulis)')
main()
