# 粵港油價即時對比計算器

**HK × ZH Gas Discount Calc** — 香港加德士拆單券後價 × 內地延長殼牌 98# 跨境比價

本專案以 [hkg-deadline/caltex-discount-calc](https://github.com/hkg-deadline/caltex-discount-calc) 的加德士折扣算法為核心，擴充為「粵港兩地油價即時對比」互動頁面：自動計算加德士拆單券後實付、內地 98# 折後價、即時匯率、橋費攤分與回本門檻。

提供兩種使用方式：

| 版本 | 檔案 | 說明 |
|---|---|---|
| Web 版（推薦） | `index.html` | 單檔靜態頁，直接開瀏覽器或上載 GitHub Pages |
| Python 版 | `fuel_calc.py` | Streamlit 互動計算器，邏輯封裝於 `caltex_core.py` |

## 功能

- **加德士折扣計數機**：私人能源卡（黃金減 $11 / 白金減 $12）+ 油券（入滿 $350 減 $50 等）疊加，輸出每張券需入升數、免費升數、實付金額與券後每升實付。
- **跨境比價**：內地延長殼牌 V-Power 98# 原價 × 日期優惠 × 匯率，攤分來回橋費，計算每升與一箱節省金額、專程北上回本門檻。
- **日期優惠自動套用**：逢 8 號（-¥2.18）與逢週三/六（-¥1.28），兩者不疊加、自動取較大折扣；金額可依當月海報修改。
- **香港油價模式**：香港面板可切換「加德士券後價（拆單計算）」或「手動輸入每升實付」（例如消委會折後價），並以此作為比價基準。
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
├── index.html           # 單檔 Web 版（加德士計算機 + 跨境比價）
├── caltex_core.py       # 核心算法（Python，無第三方依賴）
├── fuel_calc.py         # Streamlit 互動介面
├── test_caltex_core.py  # 單元測試
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
| 匯率 CNY→HKD | [exchangerate.fun](https://exchangerate.fun)、open.er-api.com | 免費、免 API Key；失敗回退內置值 |
| 內地 98# 油價（預設） | ShowAPI 今日油價（`ali-todayoil.showapi.com`，APPCODE 認證） | 需自行申請 APPCODE；允許 CORS，Web 版可直接呼叫 |
| 內地 98# 油價（備選） | 起零數據全國油價 V2（`api.istero.com`，token 認證） | 需自行申請 token |
| 香港折後價（手動） | 消委會「油價資訊通」 | 無公開 API，供手動輸入參考 |

> 內地油價 API 的 APPCODE／token 由使用者自行申請填入，本專案不內置任何憑證；留空則手動輸入。

## 優惠規則（已確認）

- 來回橋費 **HK$340**（港珠澳大橋私家車單程 ¥150、來回 ¥300 換算）；順路北上時橋費歸零。
- **不計算**時間與車輛損耗成本。
- 內地 V-Power 98 與香港加德士 98 視為**同級**，僅以每升單價比較。
- 週三/六優惠與 8 號優惠**不疊加**，同時命中時取較大折扣。
- 8 號立減預設 -¥2.18、週三/六預設 -¥1.28，實際金額請依延長殼牌當月海報調整。

## 授權與致謝

- 本專案採 **GPL-3.0** 授權（沿用上游專案授權）。
- 加德士折扣算法移植自 [hkg-deadline/caltex-discount-calc](https://github.com/hkg-deadline/caltex-discount-calc)（GPL-3.0）。
- 香港油價資料來自 [hk-petrol-price-crawler](https://github.com/hkg-deadline/hk-petrol-price-crawler) 與 [data.gov.hk](https://data.gov.hk)。

## 注意事項

- 油價與優惠變動頻繁，計算結果僅供參考，實際價格以油站為準。
- 內地油價 API 約每 10 個工作天（調價週期）更新，非即時跳動。
- 消委會「油價資訊通」為 Next.js 前端渲染、有反爬機制，故香港折後價採手動輸入。
