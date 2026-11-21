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
export const MIN_LITERS = 0.01;
export const MAX_LITERS = 100;
export const HOME_STATIONS: StationId[] = ["hk-shell", "hk-caltex", "gd-shell"];

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

export function shellDateRuleLabel(
  date: string,
  requested: DashboardConfig["hkShell"]["offerDay"],
): string {
  if (requested !== "auto") return "手動指定優惠日";
  const selected = shellOfferDay(date, requested);
  if (selected === "wed") return "星期三日期優惠";
  if (selected === "weekend") return "週末日期優惠";
  return "平日日期優惠";
}

export function cnpcDateRuleLabel(
  date: string,
  override: number | undefined,
): string {
  if (override !== undefined) return "手動直減";
  if (date < promotions.hkCnpc.start || date > promotions.hkCnpc.end) {
    return "推廣期外";
  }
  const weekday = dayOfWeek(date);
  if (weekday === 3) return "星期三直減";
  if ([1, 2, 4].includes(weekday)) return "一／二／四直減";
  return "週末直減待輸入";
}

export function hkSinopecDateRuleLabel(
  date: string,
  config: DashboardConfig["hkSinopec"],
): string {
  if (config.discountOverride !== undefined) return "手動每升優惠";
  if (!config.member) return "會員條件未符合";
  if (date < promotions.hkSinopec.start || date > promotions.hkSinopec.end) {
    return "推廣期外";
  }
  const weekday = dayOfWeek(date);
  if (config.fuel === "standard") {
    return weekday === 0 || weekday === 6 ? "週末汽油優惠" : "平日汽油優惠";
  }
  if (weekday === 3) {
    return date <= promotions.hkSinopec.wednesdayEnd
      ? "星期三升級優惠"
      : "星期三一般優惠";
  }
  if (weekday === 1 || weekday === 4) return "一／四日期優惠";
  if (weekday === 2 || weekday === 5) return "二／五日期優惠";
  return "週末日期優惠";
}

export function gdShellDateRuleLabel(date: string): string {
  const day = Number(date.slice(-2));
  const weekday = dayOfWeek(date);
  const hit8 = [8, 18, 28].includes(day);
  const hitWedSat = weekday === 3 || weekday === 6;
  if (hit8 && hitWedSat) return "日期優惠取較大";
  if (hit8) return "8／18／28 日期優惠";
  if (hitWedSat) return "週三／六日期優惠";
  return "日期無額外優惠";
}

export function cityPrice(
  city: City,
  snapshot: CityPriceSnapshot,
): { price: number; source: "snapshot" | "fallback"; stale: boolean } {
  const entry = snapshot.cities[citySnapshotKey(city)];
  if (entry && Number.isFinite(entry.p98) && entry.p98 >= 3 && entry.p98 <= 20) {
    const checked = Date.parse(entry.checked_at ?? snapshot.updated);
    const stale = !Number.isFinite(checked) || Date.now() - checked > 48 * 3600_000;
    return { price: entry.p98, source: "snapshot", stale: Boolean(entry.stale) || stale };
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
  const valid = eligibleCaltexCoupons(card, config.hkCaltex.fuel, coupons);
  const coupon =
    valid.find((item) => item.id === config.hkCaltex.couponId) ?? null;
  return { card, coupon };
}

export function eligibleCaltexCoupons(card: CaltexCard | undefined, fuel: "standard" | "premium", coupons: CaltexCoupon[]) {
  return card ? coupons.filter((coupon) => {
    const types = coupon.validCardType;
    return (!types || (Array.isArray(types) ? !types.length || types.includes(card.type) : types === card.type)) &&
      (!coupon.validFor || coupon.validFor.includes(fuel)) && coupon.spend > 0 &&
      coupon.discount >= 0 && coupon.discount < coupon.spend;
  }) : [];
}

function fuelCosts(config: DashboardConfig, live: LivePrices, snapshot: CityPriceSnapshot) {
  const shellBase = config.hkShell.manualPrice ?? live.shell[config.hkShell.fuel];
  const shellDay = shellOfferDay(config.date, config.hkShell.offerDay);
  const shellRule = promotions.hkShell.offers[config.hkShell.fuel][shellDay];
  const shellRate = money(shellBase - shellRule.cash);
  const shellCash = (liters: number) => {
    const after = shellRate * liters;
    return money(after - (config.hkShell.couponMin > 0 && after >= config.hkShell.couponMin ? money(config.hkShell.couponValue) : 0));
  };
  const { card, coupon } = cardAndCoupon(config, live.cards.length ? live.cards : fallbackCards, live.coupons.length ? live.coupons : fallbackCoupons);
  const caltexBase = config.hkCaltex.manualPrice ?? live.caltex[config.hkCaltex.fuel];
  const cardDiscount = config.hkCaltex.fuel === "standard" ? card.standardDiscount : card.premiumDiscount;
  const caltexRate = money(caltexBase - cardDiscount);
  const perCoupon = coupon && caltexBase > 0 ? coupon.spend / caltexBase : Infinity;
  const couponLimit = config.hkCaltex.couponLimit === undefined ? Infinity : Math.floor(money(config.hkCaltex.couponLimit));
  const couponCount = (liters: number) => Math.min(Math.floor(liters / perCoupon), couponLimit);
  const caltexCash = (liters: number) => money(liters - couponCount(liters) * (coupon && caltexBase > 0 ? coupon.discount / caltexBase : 0)) * caltexRate;
  const gdShellCity = resolveCity(config.gdShell.binding, config.globalCity);
  const shellCityPrice = cityPrice(gdShellCity, snapshot);
  const gdShellBase = config.gdShell.manualPrice?.value ?? shellCityPrice.price;
  const shellDiscountAmount = config.gdShell.discountOverride ?? getGdShellDiscount(config.date);
  const fx = Math.max(0.01, finite(config.fx));
  const tollHkd = promotions.toll.rmbPerCrossing * promotions.toll.crossings * fx;
  const gdRate = money(gdShellBase - shellDiscountAmount);
  const gdCash = (liters: number) => gdRate * liters * fx + (config.gdShell.includeToll ? tollHkd : 0);
  return { shellBase, shellRule, shellCash, coupon, perCoupon, couponCount, caltexBase, cardDiscount, caltexCash,
    gdShellCity, shellCityPrice, gdShellBase, shellDiscountAmount, gdRate, gdCash, fx, tollHkd };
}

export function minimumBreakEven(config: DashboardConfig, live: LivePrices, snapshot: CityPriceSnapshot, classic = false) {
  const costs = fuelCosts(config, live, snapshot);
  for (let hundredths = 1; hundredths <= MAX_LITERS * 100; hundredths++) {
    const liters = hundredths / 100;
    const hk = Math.min(costs.caltexCash(liters), classic ? Infinity : costs.shellCash(liters));
    if (costs.gdCash(liters) <= hk + 1e-9) return liters;
  }
  return null;
}

export function litersForTarget(config: DashboardConfig, live: LivePrices, snapshot: CityPriceSnapshot, station: StationId, mode: "gross" | "cash" | "coupons", amount: number) {
  if (!(amount > 0) || !Number.isFinite(amount)) return null;
  const costs = fuelCosts(config, live, snapshot);
  if (mode === "coupons") {
    if (station !== "hk-caltex" || !Number.isInteger(amount) || !Number.isFinite(costs.perCoupon)) return null;
    const liters = Math.ceil(costs.perCoupon * amount * 100) / 100;
    return liters <= MAX_LITERS ? liters : null;
  }
  const price = station === "hk-shell" ? costs.shellBase : station === "hk-caltex" ? costs.caltexBase : costs.gdShellBase * costs.fx;
  const cash = station === "hk-shell" ? costs.shellCash : station === "hk-caltex" ? costs.caltexCash : costs.gdCash;
  for (let hundredths = MAX_LITERS * 100; hundredths >= 1; hundredths--) {
    const liters = hundredths / 100;
    if ((mode === "gross" ? price * liters : cash(liters)) <= amount + 1e-9) return liters;
  }
  return null;
}

export function rankComparison(quotes: QuoteResult[]) {
  const ranked = sortQuotesByPrice(quotes);
  const best = ranked[0]?.totalHkd;
  return quotes.map((quote) => ({ ...quote, isWinner: Math.round(quote.totalHkd * 100) === Math.round(best * 100),
    savingVsWinnerHkd: quote.totalHkd - best }));
}

export function calculateQuotes(
  config: DashboardConfig,
  live: LivePrices,
  snapshot: CityPriceSnapshot,
): QuoteResult[] {
  const liters = Math.min(MAX_LITERS, Math.max(MIN_LITERS, finite(config.liters)));
  const { fx, tollHkd, shellBase, shellRule, shellCash, coupon, perCoupon, couponCount, caltexBase, cardDiscount,
    caltexCash, gdShellCity, shellCityPrice, gdShellBase, shellDiscountAmount, gdRate, gdCash } = fuelCosts(config, live, snapshot);
  const shellFinal = shellCash(liters);
  const points = config.hkShell.includePoints ? money(shellRule.allIn - shellRule.cash) * liters : 0;
  const shellEquivalent = money(shellFinal * rebateFactor(config.hkShell.rebatePercent) - points);
  const caltexFinal = caltexCash(liters);
  const caltexUsable = couponCount(liters);
  const caltexRest = caltexUsable ? money(liters - caltexUsable * perCoupon) : liters;
  const caltexEquivalent = caltexFinal * rebateFactor(config.hkCaltex.rebatePercent);

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

  const gdShellRmb = gdRate * liters;
  const gdShellFinal = gdCash(liters);

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

  const results: QuoteResult[] = [
    make(
      "hk-shell",
      config.hkShell.fuel === "premium" ? "香港 Shell V-Power" : "香港 Shell FuelSave",
      "Shell",
      "#facc15",
      shellFinal,
      shellBase * liters,
      hkPriceScope(config.hkShell.manualPrice, live, "shell", config.hkShell.fuel),
      hkPriceLabel(config.hkShell.manualPrice, live, "shell", config.hkShell.fuel),
      undefined,
      hkPriceScope(config.hkShell.manualPrice, live, "shell", config.hkShell.fuel) === "api" ? "live" : hkPriceScope(config.hkShell.manualPrice, live, "shell", config.hkShell.fuel) === "manual" ? "manual" : "fallback",
      hkPriceScope(config.hkShell.manualPrice, live, "shell", config.hkShell.fuel) === "api" ? live.updatedAt : undefined,
      undefined,
      shellBase * liters - shellFinal,
      [
        { label: "牌價", value: `HK$ ${shellBase.toFixed(2)}/L` },
        { label: "直減", value: `HK$ ${shellRule.cash.toFixed(2)}/L` },
        { label: "實付", value: `HK$ ${(shellFinal / liters).toFixed(2)}/L` },
      ],
    ),
    make(
      "hk-caltex",
      config.hkCaltex.fuel === "premium" ? "香港加德士白金" : "香港加德士黃金",
      "加德士",
      "#ef4444",
      caltexFinal,
      caltexBase * liters,
      hkPriceScope(config.hkCaltex.manualPrice, live, "caltex", config.hkCaltex.fuel),
      hkPriceLabel(config.hkCaltex.manualPrice, live, "caltex", config.hkCaltex.fuel),
      undefined,
      hkPriceScope(config.hkCaltex.manualPrice, live, "caltex", config.hkCaltex.fuel) === "api" ? "live" : hkPriceScope(config.hkCaltex.manualPrice, live, "caltex", config.hkCaltex.fuel) === "manual" ? "manual" : "fallback",
      hkPriceScope(config.hkCaltex.manualPrice, live, "caltex", config.hkCaltex.fuel) === "api" ? live.updatedAt : undefined,
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
      `${CITY_LABELS[gdShellCity]} Shell 98#`,
      `${CITY_LABELS[gdShellCity]} Shell`,
      "#10b981",
      gdShellFinal,
      gdShellBase * liters * fx,
      config.gdShell.manualPrice ? "manual" : shellCityPrice.source,
      gdPriceLabel(config.gdShell.manualPrice, shellCityPrice.stale, shellCityPrice.source, gdShellCity),
      gdDisplayCity(config.gdShell.manualPrice, shellCityPrice.source, gdShellCity),
      gdPriceScope(config.gdShell.manualPrice, shellCityPrice.source),
      config.gdShell.manualPrice
        ? undefined
        : snapshot.cities[citySnapshotKey(gdShellCity)]?.price_date ?? snapshot.updated_hkt,
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

  const dateRules: Partial<Record<StationId, string>> = {
    "hk-shell": shellDateRuleLabel(config.date, config.hkShell.offerDay),
    "hk-cnpc": cnpcDateRuleLabel(config.date, config.hkCnpc.discountOverride),
    "hk-sinopec": hkSinopecDateRuleLabel(config.date, config.hkSinopec),
    "gd-shell": config.gdShell.discountOverride === undefined ? gdShellDateRuleLabel(config.date) : "手動套用優惠",
  };
  return results.map((quote) => ({
    ...quote,
    cashHkd: quote.totalHkd,
    equivalentHkd: quote.stationId === "hk-shell" ? shellEquivalent : quote.stationId === "hk-caltex" ? caltexEquivalent : quote.totalHkd,
    dateRuleLabel: dateRules[quote.stationId],
  }));
}

const rebateFactor = (percent: number) => 1 - Math.min(100, money(percent)) / 100;

function hkPriceScope(manual: number | undefined, live: LivePrices, brand: "shell" | "caltex", fuel: "standard" | "premium") {
  return manual !== undefined ? "manual" : live.loaded && !live.fallbackGrades?.[brand]?.includes(fuel) ? "api" : "fallback";
}

function hkPriceLabel(...args: Parameters<typeof hkPriceScope>) {
  const scope = hkPriceScope(...args);
  return scope === "manual" ? "手動價格" : scope === "api" ? "香港公開牌價" : "內建備用價";
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
