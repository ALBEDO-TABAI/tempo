"""Redact private data from a reference capture before it is placed in docs/parity (refs themselves stay in the research dir).
Masks: sidebar account/calendar list, the account avatar, any text with an e-mail / workspace name, and every
non-test ("REA …") event chip title. Usage: python3 redact.py <ref-name> <out.png>"""
import json, sys
from PIL import Image, ImageDraw, ImageFilter
REF = '/workspace/ncal-research/ref'
name, out = sys.argv[1], sys.argv[2]
d = json.load(open(f'{REF}/{name}.json')); im = Image.open(f'{REF}/{name}.png').convert('RGB')
S = im.size[0] / d['vw']
rects = []
def add(r, pad=1): x, y, w, h = r; rects.append((int((x - pad) * S), int((y - pad) * S), int((x + w + pad) * S), int((y + h + pad) * S)))
side_w = max([e['r'][0] + e['r'][2] for e in d['els'] if 'sc-gnt4zv-0' in e['sc'] and e['r'][0] < 300] + [0])
if side_w > 0: add((0, 196, 240, d['vh'] - 196 - 40), 0)
for e in d['els']:
    t = (e['text'] or '').strip(); x, y, w, h = e['r']
    if w <= 0 or h <= 0: continue
    if e['tag'] == 'BUTTON' and 'border-radius' in e['st'] and e['st'].get('border-radius') == '50%' and y < 50 and 20 <= w <= 30: add(e['r'], 2)  # avatar
    if not t: continue
    if h <= 48 and ('@' in t or 'Notion' in t or "'s " in t or "’s " in t):
        add(e['r'])
        if 244 <= x <= 330: add((x - 40, y - 6, 36, h + 12), 0)  # account/workspace avatar left of a masked nav label
    # event titles that are not the synthetic test events
    if ('sc-1axd7p-6' in e['sc'] or 'sc-1axd7p-7' in e['sc']) and not t.startswith('REA') and h <= 40: add(e['r'], 1)
    # sidebar calendar list (below the mini month) when the sidebar is open
    if x < 240 and y > 280 and h <= 40 and w < 240 and x >= 0 and e['tag'] in ('DIV', 'SPAN'): add(e['r'])
    # search results / panel rows listing other events
    if x >= 1150 and y > 100 and h <= 40 and not t.startswith('REA') and ('sc-1slm0q2' in e['sc'] or 'sc-hg75jc-3' in e['sc']) and '@' in t: add(e['r'])
blur = im.filter(ImageFilter.GaussianBlur(int(6 * S)))
mask = Image.new('L', im.size, 0); md = ImageDraw.Draw(mask)
for r in rects: md.rectangle(r, fill=255)
im.paste(blur, (0, 0), mask)
dr = ImageDraw.Draw(im)
for r in rects: dr.rectangle(r, fill=(128, 128, 128))
im.save(out)
print(len(rects))
