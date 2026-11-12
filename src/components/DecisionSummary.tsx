import type { DashboardConfig, QuoteResult } from "../types";

interface Props {
  best: QuoteResult;
  quotes: QuoteResult[];
  config: DashboardConfig;
}

export function DecisionSummary({ best, quotes, config }: Props) {
  const second = quotes
    .filter((quote) => quote.stationId !== best.stationId)
    .sort((a, b) => a.totalHkd - b.totalHkd)[0];
  const gap = second ? second.totalHkd - best.totalHkd : 0;

  return (
    <section className="panel decision" aria-live="polite">
      <div>
        <div className="eyebrow">當前最抵</div>
        <div className="decision-winner">{best.name}</div>
        <p className="decision-sub">
          {config.liters.toFixed(1)}L 共 HK${best.totalHkd.toFixed(2)}
          {second ? `，比次選低 HK$${gap.toFixed(2)}` : ""}
        </p>
      </div>
      <div>
        <div className="metric-label">每升實付</div>
        <div className="metric-value">HK${best.unitPriceHkd.toFixed(2)}/L</div>
      </div>
      <div>
        <div className="metric-label">全場總額</div>
        <div className="metric-value">HK${best.totalHkd.toFixed(2)}</div>
      </div>
      <div>
        <div className="metric-label">匯率／路費</div>
        <div className="metric-value">
          1¥ = {config.fx.toFixed(4)}
        </div>
      </div>
    </section>
  );
}
