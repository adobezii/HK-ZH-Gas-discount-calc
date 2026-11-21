import { CITY_OPTIONS } from "../types";
import { MAX_LITERS, MIN_LITERS } from "../calc";
import type { DashboardModel } from "../useDashboard";

interface Props {
  model: DashboardModel;
}

export function Controls({ model }: Props) {
  const { config, setConfig, status, refreshLive, resetAll } = model;

  return (
    <section className="panel controls" aria-label="全域計算條件">
      <label className="field">
        <span>入油升數（L）</span>
        <input
          className="input"
          type="number"
          min={MIN_LITERS}
          max={MAX_LITERS}
          step="0.01"
          value={config.liters || ""}
          onChange={(event) =>
            setConfig({
              ...config,
              liters: Math.min(MAX_LITERS, Math.max(0, Number(event.target.value))),
            })
          }
          onBlur={() => { if (config.liters < MIN_LITERS) setConfig({ ...config, liters: MIN_LITERS }); }}
        />
      </label>
      <label className="field">
        <span>CNY → HKD</span>
        <input
          className="input"
          type="number"
          min="0.01"
          step="0.005"
          value={config.fx}
          onChange={(event) =>
            setConfig({
              ...config,
              fx: Math.max(0.01, Number(event.target.value) || 1),
              fxMode: "manual",
            })
          }
        />
        {config.fxMode === "manual" ? <button className="button subtle pressable" type="button" onClick={() => setConfig({ ...config, fxMode: "auto" })}>恢復自動匯率</button> : null}
      </label>
      <label className="field">
        <span>全域大陸城市</span>
        <select
          className="select"
          value={config.globalCity}
          onChange={(event) =>
            setConfig({
              ...config,
              globalCity: event.target.value as typeof config.globalCity,
            })
          }
        >
          {CITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <div className="field">
        <div className="field-heading">
          <label htmlFor="fuel-date">加油日期</label>
          <label className="auto-date-toggle">
            <input
              type="checkbox"
              checked={config.dateMode === "auto"}
              onChange={(event) =>
                event.target.checked
                  ? model.useAutomaticDate()
                  : model.setManualDate(config.date)
              }
            />
            自動今日
          </label>
        </div>
        <input
          id="fuel-date"
          className="input"
          type="date"
          value={config.date}
          onChange={(event) => model.setManualDate(event.target.value)}
        />
      </div>
      <div className="vehicle-presets field">
        <span>亮油燈後參考油量</span>
        <div className="inline-actions">
          {[["大霸王", 65], ["BMW M5 (F10)", 70], ["BMW 640i (F06)", 60]].map(([name, liters]) => (
            <button key={name} className="button subtle pressable" type="button" onClick={() => setConfig({ ...config, liters: Number(liters) })}>{name} · {liters} L</button>
          ))}
        </div>
      </div>
      <label className="checkbox-row toll-toggle">
        <input type="checkbox" checked={config.gdShell.includeToll} onChange={(event) => setConfig({ ...config, gdShell: { ...config.gdShell, includeToll: event.target.checked } })} />
        計入來回路費 ¥285
      </label>
      <div className="inline-actions">
        <button
          className="button subtle pressable"
          type="button"
          onClick={() => void refreshLive()}
          disabled={status === "loading"}
        >
          {status === "loading" ? "更新中…" : "更新香港價"}
        </button>
        <button className="button subtle pressable" type="button" onClick={resetAll}>
          重設
        </button>
      </div>
    </section>
  );
}
