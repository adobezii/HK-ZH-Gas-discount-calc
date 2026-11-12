import { CITY_LABELS } from "../types";
import type { DashboardModel } from "../useDashboard";

interface Props {
  model: DashboardModel;
}

export function SharePanel({ model }: Props) {
  const { config, quotes, best } = model;
  const lines = [
    `【粵港六站油價比價】${config.date}`,
    `入油 ${config.liters.toFixed(2)}L｜1¥ = HK$${config.fx.toFixed(4)}｜全域城市 ${CITY_LABELS[config.globalCity]}`,
    "",
    ...quotes.flatMap((quote) => [
      `■ ${quote.name}${quote.city ? `（${CITY_LABELS[quote.city]}）` : ""}`,
      `　HK$${quote.unitPriceHkd.toFixed(2)}/L｜總額 HK$${quote.totalHkd.toFixed(2)}｜${quote.sourceLabel}`,
    ]),
    "",
    `★ 全場最抵：${best.name}｜HK$${best.unitPriceHkd.toFixed(2)}/L｜總額 HK$${best.totalHkd.toFixed(2)}`,
    "",
    "價格及優惠只供參考，以油站實際交易為準。",
  ];
  const summary = lines.join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(summary);
    } catch {
      // 瀏覽器拒絕剪貼簿時，使用者仍可手動選取摘要。
    }
  }

  return (
    <details className="panel share-panel">
      <summary>分享／列印目前結果</summary>
      <div className="inline-actions" style={{ marginTop: "0.7rem" }}>
        <button className="button subtle pressable" type="button" onClick={copy}>
          複製摘要
        </button>
        <button
          className="button subtle pressable"
          type="button"
          onClick={() => window.print()}
        >
          列印／PDF
        </button>
      </div>
      <pre className="summary-text">{summary}</pre>
    </details>
  );
}
