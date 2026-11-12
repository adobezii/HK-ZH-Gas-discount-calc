import { createDefaultConfig } from "./data";
import type {
  DashboardConfig,
  GdPriceOverride,
  GdShellConfig,
  GdSinopecConfig,
} from "./types";

const STORAGE_KEY = "hkzh.dashboard.v3";

export function loadConfig(): DashboardConfig {
  const defaults = createDefaultConfig();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Omit<
      Partial<DashboardConfig>,
      "schemaVersion"
    > & { schemaVersion?: number };
    if (![1, 2, 3].includes(parsed.schemaVersion ?? 0)) return defaults;
    const migrateManualPrice = (
      value: number | GdPriceOverride | undefined,
    ): GdPriceOverride | undefined => {
      if (value === undefined) return undefined;
      if (typeof value === "number") {
        return { value, scope: "manual", label: "手動價格" };
      }
      return value;
    };
    const gdShell: Partial<GdShellConfig> = {
      ...defaults.gdShell,
      ...(parsed.gdShell as Partial<GdShellConfig> | undefined),
    };
    const gdSinopec: Partial<GdSinopecConfig> = {
      ...defaults.gdSinopec,
      ...(parsed.gdSinopec as Partial<GdSinopecConfig> | undefined),
    };
    gdShell.manualPrice = migrateManualPrice(
      (parsed.gdShell as Partial<GdShellConfig> | undefined)?.manualPrice,
    );
    gdSinopec.manualPrice = migrateManualPrice(
      (parsed.gdSinopec as Partial<GdSinopecConfig> | undefined)?.manualPrice,
    );
    return {
      ...defaults,
      ...parsed,
      schemaVersion: 3,
      dateMode: parsed.dateMode ?? "auto",
      hkShell: { ...defaults.hkShell, ...parsed.hkShell },
      hkCaltex: { ...defaults.hkCaltex, ...parsed.hkCaltex },
      hkCnpc: { ...defaults.hkCnpc, ...parsed.hkCnpc },
      hkSinopec: { ...defaults.hkSinopec, ...parsed.hkSinopec },
      gdShell: gdShell as GdShellConfig,
      gdSinopec: gdSinopec as GdSinopecConfig,
    };
  } catch {
    return defaults;
  }
}

export function saveConfig(config: DashboardConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // 私隱模式或儲存空間不足時仍可即時計算。
  }
}

export function clearConfig() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略不可用的瀏覽器儲存。
  }
}
