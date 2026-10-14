# 粵港油價即時對比計算器

**HK × ZH Gas Discount Calc** — 香港 Shell × 香港加德士 × 珠海 Shell 三欄實時比價

首頁（`index.html`）為三欄比價器：**香港 Shell**（GO+ 日別神券）、**香港加德士**（私人能源卡＋油券拆單，算法對齊 [hkg-deadline/caltex-discount-calc](https://github.com/hkg-deadline/caltex-discount-calc)）、**珠海 Shell**（只比 98#）並列比較，內建自動抓價、即時匯率、手機觸控優化與易讀度設計。

| 版本 | 檔案 | 說明 |
|---|---|---|
| Web 版（首頁，推薦） | `index.html` | v2.0 三欄比價器；單檔靜態頁，直接開瀏覽器或上載 GitHub Pages |
| Web 版（經典） | `classic.html` | 舊版「加德士券後價 × 延長殼牌 98#」跨境比價頁，保留備用 |
| Python 版 | `fuel_calc.py` | Streamlit 互動計算器，邏輯封裝於 `caltex_core.py` |
| 相容連結 | `v2.html` | 已轉址至首頁 |

## 功能

- **加德士折扣計數機**：私人能源卡（黃金減 $11 / 白金減 $12）+ 油券（入滿 $350 減 $50 等）疊加，輸出每張券需入升數、免費升數、實付金額與券後每升實付。
- **跨境比價**：內地延長殼牌 V-Power 98# 原價 × 日期優惠 × 匯率，攤分來回橋費，計算每升與一箱節省金額、專程北上回本門檻。
- **日期優惠自動套用**：逢 8 號（-¥2.18）與逢週三/六（-¥1.28），兩者不疊加、自動取較大折扣；金額可依當月海報修改。
- **香港油價模式**：香港面板可切換「加德士券後價（拆單計算）」或「手動輸入每升實付」（例如消委會折後價），並以此作為比價基準。
- **三欄比價（首頁 `index.html`）**：香港 Shell（GO+ 日別神券與積分）／香港加德士（私人能源卡＋油券拆單）／珠海 Shell（98#）並列比價，支援接口盒子／ShowAPI／起零數據／RollToolsApi 與汽油价格网自動抓價、即時匯率，並已套用手機觸控與縮放優化。
- **車輛加油量預設**：亮燈後參考值 — 大霸王 65L、BMW M5 (F10) 70L、BMW 640i (F06) 60L。
- **易讀度設計**：數值統一 tabular numerals 與千分位；三欄各有顏色識別條（Shell 黃／加德士 紅／珠海 綠）；說明字級下限 11px 並提高對比；進階設定（信用卡回贈、目標、優惠規則金額）以「進階設定」收合，預設畫面只留必要欄位。
- **手機底部摘要條**：手機滑動時固定顯示三個方案的每升單價與最抵方案。
- **淺色主題**：右上角可切換深色／淺色（選擇記憶於瀏覽器）。
- **分享／列印**：「分享／列印目前結果」可複製純文字摘要（含各方案單價、總額、最抵與可省金額），或直接列印／存成 PDF（列印時自動隱藏操作介面）。
- **長註解收合**：加德士門檻與券值說明、資料來源與憑證說明改為「?」點開，減少預設雜訊。
- **珠海 Shell 日期優惠**：逢週三／六 −¥0.98、逢 8／18／28 號 −¥1.88，不疊加取較大，可選加油日期自動套用。
- **過境路費**：固定 **¥142.5 × 2（來回）＝¥285**，以 tick box 控制「有／沒有」；勾選時依即時匯率換算成 HK$ 計入珠海總額與贏家比較。
- **珠海 Shell 不設滿額券**：只有每升立減（日期優惠）與過境路費，計算為 `(掛牌價 − 每升立減) × 升數`。
- **只比較 98#**：珠海欄位僅 98# 汽油，不再提供 95#。
- **打和升數**：自動計算「抵消過境路費所需最少升數」＝ 路費(HK$) ÷ (香港最佳每升 − 珠海每升)，並標示目前升數是否已打和。
- **目標金額／券數**：香港 Shell 與加德士兩欄可自訂目標，模式為「按升數／按油錶價 (HK$)／按折實價 (HK$)」；加德士另有「按優惠券張數」。換算後會更新共用的入油升數，讓三欄維持同一升數比較；每欄下方即時顯示對應的「升數／油錶價／折實價／券數」。
- **即時資料自動抓取**：香港牌價／折扣卡／油券、CNY→HKD 匯率；抓取失敗時自動回退內置備用值，離線亦可用。

## 快速開始

### Web 版

直接用瀏覽器開啟 `index.html` 即可，無需編譯或伺服器。

若要部署到 GitHub Pages：將本目錄上載後，於儲存庫設定 Pages 指向根目錄即可。

### Python（Streamlit）版

```bash
pip install streamlit
streamlit run fuel_calc.py
```

### 執行測試

```bash
python3 test_caltex_core.py
# 或使用 pytest：python3 -m pytest test_caltex_core.py -q
```

## 檔案結構

```
HK-ZH-Gas-discount-calc/
├── index.html           # 首頁：v2.0 三欄比價（Shell GO+ 神券／加德士卡券拆單／珠海 Shell，內建自動抓價）
├── classic.html         # 經典版：加德士券後價 × 延長殼牌 98# 跨境比價（保留備用）
├── v2.html              # 相容轉址頁（→ 首頁）
├── caltex_core.py       # 核心算法（Python，無第三方依賴）
├── fuel_calc.py         # Streamlit 互動介面
├── test_caltex_core.py  # 單元測試
├── scripts/
│   └── update_cn_price.py   # 抓取內地 98# 油價快照（供 GitHub Actions 執行）
├── data/cn98.json       # 內地 98# 油價每日快照（自動更新）
├── .github/workflows/update-prices.yml  # 每日 06:00（HKT）自動更新快照
├── README.md
├── LICENSE              # GPL-3.0
└── js/                  # 原版 caltex-discount-calc 遺留檔案（Web 版已不引用）
```

## 核心算法

`caltex_core.calc_caltex_effective_price` 忠實移植原版 `js/main.js`：

```text
discountedPrice = listPrice - cardDiscount          # 折扣後單價
totalLiters     = spend / listPrice                 # 達門檻需入升數（按牌價）
paidLiters      = (spend - couponValue) / listPrice # 實際付費升數
freeLiters      = totalLiters - paidLiters          # 油券抵銷升數
amountPaid      = paidLiters * discountedPrice      # 實際付款
actualPrice     = amountPaid / totalLiters          # 券後每升實付
```

**基準案例**：牌價 $33.17、私人能源卡減 $11、油券「滿 $350 減 $50」→ 每張券入 10.552 L、實付 $200.51、**券後每升 $19.00**。

跨境比價：

```text
內地折後純油價(HKD) = (原價 - 立減) × 匯率
含橋費單價          = 內地折後純油價(HKD) + 橋費 / 加油容量
一箱節省            = (香港基準單價 - 含橋費單價) × 加油容量
回本門檻            = 橋費 / (香港基準單價 - 內地折後純油價HKD)
```

## 資料來源

| 資料 | 來源 | 備註 |
|---|---|---|
| 香港牌價／折扣卡／油券 | [hk-petrol-price-crawler](https://github.com/hkg-deadline/hk-petrol-price-crawler)（data.gov.hk 開放數據） | 消委會「油價資訊通」衍生資料 |
| 匯率 CNY→HKD | [fawazahmed0 currency-api](https://github.com/fawazahmed0/exchange-api)（jsDelivr CDN／Cloudflare 鏡像） | 免 API Key、無限次；主線來源 |
| 匯率 CNY→HKD（備援） | [exchangerate.fun](https://exchangerate.fun)、open.er-api.com | 前兩者失敗時回退 |
| 內地 98# 油價（推薦） | 接口盒子 全國油價（`cn.apihz.cn`，id + key 認證） | 需自行申請 id/key；`Access-Control-Allow-Origin: *`，Web 版可直接呼叫 |
| 內地 98# 油價 | ShowAPI 今日油價（`ali-todayoil.showapi.com`，APPCODE 認證） | 需自行申請 APPCODE；允許 CORS |
| 內地 98# 油價 | 起零數據全國油價 V2（`api.istero.com`，token 認證） | 需自行申請 token |
| 內地 98# 油價 | RollToolsApi 全國油價（`www.mxnzp.com/api/oil/search`） | 需自行申請 app_id／app_secret；允許 CORS |
| 內地 98# 油價（**預設，免憑證**） | 汽油价格网（`www.qiyoujiage.com`） | 免註冊、免 Key；優先讀 `data/cn98.json` 每日快照（GitHub Actions 產生），快照未涵蓋城市才經 `r.jina.ai` 即時查詢 |
| 香港折後價（手動） | 消委會「油價資訊通」 | 無公開 API，供手動輸入參考 |

> 內地油價 API 的 APPCODE／token 由使用者自行申請填入，本專案不內置任何憑證；留空則手動輸入。

## 兩套優惠活動的分工（重要）

本專案同時存在兩套不同油站的活動規則，屬**刻意區分**，不是不一致：

| 介面 | 油站／活動 | 日期規則 |
|---|---|---|
| `index.html`（首頁，網頁版） | 珠海 Shell 98# | 逢 **8／18／28 號** −¥1.88；逢**週三／六** −¥0.98（不疊加取較大） |
| `classic.html` 與 `caltex_core` / `fuel_calc.py`（經典版） | 內地**延長殼牌** | 逢 **8 號** −¥2.18；逢**週三／六** −¥1.28（不疊加取較大） |

兩邊的預設金額與適用日子本來就不同；改動其中一邊時請勿假設另一邊同步。

## 優惠規則（已確認）

- 來回橋費 **HK$340**（港珠澳大橋私家車單程 ¥150、來回 ¥300 換算）；順路北上時橋費歸零。
- **不計算**時間與車輛損耗成本。
- 內地 V-Power 98 與香港加德士 98 視為**同級**，僅以每升單價比較。
- 週三/六優惠與 8 號優惠**不疊加**，同時命中時取較大折扣。
- 8 號立減預設 -¥2.18、週三/六預設 -¥1.28，實際金額請依延長殼牌當月海報調整。
- **珠海 Shell 98#**（v2.0 頁）：逢週三／六立減 **-¥0.98/L**、逢每月 **8／18／28 號**立減 **-¥1.88/L**；兩者不疊加、取較大，金額可在珠海欄位調整，並可選加油日期自動套用。

## 授權與致謝

- 本專案採 **GPL-3.0** 授權（沿用上游專案授權）。
- 加德士折扣算法移植自 [hkg-deadline/caltex-discount-calc](https://github.com/hkg-deadline/caltex-discount-calc)（GPL-3.0）。
- 香港油價資料來自 [hk-petrol-price-crawler](https://github.com/hkg-deadline/hk-petrol-price-crawler) 與 [data.gov.hk](https://data.gov.hk)。

## 注意事項

- 油價與優惠變動頻繁，計算結果僅供參考，實際價格以油站為準。
- 內地油價 API 約每 10 個工作天（調價週期）更新，非即時跳動。
- 消委會「油價資訊通」為 Next.js 前端渲染、有反爬機制，故香港折後價採手動輸入。
