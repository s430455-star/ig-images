# FUTURE TECHNOLOGY HEADQUARTERS — 高精度 3D 建築重建

以 **Blender Python API** 程式化建立的未來科技總部（真實 3D 幾何，不使用 AI 3D 生成器或平面貼圖），
**Blender Cycles** 電影級渲染八個固定視角，並以 **Three.js** 展示 GLB 模型。

## 正式尺寸（已由 `src/validate.py` 自動驗證）

| 項目 | 規格 | 模型實測 |
|---|---|---|
| 主體樓層 | 10 層，每層 5 m | 10 層 × 5.0 m |
| 主體高度（屋頂結構面） | 50 m | 50.0 m |
| 通訊尖塔（自屋頂向上） | 68 m | 68.0 m |
| 地面至尖塔頂總高 | 約 118 m | 118.0 m |
| 主體平面（地面層） | — | 30.3 m × 24.5 m（向上收窄至 22 × 18 m） |

詳細數據：`reports/geometry_report.json`（尺寸、螺旋與立面淨距、螺旋間淨距、BVH 三角面穿插檢查、網格統計）。

## 交付內容

```
projects/future-tech-hq/
├── run_all.py                   一鍵管線（建模 → 驗證 → 存檔 → 匯出 GLB → 八角度渲染）
├── src/
│   ├── config.py                正式尺寸與所有造型參數（修改這裡即可調整建築）
│   ├── meshkit.py               幾何工具：管件、掃掠、稜柱、環形、球、方向盒（外向法線）
│   ├── build_model.py           自動建模腳本（A 主體 / B 外骨骼 / C 屋頂與尖塔 / D 基座）
│   ├── materials.py             材質設定腳本（陶瓷複合、藍灰玻璃、拉絲金屬、鈦合金…）
│   ├── scene_setup.py           燈光、環境、攝影機（八視角定義）、Cycles 與色彩管理
│   ├── render_views.py          八角度渲染＋乾淨中性背景合成
│   ├── export_glb.py            GLB / glTF 匯出
│   └── validate.py              幾何檢查報告
├── blender/future_tech_hq.blend 可編輯 Blender 專案（含 8 台攝影機、燈光、Collection 分層）
├── model/future_tech_hq.glb     GLB 模型（約 8 MB，36 個網格物件）
├── renders/                     八張 1600×2000 渲染圖（PNG 與 JPG）
├── reports/geometry_report.json
└── viewer/index.html            Three.js 3D 展示頁
```

## 模型組件（Blender Collection）

- **A_Main_Building**：十層樓板（內部樓板＋金屬收邊環）、玻璃帷幕（6 cm 實體厚度，大廳層為透明玻璃）、
  70 支垂直窗框（沿周長等弧長分佈）與每 7 支一根的結構柱、樓層中段水平遮陽板、核心筒、屋頂女兒牆。
- **B_Exoskeleton**：4 條白色螺旋外骨骼（2 順時針＋2 逆時針，每條 0.75 圈，截面 2.9 m × 0.8 m 圓角矩形），
  中下段外鼓、頂部收束到屋頂冠環；邊緣金屬飾條；徑向與斜向金屬支撐（自動略過會穿過其他螺旋的支撐）；
  球形節點與錨固板；6 處螺旋交錯點的鈦金屬夾具（交錯處內外層自動分離，避免穿插）；底部固定座。
- **C1_Roof_Crown**：屋頂玻璃圓鼓與金屬框、觀景平台與欄杆、屋頂設備、28 支屋緣小型天線。
- **C2_Spire**：68 m 通訊尖塔 — 底部 4 腳斜撐框架（55.6→68 m）、方形桁架主桿（68→106 m，X 形斜撐＋水平撐）、
  中央垂直主桿、4 層環形平台（欄杆、支撐托架、白色環帶、天線板）、微波碟型天線、頂端偶極天線與航空警示燈、避雷針至 118 m。
- **D_Base**：圓角方形基地鋪面、兩階圓形基座、金屬收邊環與裝飾葉片、8 支斜向落地支撐腳（自動挑選不與螺旋干涉的角度）、
  正面玻璃入口門廳、雨遮與旋轉門。

## 執行方式

### 1. 安裝 Blender（擇一）

**A. pip 安裝 Blender Python 模組（無需 GUI，本專案即以此完成）**
```bash
python3.13 -m venv .venv-blender
```
```bash
.venv-blender/bin/pip install bpy==5.3.0 pillow numpy
```

**B. 完整版 Blender 5.x**（https://www.blender.org/download/ ）— 需另外讓 Blender 內建 Python 可匯入 Pillow：
```bash
blender -b --python-expr "import subprocess,sys; subprocess.check_call([sys.executable,'-m','pip','install','pillow'])"
```

### 2. 執行管線

```bash
cd projects/future-tech-hq
```
完整流程（建模、驗證、存 .blend、匯出 GLB、八張 1600×2000、160 samples 渲染）：
```bash
../../.venv-blender/bin/python run_all.py --samples 160 --res 1600x2000
```
或使用完整版 Blender：
```bash
blender -b -P run_all.py -- --samples 160 --res 1600x2000
```
快速預覽（1/4 解析度、低取樣）：
```bash
../../.venv-blender/bin/python run_all.py --stage build,render --preview
```
只重做模型與檢查，不渲染：
```bash
../../.venv-blender/bin/python run_all.py --stage build,validate,save,export
```
只渲染部分視角：
```bash
../../.venv-blender/bin/python run_all.py --stage build,render --views 01_front,08_low_angle
```

參考耗時（4 核 CPU，無 GPU）：建模＋驗證約 3 秒；每張 1600×2000 / 160 samples 約 6–7 分鐘。
有 NVIDIA/AMD GPU 時可在 `scene_setup.py` 將 `cy.device` 改為 `"GPU"` 並於偏好設定啟用 CUDA/OptiX/HIP。

### 3. Three.js 展示頁

GLB 需經由 HTTP 載入（瀏覽器不允許 `file://` 讀取）：
```bash
cd projects/future-tech-hq && python3 -m http.server 8000
```
開啟 `http://localhost:8000/viewer/index.html`。功能：軌道旋轉/縮放/平移、八個與 Blender 相同的固定視角、
外骨骼/玻璃/尖塔圖層開關、自動旋轉、即時陰影。three.js 0.170.0 由 jsDelivr CDN 載入（需網路）。
亦可用 `?model=路徑` 指定其他 GLB。

## 八個固定視角

| 檔名 | 視角 |
|---|---|
| `01_front` | 正面全景 |
| `02_left_front_45` | 左前方 45° |
| `03_right_front_45` | 右前方 45° |
| `04_left_side` | 左側面 |
| `05_right_side` | 右側面 |
| `06_back` | 正後方 |
| `07_aerial_45` | 高空俯視 45° |
| `08_low_angle` | 低角度仰視（人眼高度 1.6 m、15 mm 廣角） |

八張圖皆來自同一個場景、同一個模型，只切換攝影機；主光（太陽）與攝影機維持固定相對角度（攝影棚式打光），
讓每個立面的光影品質一致。

## 燈光與渲染設定

- Cycles（CPU），adaptive sampling，OpenImageDenoise 降噪，光線反彈 12 / 穿透 10 / 光澤 5，關閉焦散。
- 自然日光：Sun 5.0、角直徑 1.2°（清晰但柔和的陰影）；天空漸層世界光（天頂藍→地平白）提供玻璃與金屬反射。
- 乾淨中性背景：透明底片＋陰影捕捉地面，再與淺灰漸層背景合成，保留真實落地陰影。
- 色彩管理：AgX ＋ 輕度對比/飽和調色（只套用在建築本體）。

## 修改建築

所有尺寸與造型參數都在 `src/config.py`：例如 `RIB_TURNS`（螺旋圈數）、`RIB_BULGE`（外鼓量）、`RIB_WIDTH/RIB_THICK`（截面）、
`N_FINS`（窗框數）、`SPIRE_RINGS`（尖塔環形平台高度/半徑/天線數）。`config.py` 內有斷言保護正式尺寸（50 m / 118 m）。
修改後重跑 `run_all.py`，`validate.py` 會重新檢查尺寸與穿插。

## 已知限制

- 參考圖為概念圖，本模型依確認規格（50 / 68 / 118 m）重建造型語言，非逐像素複製。
- Three.js 展示頁的玻璃改用即時反射材質（不做即時折射），以維持瀏覽器效能；寫實折射效果請看 Cycles 渲染圖。
- 結構柱為沿收窄立面傾斜的實體，柱頂角點比屋頂面高約 4 cm（報告中 `body_roof_level_m = 50.04`），屋頂結構面為 50.0 m。

## 500 m 園區版本（HQ_VARIANT=tower500）

給「未來科技總部大樓」園區頁面使用的版本：10 層、每層 21.2 m（主體 212 m）、通訊尖塔 288 m、總高 500 m，
每層樓地板固定 100 坪（塔身上下等寬，21.6 × 17.3 m 圓角平面）。正式 118 m 版本的參數與產出完全不受影響。

建模與檢查：
```bash
HQ_VARIANT=tower500 ../../.venv-blender/bin/python -c "import sys;sys.path.insert(0,'src');import bpy,build_model,validate;build_model.build();validate.run('variants/tower500/geometry_report.json')"
```
匯出 10 個樓層切片（給園區頁面的 `models/future-hq-500-a/b/c.gltf.json`）：
```bash
HQ_VARIANT=tower500 ../../.venv-blender/bin/python integrations/export_campus_slices.py <輸出資料夾>
```
園區頁面的整合程式：`integrations/hq-swap.js`（每個樓層切片掛在原本的樓層群組下，展開樓層時一起滑出）。

## 800 m 園區版本（HQ_VARIANT=tower800，園區頁面目前使用）

10 層 × 5 m（主體 50 m）、通訊尖塔 750 m、總高 800 m，每層樓地板 100 坪（塔身上下等寬）。
750 m 尖塔重新配置比例：底座框架貼滿屋頂、桁架 14＋72 段、6 層環形平台由 215 m 到 665 m 遞減、5 組微波碟型天線。
```bash
HQ_VARIANT=tower800 ../../.venv-blender/bin/python integrations/export_campus_slices.py <輸出資料夾>
```
輸出 `future-hq-800-a/b/c.gltf.json`；檢查報告在 `variants/tower800/geometry_report.json`，預覽圖 `variants/tower800/preview.png`。

## 500 m／114 層園區版本（HQ_VARIANT=tower114，園區頁面目前使用）

114 層 × 3.5 m（主體 399 m）＋屋頂機房基座 1 m＋通訊尖塔 100 m＝總高 500 m，每層樓地板 100 坪（塔身上下等寬）。
螺旋外骨骼繞 4.25 圈（34 處交錯），外骨骼支撐每 3 層一組；網頁版降低曲面取樣（約 61 萬頂點）。
```bash
HQ_VARIANT=tower114 ../../.venv-blender/bin/python integrations/export_campus_slices.py <輸出資料夾>
```
輸出 `future-hq-114-a/b`（1F–10F 可展開切片）、`-c`（屋頂、尖塔、基座）、`-u0…u4`（11F–114F 固定塔身）。

## 200 m 園區版本（HQ_VARIANT=tower200，園區頁面目前使用）

10 層 × 15 m（主體 150 m）＋通訊尖塔 50 m＝總高 200 m，每層樓地板 100 坪（塔身上下等寬）。
螺旋外骨骼繞 1.4 圈（10 處交錯；1.5 圈會讓順逆兩組螺旋的落地點重疊）。挑高樓層每層 3 道遮陽板、樓層中段加外骨骼支撐。
```bash
HQ_VARIANT=tower200 ../../.venv-blender/bin/python integrations/export_campus_slices.py <輸出資料夾>
```

## 80 m 園區版本（HQ_VARIANT=tower80，園區頁面目前使用）

10 層 × 3 m（主體 30 m）＋通訊尖塔 50 m＝總高 80 m，每層樓地板 100 坪。外骨骼支撐每 2 層一組。
園區頁面選擇樓層時切換成「獨立辦公室畫面」：只留下該層辦公室，其他樓層、屋頂、尖塔、電梯井暫時隱藏，
該層外骨骼與結構柱也收起；離開樓層後整棟恢復（`integrations/hq-swap.js` 的 `isolate()`）。
```bash
HQ_VARIANT=tower80 ../../.venv-blender/bin/python integrations/export_campus_slices.py <輸出資料夾>
```

## 200 m 等比例版本（HQ_VARIANT=tower200p，園區頁面目前使用）

由 80 m 版本（主體 30 m：尖塔 50 m）等比例拉高到 200 m，維持每層 3 m：
主體 25 層 × 3 m = 75 m＋通訊尖塔 125 m＝總高 200 m，每層樓地板 100 坪。螺旋外骨骼繞 1.1 圈。
園區頁面：1F–10F 為可展開的部門樓層（獨立辦公室畫面），11F–25F 合成固定的上部塔身。
```bash
HQ_VARIANT=tower200p ../../.venv-blender/bin/python integrations/export_campus_slices.py <輸出資料夾>
```

## 110 m 園區版本（HQ_VARIANT=tower110，園區頁面目前使用）

10 層 × 3 m（主體 30 m）＋通訊尖塔 80 m＝總高 110 m，每層樓地板 100 坪。
園區頁面的室內（家具、員工、設備）整間等比例縮成 60%（原本依約 5 m 樓層製作），木地板仍鋪滿整層。
```bash
HQ_VARIANT=tower110 ../../.venv-blender/bin/python integrations/export_campus_slices.py <輸出資料夾>
```
