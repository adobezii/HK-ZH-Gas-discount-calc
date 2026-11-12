import { cityPrice } from "./calc";
import { citySnapshot } from "./data";
import type { City } from "./types";

export type MainlandSource =
  | "snapshot"
  | "apihz"
  | "showapi"
  | "istero"
  | "mxnzp";

export interface MainlandCredentials {
  id?: string;
  key?: string;
}

function find98(value: unknown): number | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = find98(item);
      if (found !== null) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  for (const [key, item] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[_\- ]/g, "");
    if (["p98", "98", "t98", "price98", "oil98", "no98"].includes(normalized)) {
      const parsed = Number(item);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    if (item && typeof item === "object") {
      const found = find98(item);
      if (found !== null) return found;
    }
  }
  return null;
}

async function fetchJson(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    window.clearTimeout(timer);
  }
}

export async function fetchMainlandPrice(
  source: MainlandSource,
  city: City,
  credentials: MainlandCredentials,
): Promise<{ price: number; cityScoped: boolean; label: string }> {
  if (source === "snapshot") {
    const entry = cityPrice(city, citySnapshot);
    return {
      price: entry.price,
      cityScoped: entry.source === "snapshot",
      label: `${city} 98# 每日快照${entry.stale ? "（上次成功值）" : ""}`,
    };
  }

  let payload: unknown;
  if (source === "apihz") {
    if (!credentials.id || !credentials.key) throw new Error("請填寫開發者 ID 與 KEY");
    const query = new URLSearchParams({
      id: credentials.id,
      key: credentials.key,
      sheng: "广东",
    });
    payload = await fetchJson(
      `https://cn.apihz.cn/api/jinrong/youjia.php?${query}`,
    );
  } else if (source === "showapi") {
    if (!credentials.key) throw new Error("請填寫 APPCODE");
    payload = await fetchJson(
      `https://ali-todayoil.showapi.com/todayoil?prov=${encodeURIComponent("广东")}`,
      { headers: { Authorization: `APPCODE ${credentials.key}` } },
    );
  } else if (source === "istero") {
    if (!credentials.key) throw new Error("請填寫起零數據 token");
    payload = await fetchJson(
      `https://api.istero.com/resource/v2/oilprice?token=${encodeURIComponent(credentials.key)}&keyword=${encodeURIComponent("广东")}`,
    );
  } else {
    if (!credentials.id || !credentials.key) {
      throw new Error("請填寫 app_id 與 app_secret");
    }
    const query = new URLSearchParams({
      province: "广东",
      app_id: credentials.id,
      app_secret: credentials.key,
    });
    payload = await fetchJson(
      `https://www.mxnzp.com/api/oil/search?${query}`,
    );
  }

  const price = find98(payload);
  if (price === null) throw new Error("回應沒有可解析的 98# 價格");
  return { price, cityScoped: false, label: "廣東全省" };
}
