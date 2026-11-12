import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createDefaultConfig } from "../data";
import { Controls } from "./Controls";
import type { DashboardModel } from "../useDashboard";

function model(): DashboardModel {
  const config = createDefaultConfig();
  return {
    config,
    setConfig: vi.fn(),
    live: {
      loaded: false,
      source: "fallback",
      shell: { premium: 36.32, standard: 34.52 },
      caltex: { premium: 36.52, standard: 34.72 },
      cnpc: 36.52,
      sinopec: { premium: 36.52, standard: 34.72 },
      cards: [],
      coupons: [],
    },
    status: "ready",
    quotes: [],
    best: {} as DashboardModel["best"],
    refreshLive: vi.fn(),
    resetAll: vi.fn(),
  };
}

describe("global controls", () => {
  it("城市預設珠海並可切換深圳", async () => {
    const value = model();
    render(<Controls model={value} />);
    const city = screen.getByLabelText("全域大陸城市") as HTMLSelectElement;
    expect(city.value).toBe("zhuhai");
    await userEvent.selectOptions(city, "shenzhen");
    expect(value.setConfig).toHaveBeenCalledWith(
      expect.objectContaining({ globalCity: "shenzhen" }),
    );
  });

  it("包含六站共用日期控制", () => {
    render(<Controls model={model()} />);
    expect(screen.getByLabelText("加油日期")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重設" })).toBeInTheDocument();
  });
});
