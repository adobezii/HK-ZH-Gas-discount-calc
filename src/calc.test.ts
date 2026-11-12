import { describe, expect, it } from "vitest";
import {
  calculateQuotes,
  cnpcDirectDiscount,
  getGdShellDiscount,
  gdShellDateRuleLabel,
  hkSinopecDateRuleLabel,
  hkSinopecDiscount,
  cnpcDateRuleLabel,
  shellDateRuleLabel,
  sortQuotesByPrice,
} from "./calc";
import { createDefaultConfig } from "./data";
import { withCalibratedDate } from "./data";
import { fallbackLivePrices } from "./livePrices";
import type { CityPriceSnapshot, DashboardConfig } from "./types";

const snapshot: CityPriceSnapshot = {
  updated: "2026-11-12T00:00:00Z",
  updated_hkt: "2026-11-12",
  source: "test",
  cities: {
    "guangdong/zhuhai.shtml": { name: "珠海", p98: 11.0 },
    "guangdong/shenzhen.shtml": { name: "深圳", p98: 12.0 },
    "guangdong/guangzhou.shtml": { name: "廣州", p98: 13.0 },
  },
};

const config = (): DashboardConfig => ({
  ...createDefaultConfig(),
  date: "2026-11-12",
});

const quote = (quotes: ReturnType<typeof calculateQuotes>, stationId: string) =>
  quotes.find((item) => item.stationId === stationId)!;

describe("city bindings", () => {
  it("預設珠海，兩個廣東方案都跟隨全域城市", () => {
    const quotes = calculateQuotes(config(), fallbackLivePrices, snapshot);
    expect(quote(quotes, "gd-shell").city).toBe("zhuhai");
    expect(quote(quotes, "gd-sinopec").city).toBe("zhuhai");
  });

  it("切換全域城市會更新跟隨欄位", () => {
    const quotes = calculateQuotes(
      { ...config(), globalCity: "shenzhen" },
      fallbackLivePrices,
      snapshot,
    );
    expect(quote(quotes, "gd-shell").city).toBe("shenzhen");
    expect(quote(quotes, "gd-sinopec").city).toBe("shenzhen");
    expect(quote(quotes, "gd-shell").breakdown).toContainEqual({
      label: "人民幣牌價",
      value: "¥12.00/L",
    });
  });

  it("覆寫欄位不隨全域城市改變", () => {
    const first = config();
    first.gdShell.binding = { mode: "override", city: "shenzhen" };
    const quotes = calculateQuotes(
      { ...first, globalCity: "guangzhou" },
      fallbackLivePrices,
      snapshot,
    );
    expect(quote(quotes, "gd-shell").city).toBe("shenzhen");
    expect(quote(quotes, "gd-sinopec").city).toBe("guangzhou");
  });
});

describe("promotion rules", () => {
  it("中石油只計日期直減，週末留待手動輸入", () => {
    expect(cnpcDirectDiscount("2026-11-12")).toBe(12.6);
    expect(cnpcDirectDiscount("2026-11-18")).toBe(13.9);
    expect(cnpcDirectDiscount("2026-11-20")).toBe(0);
    expect(cnpcDirectDiscount("2026-12-01")).toBe(0);
  });

  it("香港中石化切換積分與油品", () => {
    expect(hkSinopecDiscount("2026-11-12", "premium", false)).toBe(7.8);
    expect(hkSinopecDiscount("2026-11-18", "premium", false)).toBe(13.51);
    expect(hkSinopecDiscount("2026-11-18", "premium", true)).toBe(15.1);
    expect(hkSinopecDiscount("2026-11-21", "standard", false)).toBe(6);
    expect(hkSinopecDiscount("2026-11-21", "standard", true)).toBe(6.61);
  });

  it("珠海 Shell 日期優惠取較大值", () => {
    expect(getGdShellDiscount("2026-11-18")).toBe(1.88);
    expect(getGdShellDiscount("2026-11-21")).toBe(0.98);
    expect(getGdShellDiscount("2026-11-12")).toBe(0);
  });
});

describe("quote costs", () => {
  it("愛跑98 路費可獨立關閉並計算回本", () => {
    const base = config();
    base.gdSinopec.includeToll = false;
    base.gdSinopec.manualPrice = {
      value: 11.65,
      scope: "city",
      label: "珠海城市快照",
    };
    const quotes = calculateQuotes(base, fallbackLivePrices, snapshot);
    const result = quote(quotes, "gd-sinopec");
    expect(result.totalHkd).toBeCloseTo((11.65 - 2) * 60 * 1.08, 6);
    expect(result.breakdown).toContainEqual({
      label: "卡費回本",
      value: "294L",
    });
  });

  it("加入路費後總額包含兩次單程路費", () => {
    const base = config();
    base.gdSinopec.includeToll = true;
    base.gdSinopec.manualPrice = {
      value: 11.65,
      scope: "city",
      label: "珠海城市快照",
    };
    const quotes = calculateQuotes(base, fallbackLivePrices, snapshot);
    const result = quote(quotes, "gd-sinopec");
    expect(result.totalHkd).toBeCloseTo(
      (11.65 - 2) * 60 * 1.08 + 142.5 * 2 * 1.08,
      5,
    );
  });

  it("路費不計入牌價節省", () => {
    const base = config();
    base.gdSinopec.includeToll = true;
    base.gdSinopec.manualPrice = {
      value: 11.65,
      scope: "city",
      label: "珠海城市快照",
    };
    const quotes = calculateQuotes(base, fallbackLivePrices, snapshot);
    expect(quote(quotes, "gd-sinopec").listSavingHkd).toBeCloseTo(
      2 * 60 * 1.08,
      5,
    );
  });

  it("省級 API 價格不冒充城市價", () => {
    const base = config();
    base.gdShell.manualPrice = {
      value: 9.8,
      scope: "province",
      label: "廣東全省 API",
    };
    const quotes = calculateQuotes(base, fallbackLivePrices, snapshot);
    const result = quote(quotes, "gd-shell");
    expect(result.city).toBeUndefined();
    expect(result.priceScope).toBe("province");
    expect(result.sourceLabel).toBe("廣東全省 API");
  });

  it("同價排序保留固定站點順序", () => {
    const quotes = calculateQuotes(config(), fallbackLivePrices, snapshot);
    const synthetic = [quotes[2], quotes[0], quotes[1], quotes[3]].map((item) => ({
      ...item,
      totalHkd:
        item.stationId === "hk-shell" || item.stationId === "hk-caltex"
          ? 10
          : 20,
    }));
    expect(sortQuotesByPrice(synthetic).map((item) => item.stationId)).toEqual([
      "hk-shell",
      "hk-caltex",
      "hk-cnpc",
      "hk-sinopec",
    ]);
  });

  it("日期規則標籤會跟隨選定日期", () => {
    expect(shellDateRuleLabel("2026-11-12", "auto")).toBe("平日日期優惠");
    expect(shellDateRuleLabel("2026-11-18", "auto")).toBe("星期三日期優惠");
    expect(cnpcDateRuleLabel("2026-11-18", undefined)).toBe("星期三直減");
    expect(cnpcDateRuleLabel("2026-11-20", undefined)).toBe("週末直減待輸入");
    expect(
      hkSinopecDateRuleLabel("2026-11-21", {
        ...config().hkSinopec,
        fuel: "premium",
      }),
    ).toBe("週末日期優惠");
    expect(gdShellDateRuleLabel("2026-11-18")).toBe("日期優惠取較大");
  });

  it("指定新日期會清除日期折扣覆寫並恢復 Shell 自動日別", () => {
    const base = config();
    base.hkShell.offerDay = "weekend";
    base.hkCnpc.discountOverride = 9;
    base.hkSinopec.discountOverride = 10;
    const calibrated = withCalibratedDate(base, "2026-11-18");
    expect(calibrated.date).toBe("2026-11-18");
    expect(calibrated.hkShell.offerDay).toBe("auto");
    expect(calibrated.hkCnpc.discountOverride).toBeUndefined();
    expect(calibrated.hkSinopec.discountOverride).toBeUndefined();
  });
});
