import { useId, useState } from "react";
import { litersForTarget } from "../calc";
import { citySnapshot } from "../data";
import type { DashboardConfig, LivePrices, StationId } from "../types";

export function FillTarget({ config, live, station, setConfig }: {
  config: DashboardConfig;
  live: LivePrices;
  station: StationId;
  setConfig: (config: DashboardConfig) => void;
}) {
  const id = useId();
  const [mode, setMode] = useState<"gross" | "cash" | "coupons">("gross");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");

  return <div className="field full fill-target">
    <label htmlFor={`${id}-mode`}>入油目標</label>
    <div className="inline-actions">
      <select id={`${id}-mode`} className="select" value={mode} onChange={(event) => {
        setMode(event.target.value as typeof mode);
        setAmount("");
        setMessage("");
      }}>
        <option value="gross">油錶金額</option>
        <option value="cash">折實金額</option>
        {station === "hk-caltex" ? <option value="coupons">目標券數</option> : null}
      </select>
      <label className="field" htmlFor={`${id}-amount`}>
        {mode === "coupons" ? "張數" : station === "gd-shell" ? "金額（¥）" : "金額（HK$）"}
        <input id={`${id}-amount`} className="input" type="number" min={mode === "coupons" ? 1 : 0.01} step={mode === "coupons" ? 1 : 0.01} value={amount} onChange={(event) => setAmount(event.target.value)} />
      </label>
      <button className="button subtle pressable" type="button" onClick={() => {
        const value = Number(amount);
        const budget = station === "gd-shell" ? value * config.fx : value;
        const liters = litersForTarget(config, live, citySnapshot, station, mode, budget);
        if (liters === null) {
          setMessage(mode === "coupons" ? "沒有相容油券，或券數無法在 100 L 內用完。" : "此金額不足以入油 0.01 L。");
          return;
        }
        setConfig({ ...config, liters, hkCaltex: mode === "coupons" ? { ...config.hkCaltex, couponLimit: value } : config.hkCaltex });
        setMessage(`已套用 ${liters.toFixed(2)} L`);
      }}>套用升數</button>
    </div>
    <span className="status-line" role="status">{message}</span>
  </div>;
}
