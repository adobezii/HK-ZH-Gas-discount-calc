import { CITY_LABELS, type QuoteResult } from "../types";

interface Props {
  quotes: QuoteResult[];
  onSelect: (stationId: QuoteResult["stationId"]) => void;
}

export function StationMatrix({ quotes, onSelect }: Props) {
  const winner = quotes.reduce((best, quote) =>
    quote.totalHkd < best.totalHkd ? quote : best,
  );

  return (
    <section className="matrix" aria-label="六站比價結果">
      {quotes.map((quote) => (
        <article
          key={quote.stationId}
          className={`panel station-card${quote.isWinner ? " winner" : ""}`}
          style={{ "--station-accent": quote.accent } as React.CSSProperties}
        >
          <div className="station-card-head">
            <div>
              <h2>{quote.name}</h2>
              <p>
                {quote.city ? `${CITY_LABELS[quote.city]} · ` : ""}
                {quote.sourceLabel}
              </p>
            </div>
            {quote.isWinner ? <span className="badge winner">最低</span> : null}
          </div>

          <div className="station-numbers">
            <div className="unit-price">
              HK${quote.unitPriceHkd.toFixed(2)}
              <small> / L</small>
            </div>
            <div className="delta">
              {quote.isWinner
                ? "全場最低"
                : `+HK$${(quote.totalHkd - winner.totalHkd).toFixed(2)}`}
            </div>
          </div>

          <div className="details-grid">
            <div className="detail-row">
              <span>本次總額</span>
              <strong>HK${quote.totalHkd.toFixed(2)}</strong>
            </div>
            <div className="detail-row">
              <span>相對牌價節省</span>
              <strong>HK${Math.max(0, quote.savingHkd).toFixed(2)}</strong>
            </div>
          </div>

          <div className="station-footer">
            <span className="source-chip" title={quote.sourceLabel}>
              {quote.sourceLabel}
            </span>
            <button
              className="button subtle pressable"
              type="button"
              onClick={() => onSelect(quote.stationId)}
            >
              詳情
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
