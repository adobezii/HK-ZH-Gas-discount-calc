import { useState } from "react";
import { Link } from "react-router-dom";
import { Controls } from "../components/Controls";
import { DecisionSummary } from "../components/DecisionSummary";
import { StationDetailSheet } from "../components/StationDetailSheet";
import { StationMatrix } from "../components/StationMatrix";
import type { StationId } from "../types";
import type { DashboardModel } from "../useDashboard";

interface Props {
  model: DashboardModel;
}

export default function ClassicPage({ model }: Props) {
  const [selected, setSelected] = useState<StationId | null>(null);
  const quotes = model.quotes.filter(
    (quote) => quote.stationId === "hk-caltex" || quote.stationId === "gd-shell",
  );
  const best = quotes.reduce((winner, quote) =>
    quote.totalHkd < winner.totalHkd ? quote : winner,
  );
  const selectedQuote = quotes.find((quote) => quote.stationId === selected);

  return (
    <div className="page">
      <header className="page-heading">
        <div>
          <div className="eyebrow">Classic comparison</div>
          <h1>香港加德士 × 廣東 Shell</h1>
          <p className="lede">
            保留經典兩站跨境比較；城市、油量與匯率跟首頁共用。
          </p>
        </div>
        <Link className="button subtle pressable" to="/">
          返回六站
        </Link>
      </header>

      <Controls model={model} />
      <DecisionSummary
        best={best}
        quotes={quotes}
        config={model.config}
      />
      <StationMatrix quotes={quotes} onSelect={setSelected} />

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
