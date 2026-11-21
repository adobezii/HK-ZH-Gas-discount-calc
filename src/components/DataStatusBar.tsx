import { citySnapshot } from "../data";
import { CITY_LABELS } from "../types";
import type { DashboardModel } from "../useDashboard";

interface Props {
  model: DashboardModel;
}

function scopeLabel(scope: string | undefined) {
  switch (scope) {
    case "city":
      return "城市快照";
    case "province":
      return "廣東全省 API";
    case "manual":
      return "手動價格";
    case "fallback":
      return "備用價";
    case "live":
      return "香港公開即時價";
    default:
      return "未標示";
  }
}

export function DataStatusBar({ model }: Props) {
  const hkTime = model.live.updatedAt
    ? new Date(model.live.updatedAt).toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong" })
    : null;
  const snapshotChecked = citySnapshot.checked_at ? new Date(citySnapshot.checked_at).toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong" }) : "未記錄";
  const gdQuotes = model.quotes.filter((quote) => quote.cityMode);
  const scopeSet = [...new Set(gdQuotes.map((quote) => quote.priceScope))];
  const scopeText =
    scopeSet.length === 1
      ? scopeLabel(scopeSet[0])
      : gdQuotes
          .map((quote) => `${quote.shortName}：${scopeLabel(quote.priceScope)}`)
          .join(" · ");
  const cityText = model.config.globalCity
    ? CITY_LABELS[model.config.globalCity]
    : "珠海";

  return (
    <section className="data-status-bar" aria-label="資料狀態" aria-live="polite">
      <span className="data-status-chip">
        香港最近查價 {model.live.loaded ? hkTime : "未成功，使用備用價"}{model.status === "error" && model.live.loaded ? "（本次失敗）" : ""}
      </span>
      <span className="data-status-chip">
        城市快照資料日期 {citySnapshot.updated_hkt}
      </span>
      <span className="data-status-chip">城市最近查價 {snapshotChecked}</span>
      <span className="data-status-chip">匯率 {model.config.fxMode === "manual" ? "手動" : model.fxAsOf ? model.fxAsOf.slice(0, 10) : "備用／上次數值"}</span>
      <span className="data-status-chip">全域城市 {cityText}</span>
      <span className="data-status-chip">大陸資料 {scopeText}</span>
      <span className="data-status-chip">
        日期校準 {model.config.dateMode === "auto" ? "自動今日" : "手動指定"}
      </span>
    </section>
  );
}
