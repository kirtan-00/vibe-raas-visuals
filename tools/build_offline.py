#!/usr/bin/env python3
"""Build the no-internet, no-server copy: ONE self-contained HTML that runs from file:// (double-click).
Every visual is inlined and loaded as an iframe srcdoc (same origin as the show page, even under file://),
images and fonts become data: URIs, phone control (MQTT/QR) is left out.
Usage: python3 tools/build_offline.py [OUT_DIR]   (default ~/Desktop/Vibe Raas Visuals OFFLINE)"""
import base64, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/Desktop/Vibe Raas Visuals OFFLINE')
MIME = {'.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf'}

def rd(p): return open(os.path.join(ROOT, p), encoding='utf-8').read()
def data_uri(p):
    return 'data:%s;base64,%s' % (MIME[os.path.splitext(p)[1]], base64.b64encode(open(os.path.join(ROOT, p), 'rb').read()).decode())
def must_sub(pat, repl, s, what, count=0):
    s2, n = re.subn(pat, repl, s, count=count)
    if n == 0: sys.exit('build_offline: pattern not found: ' + what)
    return s2

show = rd('show.html')
dirs = sorted(set(re.findall(r"^\s+\w+:\s+'([a-z]+)/\?embed=1", show, re.M)))
assert dirs, 'no visuals found in VIS map'
embed_js = rd('vr-embed.js')
bundle = {}
for d in dirs:
    h = rd(d + '/index.html')
    h = must_sub(r'<script src="\.\./vr-embed\.js"></script>', lambda m: '<script>' + embed_js + '</script>', h, d + ' vr-embed', 1)
    h = h.replace('new URLSearchParams(location.search)', 'new URLSearchParams(window.__VRQS || location.search)')
    h = re.sub(r'(src=")(assets/[^"]+)"', lambda m: m.group(1) + data_uri(d + '/' + m.group(2)) + '"', h)
    h = re.sub(r"url\(\.\./(fonts/[^)'\"]+)\)", lambda m: 'url(' + data_uri(m.group(1)) + ')', h)
    left = re.findall(r'(?:src|href)="(?!data:|#|javascript:)[^"]+"|url\(\.\./', h)
    if left: sys.exit('build_offline: unresolved refs in %s: %s' % (d, left[:5]))
    bundle[d] = h

relay = rd('relay.js')
s = show
s = must_sub(r'<script src="https://cdn\.jsdelivr\.net/npm/mqtt[^"]+"></script>\n?', '', s, 'mqtt tag')
s = must_sub(r'<script src="https://cdn\.jsdelivr\.net/npm/qrcode-generator[^"]+"></script>\n?', '', s, 'qr tag')
blob = json.dumps(bundle).replace('</', '<\\/')
s = must_sub(r'<script src="relay\.js"></script>',
             lambda m: '<script>window.VR_OFFLINE_BUILD = true;\n' + relay + '</script>\n<script>window.VR_BUNDLE = ' + blob + ';</script>', s, 'relay tag', 1)
s = re.sub(r'(src=")(img/[^"]+)"', lambda m: m.group(1) + data_uri(m.group(2)) + '"', s)
s = must_sub(r'</style>', '.pair,#pairov{display:none!important}\n</style>', s, 'style', 1)
s = s.replace('<kbd>Q</kbd>phone code ', '')
s = s.replace('<title>Vibe Raas Show</title>', '<title>Vibe Raas Visuals (offline)</title>')
if re.search(r'https?://', re.sub(r'<script>window\.VR_BUNDLE.*?</script>', '', s, flags=re.S).replace('http://www.w3.org', '')):
    print('note: show page still mentions http(s) URLs (strings only, nothing loads from them)')
os.makedirs(OUT, exist_ok=True)
out = os.path.join(OUT, 'Vibe Raas Visuals.html')
open(out, 'w', encoding='utf-8').write(s)
readme = os.path.join(ROOT, 'tools', 'OFFLINE_READ_ME.txt')
if os.path.exists(readme): open(os.path.join(OUT, 'READ ME.txt'), 'w').write(open(readme).read())
print('wrote', out, '%.1f MB' % (os.path.getsize(out) / 1e6), 'visuals:', ', '.join(dirs))
