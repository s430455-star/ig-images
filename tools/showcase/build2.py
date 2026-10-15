import base64, io, json, os
from PIL import Image
os.chdir(os.path.dirname(os.path.abspath(__file__)))
sh = 'shots/'
def crop(f, box, w):
    im = Image.open(sh + f).convert('RGB').crop(box); h = int(im.height * w * 2 / im.width)
    im = im.resize((w * 2, h), Image.LANCZOS); b = io.BytesIO(); im.save(b, 'JPEG', quality=88)
    return f"<img class='shot' style='width:{w}px' src='data:image/jpeg;base64,{base64.b64encode(b.getvalue()).decode()}'>"
CSSX = "<style>.shot{border-radius:22px;box-shadow:0 14px 40px rgba(31,58,58,.18);border:2px solid #E2DED2;display:block}.c{display:flex;justify-content:center;gap:28px;margin-top:34px;align-items:flex-start}.v{flex-direction:column;align-items:center;gap:20px}.lead{font-size:36px;color:#4A5F5C;margin-top:14px;line-height:1.45;font-weight:500}.demo{position:absolute;right:96px;top:120px;font-size:26px;color:#A0522D;border:2px solid #A0522D;border-radius:10px;padding:4px 14px;font-weight:700}.row{font-size:42px}.row small{display:block;font-size:30px;color:#5D6F6C;font-weight:500;margin-top:6px}</style>"
def hdr(k, title, lead): return CSSX + f"<div class='demo'>示範資料</div><div class='kicker'>{k}</div><h2 style='font-size:58px'>{title}</h2><div class='lead'>{lead}</div>"
def cover(k, h1, sub, pills): return {"cover": True, "html": CSSX + f"<div class='kicker'>{k}</div><h1 style='font-size:88px'>{h1}</h1><div class='sub'>{sub}</div>" + "".join(f"<span class='pill'>{p}</span>" for p in pills) + "<div class='note' style='color:#BFD6CF;margin-top:60px'>👉 往右滑看實際畫面（皆為示範資料）</div>"}
def feats(k, h, items): return {"html": CSSX + f"<div class='kicker'>{k}</div><h2>{h}</h2><div class='rows'>" + "".join(f"<div class='row'><span>{a}<small>{b}</small></span></div>" for a, b in items) + "</div>"}
def cta(h, extra=""): return {"html": CSSX + f"<div class='kicker'>你也可以</div><h1 style='font-size:84px'>{h}</h1><div class='rows'><div class='row'><span>💬 有需求可留言詢問</span></div><div class='row'><span>🛠 依你的工作流程客製</span></div><div class='row'><span>📱 手機、電腦都能使用</span></div></div><div class='note'>※ 圖中單位、電話、個案姓名皆為示範資料，<br>非真實個案或特約單位。{extra}</div><span class='chip'>先收藏，需要時找得到 🤍</span>"}
v = lambda *imgs: "<div class='c v'>" + "".join(imgs) + "</div>"
h = lambda *imgs: "<div class='c'>" + "".join(imgs) + "</div>"

posts = {
 "a": [
  cover("AI 工作小工具 01", "時效報表<br>不用再<br>手動算天數", "用 AI 做的新案服務時效追蹤報表<br>輸入資料，達成率自動算好", ["自動計算", "超時提醒", "一鍵匯出"]),
  {"html": hdr("工作台", "打開就知道今天要補什麼", "超時未填原因、未填服務日期、派案方式未紀錄，自動列出") + h(crop('time_home.png', (0, 0, 2200, 2620), 620))},
  {"html": hdr("個案清單", "每月達成率自動統計", "一般案、無縫案分開計算，超過時效自動標色") + v(crop('time_tab0.png', (0, 1160, 2200, 1940), 700), crop('time_tab0.png', (0, 2720, 2200, 4360), 700))},
  {"html": hdr("超時追蹤", "超時個案一頁整理", "原因、改善措施集中填寫，評鑑前不用到處翻") + h(crop('time_tab1.png', (0, 1020, 2200, 3400), 700))},
  {"html": hdr("年度成果", "月報、年報一鍵產出", "未達標月份自動標色，統計表不用一格一格填") + v(crop('time_tab2.png', (0, 1000, 2200, 1940), 700), crop('time_tab2.png', (0, 6160, 2200, 7610), 700))},
  cta("想讓 AI<br>幫你做報表嗎？"),
 ],
 "b": [
  cover("AI 工作小工具 02", "派案輪到誰<br>不用再<br>翻紙本記", "用 AI 做的專業服務輪派表<br>自動排順位、自動留紀錄", ["自動輪派", "即時同步", "匯出 Excel"]),
  {"html": hdr("輪派畫面", "下一順位自動跳出來", "依服務碼別輪派，已派過的單位自動排到後面") + h(crop('dispatch_full.png', (0, 880, 1700, 2560), 780))},
  {"html": hdr("派案紀錄", "每一筆都有紀錄", "依碼別篩選，年底直接匯出 Excel，不用再整理") + h(crop('dispatch_full.png', (0, 2780, 1700, 4060), 820))},
  feats("省下哪些事", "原本 vs. 現在", [("📒 翻紙本找上一次派給誰", "→ 打開就看到下一順位"), ("☎️ 單位暫停還要另外記", "→ 標記暫停，自動跳過"), ("📑 年底重新整理派案表", "→ 一鍵匯出年度 Excel"), ("👥 同事之間資料不同步", "→ 多人使用即時更新")]),
  cta("想讓 AI<br>幫你排派案嗎？"),
 ],
 "c": [
  cover("AI 工作小工具 03", "家屬問<br>要付多少錢<br>馬上算給他看", "用 AI 做的長照四包錢試算<br>補助與自付金額即時算好", ["四包錢", "自付試算", "照顧計畫"]),
  {"html": hdr("基本設定", "選身分別和長照等級", "一般戶、中低收、低收，等級 2～8 級，額度自動帶入") + h(crop('calc_filled.png', (0, 0, 800, 1180), 520))},
  {"html": hdr("勾選服務", "補助、自付一目了然", "加入服務碼與次數，額度用多少、家屬付多少馬上看到") + h(crop('calc_filled.png', (0, 1140, 800, 2780), 460))},
  {"html": hdr("產出計畫", "勾完直接產出照顧計畫", "依選擇的服務項目自動整理成計畫內容") + h(crop('calc_plan.png', (0, 3180, 800, 4140), 640))},
  cta("想讓 AI<br>幫你做試算嗎？", "<br>※ 試算僅供初步參考，實際以照管中心評估核定為準。"),
 ],
}
for k, slides in posts.items():
    json.dump({"handle": "longtimecare115", "slides": slides}, open(f'p_{k}.json', 'w', encoding='utf-8'), ensure_ascii=False)
