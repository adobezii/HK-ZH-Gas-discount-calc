import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultConfig } from "./data";
import { loadConfig, saveConfig } from "./storage";

describe("dashboard storage", () => {
  beforeEach(() => localStorage.clear());

  it("還原 v2 設定", () => {
    const config = createDefaultConfig();
    config.globalCity = "shenzhen";
    config.gdShell.binding = { mode: "override", city: "guangzhou" };
    saveConfig(config);
    expect(loadConfig()).toMatchObject({
      globalCity: "shenzhen",
      gdShell: { binding: { mode: "override", city: "guangzhou" } },
    });
  });

  it("舊版數字手動價會遷移成結構化狀態", () => {
    const legacy = createDefaultConfig() as unknown as Record<string, unknown>;
    legacy.schemaVersion = 1;
    legacy.gdShell = {
      binding: { mode: "follow-global" },
      overrideCity: "zhuhai",
      includeToll: true,
      manualPrice: 10.5,
    };
    localStorage.setItem("hkzh.dashboard.v3", JSON.stringify(legacy));
    expect(loadConfig().gdShell.manualPrice).toEqual({
      value: 10.5,
      scope: "manual",
      label: "手動價格",
    });
  });
});
