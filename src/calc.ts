import {
  citySnapshotKey,
  fallbackCards,
  fallbackCoupons,
  promotions,
} from "./data";
import type {
  CaltexCard,
  CaltexCoupon,
  City,
  CityBinding,
  CityPriceSnapshot,
  DashboardConfig,
  GdPriceOverride,
  LivePrices,
  PriceScope,
  QuoteResult,
  StationId,
} from "./types";
import { CITY_LABELS, STATIONS } from "./types";

const dayOfWeek = (iso: string) => new Date(`${iso}T00:00:00`).getDay();
const finite = (value: number) => (Number.isFinite(value) ? value : 0);
const money = (value: number) => Math.max(0, finite(value));

export function resolveCity(binding: CityBinding, globalCity: City): City {
  return binding.mode === "follow-global" ? globalCity : binding.city;
}

export function shellOfferDay(
  date: string,
  requested: DashboardConfig["hkShell"]["offerDay"],
): "wed" | "weekend" | "weekday" {
  if (requested !== "auto") return requested;
  const weekday = dayOfWeek(date);
  if (weekday === 3) return "wed";
  if (weekday === 0 || weekday === 6) return "weekend";
  return "weekday";
}

export function cnpcDirectDiscount(date: string): number {
  const weekday = dayOfWeek(date);
  const inPromo = date >= promotions.hkCnpc.start && date <= promotions.hkCnpc.end;
  if (!inPromo) return 0;
  if (weekday === 3) return promotions.hkCnpc.direct.wed;
  if ([1, 2, 4].includes(weekday)) return promotions.hkCnpc.direct.monThu;
  return promotions.hkCnpc.direct.weekend;
}

export function hkSinopecDiscount(
  date: string,
  fuel: "premium" | "standard",
  includePoints: boolean,
): number {
  const weekday = dayOfWeek(date);
  const inPromo =
    date >= promotions.hkSinopec.start && date <= promotions.hkSinopec.end;
  if (!inPromo) return 0;

  if (fuel === "standard") {
    const rule =
      weekday === 0 || weekday === 6
        ? promotions.hkSinopec.standard.weekend
        : promotions.hkSinopec.standard.weekday;
    return includePoints ? rule.allIn : rule.direct;
  }

  let rule = promotions.hkSinopec.premium.weekend;
  if (weekday === 1 || weekday === 4) rule = promotions.hkSinopec.premium.monThu;
  else if (weekday === 2 || weekday === 5) rule = promotions.hkSinopec.premium.tueFri;
  else if (weekday === 3 && date <= promotions.hkSinopec.wednesdayEnd) {
    rule = promotions.hkSinopec.premium.wed;
  }
  return includePoints ? rule.allIn : rule.direct;
}

export function getGdShellDiscount(date: string): number {
  const weekday = dayOfWeek(date);
  const day = Number(date.slice(-2));
  const hit8 = [8, 18, 28].includes(day);
  const hitWedSat = weekday === 3 || weekday === 6;
  if (hit8 && hitWedSat) {
    return Math.max(promotions.gdShell.discount8th, promotions.gdShell.discountWedSat);
  }
  if (hit8) return promotions.gdShell.discount8th;
  if (hitWedSat) return promotions.gdShell.discountWedSat;
  return 0;
}

export function cityPrice(
  city: City,
  snapshot: CityPriceSnapshot,
): { price: number; source: "snapshot" | "fallback"; stale: boolean } {
  const entry = snapshot.cities[citySnapshotKey(city)];
  if (entry?.p98 > 0) {
    return { price: entry.p98, source: "snapshot", stale: Boolean(entry.stale) };
  }
  return { price: promotions.gdShell.fallback, source: "fallback", stale: false };
}

export function sortQuotesByPrice(quotes: QuoteResult[]): QuoteResult[] {
  const stationOrder = new Map(
    STATIONS.map((station, index) => [station.id, index]),
  );
  return [...quotes]
    .sort(
      (left, right) =>
        left.totalHkd - right.totalHkd ||
        (stationOrder.get(left.stationId) ?? 0) -
          (stationOrder.get(right.stationId) ?? 0),
    )
}

function cardAndCoupon(
  config: DashboardConfig,
  cards: CaltexCard[],
  coupons: CaltexCoupon[],
) {
  const card =
    cards.find((item) => item.id === config.hkCaltex.cardId) ?? cards[0] ?? fallbackCards[0];
  const valid = coupons.filter((coupon) => {
    const cardTypes = coupon.validCardType
      ? Array.isArray(coupon.validCardType)
        ? coupon.validCardType
        : [coupon.validCardType]
      : [];
    return (
      (!cardTypes.length || cardTypes.includes(card.type)) &&
      (!coupon.validFor || coupon.validFor.includes(config.hkCaltex.fuel))
    );
  });
  const coupon =
    valid.find((item) => item.id === config.hkCaltex.couponId) ?? valid[0] ?? null;
  return { card, coupon };
}

export function calculateQuotes(
  config: DashboardConfig,
  live: LivePrices,
  snapshot: CityPriceSnapshot,
): QuoteResult[] {
  const liters = Math.max(0.1, finite(config.liters));
  const fx = Math.max(0.01, finite(config.fx));
  const cards = live.cards.length ? live.cards : fallbackCards;
  const coupons = live.coupons.length ? live.coupons : fallbackCoupons;
  const tollHkd =
    promotions.toll.rmbPerCrossing * promotions.toll.crossings * fx;

  const shellBase = config.hkShell.manualPrice ?? live.shell[config.hkShell.fuel];
  const shellDay = shellOfferDay(config.date, config.hkShell.offerDay);
  const shellRule = promotions.hkShell.offers[config.hkShell.fuel][shellDay];
  const shellDiscount = finite(
    config.hkShell.includePoints ? shellRule.allIn : shellRule.cash,
  );
  const shellAfter = Math.max(0, (shellBase - shellDiscount) * liters);
  const shellVoucher =
    config.hkShell.couponMin > 0 && shellAfter >= config.hkShell.couponMin
      ? config.hkShell.couponValue
      : 0;
  const shellFinal = money(
    (shellAfter - shellVoucher) * (1 - config.hkShell.rebatePercent / 100),
  );

  const { card, coupon } = cardAndCoupon(config, cards, coupons);
  const caltexBase = config.hkCaltex.manualPrice ?? live.caltex[config.hkCaltex.fuel];
  const cardDiscount =
    config.hkCaltex.fuel === "standard"
      ? card.standardDiscount
      : card.premiumDiscount;
  const discountedCaltex = Math.max(0, caltexBase - cardDiscount);
  let caltexFinal = discountedCaltex * liters;
  let caltexUsable = 0;
  let caltexRest = liters;
  if (coupon && coupon.spend > 0) {
    const perCouponLiters = coupon.spend / caltexBase;
    caltexUsable = Math.floor(
      (liters * caltexBase + 0.005 * caltexBase) / coupon.spend,
    );
    caltexRest = Math.max(0, liters - caltexUsable * perCouponLiters);
    const paidLiters =
      caltexUsable * ((coupon.spend - coupon.discount) / caltexBase) + caltexRest;
    caltexFinal = paidLiters * discountedCaltex;
  }
  caltexFinal = money(caltexFinal * (1 - config.hkCaltex.rebatePercent / 100));

  const cnpcBase = config.hkCnpc.manualPrice ?? live.cnpc;
  const cnpcDiscount = config.hkCnpc.eligible
    ? Math.min(
        cnpcBase,
        config.hkCnpc.discountOverride ?? cnpcDirectDiscount(config.date),
      )
    : 0;
  const cnpcFinal = money((cnpcBase - cnpcDiscount) * liters);

  const sinohkBase = config.hkSinopec.manualPrice ?? live.sinopec[config.hkSinopec.fuel];
  const sinohkDiscount = config.hkSinopec.member
    ? Math.min(
        sinohkBase,
        config.hkSinopec.discountOverride ??
          hkSinopecDiscount(
            config.date,
            config.hkSinopec.fuel,
            config.hkSinopec.includePoints,
          ),
      )
    : 0;
  const sinohkFinal = money((sinohkBase - sinohkDiscount) * liters);

  const gdShellCity = resolveCity(config.gdShell.binding, config.globalCity);
  const shellCityPrice = cityPrice(gdShellCity, snapshot);
  const gdShellBase =
    config.gdShell.manualPrice?.value ?? shellCityPrice.price;
  const shellDiscountAmount = getGdShellDiscount(config.date);
  const gdShellRmb = Math.max(0, (gdShellBase - shellDiscountAmount) * liters);
  const gdShellFinal =
    gdShellRmb * fx + (config.gdShell.includeToll ? tollHkd : 0);

  const gdSinopecCity = resolveCity(config.gdSinopec.binding, config.globalCity);
  const sinoCityPrice = cityPrice(gdSinopecCity, snapshot);
  const gdSinopecBase =
    config.gdSinopec.manualPrice?.value ?? sinoCityPrice.price;
  const gdSinopecRmb = Math.max(
    0,
    (gdSinopecBase - config.gdSinopec.discountPerLiter) * liters,
  );
  const gdSinopecFinal =
    gdSinopecRmb * fx + (config.gdSinopec.includeToll ? tollHkd : 0);

  const winnerTotal = Math.min(
    shellFinal,
    caltexFinal,
    cnpcFinal,
    sinohkFinal,
    gdShellFinal,
    gdSinopecFinal,
  );

  const make = (
    stationId: StationId,
    name: string,
    shortName: string,
    accent: string,
    totalHkd: number,
    grossHkd: number,
    source: "snapshot" | "api" | "manual" | "fallback",
    sourceLabel: string,
    city: City | undefined,
    priceScope: PriceScope,
    sourceUpdatedAt: string | undefined,
    cityMode: "follow-global" | "override" | undefined,
    listSavingHkd: number,
    breakdown: Array<{ label: string; value: string }>,
  ): QuoteResult => ({
    stationId,
    name,
    shortName,
    accent,
    city,
    unitPriceHkd: totalHkd / liters,
    totalHkd,
    grossHkd,
    discountPerLiterHkd: (grossHkd - totalHkd) / liters,
    source,
    sourceLabel,
    priceScope,
    sourceUpdatedAt,
    cityMode,
    listSavingHkd,
    savingVsWinnerHkd: totalHkd - winnerTotal,
    isWinner: Math.abs(totalHkd - winnerTotal) < 0.005,
    breakdown,
  });

  return [
    make(
      "hk-shell",
      "香港 Shell",
      "Shell",
      "#facc15",
      shellFinal,
      shellBase * liters,
      live.loaded ? "api" : "fallback",
      live.loaded ? "香港油價公開資料" : "內建備用價",
      undefined,
      live.loaded ? "live" : "fallback",
      live.updatedAt,
      undefined,
      shellBase * liters - shellFinal,
      [
        { label: "牌價", value: `HK$ ${shellBase.toFixed(2)}/L` },
        { label: "直減", value: `HK$ ${shellDiscount.toFixed(2)}/L` },
        { label: "實付", value: `HK$ ${(shellFinal / liters).toFixed(2)}/L` },
      ],
    ),
    make(
      "hk-caltex",
      "香港加德士",
      "加德士",
      "#ef4444",
      caltexFinal,
      caltexBase * liters,
      live.loaded ? "api" : "fallback",
      live.loaded ? "卡券資料已同步" : "內建卡券",
      undefined,
      live.loaded ? "live" : "fallback",
      live.updatedAt,
      undefined,
      caltexBase * liters - caltexFinal,
      [
        { label: "牌價", value: `HK$ ${caltexBase.toFixed(2)}/L` },
        { label: "卡折扣", value: `HK$ ${cardDiscount.toFixed(2)}/L` },
        {
          label: "可用券",
          value: coupon ? `${caltexUsable} 張，餘 ${caltexRest.toFixed(2)}L` : "無",
        },
      ],
    ),
    make(
      "hk-cnpc",
      "香港中石油",
      "中石油",
      "#f97316",
      cnpcFinal,
      cnpcBase * liters,
      live.loaded ? "api" : "fallback",
      live.loaded ? "香港油價公開資料" : "內建備用價",
      undefined,
      live.loaded ? "live" : "fallback",
      live.updatedAt,
      undefined,
      cnpcBase * liters - cnpcFinal,
      [
        { label: "牌價", value: `HK$ ${cnpcBase.toFixed(2)}/L` },
        { label: "純直減", value: `HK$ ${cnpcDiscount.toFixed(2)}/L` },
        { label: "門檻", value: config.hkCnpc.eligible ? "已符合" : "未符合" },
      ],
    ),
    make(
      "hk-sinopec",
      "香港中石化",
      "港中石化",
      "#06b6d4",
      sinohkFinal,
      sinohkBase * liters,
      live.loaded ? "api" : "fallback",
      live.loaded ? "香港油價公開資料" : "內建備用價",
      undefined,
      live.loaded ? "live" : "fallback",
      live.updatedAt,
      undefined,
      sinohkBase * liters - sinohkFinal,
      [
        { label: "牌價", value: `HK$ ${sinohkBase.toFixed(2)}/L` },
        {
          label: config.hkSinopec.includePoints ? "直減＋積分" : "純直減",
          value: `HK$ ${sinohkDiscount.toFixed(2)}/L`,
        },
        { label: "會員", value: config.hkSinopec.member ? "符合" : "未符合" },
      ],
    ),
    make(
      "gd-shell",
      "廣東 Shell",
      "粵 Shell",
      "#10b981",
      gdShellFinal,
      gdShellBase * liters * fx,
      config.gdShell.manualPrice ? "manual" : shellCityPrice.source,
      gdPriceLabel(config.gdShell.manualPrice, shellCityPrice.stale, shellCityPrice.source, gdShellCity),
      gdDisplayCity(config.gdShell.manualPrice, shellCityPrice.source, gdShellCity),
      gdPriceScope(config.gdShell.manualPrice, shellCityPrice.source),
      config.gdShell.manualPrice
        ? undefined
        : snapshot.updated_hkt,
      config.gdShell.binding.mode,
      gdShellBase * liters * fx - gdShellRmb * fx,
      [
        { label: "城市", value: CITY_LABELS[gdShellCity] },
        { label: "人民幣牌價", value: `¥${gdShellBase.toFixed(2)}/L` },
        { label: "每升立減", value: `¥${shellDiscountAmount.toFixed(2)}/L` },
        {
          label: "過境路費",
          value: config.gdShell.includeToll ? `HK$${tollHkd.toFixed(0)}` : "未計",
        },
      ],
    ),
    make(
      "gd-sinopec",
      "廣東中石化",
      "粵中石化",
      "#3b82f6",
      gdSinopecFinal,
      gdSinopecBase * liters * fx,
      config.gdSinopec.manualPrice ? "manual" : sinoCityPrice.source,
      gdPriceLabel(config.gdSinopec.manualPrice, sinoCityPrice.stale, sinoCityPrice.source, gdSinopecCity),
      gdDisplayCity(config.gdSinopec.manualPrice, sinoCityPrice.source, gdSinopecCity),
      gdPriceScope(config.gdSinopec.manualPrice, sinoCityPrice.source),
      config.gdSinopec.manualPrice ? undefined : snapshot.updated_hkt,
      config.gdSinopec.binding.mode,
      gdSinopecBase * liters * fx - gdSinopecRmb * fx,
      [
        { label: "城市", value: CITY_LABELS[gdSinopecCity] },
        { label: "人民幣牌價", value: `¥${gdSinopecBase.toFixed(2)}/L` },
        {
          label: "每升立減",
          value: `¥${config.gdSinopec.discountPerLiter.toFixed(2)}/L`,
        },
        {
          label: "卡費回本",
          value:
            config.gdSinopec.discountPerLiter > 0
              ? `${(config.gdSinopec.cardFee / config.gdSinopec.discountPerLiter).toFixed(0)}L`
              : "—",
        },
        {
          label: "過境路費",
          value: config.gdSinopec.includeToll ? `HK$${tollHkd.toFixed(0)}` : "未計",
        },
      ],
    ),
  ];
}

function gdDisplayCity(
  override: GdPriceOverride | undefined,
  source: "snapshot" | "fallback",
  city: City,
): City | undefined {
  if (override) return override.scope === "city" ? city : undefined;
  return source === "snapshot" ? city : undefined;
}

function gdPriceScope(
  override: GdPriceOverride | undefined,
  source: "snapshot" | "fallback",
): PriceScope {
  if (override) return override.scope;
  return source === "snapshot" ? "city" : "fallback";
}

function gdPriceLabel(
  override: GdPriceOverride | undefined,
  stale: boolean,
  source: "snapshot" | "fallback",
  city: City,
): string {
  if (override) return override.label;
  if (source === "fallback") return "內建備用價";
  return `${CITY_LABELS[city]} ${stale ? "上次城市快照" : "城市快照"}`;
}
