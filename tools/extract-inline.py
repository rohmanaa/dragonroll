#!/usr/bin/env python3
"""Pecah <style> dan <script> inline halaman root (kecuali gameplay.html) ke assets/css/pages/ dan assets/js/pages/.
Posisi tag dipertahankan (urutan eksekusi/cascade sama). Inline kecil (<MIN) dan importmap tetap inline.
Jalankan ulang aman (idempoten): hanya memproses blok inline yang masih ada."""
import re, os, glob, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
MIN = 300
SKIP = {'gameplay.html', 'index.html'}
def fix_css_urls(css):
    def u(m):
        q, url = m.group(1), m.group(2).strip()
        if re.match(r'^(?:[a-z]+:|//|/|#|data:)', url, re.I) or url.startswith('../'): return m.group(0)
        return 'url(%s%s%s)' % (q, '../../../' + url, q)
    css = re.sub(r'url\(\s*([\'"]?)([^\'")]+)\1\s*\)', u, css)
    css = re.sub(r'@import\s+([\'"])([^\'"]+)\1', lambda m: m.group(0) if re.match(r'^(?:[a-z]+:|//|/)', m.group(2), re.I) or m.group(2).startswith('../') else '@import %s../../../%s%s' % (m.group(1), m.group(2), m.group(1)), css)
    return css
total = 0
for p in sorted(glob.glob('*.html')):
    if p in SKIP: continue
    name = p[:-5]; s = open(p, encoding='utf8').read(); orig = s
    # ---- CSS: gabungkan blok <style> bersebelahan tanpa atribut; <style id=...> jadi <link id=...> sendiri
    def free(ext, sub):
        i = 1
        while True:
            fn = '%s%s.%s' % (name, '' if i == 1 else '-%d' % i, ext)
            if not os.path.exists('assets/%s/pages/%s' % (sub, fn)): return fn
            i += 1
    def write_css(body, attr_id):
        fn = free('css', 'css'); os.makedirs('assets/css/pages', exist_ok=True)
        open('assets/css/pages/' + fn, 'w', encoding='utf8').write('/* %s — dipindah dari <style> inline (%s). Path url() relatif ke folder ini. */\n' % (fn, p) + fix_css_urls(body).strip('\n') + '\n')
        write_css.n += 1
        return '<link rel="stylesheet"%s href="assets/css/pages/%s">' % ((' id="%s"' % attr_id) if attr_id else '', fn)
    write_css.n = 0
    def run(m):
        blocks = re.findall(r'<style([^>]*)>(.*?)</style>', m.group(0), re.S)
        out, buf = [], []
        def flush():
            if buf:
                body = '\n'.join(b.strip('\n') for b in buf)
                out.append(write_css(body, None) if len(body.strip()) >= MIN else ''.join('<style>%s</style>' % b for b in buf)); buf.clear()
        for a, b in blocks:
            a = a.strip(); mid = re.fullmatch(r'id="([^"]+)"', a)
            if not a: buf.append(b)
            elif mid and len(b.strip()) >= MIN: flush(); out.append(write_css(b, mid.group(1)))
            else: flush(); out.append('<style %s>%s</style>' % (a, b) if a else '<style>%s</style>' % b)
        flush()
        return ''.join(out) + ('\n' if m.group(0).endswith('\n') else '')
    s = re.sub(r'(?:<style[^>]*>.*?</style>[ \t]*\n?)+', run, s, flags=re.S)
    css_group = write_css
    # ---- JS: tiap <script> inline (klasik/module) >= MIN
    def js_one(m):
        attrs, body = m.group(1), m.group(2)
        if 'src=' in attrs or 'importmap' in attrs or len(body.strip()) < MIN: return m.group(0)
        js_one.n += 1
        fn = free('js', 'js')
        os.makedirs('assets/js/pages', exist_ok=True)
        body = re.sub(r"""import\((['\"])(?:\./)?(assets/[^'\"]+)\1\)""", lambda m: 'import(%s../../../%s%s)' % (m.group(1), m.group(2), m.group(1)), body)  # import() dinamis: relatif ke file skrip, bukan halaman
        if 'module' in attrs: assert not re.search(r'\bimport\b', body), (p, 'module dengan import')
        open('assets/js/pages/' + fn, 'w', encoding='utf8').write('/* %s — dipindah dari <script> inline (%s). */\n' % (fn, p) + body.strip('\n') + '\n')
        return '<script%s src="assets/js/pages/%s"></script>' % (attrs, fn)
    js_one.n = 0
    s = re.sub(r'<script([^>]*)>(.*?)</script>', js_one, s, flags=re.S)
    if s != orig:
        open(p, 'w', encoding='utf8').write(s); total += 1
        print('%-20s css:%d js:%d  %d -> %d bytes' % (p, css_group.n, js_one.n, len(orig), len(s)))
print('halaman diubah:', total)
