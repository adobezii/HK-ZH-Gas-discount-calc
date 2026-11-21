import { CITY_LABELS } from "../types";
import type { DashboardModel } from "../useDashboard";

interface Props {
  model: DashboardModel;
}

export function SharePanel({ model }: Props) {
  const { config, quotes, best } = model;
  const [copyStatus, setCopyStatus] = useState("");
  const lines = [
    `【粵港三站油價比價】${config.date}`,
    `入油 ${config.liters.toFixed(2)} L｜¥1 = HK$${config.fx.toFixed(4)}｜${CITY_LABELS[config.globalCity]}｜${config.gdShell.includeToll ? "珠海含來回路費 ¥285" : "珠海不計路費"}`,
    "",
    ...quotes.flatMap((quote) => [
      `■ ${quote.name}${quote.city ? `（${CITY_LABELS[quote.city]}）` : ""}`,
      `　即場 HK$${quote.unitPriceHkd.toFixed(2)}/L｜總額 HK$${quote.totalHkd.toFixed(2)}｜${quote.sourceLabel}${quote.sourceUpdatedAt ? `（${quote.sourceUpdatedAt.slice(0, 10)}）` : ""}`,
      ...(quote.equivalentHkd !== undefined && quote.totalHkd - quote.equivalentHkd >= 0.005 ? [`　回贈後等效 HK$${quote.equivalentHkd.toFixed(2)}`] : []),
    ]),
    "",
    `即場最抵：${quotes.filter((quote) => quote.isWinner).map((quote) => quote.name).join("、")}｜HK$${best.unitPriceHkd.toFixed(2)}/L｜總額 HK$${best.totalHkd.toFixed(2)}`,
    `北上首次打和：${model.breakEven === null ? "100 L 內未打和" : `${model.breakEven.toFixed(2)} L`}`,
    "",
    "價格及優惠只供參考，以油站實際交易為準。",
  ];
  const summary = lines.join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(summary);
      setCopyStatus("已複製摘要");
    } catch {
      setCopyStatus("無法存取剪貼簿，可選取摘要文字");
    }
  }

  return (
    <>
    <pre className="print-summary">{summary}</pre>
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
      <span role="status">{copyStatus}</span>
      <pre className="summary-text">{summary}</pre>
    </details>
    </>
  );
}
import { useState } from "react";
