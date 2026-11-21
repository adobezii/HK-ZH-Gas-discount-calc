import { fallbackCards, fallbackCoupons, promotions } from "./data";
import type { CaltexCard, CaltexCoupon, LivePrices } from "./types";

const PRICE_API =
  "https://hkg-deadline.github.io/hk-petrol-price-crawler/json/";

export const fallbackLivePrices: LivePrices = {
  loaded: false,
  source: "fallback",
  shell: promotions.hkShell.prices,
  caltex: {
    premium: promotions.caltex.premiumPrice,
    standard: promotions.caltex.standardPrice,
  },
  cnpc: promotions.hkCnpc.price,
  sinopec: promotions.hkSinopec.prices,
  cards: fallbackCards,
  coupons: fallbackCoupons,
};

function abortAfter(ms: number) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => window.clearTimeout(timer),
  };
}

export async function fetchFxRate() {
  const timeout = abortAfter(5000);
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/CNY", { signal: timeout.signal });
    if (!response.ok) throw new Error("匯率查詢失敗");
    const data = await response.json();
    const rate = data?.rates?.HKD;
    if (data?.base_code !== "CNY" || typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) throw new Error("缺少有效港幣匯率");
    return { rate, effectiveAt: typeof data.time_last_update_unix === "number" ? new Date(data.time_last_update_unix * 1000).toISOString() : undefined };
  } finally {
    timeout.clear();
  }
}

export async function fetchLivePrices(): Promise<LivePrices> {
  const timeout = abortAfter(10_000);
  try {
    const [cardsJson, couponsJson, pricesJson] = await Promise.all([
      fetch(`${PRICE_API}caltex-discountcards.json`, {
        signal: timeout.signal,
      }).then((response) => response.json()),
      fetch(`${PRICE_API}caltex-coupons.json`, {
        signal: timeout.signal,
      }).then((response) => response.json()),
      fetch(`${PRICE_API}petrolprice.json`, {
        signal: timeout.signal,
      }).then((response) => response.json()),
    ]);

    type PriceBlock = { type: string; price: Record<string, string> };
    const prices = pricesJson as PriceBlock[];
    const standard = prices.find((item) => item.type === "Standard Petrol");
    const premium = prices.find((item) => item.type === "Premium Petrol");
    if (!standard?.price || !premium?.price) {
      throw new Error("香港油價資料格式不完整");
    }

    const parse = (value: string | undefined, fallback: number) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    };

    const cards =
      Array.isArray((cardsJson as { discountCards?: CaltexCard[] }).discountCards) &&
      (cardsJson as { discountCards: CaltexCard[] }).discountCards.length
        ? (cardsJson as { discountCards: CaltexCard[] }).discountCards
        : fallbackCards;
    const coupons =
      Array.isArray((couponsJson as { coupons?: CaltexCoupon[] }).coupons) &&
      (couponsJson as { coupons: CaltexCoupon[] }).coupons.length
        ? (couponsJson as { coupons: CaltexCoupon[] }).coupons
        : fallbackCoupons;

    const fallbackGrades: NonNullable<LivePrices["fallbackGrades"]> = {};
    const brandPrices = (key: "Shell" | "Caltex", brand: "shell" | "caltex") => {
      const regular = parse(standard.price[key], 0);
      const extra = parse(premium.price[key], 0);
      const validPremium = extra > 0 && (brand !== "shell" || extra !== regular);
      fallbackGrades[brand] = [...(regular ? [] : ["standard" as const]), ...(validPremium ? [] : ["premium" as const])];
      return { standard: regular || fallbackLivePrices[brand].standard, premium: validPremium ? extra : fallbackLivePrices[brand].premium };
    };
    return {
      loaded: true,
      source: "crawler",
      updatedAt: new Date().toISOString(),
      fallbackGrades,
      shell: brandPrices("Shell", "shell"),
      caltex: brandPrices("Caltex", "caltex"),
      cnpc: parse(premium.price.PetroChina, promotions.hkCnpc.price),
      sinopec: {
        standard: parse(
          standard.price.Sinopec,
          promotions.hkSinopec.prices.standard,
        ),
        premium: parse(
          premium.price.Sinopec,
          promotions.hkSinopec.prices.premium,
        ),
      },
      cards,
      coupons,
    };
  } finally {
    timeout.clear();
  }
}
