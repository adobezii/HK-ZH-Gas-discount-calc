export type City = "zhuhai" | "shenzhen" | "guangzhou";

export type CityBinding =
  | { mode: "follow-global" }
  | { mode: "override"; city: City };

export type StationId =
  | "hk-shell"
  | "hk-caltex"
  | "hk-cnpc"
  | "hk-sinopec"
  | "gd-shell"
  | "gd-sinopec";

export type QuoteSource = "snapshot" | "api" | "manual" | "fallback";

export interface ShellConfig {
  fuel: "premium" | "standard";
  offerDay: "auto" | "wed" | "weekend" | "weekday";
  includePoints: boolean;
  couponMin: number;
  couponValue: number;
  rebatePercent: number;
  manualPrice?: number;
}

export interface CaltexConfig {
  fuel: "premium" | "standard";
  cardId: string;
  couponId: string;
  rebatePercent: number;
  manualPrice?: number;
}

export interface CnpcConfig {
  eligible: boolean;
  discountOverride?: number;
  manualPrice?: number;
}

export interface HkSinopecConfig {
  fuel: "premium" | "standard";
  member: boolean;
  includePoints: boolean;
  discountOverride?: number;
  manualPrice?: number;
}

export interface GdShellConfig {
  binding: CityBinding;
  overrideCity: City;
  includeToll: boolean;
  manualPrice?: number;
}

export interface GdSinopecConfig {
  binding: CityBinding;
  overrideCity: City;
  discountPerLiter: number;
  cardFee: number;
  includeToll: boolean;
  manualPrice?: number;
}

export interface DashboardConfig {
  schemaVersion: 1;
  liters: number;
  fx: number;
  globalCity: City;
  date: string;
  hkShell: ShellConfig;
  hkCaltex: CaltexConfig;
  hkCnpc: CnpcConfig;
  hkSinopec: HkSinopecConfig;
  gdShell: GdShellConfig;
  gdSinopec: GdSinopecConfig;
}

export interface CaltexCard {
  id: string;
  type: string;
  description: string;
  standardDiscount: number;
  premiumDiscount: number;
}

export interface CaltexCoupon {
  id: string;
  description: string;
  spend: number;
  discount: number;
  validCardType?: string | string[];
  validFor?: Array<"standard" | "premium">;
}

export interface LivePrices {
  loaded: boolean;
  source: "crawler" | "fallback";
  updatedAt?: string;
  shell: { premium: number; standard: number };
  caltex: { premium: number; standard: number };
  cnpc: number;
  sinopec: { premium: number; standard: number };
  cards: CaltexCard[];
  coupons: CaltexCoupon[];
}

export interface CityPriceSnapshot {
  updated: string;
  updated_hkt: string;
  source: string;
  cities: Record<string, { name: string; p98: number; stale?: boolean }>;
}

export interface QuoteResult {
  stationId: StationId;
  name: string;
  shortName: string;
  accent: string;
  city?: City;
  unitPriceHkd: number;
  totalHkd: number;
  grossHkd: number;
  savingHkd: number;
  discountPerLiterHkd: number;
  source: QuoteSource;
  sourceLabel: string;
  isWinner: boolean;
  breakdown: Array<{ label: string; value: string }>;
}

export interface StationMeta {
  id: StationId;
  name: string;
  shortName: string;
  accent: string;
  category: "hk" | "gd";
}

export const CITY_LABELS: Record<City, string> = {
  zhuhai: "珠海",
  shenzhen: "深圳",
  guangzhou: "廣州",
};

export const CITY_OPTIONS: Array<{ value: City; label: string }> = [
  { value: "zhuhai", label: "珠海" },
  { value: "shenzhen", label: "深圳" },
  { value: "guangzhou", label: "廣州" },
];

export const STATIONS: StationMeta[] = [
  { id: "hk-shell", name: "香港 Shell", shortName: "Shell", accent: "#facc15", category: "hk" },
  { id: "hk-caltex", name: "香港加德士", shortName: "加德士", accent: "#ef4444", category: "hk" },
  { id: "hk-cnpc", name: "香港中石油", shortName: "中石油", accent: "#f97316", category: "hk" },
  { id: "hk-sinopec", name: "香港中石化", shortName: "港中石化", accent: "#06b6d4", category: "hk" },
  { id: "gd-shell", name: "廣東 Shell", shortName: "粵 Shell", accent: "#10b981", category: "gd" },
  { id: "gd-sinopec", name: "廣東中石化", shortName: "粵中石化", accent: "#3b82f6", category: "gd" },
];
