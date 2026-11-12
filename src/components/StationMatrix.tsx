import { useEffect, useState } from "react";
import { sortQuotesByPrice } from "../calc";
import { CITY_LABELS, type QuoteResult } from "../types";

interface Props {
  quotes: QuoteResult[];
  onSelect: (stationId: QuoteResult["stationId"]) => void;
}

export function visibleQuotes(
  quotes: QuoteResult[],
  mobile: boolean,
  expanded: boolean,
) {
  if (!mobile) return quotes;
  const ranked = sortQuotesByPrice(quotes);
  return expanded ? ranked : ranked.slice(0, 3);
}

function useMobileLayout() {
  const [mobile, setMobile] = useState(
    () => window.matchMedia("(max-width: 700px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return mobile;
}

function sourceBadge(quote: QuoteResult) {
  switch (quote.priceScope) {
    case "city":
      return "城市快照";
    case "province":
      return "廣東全省 API";
    case "manual":
      return "手動價格";
    case "fallback":
      return "備用價";
    case "live":
      return "香港公開價";
  }
}

function sourceTime(quote: QuoteResult) {
  if (!quote.sourceUpdatedAt) return "";
  if (quote.priceScope === "live") {
    return `更新 ${new Date(quote.sourceUpdatedAt).toLocaleTimeString("zh-HK", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }
  if (quote.priceScope === "city") {
    return `快照 ${quote.sourceUpdatedAt}`;
  }
  return "";
}

export function StationMatrix({ quotes, onSelect }: Props) {
  const mobile = useMobileLayout();
  const [expanded, setExpanded] = useState(false);
  const ranked = sortQuotesByPrice(quotes);
  const rankMap = new Map(ranked.map((quote, index) => [quote.stationId, index + 1]));
  const visible = visibleQuotes(quotes, mobile, expanded);

  return (
    <section aria-label="六站比價結果">
      {mobile ? (
        <div className="mobile-rank-heading">
          <div>
            <strong>{expanded ? "六站完整排序" : "最抵三強"}</strong>
            <span>依本次總額由低至高</span>
          </div>
          <span>{visible.length} / {quotes.length}</span>
        </div>
      ) : null}
      <div className="matrix" id="station-results">
      {visible.map((quote) => {
        const rank = mobile ? rankMap.get(quote.stationId) : undefined;
        const cityMode =
          quote.cityMode === "override" ? "已自訂" : "跟隨全域";
        const cityPart = quote.city ? ` · ${CITY_LABELS[quote.city]}` : "";
        const updated = sourceTime(quote);
        const sourceMeta =
          updated ||
          (quote.priceScope === "province"
            ? "已套用全省價"
            : quote.priceScope === "manual"
              ? "已套用手動價"
              : quote.priceScope === "fallback"
                ? "離線備用"
                : "即時");
        return (
        <article
          key={quote.stationId}
          className={`panel station-card${quote.isWinner ? " winner" : ""}`}
          style={{ "--station-accent": quote.accent } as React.CSSProperties}
        >
          <div className="station-card-head">
            <div>
              <h2>{quote.name}</h2>
              <p>
                {quote.grossHkd <= 0
                  ? "資料未載入"
                  : quote.stationId.startsWith("gd")
                    ? "98# · 城市與路費獨立"
                    : "香港站點 · 同油量比較"}
              </p>
            </div>
            <div className="card-badges">
              {rank ? (
                <span className="rank-badge" aria-label={`第 ${rank} 名`}>
                  {rank}
                </span>
              ) : null}
              {quote.isWinner ? <span className="badge winner">最低</span> : null}
            </div>
          </div>

          <div className="station-meta">
            {quote.cityMode ? (
              <span className={`mode-badge ${quote.cityMode}`}>
                {cityMode}{cityPart}
              </span>
            ) : null}
            <span className={`scope-badge ${quote.priceScope}`}>
              {sourceBadge(quote)}
            </span>
          </div>

          <div className="station-numbers">
            <div className="unit-price">
              HK${quote.unitPriceHkd.toFixed(2)}
              <small> / L</small>
            </div>
            <div className="delta">
              {quote.isWinner
                ? "全場最低"
                : `+HK$${quote.savingVsWinnerHkd.toFixed(2)}`}
            </div>
          </div>

          <div className="details-grid">
            <div className="detail-row">
              <span>本次總額</span>
              <strong>HK${quote.totalHkd.toFixed(2)}</strong>
            </div>
            <div className="detail-row">
              <span>相對牌價節省</span>
              <strong>
                {quote.listSavingHkd > 0.005
                  ? `HK$${quote.listSavingHkd.toFixed(2)}`
                  : "牌價無折扣"}
              </strong>
            </div>
          </div>

          <div className="station-footer">
            <span className="source-chip" title={`${quote.sourceLabel}${updated ? ` · ${updated}` : ""}`}>
              {sourceMeta}
            </span>
            <button
              className="button subtle pressable"
              type="button"
              onClick={() => onSelect(quote.stationId)}
              aria-label={`${quote.name}詳情`}
            >
              詳情
            </button>
          </div>
        </article>
        );
      })}
      </div>
      {mobile && quotes.length > 3 ? (
        <button
          className="button subtle pressable mobile-expand"
          type="button"
          aria-expanded={expanded}
          aria-controls="station-results"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "收起其餘站點" : "查看其餘 3 站"}
        </button>
      ) : null}
    </section>
  );
}
