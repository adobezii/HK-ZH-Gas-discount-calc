import { createDefaultConfig } from "./data";
import type { DashboardConfig } from "./types";

const STORAGE_KEY = "hkzh.dashboard.v3";

export function loadConfig(): DashboardConfig {
  const defaults = createDefaultConfig();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<DashboardConfig>;
    if (parsed.schemaVersion !== 1) return defaults;
    return {
      ...defaults,
      ...parsed,
      hkShell: { ...defaults.hkShell, ...parsed.hkShell },
      hkCaltex: { ...defaults.hkCaltex, ...parsed.hkCaltex },
      hkCnpc: { ...defaults.hkCnpc, ...parsed.hkCnpc },
      hkSinopec: { ...defaults.hkSinopec, ...parsed.hkSinopec },
      gdShell: { ...defaults.gdShell, ...parsed.gdShell },
      gdSinopec: { ...defaults.gdSinopec, ...parsed.gdSinopec },
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
