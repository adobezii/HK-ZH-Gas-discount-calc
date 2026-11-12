import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { QuoteResult } from "../types";
import { StationMatrix } from "./StationMatrix";

function quotes(): QuoteResult[] {
  const names = [
    "香港 Shell",
    "香港加德士",
    "香港中石油",
    "香港中石化",
    "廣東 Shell",
    "廣東中石化",
  ];
  return names.map((name, index) => ({
    stationId: (
      [
        "hk-shell",
        "hk-caltex",
        "hk-cnpc",
        "hk-sinopec",
        "gd-shell",
        "gd-sinopec",
      ] as const
    )[index],
    name,
    shortName: name,
    accent: "#fff",
    city: index >= 4 ? "zhuhai" : undefined,
    unitPriceHkd: index + 1,
    totalHkd: (6 - index) * 10,
    grossHkd: 100,
    listSavingHkd: index === 4 ? 0 : 5,
    savingVsWinnerHkd: (6 - index) * 10 - 10,
    discountPerLiterHkd: 1,
    source: index >= 4 ? "snapshot" : "api",
    sourceLabel: index >= 4 ? "珠海城市快照" : "香港公開油價",
    priceScope: index >= 4 ? "city" : "live",
    cityMode: index >= 4 ? "follow-global" : undefined,
    isWinner: index === 5,
    breakdown: [],
  }));
}

describe("StationMatrix", () => {
  it("手機預設三強，可展開全部六站", async () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: query.includes("max-width"),
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
    render(<StationMatrix quotes={quotes()} onSelect={() => undefined} />);
    expect(screen.getAllByRole("article")).toHaveLength(3);
    const expand = screen.getByRole("button", { name: "查看其餘 3 站" });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(expand);
    expect(screen.getAllByRole("article")).toHaveLength(6);
    expect(expand).toHaveAttribute("aria-expanded", "true");
  });

  it("顯示城市模式、來源範圍及站別詳情名稱", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: () => ({
        matches: false,
        media: "",
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
    render(<StationMatrix quotes={quotes()} onSelect={() => undefined} />);
    expect(screen.getAllByText("跟隨全域 · 珠海")).toHaveLength(2);
    expect(screen.getAllByText("城市快照")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "廣東中石化詳情" }),
    ).toBeInTheDocument();
    expect(screen.getByText("牌價無折扣")).toBeInTheDocument();
  });
});
