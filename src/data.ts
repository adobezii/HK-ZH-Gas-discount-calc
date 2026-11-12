import citiesJson from "../data/cn98.json";
import promotionsJson from "../data/promotions.json";
import type {
  CaltexCard,
  CaltexCoupon,
  CityPriceSnapshot,
  DashboardConfig,
} from "./types";

export const promotions = promotionsJson;
export const citySnapshot = citiesJson as CityPriceSnapshot;

export const fallbackCards = promotions.caltex.cards as CaltexCard[];
export const fallbackCoupons = promotions.caltex.coupons as CaltexCoupon[];

export function localDateString(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function withCalibratedDate(
  config: DashboardConfig,
  date: string,
): DashboardConfig {
  return {
    ...config,
    date,
    hkShell: { ...config.hkShell, offerDay: "auto" },
    hkCnpc: { ...config.hkCnpc, discountOverride: undefined },
    hkSinopec: { ...config.hkSinopec, discountOverride: undefined },
  };
}

export function createDefaultConfig(): DashboardConfig {
  return {
    schemaVersion: 3,
    liters: 60,
    fx: 1.08,
    globalCity: "zhuhai",
    date: localDateString(),
    dateMode: "auto",
    hkShell: {
      fuel: "premium",
      offerDay: "auto",
      includePoints: false,
      couponMin: 0,
      couponValue: 0,
      rebatePercent: 0,
    },
    hkCaltex: {
      fuel: "standard",
      cardId: fallbackCards[0].id,
      couponId: fallbackCoupons[0].id,
      rebatePercent: 0,
    },
    hkCnpc: {
      eligible: true,
    },
    hkSinopec: {
      fuel: "premium",
      member: true,
      includePoints: false,
    },
    gdShell: {
      binding: { mode: "follow-global" },
      overrideCity: "zhuhai",
      includeToll: true,
    },
    gdSinopec: {
      binding: { mode: "follow-global" },
      overrideCity: "zhuhai",
      discountPerLiter: promotions.gdSinopec.discountPerLiter,
      cardFee: promotions.gdSinopec.cards[1].fee,
      includeToll: false,
    },
  };
}

export const citySnapshotKey = (city: "zhuhai" | "shenzhen" | "guangzhou") =>
  `guangdong/${city}.shtml`;
