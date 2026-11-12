import { useState } from "react";
import { Link } from "react-router-dom";
import { Controls } from "../components/Controls";
import { DecisionSummary } from "../components/DecisionSummary";
import { SharePanel } from "../components/SharePanel";
import { SourcePanel } from "../components/SourcePanel";
import { StationDetailSheet } from "../components/StationDetailSheet";
import { StationMatrix } from "../components/StationMatrix";
import { CITY_LABELS, type StationId } from "../types";
import type { DashboardModel } from "../useDashboard";

interface Props {
  model: DashboardModel;
}

export function DashboardPage({ model }: Props) {
  const [selected, setSelected] = useState<StationId | null>(null);
  const selectedQuote = model.quotes.find((quote) => quote.stationId === selected);

  return (
    <div className="page">
      <header className="page-heading">
        <div>
          <div className="eyebrow">Precision fuel dashboard</div>
          <h1>粵港六站油價及油卡比價</h1>
          <p className="lede">
            香港四站與廣東兩站按同一油量、匯率、日期及行程成本比較。預設城市為
            {CITY_LABELS[model.config.globalCity]}。
          </p>
        </div>
        <div className="inline-actions">
          <span className="badge">v3 · React</span>
          <Link className="button subtle pressable" to="/classic">
            經典比較
          </Link>
        </div>
      </header>

      <Controls model={model} />
      <DecisionSummary
        best={model.best}
        quotes={model.quotes}
        config={model.config}
      />
      <StationMatrix quotes={model.quotes} onSelect={setSelected} />
      <SourcePanel model={model} />
      <SharePanel model={model} />

      <div className="sticky-summary" aria-live="polite">
        <div>
          <div className="metric-label">全場最抵</div>
          <strong>{model.best.name}</strong>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="metric-label">每升／總額</div>
          <strong>
            HK${model.best.unitPriceHkd.toFixed(2)} · HK$
            {model.best.totalHkd.toFixed(0)}
          </strong>
        </div>
      </div>

      {selectedQuote ? (
        <StationDetailSheet
          quote={selectedQuote}
          config={model.config}
          setConfig={model.setConfig}
          live={model.live}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
