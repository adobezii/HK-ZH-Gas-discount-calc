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
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function createDefaultConfig(): DashboardConfig {
  return {
    schemaVersion: 1,
    liters: 60,
    fx: 1.08,
    globalCity: "zhuhai",
    date: localDateString(),
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
