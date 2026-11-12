import { useEffect, useMemo, useState } from "react";
import { calculateQuotes } from "./calc";
import { citySnapshot, createDefaultConfig } from "./data";
import {
  fallbackLivePrices,
  fetchLivePrices,
} from "./livePrices";
import { clearConfig, loadConfig, saveConfig } from "./storage";
import type { DashboardConfig, LivePrices } from "./types";

export type LiveStatus = "idle" | "loading" | "ready" | "error";

export function useDashboard() {
  const [config, setConfig] = useState<DashboardConfig>(loadConfig);
  const [live, setLive] = useState<LivePrices>(fallbackLivePrices);
  const [status, setStatus] = useState<LiveStatus>("idle");

  useEffect(() => {
    saveConfig(config);
  }, [config]);

  const refreshLive = async () => {
    setStatus("loading");
    try {
      setLive(await fetchLivePrices());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    void refreshLive();
  }, []);

  const quotes = useMemo(
    () => calculateQuotes(config, live, citySnapshot),
    [config, live],
  );
  const best = useMemo(
    () => quotes.reduce((winner, item) => (item.totalHkd < winner.totalHkd ? item : winner)),
    [quotes],
  );

  return {
    config,
    setConfig,
    live,
    status,
    quotes,
    best,
    refreshLive,
    resetAll: () => {
      clearConfig();
      setConfig(createDefaultConfig());
    },
  };
}

export type DashboardModel = ReturnType<typeof useDashboard>;
