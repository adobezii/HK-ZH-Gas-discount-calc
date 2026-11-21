import { useState } from "react";
import { Link } from "react-router-dom";
import { Controls } from "../components/Controls";
import { DataStatusBar } from "../components/DataStatusBar";
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
    <div className="page dashboard-page">
      <header className="page-heading">
        <div>
          <div className="eyebrow">香港 × {CITY_LABELS[model.config.globalCity]}</div>
          <h1>粵港三站油價比價</h1>
        </div>
        <div className="inline-actions">
          <Link className="button subtle pressable" to="/classic">
            經典比較
          </Link>
        </div>
      </header>

      <Controls model={model} />
      <DataStatusBar model={model} />
      <DecisionSummary
        best={model.best}
        quotes={model.quotes}
        config={model.config}
        breakEven={model.breakEven}
      />
      <StationMatrix quotes={model.quotes} onSelect={setSelected} />
      <SourcePanel model={model} />
      <SharePanel model={model} />

      {!selectedQuote ? (
        <div className="sticky-summary" aria-label="每升即場實付摘要">
          {model.quotes.map((quote) => <div key={quote.stationId} className={quote.isWinner ? "sticky-summary-winner" : undefined}>
            <span>{quote.shortName}{quote.isWinner ? " · 最抵" : ""}</span>
            <strong>HK${quote.unitPriceHkd.toFixed(2)}/L</strong>
          </div>)}
        </div>
      ) : null}

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
