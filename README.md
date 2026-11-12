# 粵港六站油價及油卡比價器

香港 Shell、加德士、中石油、中石化與廣東 Shell、中石化六站並列比較。React 版採精準數據台設計，使用同一油量、匯率、日期及過境成本計算每升實付、總額、節省及全場最抵方案。

## 版本

| 入口 | 技術 | 說明 |
| --- | --- | --- |
| `/` | React + Vite + TypeScript | 六站完整比較，桌面、平板及手機響應式 |
| `/classic` | React | 香港加德士 × 廣東 Shell 經典比較 |
| `fuel_calc.py` | Streamlit + Python | 六站功能對齊的獨立版本 |
| `classic.html` | 靜態轉址 | 舊網址轉往 `/?view=classic` |
| `legacy/` | 靜態封存 | 重構前六站及經典版，保留回滾 |

## 快速開始

### React

```bash
pnpm install
pnpm dev
```

Production build：

```bash
pnpm build
pnpm preview
```

### Streamlit

```bash
uv venv .venv
uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/streamlit run fuel_calc.py
```

### 測試

```bash
pnpm typecheck
pnpm test
pnpm test:e2e
.venv/bin/python -m pytest -q
```

## 城市規則

- 支援城市固定為 **珠海、深圳、廣州**。
- 全域城市預設 **珠海**。
- 珠海 Shell 與廣東中石化預設跟隨全域城市。
- 任一廣東方案都可切換成個別覆寫城市。
- 已覆寫方案不會因全域城市改變而被重設；詳情面板提供「恢復跟隨全域」。
- 汽油价格网每日快照提供城市級價格。
- 接口盒子、ShowAPI、起零數據及 RollToolsApi 只提供省級資料時，明確標示「廣東全省」，不冒充城市價格。
- 省級 API 價格套用時會成為兩個廣東方案的手動價，城市切換不會改變該省級結果。

## 響應式與資料狀態

- 電腦版顯示「電腦版 · 六站總覽」，六站固定在 3×2 摘要矩陣；詳情使用置中對話框。
- 手機版顯示「手機版 · 最抵三強」，詳情使用可拖拽底部抽屜，並只在滾動後顯示固定摘要。
- 手機預設只顯示按總額排序的最抵三站；可用 `aria-expanded` 按鈕展開其餘三站。
- 同價時依固定站點順序排列，避免每次 render 名次跳動。
- 每張廣東卡片直接顯示「跟隨全域／已自訂」、城市模式及價格範圍：城市快照、廣東全省 API、手動價或備用價。
- 香港價更新時間、城市快照日期、全域城市及大陸資料範圍永久顯示於頁面上方。
- 底部固定摘要只在頁面滾動後出現，詳情抽屜開啟時隱藏；每升及總額完整顯示兩位小數。
- 「相對牌價節省」不包含路費；零折扣顯示「牌價無折扣」。
- 日期預設「自動今日」，以香港時區計算；跨午夜、回到前景或手動改日期時，會重算 Shell、中石油、香港中石化及廣東 Shell 的日期優惠。
- 改日期會清除上一個日期的手動折扣覆寫，恢復由當日規則自動計算；需要指定日期時可取消「自動今日」。

## 六站規則

### 香港 Shell

- V-Power／FuelSave 牌價由香港公開油價資料更新。
- 可選擇平日、星期三、週末優惠。
- 可選 GO+ 積分、滿額券及信用卡回贈。

### 香港加德士

- 私人能源卡折扣＋油券拆單。
- 按實際油量計算可用券數、每張券覆蓋升數及餘量按卡價。
- 可選手動牌價及信用卡回贈。

### 香港中石油

- 只計純直減，不計積分及免費升級。
- 一／二／四及星期三按官方日期規則計算。
- 週末純直減未公開時留待手動覆寫。
- 可標示是否符合折實滿 HK$300。

### 香港中石化

- 可切換中石化超級汽油／中石化汽油。
- 按一／四、二／五、三、六／日套用 X CARD／APP 純直減。
- 積分價值預設關閉，開啟後才使用官方連積分最高值。
- 已標示會員條件、不適用油站及星期一滿 25L 電子券限制。

### 廣東 Shell

- 98# 城市牌價由 `data/cn98.json` 更新或手動輸入。
- 8／18／28 日及週三／六優惠不疊加，取較大值。
- 過境路費可獨立啟用。

### 廣東中石化愛跑98

- 每升立減 ¥2，可按實際方案修改。
- 可選 1 年卡 ¥388 或 2 年卡 ¥588。
- 自動顯示回本升數（1 年卡 194L、2 年卡 294L）。
- 卡費不計入單次加油總額。
- 過境路費與珠海 Shell 完全獨立，預設不計。

## 資料來源

| 資料 | 來源 |
| --- | --- |
| 香港牌價／加德士卡券 | [hk-petrol-price-crawler](https://github.com/hkg-deadline/hk-petrol-price-crawler) |
| 匯率 | fawazahmed0 currency-api、exchangerate.fun、open.er-api.com |
| 廣東城市 98# | 汽油价格网每日快照 `data/cn98.json` |
| 省級 API | 接口盒子、ShowAPI、起零數據、RollToolsApi |
| 優惠參數 | `data/promotions.json`，React 與 Python 共用 |

API 憑證只保留在目前頁面或 Streamlit session，不寫入 localStorage，也不提交到 repository。

## 專案結構

```text
src/
├── App.tsx
├── calc.ts                  # React／TypeScript 共用計算
├── data.ts
├── livePrices.ts
├── mainland.ts
├── physics.ts
├── components/
└── pages/
data/
├── cn98.json                # 城市油價快照
└── promotions.json          # 六站優惠與費用
gas_dashboard.py             # Python 共用六站計算
fuel_calc.py                 # Streamlit UI
legacy/                      # 重構前靜態版
```

## 部署

GitHub Pages 由 `.github/workflows/deploy-pages.yml` 執行：

1. pnpm frozen install
2. TypeScript typecheck
3. Vitest
4. Vite production build
5. 上載 `dist` 並部署 Pages

Vite base path 固定為 `/HK-ZH-Gas-discount-calc/`。GitHub Pages 的 SPA 路由由 `public/404.html` fallback 回應用程式入口。

## 無障礙與互動

- 主要頁面屬 C 類高密讀數介面，使用系統字體、等寬數字及穩定欄位。
- 所有控制有可見 focus ring 及至少 44px 觸控高度。
- 詳情抽屜提供 dialog 語意、焦點鎖定、Escape 關閉及背景內容障礙。
- 抽屜只使用臨界阻尼收合、1:1 拖拽及 `pointerdown` 中斷；事件內即時讀取 `prefers-reduced-motion`。
- 支援 `prefers-reduced-motion`、`prefers-reduced-transparency` 及 `prefers-contrast`。

## 技能

`apple-web-craftsmanship` 已安裝於：

- Codex：`~/.codex/skills/apple-web-craftsmanship`
- Comate：`~/.comate/skills/apple-web-craftsmanship`

此站依技能判定為 C 類，未在資料區加入裝飾性彈跳、動量投射或盤古之白。
