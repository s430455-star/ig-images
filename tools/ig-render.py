import json, sys
from playwright.sync_api import sync_playwright
CSS = """
*{box-sizing:border-box;margin:0}
body{width:1080px;height:1350px;font-family:'Noto Sans CJK TC',sans-serif;background:#F3F1EA;color:#1F3A3A;position:relative;overflow:hidden}
.pad{position:absolute;inset:0;padding:110px 96px 150px}
.kicker{font-size:34px;font-weight:700;letter-spacing:4px;color:#3E7C6E}
h1{font-size:96px;line-height:1.18;font-weight:900;margin-top:28px}
h2{font-size:70px;line-height:1.2;font-weight:900;margin-top:20px}
.sub{font-size:44px;line-height:1.5;color:#4A5F5C;margin-top:36px;font-weight:500}
.big{font-size:150px;font-weight:900;color:#2E6B5E;line-height:1;margin-top:40px}
.unit{font-size:48px;font-weight:700;color:#4A5F5C}
.rows{margin-top:48px;display:flex;flex-direction:column;gap:18px}
.row{display:flex;justify-content:space-between;align-items:baseline;background:#fff;border-radius:22px;padding:24px 36px;font-size:46px;font-weight:700}
.row span:last-child{font-variant-numeric:tabular-nums;color:#2E6B5E}
.row.hl{background:#2E6B5E;color:#fff}.row.hl span:last-child{color:#FFE08A}
.note{font-size:34px;color:#5D6F6C;margin-top:36px;line-height:1.5}
.chip{display:inline-block;background:#FFE08A;color:#1F3A3A;border-radius:999px;padding:10px 30px;font-size:34px;font-weight:700;margin-top:30px}
.foot{position:absolute;left:96px;right:96px;bottom:60px;display:flex;justify-content:space-between;font-size:30px;color:#7A8C89;font-weight:500}
.bar{position:absolute;left:0;top:0;width:100%;height:18px;background:#3E7C6E}
.cover{background:#2E6B5E;color:#fff}.cover .kicker{color:#FFE08A}.cover .sub{color:#DDEBE6}.cover .foot{color:#BFD6CF}.cover .bar{background:#FFE08A}
.pill{display:inline-block;font-size:30px;padding:8px 24px;border:3px solid currentColor;border-radius:999px;margin-right:14px;margin-top:22px}
"""
def page(inner, n, total, handle, cover=False):
    cls = 'cover' if cover else ''
    return f"<html><head><meta charset='utf-8'><style>{CSS}</style></head><body class='{cls}'><div class='bar'></div><div class='pad'>{inner}</div><div class='foot'><span>@{handle}</span><span>{n} / {total}</span></div></body></html>"
def main(spec_path, out_prefix):
    spec = json.load(open(spec_path, encoding='utf-8'))
    slides = spec['slides']; total = len(slides)
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width':1080,'height':1350})
        for i, s in enumerate(slides, 1):
            pg.set_content(page(s['html'], i, total, spec['handle'], s.get('cover', False)))
            pg.wait_for_timeout(150)
            pg.screenshot(path=f"{out_prefix}{i:02d}.jpg", type='jpeg', quality=90)
        b.close()
if __name__ == '__main__': main(sys.argv[1], sys.argv[2])
