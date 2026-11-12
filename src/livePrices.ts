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

    return {
      loaded: true,
      source: "crawler",
      updatedAt: new Date().toISOString(),
      shell: {
        standard: parse(standard.price.Shell, promotions.hkShell.prices.standard),
        premium: parse(premium.price.Shell, promotions.hkShell.prices.premium),
      },
      caltex: {
        standard: parse(
          standard.price.Caltex,
          promotions.caltex.standardPrice,
        ),
        premium: parse(premium.price.Caltex, promotions.caltex.premiumPrice),
      },
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
