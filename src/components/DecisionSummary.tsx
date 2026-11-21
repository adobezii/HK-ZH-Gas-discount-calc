import type { DashboardConfig, QuoteResult } from "../types";

interface Props {
  best: QuoteResult;
  quotes: QuoteResult[];
  config: DashboardConfig;
  breakEven?: number | null;
}

export function DecisionSummary({ best, quotes, config, breakEven }: Props) {
  const second = quotes
    .filter((quote) => quote.stationId !== best.stationId)
    .sort((a, b) => a.totalHkd - b.totalHkd)[0];
  const gap = second ? second.totalHkd - best.totalHkd : 0;
  const tollStatus = config.gdShell.includeToll ? "來回 ¥285" : "未計路費";

  return (
    <section className="panel decision" aria-live="polite">
      <div>
        <div className="eyebrow">當前最抵</div>
        <div className="decision-winner">{best.name}</div>
        <p className="decision-sub">
          {config.liters.toFixed(2)}L 共 HK${best.totalHkd.toFixed(2)}
          {second?.isWinner ? "，與次選同價" : second ? `，比次選低 HK$${gap.toFixed(2)}` : ""}
        </p>
      </div>
      <div>
        <div className="metric-label">每升實付</div>
        <div className="metric-value">HK${best.unitPriceHkd.toFixed(2)}/L</div>
      </div>
      <div>
        <div className="metric-label">即場實付總額</div>
        <div className="metric-value">HK${best.totalHkd.toFixed(2)}</div>
      </div>
      <div>
        <div className="metric-label">匯率</div>
        <div className="metric-value">
          1¥ = {config.fx.toFixed(4)}
        </div>
      </div>
      <div className="decision-toll">
        <div className="metric-label">路費設定</div>
        <div className="metric-value">{tollStatus}</div>
      </div>
      {breakEven !== undefined ? <div className="decision-toll">
        <div className="metric-label">北上首次打和 · 對比香港最抵</div>
        <div className="metric-value">{breakEven === null ? "100 L 內未打和" : `${breakEven.toFixed(2)} L`}</div>
      </div> : null}
    </section>
  );
}
